---
title: Broadcast — Execucao e Operacao
tags: [broadcast, agendamento, delay, progresso, historico, instancia, componentes, detalhado]
sources: [src/hooks/useBroadcastSend.ts, src/components/broadcast/BroadcastSendControls.tsx, src/components/broadcast/BroadcastProgressModal.tsx, src/components/broadcast/BroadcastHistory.tsx]
updated: 2026-05-04
---

# Broadcast — Execucao e Operacao

> Esta sub-wiki cobre **quando e como o broadcast e disparado**: agendamento, delay anti-ban, progresso em tempo real, selecao de instancia, e historico completo. Inclui tambem a arvore de componentes e tabelas do banco. Para **o que enviar** ver [[wiki/casos-de-uso/broadcast-conteudo]]; para **para quem** ver [[wiki/casos-de-uso/broadcast-audiencia]].

---

## 6.5 Agendamento de Envio

**O que e:** Em vez de enviar imediatamente, voce pode agendar para uma data e hora especificas. A mensagem fica salva e e disparada automaticamente no horario programado.

**Opcoes:**
- **Envio imediato** — clica "Enviar" e comeca na hora
- **Envio agendado** — escolhe data e hora, clica "Agendar"
- **Carrossel e enquete** — agendamento ainda nao suportado (so envio imediato)

**Cenario:** Gerente prepara broadcast na quinta-feira → agenda para sexta 8h → sistema dispara automaticamente na sexta de manha, sem ninguem precisar estar no computador.

> **Tecnico:** Dialog `ScheduleMessageDialog`. Funcoes `scheduleText()` e `scheduleMedia()` no hook `useBroadcastSend`. Carousel/poll: toast error "Agendamento de carrossel nao suportado ainda". Agendamento usa edge function `process-scheduled-messages`.

---

## 6.6 Delay Aleatorio (Anti-Ban)

**O que e:** Para evitar que o WhatsApp bloqueie o numero por envio em massa, o sistema adiciona um **intervalo aleatorio** entre cada mensagem enviada. Isso faz parecer envio humano, nao automatizado.

**3 opcoes de delay:**
- **Nenhum** — envia o mais rapido possivel (350ms entre cada)
- **5-10 segundos** — intervalo aleatorio de 5 a 10 segundos entre cada envio
- **10-20 segundos** — intervalo mais seguro de 10 a 20 segundos

**Delay base fixo:**
- 350ms entre cada destinatario (dentro de um grupo)
- 500ms entre cada grupo

**Cenario:** 300 leads com delay 10-20s → tempo estimado: ~75 minutos. O sistema mostra o tempo estimado antes de enviar, e durante o envio mostra o tempo restante.

> **Tecnico:** Constantes em `broadcastSender.ts`: `SEND_DELAY_MS = 350`, `GROUP_DELAY_MS = 500`. Funcao `getRandomDelay()` retorna delay aleatorio no range selecionado. Estado `randomDelay` em `BroadcastSendControls.tsx`. Opcoes: 'none' | '5-10' | '10-20'. Tempo estimado calculado antes do envio. Timer real-time durante envio.

---

## 6.7 Progresso de Envio em Tempo Real

**O que e:** Durante o envio, aparece uma janela modal mostrando o progresso em tempo real — quantos ja foram enviados, quantos faltam, tempo decorrido, tempo estimado restante, e opcoes de pausar ou cancelar.

**O que mostra:**
- **Barra de progresso** com porcentagem (ex: "67% — 201 de 300")
- **Grupo atual** — em qual grupo esta enviando (modo grupos)
- **Destinatario atual** — em qual numero esta enviando
- **Tempo decorrido** — quanto tempo ja passou (ex: "23m 15s")
- **Tempo restante** — estimativa de quanto falta (ex: "~11m")
- **Resultados** — lista de grupos/leads com status (sucesso ou erro)

**Controles:**
- **Pausar** — para o envio temporariamente, pode retomar depois
- **Retomar** — continua de onde parou
- **Cancelar** — para definitivamente (o que ja foi enviado nao volta)

**Cenarios:**
1. **Envio grande:** 500 leads com delay 10-20s. Modal mostra progresso, tempo estimado 2h30. Gerente pausa para almoco, retoma depois.
2. **Erro detectado:** Percebe que a mensagem tem erro de digitacao apos enviar 50 de 300. Cancela. 50 ja receberam, 250 nao.

> **Tecnico:** Componente `BroadcastProgressModal.tsx`. Interface `SendProgress` com: currentGroup, totalGroups, currentMember, totalMembers, groupName, status (idle|sending|paused|success|error|cancelled), results[], startedAt. Tempo: elapsed via setInterval(1s), remaining via media de velocidade. Pause/resume: flag no hook `useBroadcastSend`. Cancel: seta status='cancelled' e para o loop. Resultados: array de `{groupName, success, error?}`.

---

## 6.9 Selecao de Instancia (Qual Numero Enviar)

**O que e:** Se a empresa tem varios numeros de WhatsApp (ex: "Vendas", "Suporte", "Marketing"), voce escolhe de qual numero o broadcast sera enviado.

**Cenario:** Empresa tem 3 numeros: "Vendas" (Eletropiso), "Marketing" (Wsmart), "Suporte". Broadcast de promocao → seleciona "Marketing". Aviso interno → seleciona "Vendas".

> **Tecnico:** Componente `InstanceSelector.tsx`. Primeiro passo no workflow de broadcast. `BroadcasterHeader.tsx` mostra instancia selecionada. Instancia define quais grupos aparecem no `GroupSelector` e qual token UAZAPI e usado para envio.

---

## 6.10 Historico de Broadcasts

**O que e:** Registro completo de todos os broadcasts ja enviados. Funciona como um "diario" de tudo que foi disparado, com filtros, busca e opcao de reenviar.

**O que cada registro mostra:**
- Tipo da mensagem (texto/midia/carrossel/enquete)
- Conteudo (preview da mensagem)
- Data e hora de inicio e fim
- Duracao total do envio
- Quantidade de destinatarios: alvos, sucesso, falha
- Status: concluido, cancelado, erro
- Nome dos grupos ou listas de leads
- Instancia usada

**Filtros disponiveis:**
- Por status (concluido / cancelado / erro)
- Por tipo de mensagem (texto / midia / carrossel / enquete)
- Por destino (grupos / leads)
- Por instancia
- Por periodo (data inicio → data fim)
- Busca por conteudo

**Acoes:**
- **Reenviar** — reaproveita a mensagem e envia novamente (pode mudar destinatarios)
- **Excluir** — remove o registro (individual ou em lote)
- **Expandir** — ver detalhes completos do envio

**Cenario:** Gerente quer saber "quantos broadcasts fizemos em marco?". Filtra por periodo → ve 12 broadcasts. Clica em cada um para ver quantos leads receberam e quantos falharam.

> **Tecnico:** Componente `BroadcastHistory.tsx`, pagina `BroadcastHistoryPage.tsx`. Tabela `broadcast_logs` (user_id, instance_id, instance_name, message_type, content, media_url, carousel_data JSONB, groups_targeted, recipients_targeted, recipients_success, recipients_failed, exclude_admins, random_delay, status, started_at, completed_at, duration_seconds, error_message, group_names TEXT[]). Filtros: `BroadcastHistoryFilters.tsx`. Cards: `BroadcastLogCard.tsx`. Preview: `HistoryMessagePreview.tsx` + `HistoryCarouselPreview.tsx`. Delete: `BroadcastDeleteDialogs.tsx`. Resend: dialog com opcao grupos/leads, armazena dados em sessionStorage. Paginacao: 100 por pagina, sorted by created_at DESC. RLS: users veem proprios, super_admins veem todos.

---

## Arvore de Componentes

```
Broadcaster.tsx (modo grupos — /dashboard/broadcast)
+-- InstanceSelector.tsx (passo 1: escolher numero)
+-- GroupSelector.tsx (passo 2: escolher grupos)
|   +-- ParticipantSelector.tsx (excluir admins)
+-- BroadcastMessageForm.tsx (passo 3: compor mensagem)
|   +-- Tab Texto / Tab Midia / Tab Carrossel / Tab Enquete
+-- BroadcastSendControls.tsx (delay + enviar/agendar)
+-- BroadcastProgressModal.tsx (progresso tempo real)
+-- TemplateSelector.tsx (salvar/carregar templates)

LeadsBroadcaster.tsx (modo leads — /dashboard/broadcast/leads)
+-- LeadImporter.tsx (4 tabs: paste/csv/groups/manual)
+-- LeadDatabaseSelector.tsx (selecionar listas salvas)
+-- ContactsStep.tsx (verificacao + filtros)
+-- LeadMessageForm.tsx (compor mensagem)
+-- BroadcastProgressModal.tsx (progresso)

BroadcastHistoryPage.tsx (historico — /dashboard/broadcast/history)
+-- BroadcastHistory.tsx
    +-- BroadcastHistoryFilters.tsx
    +-- BroadcastLogCard.tsx
    +-- HistoryMessagePreview.tsx + HistoryCarouselPreview.tsx
    +-- BroadcastDeleteDialogs.tsx
```

> Detalhes completos do construtor de carrossel e do importador de leads ficam em [[wiki/casos-de-uso/broadcast-conteudo]] e [[wiki/casos-de-uso/broadcast-audiencia]] respectivamente.

---

## Tabelas do Banco

| Tabela | O que guarda |
|--------|--------------|
| `broadcast_logs` | Historico de broadcasts (tipo, conteudo, destinatarios, sucesso/falha, duracao, status) |
| `lead_databases` | Listas salvas de leads (nome, descricao, contagem) |
| `lead_database_entries` | Contatos dentro das listas (phone, name, jid, verificacao, fonte) |
| `message_templates` | Templates reutilizaveis (texto, midia, carrossel, enquete) |
| `poll_messages` | Enquetes enviadas (pergunta, opcoes, auto_tags, image_url) |
| `poll_responses` | Votos recebidos (voter_jid, selected_options[], voted_at) |

---

## Links Relacionados

- [[wiki/casos-de-uso/broadcast-detalhado]] — Indice das 12 sub-funcionalidades
- [[wiki/casos-de-uso/broadcast-conteudo]] — O que enviar (texto, midia, carrossel, enquete, templates)
- [[wiki/casos-de-uso/broadcast-audiencia]] — Para quem enviar (grupos, leads, listas, verificacao)
- [[wiki/casos-de-uso/ai-agent-detalhado]] — IA responde quando lead reage ao broadcast
