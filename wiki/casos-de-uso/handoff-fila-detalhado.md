---
title: Handoff com Fila Inteligente — Documentação Detalhada
tags: [handoff, fila, queue, departments, timeout, business-hours, round-robin, m20]
sources: [supabase/functions/ai-agent/index.ts, src/components/admin/, src/pages/dashboard/Admin*]
updated: 2026-05-05
---

# Handoff com Fila Inteligente — Distribuição Automática de Atendimentos

> Quando a IA decide transbordar (ex: lead pediu humano, qualificação completa, validator block), em vez de deixar a conversa "livre" para qualquer atendente pegar (estado atual: `conversations.assigned_to = NULL`), o sistema **atribui automaticamente** a um vendedor específico seguindo regras configuráveis. Inclui timeout com reatribuição, pausa em horário não-comercial e modo manual via gestor.
>
> **Status: D30 COMPLETO — 8/8 sprints shipped (2026-05-04 a 05-05). DB + 2 edge fns deployadas (ai-agent v174 + assign-handoff v1 + cron requeue-conversations) + admin UI (QueueConfig + ExtendedHoursConfig) + helpdesk UI + 66 testes Vitest + retention policy seed + wikis finais. Aguarda 1 handoff real para validar E2E no helpdesk (gap aceito).**

---

## 1. Os 2 Modos de Operação (Toggle no painel)

| | **Modo Fila ON** | **Modo Fila OFF (default)** |
|---|---|---|
| Quem atribui | Sistema (round-robin global) | Sistema (sempre pra atendente "default") |
| Distribuição | Conversa #1 → Lucas, #2 → Alberto, #3 → Djavan, ... | 100% das conversas → Lucas (gestor-de-chão) |
| Como Lucas distribui | Sistema decide pelo round-robin | Lucas reatribui manual no Helpdesk |
| Timeout 5min | Avança fila daquela conversa específica | Não há fila — fica com Lucas até ele agir |

---

## 2. As 8 Decisões de Design (sessão 2026-05-04, todas fechadas)

| Q | Decisão | Resumo |
|:-:|---------|--------|
| Q1 | Granularidade | Por **Departamento** (não por inbox/agente) |
| Q2 | Estratégia ON | Round-robin **global** começando por Lucas; cursor `last_assignee_position` no dept |
| Q3 | Visibilidade timeout | **Modelo C**: outros vêem em "Todas" com badge "Em fila — Lucas (3:42)" mas só assignee pode responder. Admin/gestor pode override |
| Q4 | Fim de fila | **Loop infinito** + sino para gestor a cada volta completa |
| Q5 | Horário comercial | Pausa relógio + auto-envia `out_of_hours_message` ao cruzar limite. **5min completos** ao descongelar (não saldo) |
| Especiais | Live/feriados | Toggle "Expediente Estendido" + calendário de exceções (UI v2). Acionável por gestor + super_admin |
| Q6 | Ordem fila | Drag-drop manual (`queue_position`). Gestor (Josafá) **fora por default**, com toggle |
| Q7 | Pause individual | Toggle pessoal no Helpdesk (`Disponível ↔ Pausado`). Sistema pula pausados |
| Q8 | Reset timeout | Msg do lead **NÃO reseta**. Só msg do assignee atual cancela |

---

## 3. Decisões Sub-Jacentes (D-α, D-β, D-γ)

| | Decisão | Aplicação |
|---|---------|-----------|
| **D-α** | Fallback de dept = `inboxes.default_department_id` (campo NOVO). Hierarquia: `agent_profile.handoff_dept` → `funnel.handoff_dept` → `inbox.default_dept` → falha (sino gestor) | Sprint A schema |
| **D-β** | Re-handoff de conversa antiga **respeita histórico** — volta pro último `assigned_user_id` se o atendente estiver disponível (não pausado, não desligado). Fila roda só se ele indisponível | Sprint B `assign-handoff` |
| **D-γ** | Variável `{handoff_assignee_name}` no `prompt_sections.handoff_text` — IA personaliza msg ("Vou te conectar com **Lucas** — em alguns instantes ele responde") | Sprint B + Sprint H docs |

---

## 4. Schema DB (5 migrations + 1 RPC)

```sql
-- A.1 departments: queue_mode_enabled bool, queue_mode_timeout_minutes int=5,
--                  default_assignee_id uuid, last_assignee_position int=0 (cursor RR)
-- A.2 department_members: queue_position int (drag-drop), queue_paused bool,
--                         queue_paused_reason text, gestor_in_queue bool
-- A.3 inboxes: default_department_id uuid REFERENCES departments(id)  -- D-α
-- A.4 ai_agents: extended_hours_until timestamptz  +  TABLE business_hours_exceptions
--    (id, agent_id, exception_date, schedule jsonb, note, UNIQUE(agent_id, date))
-- A.5 TABLE handoff_queue_events:
--    conversation_id, department_id, previous_assignee_id, assigned_user_id,
--    position_in_queue int, rotation_number int=0,
--    expires_at, paused_at,
--    status text CHECK IN (active|responded|timed_out|manual_override|cancelled),
--    out_of_hours_msg_sent bool, created_at, resolved_at, resolved_reason text
--    INDEX (expires_at) WHERE status='active'
-- A.6 FUNCTION pick_next_assignee(dept_id uuid, skip_user_ids uuid[]) RETURNS uuid
--    SECURITY DEFINER SET search_path = public, pg_temp
--    SELECT FOR UPDATE em departments cursor (atômico — GAP-2)
--    Pula paused, gestor (se !gestor_in_queue), skip_user_ids
```

---

## 5. Os 6 Paths de Handoff em `ai-agent/index.ts`

Todos chamam `assign-handoff(conversation_id, dept_id)` após o `status_ia='shadow'`. Resolução de dept antes da chamada:

```typescript
const deptId =
  profileData?.handoff_to_department_id ??
  funnelData?.handoff_dept ??
  inbox.default_department_id ??
  null;  // null → status=shadow + assigned=null + sino gestor (D-α)
```

Os 6 paths:
1. Tool `handoff_to_human` chamada pelo LLM
2. Auto-handoff por message limit (8 msgs default)
3. Handoff trigger por texto ("falar com humano", "atendente")
4. Validator BLOCK (validator agent rejeitou resposta)
5. Implicit text-handoff (sentimento muito negativo + sem produto)
6. Deferred handoff trigger (handoff agendado por handoff_rules)

Wrapper try/catch — se `assign-handoff` falhar, fallback para comportamento atual (`status=shadow + assigned=null`).

---

## 6. Lifecycle do `handoff_queue_events` (state machine)

```
[criado: status=active, expires_at=now+5min]
       │
       ├──► [msg outgoing do assignee] ──► status=responded ──► fim
       │
       ├──► [timeout estourou] ──► status=timed_out + cria novo evento active para próximo
       │
       ├──► [horário comercial fechou] ──► status=active, paused_at=now, expires_at congela
       │     └──► [horário reabriu] ──► paused_at=null, expires_at=now+5min (RESET completo)
       │
       ├──► [gestor reatribuiu manual] ──► status=manual_override + cria novo evento active
       │
       └──► [conversa finalizada (TicketResolutionDrawer)] ──► status=cancelled
```

---

## 7. Cron `requeue-conversations` (1min)

Para cada `handoff_queue_events` com `status='active' AND expires_at < now() AND paused_at IS NULL`:

```
1. Detectar atendente órfão (inbox_users row deletada) → marcar timed_out + skip
2. Detectar horário fechou → setar paused_at + mandar out_of_hours_message + skip
3. Detectar 1ª msg outgoing do assignee → status=responded + fim
4. Caso default → timed_out + chamar pick_next_assignee + criar novo evento + notificar
5. Se completou volta na fila (rotation_number > tamanho fila) → notificar gestor (sino)
```

---

## 8. Painel Admin (3 locais)

### 8.1 `AdminDepartments` → componente novo `QueueConfig`
- Toggle **Modo Fila** (`departments.queue_mode_enabled`)
- Slider **Timeout** (1-15min, default 5)
- Select **Atendente padrão (Modo OFF)** (`default_assignee_id`)
- Lista drag-drop dos membros (`queue_position`)
- Toggle por membro **"Incluir gestor na fila"** (`gestor_in_queue`)

### 8.2 `AdminInboxes` → adicionar Select **"Departamento padrão"** (`default_department_id` da inbox — D-α)

### 8.3 `AIAgentTab` → tab Segurança → componente `ExtendedHoursConfig` (Sprint E)
- Status: "Ativo até DD/MM às HH:mm" (badge âmbar) OU "Não ativado"
- 4 quick actions: **+1 hora**, **+2 horas**, **Resto do dia** (23:59 hoje), **Até amanhã 23:59**
- Custom datetime input + botão Aplicar (disabled em vazio/passado)
- Botão "Cancelar agora" (só quando ativo) → `extended_hours_until = null`
- Calendário de exceções `business_hours_exceptions` (schema pronto, UI v2 backlog)

### 8.4 `Helpdesk` (não-admin) → header pessoal
- Toggle **Disponível / Pausado** (`inbox_users` ou `department_members.queue_paused`)
- Badge "Em fila — Lucas (3:42 restantes)" nas conversas atribuídas a outros

---

## 9. Os 8 Sprints de Implementação (~3-4 dias)

| Sprint | Escopo | h |
|:-:|---|:-:|
| ✅ **A** | 5 migrations + RPC `pick_next_assignee` (atômico) — *shipped 2026-05-04* | 3.5 |
| ✅ **B** | `_shared/handoffQueue.ts` + `_shared/handoffDepartment.ts` + edge fn `assign-handoff` (wrapper HTTP fino) + integração nos 6 paths em ai-agent com try/catch + D-α dept resolution + D-β re-handoff + D-γ `{handoff_assignee_name}` — *shipped 2026-05-04, deployadas em prod (ai-agent v174, assign-handoff v1)* | 5 |
| ✅ **C** | `_shared/businessHours.ts` (helper isOutsideBusinessHours) + edge fn `requeue-conversations` (cron 1min, 5 cases A-E + reativação de pausados) + migration `pg_cron` schedule + Realtime broadcast `queue-update` — *shipped + deployed 2026-05-04 (v1, cron jobid=12 ativo, smoke 200 OK em prod). Hotfix R92: vault.SUPABASE_ANON_KEY atualizada de JWT legacy para `sb_publishable_*` (afetava todos os crons silenciosamente).* | 5 |
| ✅ **D** | `QueueConfig.tsx` (dialog: toggle Modo, slider timeout, select default_assignee, drag-drop ordem, toggle gestor_in_queue) + botão "Fila" em DepartmentsTab + select default_dept inline em InboxesTab (D-α). Audit logs `update_dept_queue_config` + `set_inbox_default_dept` via RPC `log_admin_action`. — *shipped 2026-05-04* | 3 |
| ✅ **F** | Hook `useActiveQueueEvents` (tick 1s + Realtime `queue-update`) + `QueuePauseToggle` no header (Disponível/Pausado global) + badge `"Em fila — Lucas (3:42)"` em `ConversationItem` (filtra próprio assignee) + cancelar queue_event ativo em `assignAgent` (manual_override). — *shipped 2026-05-05, smoke ao vivo OK (badge + countdown + toggle persistência)* | 3 |
| ✅ **G** | 53 testes Vitest novos (handoffDepartment 6 + businessHours 17 + handoffQueue 20 + useActiveQueueEvents 10) + retention policy seed `handoff_queue_events` (90d, OFF/dry_run, id=8 em prod). Smoke: dry-run em prod sem erro, 0 candidates (sem handoffs reais ainda). 715 testes passam, 0 regressão. — *shipped 2026-05-05* | 2.5 |
| ✅ **E** | `ExtendedHoursConfig.tsx` (~210 linhas) — status (Ativo até / Não ativado), 4 quick actions (+1h, +2h, Resto do dia, Até amanhã 23:59), custom datetime, botão Cancelar agora. Renderizado abaixo do BusinessHoursEditor em `RulesConfig.tsx`. `extended_hours_until` em ALLOWED_FIELDS. 13 testes Vitest novos. tsc 0, vitest 728 passam (+13). — *shipped 2026-05-05* | 2.5 |
| ✅ **H** | `admin-detalhado` ganha seção D30 (3 superfícies). `erros-e-licoes` ganha entries históricos detalhados R91 (RR concorrência) + R92 (vault rotation). Logs D+F+G+E arquivados em `wiki/log-arquivo-2026-05-05-d30-defg-e.md`. `log.md` enxugado. — *shipped 2026-05-05* | 2 |
| **TOTAL** | | **26.5h** |

---

## 10. Riscos e Pendências (durante implementação)

- **HIGH RISK mitigado** (Sprint B): integração nos 6 paths usa closure `runQueueAssignment(handoffMsgTemplate)` com try/catch interno — qualquer falha (RPC, INSERT, lookup de nome) cai num fallback que retorna `assigned_user_id=null` e a mensagem original (sem substituição). Comportamento atual preservado: `status_ia=SHADOW + assigned_to=NULL` igual ao pré-D30.
- **R91 mitigado** (Sprint A): RPC `pick_next_assignee` usa `SELECT … FOR UPDATE` no cursor `departments.last_assignee_position`. Smoke test 5 atendentes rotaram + loop infinito OK.
- **Sprint A nota:** wiki original dizia `assigned_user_id` em `conversations` — coluna real é `assigned_to` (uuid → auth.users). Sprint B usa `conversations.assigned_to`.
- **Backfill:** A migration A.2 backfilla `queue_position` de membros existentes (espaçado por 10) para que o round-robin funcione antes do drag-drop UI da Sprint D.
- **D-γ no caminho 5 (implicit text-handoff):** o LLM gera texto livre — não há template para substituir `{handoff_assignee_name}`. Helper roda mesmo assim (cria `handoff_queue_event` + setta `assigned_to`) mas sem substituição.
- **Deploy pendente:** edge functions `ai-agent` e `assign-handoff` precisam ser deployadas com `supabase functions deploy`. Smoke manual em prod (testar 1 conversa em cada path) antes de declarar shipped.
- **Dependência de Realtime**: badge "em fila" precisa Realtime cobrir `conversations.assigned_user_id` (verificar existing canal helpdesk:)
- **Retention**: ✅ Sprint G — policy seed id=8 (`handoff_queue_events`, 90d, OFF/dry_run) inserida em `db_retention_policies`. Tabela passa em `is_table_protected=false`, dry-run smoke OK.
- **Backwards compat**: tenants sem dept configurado → fila não dispara (default OFF). Não pode quebrar handoff existente

---

## 11. Links Relacionados

- [[wiki/casos-de-uso/admin-detalhado]] — Painel admin (será atualizado com seção QueueConfig)
- [[wiki/casos-de-uso/helpdesk-organizacao]] — Atribuição manual existente
- [[wiki/casos-de-uso/ai-agent-cerebro-tools-detalhado]] — Tool `handoff_to_human`
- [[wiki/decisoes-chave]] — D30 Fila Inteligente (entry resumido)
- [[wiki/erros-e-licoes]] — R36 (PostgREST onConflict), R88 (silent fail), R91 (RR concurrency, candidata)
- [[RULES.md]] — SYNC RULE 8 itens

---

*Documentado em: 2026-05-04 — Sessão de design completa (8 decisões + 3 sub-decisões D-α/β/γ + 8 sprints). Implementação pendente.*
