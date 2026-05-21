---
title: Log Arquivo 2026-05-19 — Migração Eletropiso v2 + DB Reset
tags: [log, arquivo, 2026-05-19, eletropiso, migracao, db-reset]
description: Movido de log.md em 2026-05-21 (hard limit 300 linhas)
updated: 2026-05-21
audited_at: 2026-05-21
---

# Log Arquivo 2026-05-19 — Migração Eletropiso + DB Reset

## 2026-05-19 (tarde) — Migração Eletropiso → nova instância +558781592373

**Migração aditiva.** Nova instância UAZAPI criada com número +558781592373 (id `re662a6d32de7e0`, token `aaae9607-...`). Eletropiso atual (`r466a98889b5809`) preservada e segue operando em paralelo.

**Estrutura criada:**
- inbox `01a9c21d-98c8-4225-805a-18e79e7df719` (nome "Eletropiso 558781592373")
- department `5240c457-762d-4adc-868c-71c1d82b7f57` ("Vendas", is_default=true, **queue_mode_enabled=false**, **default_assignee_id=Lucas**)
- 6 inbox_users (clone integral) — mas SO Lucas em department_members (qp=10)
- 6 user_instance_access
- ai_agent `1062059a-b5b2-49cf-9032-098cf6875d73` (clone integral 56 colunas — service_categories, excluded_products, prompt_sections, business_info, business_hours, handoff_message, etc.)
- 7 ai_agent_products clonados (URLs de imagem compartilhadas, sem duplicação no storage)

**Fila desligada — Opção C** (recomendação do audit em 5 agentes): com `queue_mode_enabled=false` + `default_assignee_id=Lucas`, todo handoff vai direto pra ele (handoffQueue.ts:166-174). Outros 5 atendentes têm acesso à inbox mas não recebem handoff automático.

**Pendências do usuário:**
1. Criar fluxo n8n novo (path único, ex: `eletropiso_558781592373`)
2. Configurar webhook UAZAPI da nova instância → URL n8n
3. Teste E2E

**Doc:** [[wiki/migracao-eletropiso-558781592373]] (procedimento + IDs + rollback).

**Lição:** `instances.id` é gerado pelo UAZAPI, não pelo DB. Buscar via `GET /instance/status` com token quando o painel não mostra. Clone de ai_agent via INSERT...SELECT listando ~56 colunas explicitamente é mais robusto que `SELECT *`.

---

## 2026-05-19 — DB Reset total pré-nova-instância

**Operação destrutiva autorizada.** Usuário vai cadastrar uma nova instância e pediu limpeza completa de dados operacionais para evitar cruzamento com Eletropiso (contacts/leads/conversations/logs).

**Auditoria antes:** 21 contatos, 24 conversas, 1941 msgs, 18 lead_profiles, 551 handoff events, 44 lead_db_entries, 1 lead_database, 47 score_history, 2 lead_memory, 1 poll_message — todos da Eletropiso. Sandbox IA já vazia.

**Decisões do usuário:** (1) escopo TOTAL todas instâncias, (2) apagar lead_databases também, (3) SEM backup.

**Executado:** `TRUNCATE ... RESTART IDENTITY CASCADE` em transação única, listando 32 tabelas explicitamente (contacts/conversations/messages + ~20 FK-dependentes: ai_agent_logs, ai_debounce_queue, flow_states, intent_detections, handoff_queue_events, validator_logs, shadow_extractions, etc.). 0 erros. Validado com COUNT em 19 tabelas — todas em 0.

**Preservado intencionalmente:** instances (2), inboxes (2), departments (2), inbox_users (7), user_roles (7), auth.users (7), whatsapp_forms (6), ai_agent_configs, products, flows, funnels, labels.

**Doc:** [[wiki/db-reset-2026-05-19]] (procedimento + tabelas + comando + lição).

**Lição:** Reset total seguro = TRUNCATE em transação única com lista explícita de todas as filhas + RESTART IDENTITY. Não confiar só no CASCADE da FK — auditar `information_schema.table_constraints` antes pra evitar tabela órfã.
