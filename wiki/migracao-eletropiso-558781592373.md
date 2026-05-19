---
title: Migração Eletropiso — nova instância +558781592373
type: operacao
tags: [migracao, instancia, eletropiso, handoff, fila-off]
updated: 2026-05-19
audited_at: 2026-05-19
---

# Migração Eletropiso — +558781592373

> Criação de uma nova instância WhatsPRO espelhando a Eletropiso atual (`r466a98889b5809`) num novo número (+558781592373), com fila de atendimento DESLIGADA e handoff direto para Lucas (atendente fixo).

## Decisões

| Item | Valor |
|---|---|
| Estratégia | **Aditiva** — Eletropiso atual (`r466a98889b5809`) permanece ativa. Nova instância roda em paralelo. |
| Nome no painel | `Eletropiso 558781592373` |
| Departments | 1 ("Vendas", is_default=true, queue_mode_enabled=false) |
| Fila | **Desligada** (Opção C do audit) — `default_assignee_id = Lucas` direto |
| Atendentes | 6 em `inbox_users` (mesmos da antiga), mas só Lucas em `department_members` (qp=10) |
| Catálogo | 7 produtos clonados (URLs de imagem compartilhadas) |
| AI Agent | Clone integral — 24 service_categories + 13 excluded_groups + prompts + business_info + business_hours + handoff_message + service_categories.catalog_status |
| n8n | Fluxo novo (path único — usuário vai configurar) |

## Identificadores (resultado da migração)

| Item | Valor |
|---|---|
| **Instance ID** | `re662a6d32de7e0` |
| **Instance name** | `Eletropiso 558781592373` |
| **Token UAZAPI** | `aaae9607-a363-4923-acc0-4bf346d36435` (rotacionar pós-deploy) |
| **owner_jid** | `558781592373` |
| **Inbox ID** | `01a9c21d-98c8-4225-805a-18e79e7df719` |
| **Department ID** | `5240c457-762d-4adc-868c-71c1d82b7f57` (Vendas) |
| **AI Agent ID** | `1062059a-b5b2-49cf-9032-098cf6875d73` |
| **Lucas user_id (default_assignee)** | `6e18a85a-47d0-4995-88a7-94bf3b71e414` |

## Configuração de handoff (fila OFF)

`departments.queue_mode_enabled = false` + `departments.default_assignee_id = <Lucas user_id>`. Comportamento (per `_shared/handoffQueue.ts:166-174`):

1. Lead atinge `handoff_to_human` → `assignHandoff()` carrega department
2. Modo desligado → vai direto pro `default_assignee_id` (Lucas)
3. Verificação de elegibilidade **NÃO** se aplica (Lucas recebe mesmo se queue_paused=true)

**Risco residual:** Lucas indisponível → conversa fica órfã. Mitigação: cron `requeue-conversations` pode reatribuir; ou setar segundo `default_assignee` futuramente.

## Comandos SQL executados

```sql
-- 1. UPDATE instance (já criada pelo UAZAPI lookup anterior)
UPDATE instances SET name = 'Eletropiso 558781592373' WHERE id = 're662a6d32de7e0';

-- 2. Inbox + Department + UPDATE inbox.default_department_id
INSERT INTO inboxes (instance_id, name, created_by) VALUES (...);
INSERT INTO departments (name, inbox_id, is_default, queue_mode_enabled, default_assignee_id)
  VALUES ('Vendas', ..., true, false, '6e18a85a-...');
UPDATE inboxes SET default_department_id = ...;

-- 3. Clone inbox_users (6 users)
INSERT INTO inbox_users (...) SELECT ... FROM inbox_users WHERE inbox_id = '3c19208d-...';

-- 4. department_members SO Lucas
INSERT INTO department_members (department_id, user_id, queue_position) VALUES (..., '6e18a85a-...', 10);

-- 5. user_instance_access (6 users)
INSERT INTO user_instance_access ... ON CONFLICT DO NOTHING;

-- 6. Clone ai_agent (~56 colunas)
INSERT INTO ai_agents (instance_id, [55 cols]) SELECT 're662a6d32de7e0', [55 cols] FROM ai_agents WHERE id = '174af654-...';

-- 7. Clone produtos (7)
INSERT INTO ai_agent_products (agent_id, sku, title, ...) SELECT '<new_agent_id>', sku, title, ... FROM ai_agent_products WHERE agent_id = '174af654-...';
```

## Validação pós-migração

| Check | Esperado | Real |
|---|---|---|
| instance.status | `connected` | ✅ connected |
| ai_agent.enabled | `true` | ✅ true |
| ai_agent.model | `gpt-4.1-mini` | ✅ |
| service_categories.categories.length | 24 | ✅ 24 |
| excluded_products.length | 13 | ✅ 13 |
| products | 7 | ✅ 7 |
| inbox_users | 6 | ✅ 6 |
| department_members | 1 (Lucas) | ✅ 1 |
| queue_mode_enabled | false | ✅ false |
| default_assignee_id = Lucas | true | ✅ true |

## Próximos passos (usuário)

1. **n8n** — Criar fluxo novo:
   - Path único: ex `/webhook/eletropiso_558781592373`
   - Webhook node → Set node (igual ao fluxo `Whatspro 01 - Eletropiso 01`) → HTTP Request POST `https://prfcbfumyrrycsrcrvms.supabase.co/functions/v1/whatsapp-webhook`
   - Body: `={{ JSON.stringify($json.body) }}`
2. **UAZAPI** — No painel da instância +558781592373, **Configurar Webhook**:
   - URL: `https://fluxwebhook.wsmart.com.br/webhook/<seu_path_novo>`
   - Eventos: `messages` (`status_ia` opcional)
3. **Teste E2E** — Enviar 1 msg pelo WhatsApp pro +558781592373 e verificar:
   - Conversation criada na inbox `01a9c21d-...`
   - Bot responde greeting
   - Pergunta nome → qualif → handoff → cai pro Lucas

## Rollback (se necessário)

```sql
-- Ordem reversa de FKs:
DELETE FROM ai_agent_products WHERE agent_id = '1062059a-b5b2-49cf-9032-098cf6875d73';
DELETE FROM ai_agents WHERE instance_id = 're662a6d32de7e0';
DELETE FROM department_members WHERE department_id = '5240c457-762d-4adc-868c-71c1d82b7f57';
DELETE FROM inbox_users WHERE inbox_id = '01a9c21d-98c8-4225-805a-18e79e7df719';
DELETE FROM user_instance_access WHERE instance_id = 're662a6d32de7e0';
UPDATE inboxes SET default_department_id = NULL WHERE id = '01a9c21d-98c8-4225-805a-18e79e7df719';
DELETE FROM departments WHERE id = '5240c457-762d-4adc-868c-71c1d82b7f57';
DELETE FROM inboxes WHERE id = '01a9c21d-98c8-4225-805a-18e79e7df719';
-- Manter instances.re662a6d32de7e0 OU deletar via UAZAPI antes:
-- DELETE FROM instances WHERE id = 're662a6d32de7e0';
```

## Lição

- `instances.id` é gerado pelo UAZAPI (formato `r...`) — não pelo DB. Buscar via `/instance/status` com token quando o painel não mostra.
- Fila OFF + `default_assignee_id` é o setup canônico pra atendimento single-attendant. Mais limpo que filtrar `department_members.available=false`.
- Clone integral do `ai_agent` via `INSERT … SELECT` lista as ~56 colunas explicitamente (evita perder campos novos quando o schema evolui). Vale criar uma view/RPC `clone_ai_agent(source_id, target_instance_id)` no futuro.

---

**Sessão:** 2026-05-19 (Claude Opus 4.7) · **Reversível:** ✅ (SQL rollback acima)
