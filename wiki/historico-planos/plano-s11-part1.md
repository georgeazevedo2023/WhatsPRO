---
title: Plano S11 Conversa Guiada FlowEditor (parte 1)
type: plano-historico
description: S11 Conversa Guiada FlowEditor (parte 1) — migration + types backend + edge function + types frontend
updated: 2026-05-11
---

---
title: S11 — Conversa Guiada + FlowEditor Completo
tags: [s11, fluxos-v3, orchestrator, guided-builder, floweditor, subagentes, m18]
sources: [wiki/fluxos-roadmap-sprints, wiki/plano-s10-templates-survey-followup-handoff]
updated: 2026-04-12
---

# S11 — Conversa Guiada + FlowEditor Completo

> **Objetivo:** FlowEditor com tab Subagentes funcional (CRUD steps + config forms + drag-and-drop) + edge function `guided-flow-builder` para criação de flows via chat com IA.
> **Complexidade:** G | **Sprint:** M18 Camada 4 — Completion

## Contexto

- S1–S9 concluídos ✅ (greeting, qualification, sales, support, validator, metrics, shadow)
- S10 ainda não executado — survey/followup/handoff são **stubs** em `subagents/index.ts`
- S11 inclui os **tipos TypeScript** (SurveyConfig, FollowupConfig, HandoffConfig) que S10 precisará, e os **config forms UI** para esses tipos
- FlowDetail.tsx tem tab Subagentes como stub ("Disponível em breve")
- `@dnd-kit/core` e `@dnd-kit/sortable` já instalados (package.json)
- `flow_steps` já existe no banco (14 tabelas do S1)

---

## Entregas

| # | Entregável | Arquivo | Agente | Tam |
|---|-----------|---------|--------|-----|
| T1 | Migration `guided_sessions` | `supabase/migrations/20260416000001_s11_guided_sessions.sql` | A1 | P |
| T2 | Types backend: +menu em SubagentMedia + GuidedMessage | `supabase/functions/orchestrator/types.ts` | A1 | P |
| T3 | Edge function `guided-flow-builder` | `supabase/functions/guided-flow-builder/index.ts` | A1 | M |
| T4 | Types frontend: FlowStep + SubagentType | `src/types/flows.ts` | A2 | P |
| T5 | Hook `useFlowSteps` (CRUD) | `src/hooks/useFlowSteps.ts` | A2 | P |
| T6 | `StepConfigForm` (8 tipos) | `src/components/flows/StepConfigForm.tsx` | A2 | M |
| T7 | `FlowStepsPanel` (drag-and-drop + CRUD) | `src/components/flows/FlowStepsPanel.tsx` | A2 | M |
| T8 | `FlowIntelPanel` (métricas do flow) | `src/components/flows/FlowIntelPanel.tsx` | A3 | M |
| T9 | `GuidedFlowBuilderModal` (chat com IA) | `src/components/flows/GuidedFlowBuilderModal.tsx` | A3 | M |
| T10 | Integração FlowDetail.tsx + FlowNewPage.tsx + tsc | Arquivos editados | Main | P |

**Ordem de execução:**
- Fase 0 (Main): T1 → T2 aplicado (types.ts editado) — rápido, desbloqueia os agentes
- Fase 1 (paralelo): A1 faz T3 | A2 faz T4+T5+T6+T7 | A3 faz T8+T9
- Fase 2 (Main): T10 — integração final + tsc 0 erros

**Arquivos:** 6 novos + 4 editados = 10 arquivos. Conflito zero: A2 e A3 criam componentes novos, Main integra no FlowDetail.

---

## T1 — Migration `guided_sessions`

**Arquivo:** `supabase/migrations/20260416000001_s11_guided_sessions.sql`

```sql
CREATE TABLE IF NOT EXISTS guided_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id   TEXT NOT NULL,
  messages      JSONB NOT NULL DEFAULT '[]',
  draft_flow    JSONB,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para limpeza eficiente
CREATE INDEX idx_guided_sessions_expires ON guided_sessions (expires_at);

-- RLS (apenas a service role acessa — chamada via edge function)
ALTER TABLE guided_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_only" ON guided_sessions USING (false);

-- Cron de limpeza: todo dia às 2h
SELECT cron.schedule(
  'cleanup-guided-sessions',
  '0 2 * * *',
  $$DELETE FROM guided_sessions WHERE expires_at < now()$$
);
```

---

## T2 — Types Backend: SubagentMedia + GuidedMessage

> **AUDITORIA:** `SurveyConfig`, `FollowupConfig`, `HandoffConfig` já existem em `types.ts` (L228-253). NÃO duplicar.

**Arquivo:** `supabase/functions/orchestrator/types.ts`

**Mudança 1 — Adicionar `'menu'` ao `SubagentMedia` (linha ~136):**
```typescript
// ANTES:
export interface SubagentMedia {
  type: 'image' | 'carousel' | 'poll'

// DEPOIS:
export interface SubagentMedia {
  type: 'image' | 'carousel' | 'poll' | 'menu'
  // Campos novos para type=menu:
  menu_title?: string              // título da lista de opções
  menu_footer?: string             // rodapé da lista
```

**Mudança 2 — Adicionar `GuidedMessage` ao final do arquivo:**
```typescript
// ── Guided Session Messages (S11) ────────────────────────────────────────────
export interface GuidedMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}
```

---

## T3 — Edge Function `guided-flow-builder`

**Arquivo:** `supabase/functions/guided-flow-builder/index.ts`

**Config:** `verify_jwt = true` (chamada pelo admin autenticado)

**POST body:**
```typescript
{
  session_id?: string    // null = nova sessão
  message: string        // pergunta/instrução do admin
  instance_id: string    // para contexto (catálogo, funis, agent configs)
}
```

**Response:**
```typescript
{
  session_id: string
  assistant_message: string
  draft_flow: {
    name: string
    description: string
    steps: Array<{
      position: number
      name: string
      subagent_type: 'greeting' | 'qualification' | 'sales' | 'support' | 'survey' | 'followup' | 'handoff'
      step_config: Record<string, unknown>
      exit_rules: unknown[]
    }>
    triggers: Array<{
      trigger_type: string
      trigger_config: Record<string, unknown>
      priority: number
    }>
  } | null
  suggestions: string[]  // próximas perguntas sugeridas
}
```

**Fluxo:**

```
1. Busca ou cria guided_session (instance_id, session_id)
2. Contexto do LLM:
   - System prompt: schema completo dos subagents (8 tipos + configs)
   - Dicas: "se instance tem catálogo → sugerir step sales; se tem bio page → sugerir trigger bio_link"
   - Formato: "retorne SEMPRE JSON com campos assistant_message + draft_flow + suggestions"
3. Append user message em guided_sessions.messages
4. Call gpt-4.1-mini com messages history + system
5. Parse response:
   - Se JSON válido → extrai draft_flow, suggestions
   - Se JSON inválido → retry 1x com "responda APENAS JSON válido"
   - Se ainda inválido → draft_flow: null, assistant_message: resposta bruta
6. UPDATE guided_sessions SET messages = messages || [user_msg, assistant_msg], draft_flow = draft_flow
7. Retorna response
```

**System prompt core (incluir no arquivo):**
```
Você é um assistente especializado em criar fluxos de atendimento WhatsApp.
Subagentes disponíveis: greeting, qualification, sales, support, survey, followup, handoff.
Pergunte sobre o objetivo do flow, depois construa step a step.
Retorne SEMPRE JSON: { "assistant_message": "...", "draft_flow": {...} | null, "suggestions": [...] }
```

**CORS:** `getDynamicCorsHeaders(req)` — obrigatório.

---

## T4 — Types Frontend

> **AUDITORIA:** `flow_steps` já existe em `src/integrations/supabase/types.ts` (L1739). Basta re-exportar.

**Arquivo:** `src/types/flows.ts` — ADICIONAR no topo com os outros tipos:

```typescript
// FlowStep (da tabela flow_steps — já no auto-generated types)
export type FlowStep = Database['public']['Tables']['flow_steps']['Row']
export type FlowStepInsert = Database['public']['Tables']['flow_steps']['Insert']
export type FlowStepUpdate = Database['public']['Tables']['flow_steps']['Update']

// Tipos válidos de subagente
export type SubagentType =
  | 'greeting'
  | 'qualification'
  | 'sales'
  | 'support'
  | 'survey'
  | 'followup'
  | 'handoff'
  | 'custom'

export const SUBAGENT_TYPE_LABELS: Record<SubagentType, string> = {
  greeting:      'Saudação',
  qualification: 'Qualificação',
  sales:         'Vendas',
  support:       'Suporte',
  survey:        'Enquete',
  followup:      'Follow-up',
  handoff:       'Atendente Humano',
  custom:        'Personalizado',
}

export const SUBAGENT_TYPE_DESCRIPTIONS: Record<SubagentType, string> = {
  greeting:      'Coleta nome e saúda o lead',
  qualification: 'Faz perguntas e qualifica o lead',
  sales:         'Mostra produtos do catálogo',
  support:       'Responde dúvidas via base de conhecimento',
  survey:        'Coleta resposta via menu de opções',
  followup:      'Agenda mensagem após N horas',
  handoff:       'Transfere para atendente humano com briefing',
  custom:        'Lógica personalizada',
}
```

---

## T5 — Hook `useFlowSteps`

**Arquivo:** `src/hooks/useFlowSteps.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import type { FlowStep, FlowStepInsert, FlowStepUpdate } from '@/types/flows'

export function useFlowSteps(flowId: string | undefined) { ... }       // SELECT * ORDER BY position
export function useCreateFlowStep() { ... }                              // INSERT
export function useUpdateFlowStep() { ... }                              // UPDATE (step_config, name, exit_rules)
export function useDeleteFlowStep() { ... }                              // DELETE
export function useReorderFlowSteps() { ... }                           // UPDATE position bulk
```

`useReorderFlowSteps`: recebe `[{ id: string, position: number }]` → UPDATE em lote via Promise.all (flow_steps não tem RPC de reorder, usar UPDATE individual).

Invalidação: `['flow-steps', flowId]` em todas as mutations.

---

