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

## T6 — `StepConfigForm` (8 tipos)

**Arquivo:** `src/components/flows/StepConfigForm.tsx`

Props:
```typescript
interface StepConfigFormProps {
  subagentType: SubagentType
  config: Record<string, unknown>
  onChange: (newConfig: Record<string, unknown>) => void
}
```

**Formulário por tipo:**

| Tipo | Campos exibidos |
|------|----------------|
| `greeting` | known_lead_message, ask_name_message, greeting_message |
| `qualification` | fields[] (nome+tipo+required), mode (fixed/adaptive), post_action |
| `sales` | max_products, search_fail_threshold, post_action |
| `support` | confidence_threshold, unanswered_limit, post_action |
| `survey` | title, options[] (add/remove até 12), footer, tag_prefix, max_retries, post_action |
| `followup` | delay_hours, message (com hint {nome}/{produto}), post_action |
| `handoff` | message, department, tag, include_context |
| `custom` | JSON editor (textarea raw JSONB) |

Implementação: componentes simples com Input/Select/Switch/Textarea. Para `qualification.fields[]` e `survey.options[]`: lista com botão "Adicionar" e "Remover". Sem validação complexa (o backend valida).

---

## T7 — `FlowStepsPanel`

**Arquivo:** `src/components/flows/FlowStepsPanel.tsx`

Props:
```typescript
interface FlowStepsPanelProps {
  flowId: string
}
```

**Layout:**
```
[+ Adicionar step] (botão direita)

┌─ Step 1: Saudação [greeting] ──────────── [Editar] [Excluir] [☰]
│  ...config preview (2 campos principais)
└──────────────────────────────────────────────────────────────────

┌─ Step 2: Qualificação [qualification] ─── [Editar] [Excluir] [☰]
│  ...
└──────────────────────────────────────────────────────────────────
```

**Drag-and-drop:** `@dnd-kit/sortable` (`SortableContext` + `useSortable`). Ao soltar → `useReorderFlowSteps` com nova ordem de positions.

**Sheet de edição:** usa `StepConfigForm` dentro de um Sheet. Ao salvar → `useUpdateFlowStep`.

**Adicionar step:** Dialog com seletor de `SubagentType` (cards com ícone + label + description) → cria step na próxima position.

---

## T8 — `FlowIntelPanel`

**Arquivo:** `src/components/flows/FlowIntelPanel.tsx`

Props: `{ flowId: string }`

**Dados:** busca de `flow_events` WHERE `flow_id = $flowId` ORDER BY `created_at DESC` LIMIT 100.

**Seções:**
1. **KPIs (cards):** Total mensagens processadas | Conversas ativas | Taxa de handoff | Custo médio (tokens)
2. **Top 5 Intents:** tabela simples (intent, count) — agrupa `flow_events.event_type = 'intent_detected'` e lê `event_data->>'intent'`
3. **Validator Stats:** total corrections + blocks nas últimas 24h
4. **Últimos eventos:** lista simples (tipo, timestamp, detalhes) — 10 mais recentes

Hook interno `useFlowEvents(flowId)`: query simples com React Query.

---

## T9 — `GuidedFlowBuilderModal`

**Arquivo:** `src/components/flows/GuidedFlowBuilderModal.tsx`

Props:
```typescript
interface GuidedFlowBuilderModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (draft: DraftFlow) => void  // DraftFlow: { name, steps[], triggers[] }
  instanceId: string
}
```

**Layout:**
```
┌─ Criar Fluxo com IA ───────────────────────────────────────────┐
│                                                                  │
│  [Mensagem do assistente]                                        │
│  [Mensagem do usuário]                                           │
│  ...histórico de chat...                                         │
│                                                                  │
│  Sugestões: [btn] [btn] [btn]                                    │
│                                                                  │
│  [Input de texto] [Enviar]                                       │
│                                                                  │
│  Preview do flow:                                                │
│  ┌─ Vitrine de Produtos ─────────────────────────────────────┐  │
│  │ 3 steps: Saudação → Vendas → Enquete                      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│                          [Cancelar] [Usar este fluxo]            │
└──────────────────────────────────────────────────────────────────┘
```

**Fluxo:**
1. POST `/functions/v1/guided-flow-builder` com `{ message, session_id, instance_id }`
2. Atualiza chat history + draft preview
3. Botões de sugestão → preenche input + envia automaticamente
4. "Usar este fluxo" → `onApply(draft_flow)` → fecha modal

**Estados:** loading (spinner no input), error (toast), empty (mensagem inicial do assistente).

---

## T10 — Integração FlowDetail.tsx + FlowNewPage.tsx

**FlowDetail.tsx:**

1. Adicionar import `FlowStepsPanel` + `FlowIntelPanel`
2. Adicionar tab "Inteligência" na TabsList (entre Subagentes e Publicar)
3. Substituir tab Subagentes stub por `<FlowStepsPanel flowId={id!} />`
4. Adicionar `<TabsContent value="inteligencia"><FlowIntelPanel flowId={id!} /></TabsContent>`
5. Atualizar TabsList: `Identidade | Gatilhos | Subagentes | Inteligência | Publicar`

**FlowNewPage.tsx:**

> **AUDITORIA:** O card "Conversa Guiada" já existe em `FlowNewPage.tsx` mas está `disabled: true, comingSoon: true`. Não reconstruir — apenas ativar.

1. Remover `disabled: true` e `comingSoon: true` do card "Conversa Guiada"
2. Adicionar `path: ''` → substituir por lógica de modal (onClick abre `GuidedFlowBuilderModal`)
3. Importar `GuidedFlowBuilderModal` + state `guidedOpen`
4. `onApply(draft)` → chama `useCreateFlow` + navega para o flow criado

**tsc:**
```bash
cd /c/projetos/claude/whatspro
npx tsc --noEmit
# Esperado: 0 erros
```

---

## Critério de Conclusão S11

**Demo ao vivo obrigatória:**
1. George abre `/dashboard/flows/{id}` → vê 5 tabs ✅
2. Tab Subagentes: drag-and-drop reordena steps → order persiste após F5 ✅
3. Edita config de step `qualification` → salva → mudança persistida no DB ✅
4. Tab Inteligência: KPIs carregam com dados reais de flow_events ✅
5. FlowNewPage: clica "Criar com IA" → modal abre → digita "quero uma vitrine de produtos" → assistente responde + preview aparece ✅
6. "Usar este fluxo" → flow criado com steps corretos ✅
7. `npx tsc --noEmit` = 0 erros ✅

---

## Arquivos Modificados / Criados

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/20260416000001_s11_guided_sessions.sql` | NOVO |
| `supabase/functions/orchestrator/types.ts` | EDITAR (+SurveyConfig +FollowupConfig +HandoffConfig +GuidedMessage) |
| `supabase/functions/guided-flow-builder/index.ts` | NOVO |
| `src/types/flows.ts` | EDITAR (+FlowStep +SubagentType +labels +descriptions) |
| `src/hooks/useFlowSteps.ts` | NOVO |
| `src/components/flows/StepConfigForm.tsx` | NOVO |
| `src/components/flows/FlowStepsPanel.tsx` | NOVO |
| `src/components/flows/FlowIntelPanel.tsx` | NOVO |
| `src/components/flows/GuidedFlowBuilderModal.tsx` | NOVO |
| `src/pages/dashboard/FlowDetail.tsx` | EDITAR (+2 tabs integradas) |
| `src/pages/dashboard/FlowNewPage.tsx` | EDITAR (+botão IA +modal) |

**Total: 7 novos + 4 editados = 11 arquivos**

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| LLM guided-builder gera JSON inválido | Retry 1x + fallback draft_flow: null com mensagem clara |
| `useReorderFlowSteps` causa race condition em updates paralelos | UPDATE sequencial com Promise.all limitado (não paralelo) — usar `for...of` |
| `StepConfigForm` para `qualification.fields[]` fica complexo | MVP: apenas 3 campos principais (field_name, field_type, required) — full edit via JSON |
| FlowDetail.tsx fica muito grande (390 linhas + 2 novos tabs) | Tabs já usam componentes extraídos — FlowDetail só importa e monta |
| `guided_sessions` cron pg_cron não existe no projeto | Verificar se pg_cron está habilitado antes da migration |

---

## Split de Agentes

### Agente 1 — Backend (T1 + T2 + T3)
- `supabase/migrations/20260416000001_s11_guided_sessions.sql`
- `supabase/functions/orchestrator/types.ts` (+4 interfaces)
- `supabase/functions/guided-flow-builder/index.ts` (nova edge function)

### Agente 2 — Steps Panel (T4 + T5 + T6 + T7)
- `src/types/flows.ts` (+FlowStep +SubagentType)
- `src/hooks/useFlowSteps.ts`
- `src/components/flows/StepConfigForm.tsx`
- `src/components/flows/FlowStepsPanel.tsx`

### Agente 3 — UI Avançada (T8 + T9)
- `src/components/flows/FlowIntelPanel.tsx`
- `src/components/flows/GuidedFlowBuilderModal.tsx`

### Main — Integração (T10)
- `src/pages/dashboard/FlowDetail.tsx`
- `src/pages/dashboard/FlowNewPage.tsx`
- `npx tsc --noEmit`
