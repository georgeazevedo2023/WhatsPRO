---
title: Auditoria 2026-04-27 — Bugs, Inconsistências e 210 Melhorias
tags: [auditoria, bugs, melhorias, backlog, qualidade]
sources: [auditoria sessao 2026-04-27]
updated: 2026-04-27
---

# Auditoria 2026-04-27 — Bugs, Inconsistências e Melhorias

> Auditoria não-destrutiva (somente leitura) realizada em 2026-04-27. Cobriu protocolo de início (5 arquivos), 4 MDs raiz, 21 wikis, 38 edge functions, estrutura `src/`, 30 migrations recentes e git status. Nenhum arquivo foi modificado durante a auditoria.

---

## Bugs e Inconsistências (24 itens)

### Críticos (10)

1. **README.md** — Template Lovable genérico com URLs `lovable.dev/projects/REPLACE_WITH_PROJECT_ID`. Não menciona WhatsPRO, multi-tenant, UAZAPI ou produção. Reescrever do zero.
2. **PRD.md:3** — Header diz "Versão 7.11.0 | 2026-04-13 | 32 Edge Functions + 57 Tabelas", mas changelog tem v7.13.0 (2026-04-25) e v7.12.0 (2026-04-25). 38 edge functions reais.
3. **AGENTS.md:10** — LLM stack lista Gemini, Mistral, Groq mas **não cita OpenAI**. OpenAI gpt-4.1-mini é o LLM primário.
4. **AGENTS.md:32** — "AI Agent (M10): 8 tools" — são 9 tools (`send_poll` em M17 F4).
5. **AGENTS.md:52** — "Edge Functions (30 total)" — são 38.
6. **ARCHITECTURE.md:30,40,76** — "31 edge functions", "Modulos (17)" — desatualizado para 38 / 18-19.
7. **ARCHITECTURE.md:80** — "Documentacao Detalhada (17 Wikis — 187 Sub-Funcionalidades)" — 21 wikis em `wiki/casos-de-uso/`.
8. **wiki/visao-produto.md:60-71** — "Versao 7.9.0", "17 modulos", "31 edge fn", "17 wikis". Tudo desatualizado.
9. **wiki/banco-de-dados.md** — `updated: 2026-04-07`, "39 migrations, 48 tabelas". Não cita funnels/automation_rules/agent_profiles/poll_*/flow_*/notifications/db_*/instance_goals/lead_*_memory etc. Hoje 60+ tabelas.
10. **wiki/modulos.md** — Falta M19 inteiro (Plataforma de Métricas & IA Conversacional). S1-S5 + S8 + S8.1 já shipped (PRD v7.10–v7.13).

### Médios (9)

11. **wiki/roadmap.md:5** — `updated: 2026-04-13` mas tem entradas S8/S8.1 (2026-04-25).
12. **wiki/erros-e-licoes.md:5** — `updated: 2026-04-13` mas tem R74-R77 datadas 2026-04-25.
13. **wiki/decisoes-chave.md:5** — `updated: 2026-04-13` mas tem D22-D25 e D21 (2026-04-25).
14. **wiki/ai-agent.md:5** — `updated: 2026-04-09`, não reflete R49-R77 nem regras hardcoded recentes.
15. **wiki/arquitetura.md:40** — "31 edge functions" — não inclui orchestrator, aggregate-metrics, assistant-chat, db-retention-backup, db-cleanup-old-backups, process-flow-followups, guided-flow-builder.
16. **index.md** — Frontmatter `updated: 2026-04-25` vs rodapé `2026-04-26`. CLAUDE.md:31 diz "19 wikis dual" mas há 21.
17. **wiki/visao-geral-completa.md:61** — "Os 17 Modulos" — são 18-19.
18. **wiki/erros-e-licoes.md** — Tabela "Regras Preventivas" pula R32-R35 (estão só na seção "Histórico de Erros" abaixo).
19. **CLAUDE.md:19** — Tabela diz "CLAUDE.md ~120 linhas" — arquivo tem 125.

### Operacionais (5)

20. `10 MODELOS DE LINK NA BIO.html` (144KB) na raiz, untracked, sem propósito documentado.
21. `.planning/m19-s4-PLAN.md`, `m19-s4-RESEARCH.md`, `m19-s4-p2-SUMMARY.md`, `m19-s5-PLAN.md`, `m19-s5-RESEARCH.md`, `m19-s8-PLAN.md` — sprints já shipped, acumulam ruído.
22. Edge functions sem wiki dedicada: `aggregate-metrics`, `assistant-chat`, `orchestrator`, `guided-flow-builder`, `process-flow-followups`.
23. `wiki/casos-de-uso/helpdesk-detalhado.md` em **522 linhas** (viola regra 14 do CLAUDE.md, max 200).
24. `wiki/banco-de-dados.md` em **66 linhas** para 60+ tabelas — sub-documentado.

---

## 210 Melhorias por Módulo (10 cada × 21 módulos)

Particionadas em 5 wikis temáticas para respeitar regra de 200 linhas:

| Wiki | Módulos | Itens |
|------|---------|-------|
| [[wiki/melhorias-modulos-comunicacao]] | Helpdesk, Broadcast, Forms WhatsApp | 30 |
| [[wiki/melhorias-modulos-inteligencia]] | AI Agent, Agent Profiles, Motor Automação, Enquetes/NPS, Fluxos v3 | 50 |
| [[wiki/melhorias-modulos-leads-crm]] | Leads, CRM Kanban, Catálogo | 30 |
| [[wiki/melhorias-modulos-canais]] | Campanhas UTM, Bio Link, Funis | 30 |
| [[wiki/melhorias-modulos-plataforma]] | Dashboard/Intelligence, Gestor M19, Assistente IA, Instâncias/Inboxes, Admin, Documentação | 70 |

---

## Achado Estrutural — Regra "Brilho/Fosco" Hardcoded (Sem Configuração Admin)

A pergunta "prefere fosco ou brilho?" está **hardcoded em 4 locais** no código, NÃO é configurável pelo admin hoje:

| Local | Linha | O que faz |
|-------|-------|-----------|
| `supabase/functions/ai-agent/index.ts` | 1167 | Regra "QUALIFICAÇÃO DE TINTAS" no prompt builder concatenado |
| `supabase/functions/ai-agent/index.ts` | 1171 | Regra "ENRIQUECIMENTO PÓS-BUSCA" com texto literal "fosco ou brilho" |
| `supabase/functions/ai-agent/index.ts` | 1336-1368 | Função `buildEnrichmentInstructions()` com `if (interesse.includes('tinta'))` adicionando "fosco, acetinado, brilho, semibrilho" |
| `src/data/nicheTemplates.ts` | 55 | Template "Home Center" com "acabamento preferido" |

**Diagnóstico:** As regras estão concatenadas DEPOIS de `prompt_sections` no prompt builder. Editar Prompt Studio NÃO sobrepõe. O admin só consegue trocar o template do nicho na criação do agente — depois fica preso.

**Solução proposta** (PRIORIDADE ALTA, item incluído no roadmap de melhorias): mover `buildEnrichmentInstructions` para tabela `ai_agent_enrichment_rules` (ou JSONB em `ai_agents.enrichment_rules`) com schema `{ category: string, fields: { key, label, examples }[] }`, editável via UI no admin.

---

## Sumário

- **24 inconsistências** documentais (10 críticas, 9 médias, 5 operacionais)
- **210 melhorias** sugeridas (10 por módulo × 21 módulos)
- **38 edge functions** reais vs 30/31/32 documentadas
- **6 wikis** com `updated:` desatualizado violando regra 13 do CLAUDE.md
- **0 arquivos modificados** durante a auditoria
- **Achado bônus:** regra "brilho/fosco" hardcoded em 4 locais, sem UI de admin

## Links

- [[CLAUDE.md]] — Orquestrador
- [[wiki/erros-e-licoes]] — Regras preventivas
- [[wiki/roadmap]] — Próximos passos
- [[log]] — Entrada 2026-04-27
