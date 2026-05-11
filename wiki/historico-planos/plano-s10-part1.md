---
title: Plano S10 Templates/Survey/Followup/Handoff (parte 1)
type: plano-historico
description: S10 Templates/Survey/Followup/Handoff (parte 1) — migration + types + survey + followup
updated: 2026-05-11
---

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

