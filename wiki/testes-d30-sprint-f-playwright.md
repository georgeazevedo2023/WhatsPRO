---
title: D30 Sprint F — Specs Playwright (testes ao vivo + regressão de R93/R94/R95)
tags: [d30, sprint-f, playwright, testes, helpdesk, regression]
sources: [src/components/helpdesk/QueuePauseToggle.tsx, src/hooks/useActiveQueueEvents.ts, src/pages/dashboard/HelpDesk.tsx]
updated: 2026-05-05
---

# D30 Sprint F — Specs Playwright

> Cenários reproduzíveis pra validar a fila inteligente no helpdesk. **Sessão 2026-05-05** rodou cada um manualmente; os 3 bugs descobertos (R93, R94, R95) viraram regression tests.

## Pré-condições compartilhadas

```yaml
ambiente:
  - prod: https://crm.wsmart.com.br
  - dev: http://localhost:8080 (mesmo banco prod)
db:
  - departamento Vendas (id 1b55559f-891e-4cb5-b286-b6a718f7ac5b) Modo Fila ON
  - 6 atendentes ordenados (Lucas pos 10 → Alberto 20 → Jussara 30 → Djavan 40 → Slone 50 → Josafá 60 fora-da-fila)
  - inbox Eletropiso (3c19208d-...) com default_department_id = Vendas
  - cron requeue-conversations rodando via n8n a cada 1min
contas:
  - super_admin: george.azevedo2023@gmail.com
  - atendente: lucas@eletropiso.com.br (e demais "<nome>@eletropiso.com.br")
```

## Cenário 1 — Login + boot do helpdesk (smoke base)
**Setup**: navegar pra `/login`
**Steps**: preencher email/senha → click Entrar → aguardar redirect
**Asserts**:
- URL final: `/dashboard/helpdesk` ou similar
- Sidebar mostra menu "Atendimento"
- Aba "Minhas / Não atribuídas / Todas" visível
- 0 errors no console

## Cenário 2 — QueuePauseToggle: render por papel
**Setup**: logar como Lucas (atendente em dept Vendas)
**Steps**: aguardar helpdesk carregar
**Asserts**:
- Botão `aria-label="Pausar e sair da fila"` visível no header
- Texto "Disponível" visível
- Cor: verde (variant outline)

**Variante A**: logar como super_admin que NÃO está em nenhum dept → botão NÃO aparece
**Variante B**: logar como atendente em 2 deptos → botão aparece (controla todos)

## Cenário 3 — R93 regression: pause persiste no DB
**Setup**: Lucas logado, status Disponível
**Steps**:
1. Click no toggle "Disponível"
2. Aguardar ~1s
**Asserts UI**:
- Texto vira "Pausado"
- Toast "Você está pausado — a fila vai te pular"
- Cor verde sólida (variant default)

**Asserts DB** (smoke SQL paralelo):
```sql
SELECT queue_paused, queue_paused_reason
FROM department_members
WHERE user_id = '<lucas-id>'
```
- `queue_paused` = `true` ✅ (R93 — antes ficava false silente)
- `queue_paused_reason` = `'Pausado pelo atendente no helpdesk'`

**Despausar**:
- Click novamente → "Disponível", `queue_paused=false`, `queue_paused_reason=NULL`

## Cenário 4 — Round-robin pula atendente pausado
**Setup**: Lucas pausado (do cenário 3)
**Steps**: rodar `pick_next_assignee` 8x via SQL
**Asserts**:
- Lucas (pos 10) NÃO aparece em nenhuma das 8 rotações
- Sequência: Alberto → Jussara → Djavan → Slone → Alberto (wrap, pulando Lucas e Josafá)
**Despausar Lucas + repetir**: Lucas volta a aparecer na rotação a partir do step 1

## Cenário 5 — Badge "Em fila" + countdown ao vivo
**Setup**:
1. SQL: criar `handoff_queue_events` ativo numa conversa (assignee = Alberto, expires now()+5min)
2. SQL: `UPDATE conversations SET assigned_to = '<alberto-id>'`
3. Lucas logado, na aba "Todas"

**Steps**: aguardar Realtime broadcast OU fazer F5
**Asserts iniciais**:
- Badge âmbar `"Em fila — Alberto (4:59)"` visível na linha da conversa
- Ícone Hourglass

**Asserts countdown**:
- Espera 5 segundos
- Texto decrementa: 4:59 → 4:54 (5 segundos a menos)

**Filtro do próprio user**:
- Aba "Minhas": badge NÃO aparece (Lucas é Lucas, não Alberto)

## Cenário 6 — R94 regression: header sincroniza com cron timeout
**Setup**: cenário 5 ativo, queue_event prestes a expirar (expires_at < 60s)
**Steps**:
1. Aguardar cron processar timeout (até 1min após expira)
2. SEM F5
**Asserts**:
- Badge atualiza de "Alberto" para próximo na fila (Jussara)
- Header da conversa atualiza junto (R94 fix — via useEffect que observa queueEvents)
- Painel direito > "Agente Responsável" também atualiza

**Antes do fix**: badge atualizava mas header e painel ficavam stale (Alberto).

## Cenário 7 — R95 regression: department_id propagado
**Setup**: cenário 6 acabou de processar (cron reatribuiu)
**Steps**: abrir a conversa
**Asserts**:
- Painel direito > "Departamento": **"Vendas"** ✅ (R95 fix)
- SQL: `SELECT department_id FROM conversations WHERE id=<conv>` retorna ID do dept Vendas

**Antes do fix**: department_id ficava NULL, painel mostrava "Nenhum".

## Cenário 8 — Override manual (cancel queue_event)
**Setup**: queue_event ativo com Alberto
**Steps** (logado como super_admin):
1. Abrir conversa
2. Painel direito > "Agente Responsável" select
3. Mudar de Alberto → Lucas
**Asserts UI**:
- Header e painel direito mostram Lucas (R94 fix garante sincronização)
- Badge "Em fila — Alberto" suma da lista esquerda

**Asserts DB**:
```sql
SELECT status, resolved_reason FROM handoff_queue_events WHERE id=<event-id>
```
- `status` = `'manual_override'`
- `resolved_reason` setado

## Como rodar (futuro)

Hoje executados manualmente. Pra automatizar:
1. `npm i -D @playwright/test`
2. `npx playwright install chromium`
3. Criar `e2e/playwright.config.ts` apontando pra `BASE_URL=http://localhost:8080`
4. Mover esses 8 cenários pra `e2e/d30-sprint-f.spec.ts`
5. Rodar via `npx playwright test --project=chromium`

Pré-cenário: seed DB com `db:seed:e2e` (criar fixtures se ainda não existir).

## Bugs regressionados nesta sessão

| Bug | Cenário | Fix |
|---|---|---|
| R93 | Cenário 3 | RPC `set_my_queue_paused` SECURITY DEFINER + check `rows_affected > 0` |
| R94 | Cenário 6 | useEffect em HelpDesk.tsx observa queueEvents + refetch assigned_to |
| R95 | Cenário 7 | handoffQueue.ts inclui department_id no UPDATE + redeploy 3 edge fns |

Detalhes: [[wiki/erros-e-licoes]] (R93, R94, R95).

## Smoke ao vivo nesta sessão (resumo)

- ✅ Cenário 1: navegação prod /login, app boota, 0 errors críticos no console (Playwright MCP)
- ✅ Cenários 2-7: validados manualmente em `localhost:8080` com SQL ao vivo
- ✅ Cenário 8: select de Agente Responsável funciona; aguarda usuária finalizar
