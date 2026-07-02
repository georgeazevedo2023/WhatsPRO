---
title: "PRD Modelo — Disparador de Mensagens WhatsApp (Broadcast)"
type: prd
updated: 2026-07-02
sources: [implementação real WhatsPRO v7.103.0]
---

# PRD — Disparador de Mensagens WhatsApp

> **Modelo reutilizável** extraído da implementação REAL do WhatsPRO (2026-07-02).
> Cobre broadcast por grupos e por leads, 4 tipos de mensagem (texto, mídia,
> **carrossel**, enquete), importação multi-fonte, agendamento com recorrência,
> anti-ban e relatórios. Stack de referência: React + Supabase (Postgres/Storage/
> Edge Functions) + UAZAPI (gateway WhatsApp).

---

## 1. Visão

Permitir que uma empresa envie mensagens em massa pelo WhatsApp — para **grupos**
ou **listas de leads** — com composição rica (texto, mídia, carrossel de produtos
com botões, enquete), agendamento recorrente, proteção anti-ban e histórico
auditável, sem sair do CRM.

**Problema que resolve:** campanhas manuais (copiar/colar contato a contato) não
escalam, não têm relatório e derrubam o número por comportamento robótico.

## 2. Personas e casos de uso (exemplos reais)

| Persona | Caso de uso |
|---|---|
| Gestor da loja | Promoção de sábado: carrossel com 5 pisos em oferta + botão "Eu quero" pra base de 500 leads que já compraram |
| Vendedor | Aviso rápido num grupo de clientes: "chegou o porcelanato 60x60" com foto |
| Marketing | Enquete "qual cor de tinta você prefere?" agendada pra toda segunda 9h |
| Gestor | Importar a planilha de clientes do balcão (CSV) e disparar boas-vindas |

## 3. Escopo funcional

### F1 — Seleção de instância e audiência
- Wizard em 3 passos: **instância → audiência → mensagem**.
- Duas rotas: **Broadcast por grupos** (multi-select dos grupos da instância, com
  opção "excluir admins" que converte o envio pra individual por membro) e
  **Broadcast por leads** (seleção de uma base + subset de contatos).

### F2 — Bases de leads e importação multi-fonte
- CRUD de bases (`lead_databases`, contador desnormalizado + RPC de recálculo).
- **4 fontes de importação:** Colar números (delimitadores automáticos: quebra de
  linha, vírgula, ponto-e-vírgula, tab; aceita `nome - 11999999999`), CSV
  (detecção automática de delimitador e headers), arquivo .vcf (parser de vCard,
  máx 10 MB) e extração de membros de grupos (não-admins, preserva o grupo de
  origem). Dedup por telefone em todas.
- **Verificação de números** (async): status pending/valid/invalid/error +
  `verified_name` retornado pelo WhatsApp; ações "remover inválidos" /
  "selecionar só válidos".
- **Gestão:** mover/copiar contatos entre bases e merge de bases com dedup
  (RPCs `move_lead_entries`, `merge_lead_databases`).
- **Auto-cadastro:** todo lead que manda mensagem no Helpdesk entra sozinho na
  base da instância (RPC de enroll no webhook, fire-and-forget) com **rede de
  segurança**: cron de reconciliação a cada 2 min varre quem ficou de fora
  (lição: fire-and-forget sem retry deixa lead de mensagem única escapar).

### F3 — Composição (4 tipos de mensagem)
- **Texto** (máx 4.096 chars) com preview.
- **Mídia**: imagem (jpeg/png/gif/webp), vídeo (mp4), áudio (mpeg/ogg/mp3/wav),
  documento; máx 10 MB; caption + filename.
- **Carrossel** (ver §4).
- **Enquete**: pergunta + 2-12 opções + single/multi-select; imagem opcional
  ANTES da enquete (limitação de protocolo: não dá pra embutir imagem —
  envia-se um send-media, aguarda 1,5 s, depois a enquete).
- **Templates** reutilizáveis (TemplateSelector).

### F4 — Envio, anti-ban e controle
- Loop de envio com **delay configurável pelo usuário**: fixo 350 ms
  (`none`) ou aleatório **5-10 s** / **10-20 s** entre contatos (anti-ban);
  500 ms base entre grupos.
- **Modal de progresso em tempo real** (contato atual/total, grupo, tempo
  estimado) com **Pausar / Retomar / Cancelar**.
- Cada envio individual é **espelhado no Helpdesk** como mensagem de saída
  (INSERT + broadcast realtime) — o atendente vê a campanha no histórico do lead.

### F5 — Agendamento com recorrência
- Data/hora + recorrência `daily | weekly | monthly | custom` (intervalo, dias
  da semana, data-fim ou nº de execuções).
- Worker (edge function em cron) faz **claim atômico** de até 50 mensagens
  devidas via RPC com `FOR UPDATE SKIP LOCKED` (impede envio duplicado entre
  execuções concorrentes), envia, recalcula `next_run_at`, grava log por
  execução e mantém retry (`attempts`/`max_retries=3`).
- Cron auxiliar re-enfileira mensagens travadas em `processing` (timeout).
- Mídia agendada referencia **URL** (não arquivo local).

### F6 — Histórico e relatórios
- `broadcast_logs`: tipo, alvo (grupos/contatos), sucesso/falha por destinatário,
  duração, config usada (excluir admins, delay), status
  (completed/cancelled/error) e o **carousel_data completo** (auditoria visual).
- `scheduled_message_logs`: por execução — success/partial/failed + contadores.
- Página de histórico com filtros por tipo/status/data.

## 4. Carrossel — especificação detalhada

**Estrutura:** mensagem geral + **2 a 10 cards**; cada card tem **imagem
obrigatória**, texto e até **3 botões** de tipos `URL` (abre link), `REPLY`
(resposta rápida) e `CALL` (ligação).

**Pipeline de imagem (as 3 lições que custaram caro):**
1. **NUNCA enviar imagem em base64** — o gateway (UAZAPI) transcodifica pra JPEG
   e rejeita base64/HEIC com `unsupported image format`. O caminho é: upload ao
   Storage (bucket público `carousel-images`) → enviar a **URL pública** no
   payload do carrossel.
2. **Upload 1x, memoizado por arquivo** — o envio roda por destinatário; sem
   memoização, o MESMO arquivo era re-uploadado a cada lead (N leads = N objetos
   + N downloads frios pelo gateway = egress explosivo). O upload é cacheado por
   `File` e todos os destinatários reusam a mesma URL.
3. **`cacheControl` de 30 dias** no objeto — o gateway baixa a mesma URL pra
   cada destinatário; com cache curto toda campanha era 100% cache-miss.
   Retenção: cron de limpeza remove objetos >30 dias do bucket.

**Envio:** action `send-carousel` → POST `/send/carousel` com
`{number, message, carousel: [{text, image, buttons}]}`, por destinatário, dentro
do loop com delay anti-ban. Fallback e validação de formato ficam no proxy.

**Espelho:** o carrossel enviado também é salvo no Helpdesk (com as URLs já
resolvidas) e o `carousel_data` vai pro log da campanha.

## 5. Modelo de dados (essência)

| Tabela | Papel | Colunas-chave |
|---|---|---|
| `lead_databases` | Bases de leads | user_id, name, leads_count (desnorm.) |
| `lead_database_entries` | Contatos | database_id, phone, name, jid, source (paste/csv/vcf/group/manual), verification_status, verified_name; índice (database_id, phone) |
| `scheduled_messages` | Agendamentos | recipients JSONB, message_type, content, media_url, scheduled_at, next_run_at, is_recurring, recurrence_* (type/interval/days[]/end_at/count), status (pending/processing/completed/failed/cancelled/paused), attempts, max_retries |
| `scheduled_message_logs` | Log por execução | status (success/partial/failed), recipients_total/success/failed |
| `broadcast_logs` | Log por campanha | message_type, groups_targeted, recipients_success/failed, exclude_admins, random_delay, duration_seconds, carousel_data JSONB, status |

RLS: cada usuário gerencia as próprias bases/agendamentos; super_admin vê tudo.

## 6. Integração com o gateway (UAZAPI via edge function proxy)

Toda chamada passa por um **proxy server-side** (edge function): valida o JWT do
usuário, resolve o token da instância (checando acesso do usuário à instância) e
só então chama o gateway — o token da instância **nunca** vai ao browser.

| Action | Endpoint | Payload |
|---|---|---|
| send-message | POST /send/text | number, text |
| send-media | POST /send/media | number, mediaUrl (URL!), mediaType, caption, filename |
| send-carousel | POST /send/carousel | number, message, carousel[{text, image URL, buttons}] |
| send-poll | POST /send/poll | number, question, options[], selectableCount |
| groups / group-info | GET/POST /group/* | listagem e membros p/ audiência |

## 7. Limites e constantes (valores de referência)

| Item | Valor |
|---|---|
| Mensagem de texto | 4.096 chars |
| Arquivo de mídia / .vcf | 10 MB |
| Cards por carrossel | 2 a 10 |
| Botões por card | 3 (URL/REPLY/CALL) |
| Opções de enquete | 2 a 12 |
| Delay entre contatos | 350 ms fixo ou 5-10 s / 10-20 s aleatório |
| Delay entre grupos | 500 ms |
| Batch do worker de agendados | 50 por claim |
| Retry de agendados | 3 tentativas |

## 8. Requisitos não-funcionais

- **Anti-ban:** delays aleatórios opt-in; envio individual sequencial (nunca
  paralelo no mesmo número); espelho no helpdesk mantém contexto humano.
- **Idempotência:** claim com SKIP LOCKED + requeue de travados; dedup de
  contatos por telefone em toda importação.
- **Segurança:** proxy server-side (token da instância fora do browser), RLS por
  dono, RPCs de manutenção com REVOKE de anon/public.
- **Custo/egress:** imagem sobe 1x e é servida com cache longo; retenção de 30
  dias no bucket de campanha; logs operacionais com purga periódica.

## 9. Armadilhas conhecidas (aprendidas em produção)

1. Base64 e HEIC **não passam** no gateway — sempre URL pública + conversão
   client-side de HEIC→JPEG por magic bytes (não por `file.type`, que vem vazio
   no mobile).
2. Upload dentro do loop por destinatário multiplica storage e egress — memoizar
   por arquivo NA FONTE (função de upload), não em cada call site.
3. Fire-and-forget de cadastro sem reconciliação deixa lead escapar — todo
   caminho crítico assíncrono precisa de cron de rede de segurança idempotente.
4. `upsert` do PostgREST com `ON CONFLICT` em índice parcial falha sempre
   (42P10) — conflito parcial vai pra RPC SECURITY DEFINER.
5. Worker de fila sem claim atômico duplica envio — `FOR UPDATE SKIP LOCKED`
   é obrigatório com cron concorrente.

## 10. Métricas de sucesso

- Taxa de entrega por campanha (success/targeted) ≥ 95%.
- Zero banimentos de número atribuíveis a disparo (delays respeitados).
- 100% dos leads ativos do Helpdesk presentes na base da instância (reconciliação).
- Relatório disponível por campanha e por execução agendada.
