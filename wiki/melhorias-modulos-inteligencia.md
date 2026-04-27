---
title: Melhorias — Inteligência (AI Agent, Profiles, Motor, Enquetes, Fluxos)
tags: [melhorias, ai-agent, automacao, profiles, polls, fluxos, backlog]
sources: [auditoria 2026-04-27]
updated: 2026-04-27
---

# Melhorias — Inteligência

> 50 melhorias acionáveis em 5 módulos: AI Agent, Agent Profiles, Motor de Automação, Enquetes/NPS, Fluxos v3.0. Auditoria 2026-04-27.

---

## AI Agent (M10) — `supabase/functions/ai-agent/`, `src/components/admin/ai-agent/`

1. **Refatorar `ai-agent/index.ts` (~2600 linhas)** em módulos: `handlers/`, `tools/`, `prompt-builder.ts`, `handoff-engine.ts`. HIGH RISK por tamanho — refatorar com testes de paridade.
2. **Validator com cache por hash de resposta** — hoje cada resposta paga LLM call. Cache 5min reduz custo ~40% para respostas repetidas (preço, horário).
3. **Métricas de tool-call** (`search_products` hit-rate, `handoff_to_human` taxa, latência por tool) em `aggregate-metrics`. Hoje só agregada.
4. **Painel da fallback chain** — Gemini/Mistral existem como fallback mas sem painel mostrando quantas vezes foram acionados nem circuit breaker state. Adicionar em `MetricsConfig.tsx`.
5. **Versionar `prompt_sections`** com histórico (tabela `ai_agent_prompt_versions`) + diff visual no PromptStudio. Hoje admin sobrescreve sem rollback.
6. **A/B test de prompts** — split traffic 50/50, agregar conversion no validator + handoff rate. Falta `ai_agent_experiments`.
7. **Detecção de loop infinito de tool-calls** — guard hardcoded de "max 5 tool calls/turno". Hoje só `max_lead_messages` (grosso).
8. **Audit-log de modificações** em `prompt_sections`, `tools_enabled`, `handoff_message` (admin_audit_log). Hoje muda silenciosamente.
9. **Prompt-leak guard no Validator** — detectar `<system>`, `<funnel_instructions>`, `<profile_instructions>` na resposta. Existe no orchestrator (R34), não no ai-agent legacy.
10. **Mover regras hardcoded para tabela editável** — `buildEnrichmentInstructions` (linhas 1336-1368) hoje hardcoded por nicho. Criar `ai_agent_enrichment_rules` JSONB com `{category, fields[]}` editável via UI. **Resolve "brilho/fosco" hardcoded.** **✅ shipped (M19-S10 v1, 2026-04-27) e evoluído para stages + score (M19-S10 v2, 2026-04-27)** — implementado como `ai_agents.service_categories JSONB` com hierarquia categorias → stages → fields. Funil de qualificação visual no admin (tab dedicada "Qualificação"), score progressivo persistido em `lead_score_history`. Resolve "fosco/brilho" hardcoded e habilita visualização de maturidade do lead em tempo real. Ver [[wiki/decisoes-chave]] D26 v2 e [[.planning/phases/M19-S10-service-categories/PLAN]].

---

## Agent Profiles (M17 F3) — `src/components/admin/ai-agent/ProfilesConfig.tsx`

1. **Templates de perfil** (SDR, Suporte, Vendedor Premium, Cobrança) prontos no admin.
2. **Preview de prompt completo** — perfil mostra prompt renderizado com variáveis substituídas.
3. **Métricas por perfil** — qual perfil tem maior conversão? Hoje agregado.
4. **A/B test entre perfis** — split traffic 50/50.
5. **Versionamento de perfil** com rollback.
6. **Clone de perfil existente** como base.
7. **Markdown rendering no prompt** (preview formatado) — hoje texto puro.
8. **Importar/exportar perfil** entre instâncias.
9. **Validação de prompt** — detectar `{{variavel}}` inválida antes de salvar.
10. **Testes de conformidade** — perfil tem que mencionar handoff_rule? Validator ao salvar.

---

## Motor de Automação (M17 F1) — `supabase/functions/_shared/automationEngine.ts`

1. **Editor visual no-code** (nó-aresta drag&drop) com `ReactFlow` em vez de form linear.
2. **Testar regra antes de publicar** (dry-run) — selecionar conversa exemplo, ver o que aconteceria.
3. **Logs de execução** com sucesso/erro por regra — hoje executa silencioso.
4. **Condições compostas** (AND/OR) — hoje 1 condição apenas.
5. **Delay entre ações** ("após move_card, esperar 1h, então send_message") — hoje executa em bloco.
6. **Exportar/importar regras** entre instâncias.
7. **Limite de execuções/hora** (rate limit por funnel_id) — anti-loop.
8. **Edição em tempo real com webhook test** — admin manda mensagem teste, vê regra disparar.
9. **Métricas de regra** — "esta regra disparou 47 vezes esta semana" + taxa de sucesso.
10. **Versionar regras** (active vs draft) — admin edita sem afetar produção até "publicar".

---

## Enquetes / NPS (M17 F4-F5) — `src/components/admin/ai-agent/PollConfigSection.tsx`

1. **Múltiplas escalas NPS** (0-5, 0-10) — hoje fixa em 4 opções (Excelente/Bom/Regular/Ruim/Péssimo).
2. **Comentário aberto pós-NPS** — "Por que essa nota?" como segunda mensagem. Hoje só nota.
3. **Segmentação NPS por agente/funil** — comparar NPS entre vendedores. Dashboard atual é agregado.
4. **Ação automática em nota ruim** (além da notificação) — abrir ticket, mover kanban para "Recuperação". Hook existe em automationEngine, falta UI.
5. **Detecção de fadiga NPS** — não enviar para mesmo lead se já respondeu nas últimas 30d.
6. **Templates de enquetes** (sorteio, escolha de produto) prontos.
7. **Exportar respostas CSV** com filtros.
8. **Webhook on poll_response** para integrar com BI externo.
9. **Tempo médio de resposta** como métrica.
10. **Enquete encadeada** (resposta A → próxima enquete; B → handoff). Hoje uma é uma.

---

## Fluxos v3.0 (M18) — `src/components/flows/`, `supabase/functions/orchestrator/`

1. **UI de migração instância-por-instância** documentada — `instances.use_orchestrator` existe, falta UI clara.
2. **Visualizador de execução em tempo real** — `flow_states` + `flow_events` como timeline visual ao admin durante teste.
3. **Templates da Fluxos v3** mais ricos — hoje 12 templates, muitos genéricos.
4. **Editor de step com IA assistida** (similar guided-flow-builder mas para edição inline).
5. **Métricas por step** — "step 'qualificação' demora 4.5 mensagens em média" no FlowMetricsPanel.
6. **Forking de fluxo** — duplicar e modificar para A/B.
7. **Rollback automático melhorado** — hoje 3 falhas em 5min reverte. Adicionar threshold por instance_id e severidade.
8. **Export/import de flow JSON** — backup e portabilidade.
9. **Subagentes customizados** (não só os 8 padrão) — hoje hardcoded em `getStepType`.
10. **Doc inline no admin** — link para casos-de-uso/fluxos-detalhado dentro do editor.

---

## Links

- [[wiki/melhorias-auditoria-2026-04-27]] — Índice geral
- [[wiki/ai-agent]] — AI Agent em detalhe
- [[wiki/casos-de-uso/ai-agent-detalhado]]
- [[wiki/casos-de-uso/motor-automacao-detalhado]]
- [[wiki/casos-de-uso/enquetes-nps-detalhado]]
- [[wiki/casos-de-uso/fluxos-detalhado]]
