---
title: Plano S10 Templates/Survey/Followup/Handoff (parte 2)
type: plano-historico
updated: 2026-05-11
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
