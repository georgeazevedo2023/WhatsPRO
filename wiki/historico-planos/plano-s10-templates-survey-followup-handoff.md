---
title: S10 — Templates + Survey + Followup + Handoff
tags: [s10, fluxos-v3, orchestrator, templates, survey, followup, handoff, plano]
sources: [wiki/fluxos-roadmap-sprints, supabase/functions/orchestrator]
updated: 2026-04-12
---

# S10 — Templates + Survey + Followup + Handoff

> **Objetivo:** Template "Vitrine" instala com 1 clique e funciona no WhatsApp end-to-end.
> **Complexidade:** G | **Sprint:** M18 Camada 4 — Completion

## Contexto

- S1–S8 concluídos ✅ (greeting, qualification, sales, support funcionais)
- S9 (validator/metrics/shadow) **não é pré-requisito** — validator roda pós-pipeline, independente dos novos subagentes
- DT2: UAZAPI `/send/menu` → 2–12 opções, max 100 chars ✅ (validado uazapi-proxy.ts:523)
- DT3: `process-follow-ups` existe (1h cron, usa `follow_up_executions`) → S10 cria **`process-flow-followups`** separado para não quebrar cadências AI Agent

---

## Entregas

| # | Entregável | Arquivo | Tamanho |
|---|-----------|---------|---------|
| T1 | Migration: RPC `install_flow_template` | `migrations/20260416000000_s10_install_flow_template.sql` | P |
| T2 | Types: SurveyConfig + FollowupConfig + HandoffConfig + menu media | `orchestrator/types.ts` | P |
| T3 | `subagents/survey.ts` | novo (≈150 linhas) | M |
| T4 | `subagents/followup.ts` | novo (≈80 linhas) | P |
| T5 | `subagents/handoff.ts` | novo (≈100 linhas) | P |
| T6 | Edge function `process-flow-followups` | `supabase/functions/process-flow-followups/index.ts` | M |
| T7 | 4 templates MVP instaláveis + hook | `src/data/flowTemplates.ts` + `src/hooks/useInstallTemplate.ts` | M |
| T8 | Frontend: botão Instalar em FlowTemplatesPage | `src/pages/dashboard/FlowTemplatesPage.tsx` | P |
| T9 | Wiring: index.ts (menu media) + subagents/index.ts + tsc | 2 arquivos existentes | P |

**Ordem:** T1 → T2 → (T3 + T4 + T5 em paralelo) → T6 → (T7 + T8 em paralelo) → T9

---

## T1 — Migration: RPC `install_flow_template`

**Arquivo:** `supabase/migrations/20260416000000_s10_install_flow_template.sql`

RPC PLPGSQL SECURITY DEFINER. Insere `flows` + `flow_steps[]` + `flow_triggers[]` em uma transação. Rollback automático se qualquer INSERT falhar (EXCEPTION sem COMMIT explícito).

```sql
CREATE OR REPLACE FUNCTION install_flow_template(
  p_instance_id TEXT,
  p_name        TEXT,
  p_slug        TEXT,
  p_description TEXT    DEFAULT NULL,
  p_template_id TEXT    DEFAULT NULL,
  p_steps       JSONB   DEFAULT '[]',
  p_triggers    JSONB   DEFAULT '[]'
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_flow_id UUID;
  v_step    JSONB;
  v_trigger JSONB;
  v_slug    TEXT := p_slug;
BEGIN
  -- Garante slug único (sufixo 4 chars se já existe)
  WHILE EXISTS (
    SELECT 1 FROM flows WHERE instance_id = p_instance_id AND slug = v_slug
  ) LOOP
    v_slug := p_slug || '-' || substr(gen_random_uuid()::text, 1, 4);
  END LOOP;

  INSERT INTO flows (instance_id, name, slug, description, template_id, mode, status)
  VALUES (p_instance_id, p_name, v_slug, p_description, p_template_id, 'active', 'active')
  RETURNING id INTO v_flow_id;

  FOR v_step IN SELECT jsonb_array_elements(p_steps) LOOP
    INSERT INTO flow_steps (flow_id, name, subagent_type, position, step_config, exit_rules)
    VALUES (
      v_flow_id,
      v_step->>'name',
      v_step->>'subagent_type',
      (v_step->>'position')::INT,
      COALESCE(v_step->'step_config', '{}'),
      COALESCE(v_step->'exit_rules', '[]')
    );
  END LOOP;

  FOR v_trigger IN SELECT jsonb_array_elements(p_triggers) LOOP
    INSERT INTO flow_triggers (flow_id, instance_id, trigger_type, trigger_config, priority)
    VALUES (
      v_flow_id,
      p_instance_id,
      v_trigger->>'trigger_type',
      COALESCE(v_trigger->'trigger_config', '{}'),
      COALESCE((v_trigger->>'priority')::INT, 50)
    );
  END LOOP;

  RETURN v_flow_id;
END;
$$;
```

**Teste de rollback:** inserir step com `subagent_type = 'invalido'` (viola CHECK) → confirmar que flow NÃO foi criado.

---

## T2 — Types: 3 interfaces + menu media

Adicionar em `supabase/functions/orchestrator/types.ts`:

```typescript
// ── Survey Config (S10) ───────────────────────────────────────────────────────
export interface SurveyConfig {
  title: string                    // "Como foi sua experiência?"
  options: string[]                // 2–12 opções (UAZAPI /send/menu limit)
  footer?: string                  // texto abaixo dos botões
  result_key?: string              // chave no step_data (default: 'survey_result')
  post_action?: 'next_step' | 'handoff' | 'complete' | 'tag_and_close'
  max_retries?: number             // tentativas antes de handoff (default: 2)
  tag_prefix?: string              // ex: 'nps' → gera tag 'nps:Ótimo!'
}

// ── Followup Config (S10) ─────────────────────────────────────────────────────
export interface FollowupConfig {
  delay_hours?: number             // horas antes de enviar (default: 24)
  message: string                  // suporta {nome} e {produto}
  post_action?: 'next_step' | 'complete' | 'handoff'
}

// ── Handoff Config (S10) ──────────────────────────────────────────────────────
export interface HandoffConfig {
  message?: string                 // mensagem de despedida ao lead
  briefing_template?: string       // template do briefing para atendente
  department?: string              // dept para atribuição no helpdesk
  tag?: string                     // tag adicional (ex: 'handoff:vendas')
  include_context?: boolean        // inclui histórico + qualificação (default: true)
}
```

Adicionar `'menu'` ao `SubagentMedia`:

```typescript
export interface SubagentMedia {
  type: 'image' | 'carousel' | 'poll' | 'menu'  // +menu = UAZAPI /send/menu
  // ... existing fields ...
  menu_title?: string              // título da lista (type=menu)
  menu_footer?: string             // rodapé da lista (type=menu)
}
```

---

## T3 — `subagents/survey.ts`

**Fluxo de execução:**

```
1ª entrada (waiting_for ≠ 'awaiting_survey'):
  → Valida: options.length entre 2 e 12 (UAZAPI limit)
  → Retorna media.type = 'menu' com options[]
  → step_data_patch: { waiting_for: 'awaiting_survey', survey_retry_count: 0 }
  → status: 'continue'

2ª+ entrada (waiting_for = 'awaiting_survey'):
  → Fuzzy match texto do lead vs options
    1. Número digitado ("1", "2"...) → índice
    2. Exact match (normalize: minúsculas, sem acentos)
    3. Starts with match
    4. Levenshtein ≤ 2 (para opções curtas)
  
  Match → step_data[result_key] = matched, waiting_for = undefined
         → tags_to_set: [tag_prefix + ':' + matched] se tag_prefix
         → status: 'advance'
  
  No match, retries < max_retries:
    → "Por favor, escolha uma das opções acima 😊"
    → survey_retry_count++
    → status: 'continue'
  
  No match, retries ≥ max_retries:
    → status: post_action (default: 'handoff')
```

**Assinatura:**
```typescript
export async function surveySubagent(
  input: SubagentInput<SurveyConfig>
): Promise<SubagentResult>
```

---

## T4 — `subagents/followup.ts`

**Mecanismo:** dois estágios separados.

**Estágio 1 — Agendamento (no pipeline do orchestrator):**
```
Primeira entrada no step:
  → NÃO envia mensagem ao lead
  → Interpola config.message: {nome} → lead_name, {produto} → products_shown[0]
  → step_data_patch:
      followup_scheduled_at: new Date(Date.now() + delay_hours * 3600_000).toISOString()
      followup_message: interpolated_message
      waiting_for: 'awaiting_followup'
  → status: 'continue'
```

**Estágio 2 — Execução (process-flow-followups cron, T6):**
```
Cron encontra este estado → envia followup_message → avança step
```

**Fluxo pós-envio (no cron T6):**
- Se `post_action = 'next_step'`: busca step com `position + 1`, atualiza `flow_state.flow_step_id`
- Se `post_action = 'complete'`: `finalizeFlowState(id, 'completed')`
- Se `post_action = 'handoff'`: `finalizeFlowState(id, 'handoff')`

---

## T5 — `subagents/handoff.ts`

**Fluxo:**
```
1. Gera briefing automático (se include_context = true):
   Nome: {lead_name} | Phone: {lead_phone}
   Tags: {tags[]}
   Qualificação: {step_data.qualification_answers}
   Produtos vistos: {step_data.products_shown[]}
   Último intent: {step_data.intent_history[0].intent}
   Mensagens no flow: {step_data.total_message_count}

2. Retorna:
   response_text: config.message ?? "Conectando com um atendente... 🤝"
   step_data_patch: { handoff_reason: 'manual_step', handoff_briefing: briefing }
   tags_to_set: [config.tag ?? 'handoff:agente']
   status: 'handoff'

3. orchestrator (index.ts) já lida com status='handoff':
   → finalizeFlowState(id, 'handoff')
   → logFlowEvent('handoff_triggered')
   → ⚠ ADICIONAR: broadcastEvent para helpdesk exibir briefing
```

**Adição em `index.ts` (case 'handoff'):**
```typescript
case 'handoff': {
  await finalizeFlowState(state.id, 'handoff')
  await logFlowEvent(...)
  // NOVO: broadcast briefing para helpdesk
  const briefing = result.step_data_patch?.handoff_briefing as string | undefined
  if (briefing && input.conversation_id) {
    fetchFireAndForget(`${SUPABASE_URL}/functions/v1/broadcast`, {
      body: JSON.stringify({
        conversation_id: input.conversation_id,
        event: 'handoff_briefing',
        data: { briefing },
      }),
    })
  }
  break
}
```

---

## T6 — Edge Function `process-flow-followups`

**Arquivo:** `supabase/functions/process-flow-followups/index.ts`

**Configuração:**
- `verify_jwt = false` (chamado por pg_cron)
- Cron: `0 * * * *` (a cada hora, igual ao process-follow-ups)

**Query principal:**
```sql
SELECT
  fs.id,
  fs.flow_id,
  fs.lead_id,
  fs.conversation_id,
  fs.instance_id,
  fs.flow_step_id,
  fs.step_data,
  fstep.step_config,
  fstep.exit_rules,
  fstep.position AS current_position
FROM flow_states fs
JOIN flow_steps fstep ON fs.flow_step_id = fstep.id
WHERE
  fs.status = 'active'
  AND fstep.subagent_type = 'followup'
  AND (fs.step_data->>'followup_scheduled_at')::timestamptz <= now()
  AND (fs.step_data->>'followup_sent') IS NULL
LIMIT 50
```

**Para cada resultado:**
1. Busca `contacts.jid` via `lead_profiles.id → contacts.contact_id`
2. Busca `instances.token` via `fs.instance_id`
3. Envia `followup_message` via UAZAPI `/send/text`
4. `UPDATE flow_states SET step_data = step_data || '{"followup_sent": true}' WHERE id = $fs_id`
5. Determina `post_action` do `step_config.post_action` (default: 'next_step')
6. Executa post_action:
   - `next_step`: busca `flow_steps WHERE flow_id = $flow_id AND position = current_position + 1`, atualiza `flow_states.flow_step_id`
   - `complete`: `UPDATE flow_states SET status = 'completed', completed_at = now()`
   - `handoff`: `UPDATE flow_states SET status = 'handoff', completed_at = now()`
7. `INSERT flow_events (followup_sent, event)`

---

## T7 — 4 Templates MVP Instaláveis

**Adicionar em `src/data/flowTemplates.ts`:**

```typescript
// Interface para templates com dados reais de instalação
export interface FlowInstallStep {
  position: number
  name: string
  subagent_type: 'greeting' | 'qualification' | 'sales' | 'support' | 'survey' | 'followup' | 'handoff'
  step_config: Record<string, unknown>
  exit_rules: Array<{ trigger: string; value?: number | string; action: string; message?: string }>
}

export interface FlowInstallTrigger {
  trigger_type: string
  trigger_config: Record<string, unknown>
  priority: number
}

export interface FlowInstallDefinition {
  template_id: string
  default_name: string
  default_slug: string
  description: string
  steps: FlowInstallStep[]
  triggers: FlowInstallTrigger[]
}
```

**T1 Vitrine** (greeting → qualification → sales → survey → handoff):
- Trigger: `conversation_started` + `keyword: ['catálogo', 'produtos', 'preço', 'comprar']`
- 5 steps: Saudação → Qualificação (1 campo: interesse) → Vitrine (max 5 produtos) → Pesquisa (3 opções NPS) → Atendente

**T2 SDR BANT** (greeting → qualification BANT → handoff):
- Trigger: `keyword: ['oi', 'olá', 'bom dia', 'boa tarde']` + `lead_created`
- 3 steps: Saudação → BANT (4 campos: budget, authority, need, timeline) → Atendente Comercial
- Exit rule qualificação: score BANT < 2 → handoff imediato (fora do perfil)

**T3 Suporte Técnico** (greeting → support → survey NPS):
- Trigger: `keyword: ['suporte', 'problema', 'ajuda', 'erro']` + `tag_added: precisa-suporte`
- 3 steps: Saudação → FAQ automático → NPS pós-atendimento

**T4 Pós-Venda** (greeting → followup D+7 → survey NPS):
- Trigger: `tag_added: cliente` + `funnel_entered`
- 3 steps: Boas-vindas cliente → Follow-up D+7 (24*7h delay) → NPS 30 dias

**Hook `useInstallTemplate`:**

```typescript
// src/hooks/useInstallTemplate.ts
import { useMutation } from '@tanstack/react-query'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { FLOW_INSTALL_DEFINITIONS } from '@/data/flowTemplates'
import { useSelectedInstance } from '@/hooks/useSelectedInstance'

export function useInstallTemplate() {
  const supabase = useSupabaseClient()
  const { selectedInstance } = useSelectedInstance()

  return useMutation({
    mutationFn: async (templateId: string) => {
      const def = FLOW_INSTALL_DEFINITIONS[templateId]
      if (!def) throw new Error(`Template não encontrado: ${templateId}`)

      const { data, error } = await supabase.rpc('install_flow_template', {
        p_instance_id: selectedInstance.id,
        p_name: def.default_name,
        p_slug: def.default_slug,
        p_description: def.description,
        p_template_id: def.template_id,
        p_steps: def.steps,
        p_triggers: def.triggers,
      })
      if (error) throw error
      return data as string // flow_id retornado pela RPC
    },
  })
}
```

---

## T8 — Frontend: FlowTemplatesPage

**Mudanças em `FlowTemplatesPage.tsx`:**

1. Importar `useInstallTemplate` e `FLOW_INSTALL_DEFINITIONS`
2. Adicionar badge "Instalação direta" nos 4 MVPs
3. Modificar `handleUseTemplate`:

```tsx
const { mutate: installTemplate, isPending: installing } = useInstallTemplate()

const handleUseTemplate = (template: FlowTemplate) => {
  if (FLOW_INSTALL_DEFINITIONS[template.id]) {
    // Template MVP → instalar via RPC (1 clique)
    installTemplate(template.id, {
      onSuccess: (flowId) => {
        toast.success(`"${template.name}" instalado com sucesso!`)
        navigate(`/dashboard/flows/${flowId}`)
      },
      onError: () => toast.error('Erro ao instalar template. Tente novamente.'),
    })
  } else {
    // Template sem definição → wizard manual
    navigate(`/dashboard/flows/new/wizard?mode=form&template=${template.id}`)
  }
}
```

4. Indicador visual no preview sheet: se `FLOW_INSTALL_DEFINITIONS[template.id]` existe, mostrar "⚡ Instala em 1 clique" + botão "Instalar agora" (com loading state `installing`).

---

## T9 — Wiring + TypeScript

**`subagents/index.ts`:** substituir 3 stubs por imports reais:
```typescript
import { surveySubagent } from './survey.ts'
import { followupSubagent } from './followup.ts'
import { handoffSubagent } from './handoff.ts'
import type { SurveyConfig, FollowupConfig, HandoffConfig } from '../types.ts'

// No SUBAGENT_MAP:
survey:  (ctx) => surveySubagent({ context: ctx, config: ctx.step_config as SurveyConfig }),
followup:(ctx) => followupSubagent({ context: ctx, config: ctx.step_config as FollowupConfig }),
handoff: (ctx) => handoffSubagent({ context: ctx, config: ctx.step_config as HandoffConfig }),
```

**`index.ts` (orchestrator) — `handleMediaSend`:** adicionar case para `type === 'menu'`:
```typescript
// Localizar a função handleMediaSend e adicionar:
if (result.media.type === 'menu') {
  await sendMenuToLead(input.instance_id, context.lead.lead_jid, result.media)
}
```

Implementar `sendMenuToLead` usando UAZAPI `/send/menu` (mesmo padrão de `sendCarouselToLead`).

**Verificação final:**
```bash
cd /c/projetos/claude/whatspro
npx tsc --noEmit
# Esperado: 0 erros
```

---

## Critério de Conclusão S10

**Demo ao vivo obrigatória:**
1. George acessa `/dashboard/flows/templates`
2. Clica "Instalar" no template "Vitrine"
3. Redireciona para `/dashboard/flows/{flow_id}` — flow criado com 5 steps + 2 triggers ✅
4. Envia "oi" no WhatsApp via instância de teste
5. Flow: saudação → qualificação → vitrine de produtos → survey (menu /send/menu) → handoff ✅
6. Follow-up agendado aparece após delay configurado ✅
7. `flow_states.status = 'handoff'` no DB ✅
8. `npx tsc --noEmit` = 0 erros ✅

---

## Arquivos Modificados / Criados

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/20260416000000_s10_install_flow_template.sql` | NOVO |
| `supabase/functions/orchestrator/types.ts` | EDITAR (+3 interfaces, +menu type) |
| `supabase/functions/orchestrator/subagents/survey.ts` | NOVO |
| `supabase/functions/orchestrator/subagents/followup.ts` | NOVO |
| `supabase/functions/orchestrator/subagents/handoff.ts` | NOVO |
| `supabase/functions/process-flow-followups/index.ts` | NOVO |
| `supabase/functions/orchestrator/subagents/index.ts` | EDITAR (wire 3 stubs) |
| `supabase/functions/orchestrator/index.ts` | EDITAR (menu media + handoff briefing) |
| `src/data/flowTemplates.ts` | EDITAR (+interfaces +4 install definitions) |
| `src/hooks/useInstallTemplate.ts` | NOVO |
| `src/pages/dashboard/FlowTemplatesPage.tsx` | EDITAR (botão instalar + badge) |

**Total: 6 novos + 5 editados = 11 arquivos**

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| `install_flow_template` RPC sem rollback real | Testar EXCEPTION: inserir step com `subagent_type` inválido → confirmar flow não existe |
| `/send/menu` falha com > 12 opções | Validar `options.length ≤ 12` no surveySubagent antes de retornar media |
| `process-flow-followups` avança step errado | Usar `position + 1` na query — se não existir próximo step, finalizar como 'completed' |
| `useInstallTemplate` usa `selectedInstance` diferente do hook padrão | Verificar hook correto de instância antes de implementar |
