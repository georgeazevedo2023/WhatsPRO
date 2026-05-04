---
title: UAZAPI — Mensagens Interativas (Índice)
tags: [uazapi, poll, enquete, interativo, broadcast, ai-agent, indice]
updated: 2026-05-04
---

# UAZAPI — Mensagens Interativas (Índice)

> Documentação dos endpoints interativos da UAZAPI disponíveis para implementação no WhatsPRO.
> Endpoint unificado: `POST /send/menu` com campo `type` determinando o tipo de interação (poll), além de `POST /send/quickreply` e `POST /send/list`.
>
> Status: Poll **IMPLEMENTADO** e testado ao vivo (2026-04-09). List e QuickReply documentados mas não implementados.

---

## Sub-páginas (organizadas por tipo de mensagem interativa)

A documentação foi particionada em 3 sub-wikis temáticas (cada uma sob 200 linhas, regra 14 do CLAUDE.md). Use o índice abaixo para navegar:

| Sub-página | Conteúdo |
|------------|----------|
| [[wiki/uazapi-polls-poll]] | **Poll / Enquete** — endpoint `POST /send/menu` (type=poll), webhook `poll_update`, limitações, status no WhatsPRO, plano de implementação (DB, proxy, webhook, AI tool, broadcast, dashboard) |
| [[wiki/uazapi-polls-list-quickreply]] | **List e QuickReply** — endpoints `POST /send/quickreply` e `POST /send/list` (não implementados), tabela comparativa de todos os endpoints `/send/*` da UAZAPI |
| [[wiki/uazapi-polls-casos-uso]] | **Casos de Uso** — AI Agent (qualificação), Broadcast (pesquisa de interesse), Formulários (campo poll), Funil (NPS), Campanha Política (pesquisa de opinião) + troubleshooting |

---

## Como navegar

- Vai **implementar ou debugar Poll**? → `uazapi-polls-poll`
- Quer entender **List ou QuickReply** (ou comparar com outros endpoints)? → `uazapi-polls-list-quickreply`
- Procura **inspiração de uso** ou está montando feature nova com mensagens interativas? → `uazapi-polls-casos-uso`

---

## Links Relacionados

- [[wiki/ai-agent]] — AI Agent (consumidor da tool `send_poll`)
- [[wiki/modulos]] — Módulos do sistema
- [[wiki/banco-de-dados]] — Tabelas `poll_messages` e `poll_responses`
- [[wiki/decisoes-chave]] — Decisões M17 F4/F5 (Polls + NPS)

---

*Documentado em: 2026-04-08*
*Fonte: uazapi.md interno + análise de código do projeto*
*Rev 1 (2026-05-04): Particionado em 3 sub-wikis para respeitar regra 14 (max 200 linhas/MD). Este arquivo virou índice.*
