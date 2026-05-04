---
title: Enquetes e NPS — Documentacao Detalhada (Indice)
tags: [enquetes, polls, nps, satisfacao, votacao, whatsapp, detalhado, indice]
sources: [src/components/broadcast/PollEditor.tsx, supabase/functions/whatsapp-webhook/, src/hooks/usePollMetrics.ts]
updated: 2026-05-04
---

# Enquetes e NPS — Votacoes Nativas do WhatsApp (Indice das 10 Sub-Funcionalidades)

> Enquetes (polls) sao **votacoes nativas do WhatsApp** — aquelas com botoes clicaveis que o lead toca para escolher uma opcao. Nao sao mensagens de texto com "1, 2, 3" — sao botoes reais renderizados pelo proprio WhatsApp, com visual bonito e interacao simples.
>
> O NPS (Net Promoter Score) e um tipo especial de enquete: uma **pesquisa de satisfacao automatica** enviada apos o atendente resolver um ticket. Se a nota for ruim, o gerente recebe notificacao automatica.
>
> As enquetes podem ser enviadas de **4 formas** (broadcast, IA, formulario, automacao). Respostas sao rastreadas e podem gerar tags automaticas.
>
> Ver tambem: [[wiki/casos-de-uso/broadcast-detalhado]], [[wiki/casos-de-uso/ai-agent-detalhado]], [[wiki/casos-de-uso/motor-automacao-detalhado]]

---

## Sub-paginas (organizadas por area)

A documentacao das 10 sub-funcionalidades foi particionada em 3 wikis tematicas (cada uma sob 200 linhas, regra 14 do CLAUDE.md). Use o indice abaixo para navegar:

| Sub-pagina | Sub-funcionalidades cobertas |
|------------|------------------------------|
| [[wiki/casos-de-uso/enquetes-nps-criacao-canais]] | **12.1** Criacao de Enquete (PollEditor), **12.2** Os 4 Canais de Envio (broadcast, IA, formulario, automacao), **12.3** Endpoint UAZAPI (`/send/menu` + payload) |
| [[wiki/casos-de-uso/enquetes-nps-respostas-tags]] | **12.4** Rastreamento de Respostas (webhook poll_update), **12.5** Auto-Tags por Opcao (D2), **12.6** Exibicao no Helpdesk (renderizacao MessageBubble) |
| [[wiki/casos-de-uso/enquetes-nps-metricas-admin]] | **12.7** NPS Automatico (D6 + 5 campos), **12.8** Notificacao de Nota Ruim (gerentes), **12.9** Dashboard de Metricas (PollMetricsCard + PollNpsChart), **12.10** Configuracao Admin (PollConfigSection) |

---

## Como navegar pelo enquetes-nps-detalhado

- Quer **criar uma enquete** ou entender por **quais canais ela e enviada**? → `enquetes-nps-criacao-canais`
- Investigando **como o voto chega** ou como tags sao aplicadas automaticamente? → `enquetes-nps-respostas-tags`
- Configurando **NPS automatico**, **notificacoes para gerente** ou estudando o **dashboard**? → `enquetes-nps-metricas-admin`

---

## Tabelas do Banco

| Tabela | O que guarda |
|--------|--------------|
| `poll_messages` | Enquetes enviadas (question, options[], selectable_count, auto_tags, image_url, is_nps, funnel_id) |
| `poll_responses` | Votos (poll_message_id FK, voter_jid, contact_id, selected_options[], voted_at — unique per voter) |
| `notifications` | Alertas NPS ruim para gerentes (type, title, message, metadata, read) |

---

## Decisoes Documentadas

| # | Decisao | Detalhe |
|---|---------|---------|
| D1 | Imagem antes da enquete | Toggle no PollEditor. Envia via /send/media + 1500ms delay antes do poll |
| D2 | Auto-tags por opcao | Map opcao→tag em poll_messages.auto_tags JSONB. Aplicado no webhook |
| D6 | Guard sentimento negativo | NPS nao envia se conversa tem tag sentimento:negativo |
| D7 | Nunca opcoes numeradas | Opcoes enviadas como plain strings. WhatsApp renderiza numeracao |

---

## Links Relacionados

- [[wiki/casos-de-uso/broadcast-detalhado]] — Enquetes no broadcast (envio em massa)
- [[wiki/casos-de-uso/ai-agent-detalhado]] — Tool send_poll (IA decide quando enviar)
- [[wiki/casos-de-uso/motor-automacao-detalhado]] — Acao send_poll + NPS via automacao
- [[wiki/casos-de-uso/formularios-detalhado]] — Campo tipo poll no formulario
- [[wiki/casos-de-uso/helpdesk-detalhado]] — Renderizacao no chat + TicketResolutionDrawer agenda NPS
- [[wiki/modulos]] — Todos os 17 modulos
- [[wiki/uazapi-polls-interativos]] — Documentacao tecnica do endpoint UAZAPI

---

*Documentado em: 2026-04-10 — Padrao dual (didatico + tecnico). Doc dedicado com 4 canais de envio + NPS completo*
*Rev 1 (2026-05-04): Particionado em 3 sub-wikis tematicas para respeitar regra 14 (max 200 linhas/MD). Este arquivo virou indice.*
