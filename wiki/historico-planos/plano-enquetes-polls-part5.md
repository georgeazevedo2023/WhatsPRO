---
title: Plano Enquetes/Polls (parte 5)
type: plano-historico
updated: 2026-05-11
---

# Plano Enquetes/Polls — parte 5/5

> Plano shipado. Read-only.

## 6. Checklist SYNC RULE (8 locais)

Cada fase DEVE verificar:

| # | Local | Fase |
|---|-------|------|
| 1 | **Banco** — automation_rules (F1), funnels.funnel_prompt (F1), poll_messages/responses (F4), poll_* em ai_agents (F4) | F1, F4 |
| 2 | **Types.ts** — Row/Insert/Update de novas tabelas + campos | F1, F4 |
| 3 | **Admin UI** — AutomationRulesTab (F1), FunnelConfig roteiro (F2), PollConfigSection + PollTemplateEditor (F5) | F1, F2, F5 |
| 4 | **ALLOWED_FIELDS** — 11 campos poll_* | F5 |
| 5 | **Backend (ai-agent)** — funnel_instructions (F2), tool send_poll (F4), sideEffectTools, prompt | F2, F4 |
| 6 | **Backend (engine)** — automationEngine.ts + integracao nos triggers | F1, F3, F4 |
| 7 | **system_settings defaults** — defaults de poll_templates para novos agentes | F5 |
| 8 | **Documentacao** — CLAUDE.md + PRD.md + memory + vault | Todas |

---

## 7. Riscos e Mitigacoes

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|---------------|---------|-----------|
| Endpoint /send/poll nao existe na UAZAPI v2 | Media | Alto | Task 1.1: testar ANTES de tudo. Se falhar, contactar suporte UAZAPI ou enviar via Baileys direto |
| Webhook poll_update nao chega ou formato diferente | Media | Alto | Task 1.1: capturar webhook real. Handler aceita multiplos event names |
| Lead muda voto (duplicata) | Baixa | Baixo | UPSERT com ON CONFLICT (poll_message_id, voter_jid) |
| WhatsApp rate limit em polls em massa | Media | Medio | Respeitar delays de broadcast (5-20min entre lotes) |
| Poll nao funciona em WhatsApp Business Cloud API | Certa | Info | Documentar que funciona apenas via UAZAPI. NAO e limitacao do WhatsPRO |
| NPS enviado em momento ruim (lead irritado) | Baixa | Medio | Delay configuravel + nao enviar se conversa teve handoff por frustração |
| Transbordo: vendedor escolhido fica offline | Media | Medio | Fallback: se vendedor nao responde em 2min, redirecionar para disponivel |

---

## 8. Arquivos que Serao Criados/Modificados

### Novos (~22 arquivos)
```
# F1 — Motor de Automacao
supabase/migrations/2026XXXX_automation.sql
supabase/functions/_shared/automationEngine.ts
src/hooks/useAutomationRules.ts
src/components/funnels/AutomationRulesTab.tsx
src/components/funnels/AutomationRuleEditor.tsx
src/lib/__tests__/automationEngine.test.ts

# F2 — Funis Agenticos
src/hooks/useFunnelConfig.ts
src/lib/funnelPromptTemplates.ts
src/lib/__tests__/funnelPrompt.test.ts

# F3 — Tags & Integracao
supabase/functions/_shared/funnelActivator.ts
supabase/functions/_shared/autoTag.ts
src/components/shared/ActionSelector.tsx
src/lib/__tests__/funnelActivator.test.ts

# F4 — Enquetes
supabase/migrations/2026XXXX_polls.sql
src/types/polls.ts
src/hooks/usePolls.ts
src/components/broadcast/PollEditor.tsx
src/components/broadcast/PollTemplateSelector.tsx
src/lib/__tests__/polls.test.ts

# F5 — NPS + Metricas
src/hooks/usePollMetrics.ts
src/components/admin/PollConfigSection.tsx
src/components/admin/PollTemplateEditor.tsx
src/components/dashboard/PollMetricsCard.tsx
src/components/dashboard/PollNpsChart.tsx
```

### Modificados (~14 arquivos)
```
# F1
src/pages/dashboard/FunnelDetail.tsx           — 4a tab Automacoes

# F2
supabase/functions/ai-agent/index.ts           — funnel_instructions + handoff rule
src/components/funnels/FunnelWizard.tsx         — pre-preencher roteiro

# F3
supabase/functions/form-public/index.ts        — usar activateFunnel()
supabase/functions/bio-public/index.ts          — usar activateFunnel()
supabase/functions/whatsapp-webhook/index.ts    — usar activateFunnel() + poll_update + tag triggers
src/components/broadcast/BroadcastMessageForm.tsx — ActionSelector

# F4
supabase/functions/uazapi-proxy/index.ts       — case send-poll + send-poll-with-image
supabase/functions/ai-agent/index.ts           — tool send_poll + transbordo
supabase/functions/form-bot/index.ts           — field_type poll
src/components/helpdesk/MessageBubble.tsx       — render poll + poll_response
src/lib/broadcastSender.ts                     — sendPollToNumber
src/components/broadcast/BroadcastMessageForm.tsx — 4a aba Enquete
src/components/broadcast/LeadMessageForm.tsx    — 4a aba Enquete

# F5
src/components/admin/AIAgentTab.tsx             — ALLOWED_FIELDS + PollConfigSection
src/pages/dashboard/DashboardHome.tsx           — PollMetricsCard + PollNpsChart
src/integrations/supabase/types.ts              — regenerar via CLI (F1 e F4)
```

---

*Documentado em: 2026-04-08*
*Autor: Claude Code + George Azevedo*
*Status: Plano detalhado — 8 decisoes aprovadas, 5 fases definidas*
*Proximo passo: Fase 1 (Motor de Automacao) — nao depende de teste UAZAPI*
*Pre-requisito do UAZAPI: necessario apenas na Fase 4 (Task 4.1)*
