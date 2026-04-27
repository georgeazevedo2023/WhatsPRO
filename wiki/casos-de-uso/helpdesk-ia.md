---
title: Helpdesk — IA e Atendimento Inteligente
tags: [helpdesk, ai-agent, toggle-ia, shadow, transcricao, resumo, finalizacao, contexto-lead]
sources: [src/components/helpdesk/, src/pages/dashboard/HelpDesk.tsx, supabase/functions/]
updated: 2026-04-27
---

# Helpdesk — IA e Atendimento Inteligente (5 Sub-Funcionalidades)

> Parte do **Helpdesk (M2)** — sub-página dedicada à integração com o **AI Agent (M10)**: como ligar/desligar a IA, transcrever áudio, gerar resumo, finalizar tickets com contexto e ver o que a IA já aprendeu sobre o lead. Para o índice geral e outras áreas, ver [[wiki/casos-de-uso/helpdesk-detalhado]].

---

## 1.5 Toggle IA (Ligar/Desligar o Agente Inteligente)

**O que e:** Um botao no cabecalho do chat que **liga ou desliga a inteligencia artificial** para aquela conversa especifica. Quando ligada, a IA le as mensagens e responde automaticamente. Quando desligada, so o atendente humano responde.

**Como funciona na pratica:**
- No cabecalho do chat (segunda linha, ao lado do status), tem um botao arredondado:
  - **"IA Ativa"** (fundo azul, icone de robo) — significa que a IA esta respondendo
  - **"Ativar IA"** (contorno cinza, icone de robo) — IA esta desligada, so humano responde
- Um clique alterna entre os dois estados
- Ao passar o mouse sobre "IA Ativa", o botao fica vermelho ("desativar")

**Os 3 estados da IA numa conversa:**
1. **Ligada** — A IA responde automaticamente ao lead (busca produtos, qualifica, envia carrossel, etc.)
2. **Desligada** — A IA fica em silencio total. So o humano responde. Ativado manualmente ou quando o atendente envia uma mensagem.
3. **Sombra (Shadow)** — A IA **nao responde** ao lead, mas fica "escutando" a conversa e **extraindo dados automaticamente** (nome, cidade, interesses, objecoes). Ativado automaticamente apos a IA transferir para humano (handoff). Ver [[wiki/ai-agent]] para detalhes.

**Regra importante:** Quando o atendente humano **envia qualquer mensagem**, a IA e automaticamente desligada. Isso evita que os dois respondam ao mesmo tempo.

**Cenarios reais:**
1. **Fluxo normal:** Lead chega → IA responde automaticamente → qualifica → envia produtos → lead pede "quero falar com vendedor" → IA faz handoff e entra em modo Shadow → atendente assume.
2. **Conversa delicada:** Gerente abre conversa de reclamacao formal → desliga a IA manualmente → responde pessoalmente com cuidado.
3. **Reativar IA:** Depois que o atendente resolve e finaliza, um novo lead manda mensagem no mesmo numero → atendente liga a IA de volta.
4. **Shadow silencioso:** Apos handoff, enquanto o vendedor negocia por 20 minutos, a IA em Shadow extrai automaticamente: "cidade:campinas", "orcamento:alto", "interesse:pintura-completa". Quando o vendedor abre o perfil do lead, os dados ja estao la.

> **Tecnico:** Estado armazenado em `conversations.status_ia` (enum: 'ligada'|'desligada'|'shadow'). Constantes: `STATUS_IA.LIGADA/DESLIGADA/SHADOW` de `src/constants/statusIa.ts` (frontend) e `_shared/constants.ts` (edge). Toggle em `ChatPanel.tsx` `handleToggleIA()`: `supabase.from('conversations').update({ status_ia: newStatus })`. Auto-desliga no `handleMessageSent` callback: `setIaAtivada(false)`. UI: Button variant `default` (ativa) / `outline` (inativa), hover muda para `destructive`. Estado inicial carregado via `supabase.from('conversations').select('status_ia')`. Realtime sync: broadcast `new-message` payload inclui `status_ia`.

---

## 1.13 Transcricao de Audio

**O que e:** Quando o lead envia um audio pelo WhatsApp, o sistema **transcreve automaticamente** o conteudo para texto. Aparece em italico logo abaixo do player de audio, com um icone de bloquinho de notas.

**Por que importa:** Muitos brasileiros preferem mandar audio. Mas o atendente pode estar em ambiente barulhento, ou o audio pode ter 3 minutos. Com a transcricao, ele **le em 10 segundos** o que levaria 3 minutos para ouvir.

> **Tecnico:** Motor: Whisper via Groq API, processado pelo edge function `transcribe-audio` (chamado pelo `process-jobs` worker). Transcricao salva no campo `conversation_messages.transcription`. Realtime: broadcast `transcription-updated` com `{ conversationId, messageId, transcription }` no canal `helpdesk-realtime`. ChatPanel listener atualiza estado: `setMessages(prev => prev.map(m => m.id === messageId ? { ...m, transcription } : m))`. UI: texto italico com prefix de icone abaixo do AudioPlayer. Loading: spinner animado + "Transcrevendo...".

---

## 1.14 Resumo IA da Conversa

**O que e:** Um botao **"Gerar Resumo"** no painel de informacoes (direita) que pede a inteligencia artificial para ler toda a conversa e criar um resumo inteligente.

**O que o resumo contem:**
- **Motivo** — Por que o lead entrou em contato
- **Resumo** — O que foi discutido
- **Resolucao** — Como terminou
- **Quantidade de mensagens** e **data** de quando o resumo foi gerado

**Cenarios:**
1. Gerente abre conversa de 200 mensagens → "Gerar Resumo" → 5 segundos → sabe todo o contexto.
2. Historico: cada conversa passada pode ter seu proprio resumo gerado.

> **Tecnico:** Edge function `summarize-conversation` (Groq/Gemini). Request: `edgeFunctionFetch('summarize-conversation', { conversation_id, force_refresh })`. Response: `{ summary: AiSummary }` com campos `reason`, `summary`, `resolution`, `generated_at`, `message_count`. Salvo em `conversations.ai_summary` (JSONB). UI: botao `Sparkles` + `RefreshCw` no ContactInfoPanel. Estado local: `aiSummary` + `summarizing`. Historico: `handleGenerateHistorySummary(convId)` para conversas passadas.

---

## 1.18 Finalizar Atendimento (Ticket Resolution Drawer)

**O que e:** Um painel que desliza de baixo para cima quando o atendente clica no botao verde **"Finalizar"**. Serve para registrar **como** aquele atendimento terminou.

**As 4 categorias:**
1. **Venda Fechada** (verde) — O lead comprou. Aparece campo para digitar o valor da venda (ex: R$ 1.450,00)
2. **Nao Converteu** (vermelho) — O lead nao comprou. Motivo: Preco alto / Concorrente / Sem estoque / Sem resposta
3. **Suporte Resolvido** (azul) — Era duvida ou problema tecnico, e foi resolvido
4. **Spam / Irrelevante** (cinza) — Mensagem indesejada, propaganda, numero errado

**O que acontece ao clicar "Finalizar":**
- Status muda para "Resolvida"
- Tags automaticas aplicadas (ex: `resultado:venda`, `motivo:preco`, `valor:1450`)
- Card do lead no CRM Kanban movido para coluna correspondente
- Perfil do lead atualizado (ticket medio, data ultima compra)
- Se NPS habilitado, agenda enquete de satisfacao automatica
- Campo de observacoes para comentarios finais

**Cenario:** Atendente fecha venda de R$ 2.800 → "Finalizar" → "Venda Fechada" → R$ 2.800 → card move para "Fechado Ganho" → 30 minutos depois, lead recebe NPS.

> **Tecnico:** Componente `TicketResolutionDrawer.tsx` (Drawer, vaul). 4 categorias em `CATEGORIES` array (value, label, icon, color, bgColor). Lost reasons: `LOST_REASONS` array. Kanban mapping: `KANBAN_COLUMN_MAP` (VENDA→'Fechado Ganho', PERDIDO→'Perdido'). Tags: `TAG_MAP` (VENDA→'resultado:venda'). Currency: `formatCurrency/parseCurrency` com mascara pt-BR e limite `MAX_SALE_VALUE = 999_999_99` (centavos). Upsert lead_profiles: average_ticket, last_purchase_at. NPS: chama `triggerNpsIfEnabled()` via job_queue (delay configuravel). Observacoes: textarea livre salvo em tags como `observacao:TEXTO`.

---

## 1.20 Contexto do Lead (Perfil + Ultimo Handoff)

**O que e:** No painel de informacoes, o sistema mostra automaticamente **todos os dados que a IA coletou** sobre o lead.

**Dados exibidos:** Nome completo, cidade, interesses, ticket medio, objecoes, notas da IA, ultimo motivo de handoff.

**Por que importa:** O atendente assume e **ja sabe tudo** sem precisar perguntar.

> **Tecnico:** Lead profile: `supabase.from('lead_profiles').select('full_name, city, interests, reason, average_ticket, objections, notes').eq('contact_id', X).maybeSingle()`. Handoff log: `supabase.from('ai_agent_logs').select('metadata, created_at').eq('conversation_id', X).eq('event', 'handoff').order('created_at', { ascending: false }).limit(1).maybeSingle()`. Estado: `leadProfile` + `handoffLog`. Exibicao: icones MapPin (cidade), ShoppingCart (ticket), Target (interesses). Tabela `lead_profiles` com FK `contact_id` para `contacts`.

---

## Sub-páginas relacionadas

- [[wiki/casos-de-uso/helpdesk-detalhado]] — Índice geral
- [[wiki/casos-de-uso/helpdesk-organizacao]] — Etiquetas, Tags, Notas, Status, Prioridade, Atribuição, Departamentos, Bulk
- [[wiki/casos-de-uso/helpdesk-comunicacao]] — Templates `/`, Mídia, Rascunhos, Emoji, Reply
- [[wiki/casos-de-uso/helpdesk-ux]] — Layout, Typing, Tempo de Espera, Histórico, Busca Global, Filtros, Realtime
- [[wiki/casos-de-uso/helpdesk-permissoes]] — Permissões Granulares + Árvore de Componentes
- [[wiki/ai-agent]] — Detalhes do AI Agent
- [[wiki/casos-de-uso/ai-agent-detalhado]] — AI Agent em profundidade (15 sub-funcionalidades)
