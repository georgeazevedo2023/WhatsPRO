---
title: Plano S11 Conversa Guiada FlowEditor (parte 2)
type: plano-historico
description: S11 Conversa Guiada FlowEditor (parte 2) — hook + 8 tipos step + FlowStepsPanel + FlowIntelPanel
updated: 2026-05-11
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
