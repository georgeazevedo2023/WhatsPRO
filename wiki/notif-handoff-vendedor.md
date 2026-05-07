---
title: Notificação de Vendedor por WhatsApp no Handoff
tags: [feature, handoff, whatsapp, notif]
sources: [PRD.md v7.32.0, .planning/phases/notify-vendor-handoff/PLAN.md]
updated: 2026-05-07
---

# Notificação de Vendedor por WhatsApp no Handoff

> Quando lead é atribuído a um vendedor (via Lucas default ou Robin lista-on), o vendedor recebe ping no WhatsApp pessoal com nome do cliente, última msg e link direto pro chat no helpdesk. **Shipped MVP em 2026-05-07.**

---

## Por que existe

Lead morno (ex.: Eletropiso, piso vinílico) esfria em 10-15min. Hoje vendedor precisa estar logado no painel pra perceber atribuição — se tá na rua/almoço/outro app, lead espera. Notif no WhatsApp pessoal traz vendedor de volta em segundos.

## Como funciona (resumo)

```
[Lead novo → AI atribui Lucas via fila]
  → assignHandoff() em _shared/handoffQueue.ts
    → UPDATE conversations.assigned_to = lucas_id, assigned_at = now()
    → fire-and-forget POST notify-vendor-assignment
      → 8 guards (skip silencioso + log)
      → Se passou tudo: envia msg via UAZAPI pro WhatsApp pessoal do Lucas
```

**Mensagem enviada:**
```
🔔 Novo atendimento, Lucas!

👤 Cliente: João Silva
📱 WhatsApp: +55 11 9 8765-4321
💬 Última msg: vocês entregam em SP capital?
⏰ Aguardando há: 2 min

Atender: https://crm.wsmart.com.br/dashboard/helpdesk?conv=abc123
```

## Sem janela 24h (UAZAPI ≠ Business API oficial)

UAZAPI usa WhatsApp Web protocol (chip), **não tem janela 24h formal** (regra da Business API oficial Meta). Vendedor cadastra número uma vez e pronto — sem handshake, sem renovação. Risco real é **banimento de chip** por uso abusivo, mitigado por:

- Rate limit 3/hora por vendedor.
- Batching de rajada (msg compacta se outra <60s atrás).
- `business_hours` por agent.

## 7 guards (skip silencioso + log em `notification_log.skip_reason`)

| Reason | Quando |
|--------|--------|
| `skip_disabled` | `instance_settings.notifications_enabled = false` |
| `skip_optout` | Vendedor desativou opt-in (`notify_on_assignment = false`) |
| `skip_no_number` | Vendedor sem `personal_whatsapp` cadastrado |
| `skip_paused` | Admin/gestor pausou via `notifications_paused_until` |
| `skip_off_hours` | Fora de business_hours |
| `skip_queue_paused` | Vendedor pausou a fila no helpdesk header |
| `skip_rate_limited` | Mais de 3 notif/hora pro mesmo vendedor |
| `skip_no_instance_token` | Instância sem token UAZAPI configurado |

## Tabelas tocadas

- `user_profiles` — 6 colunas (personal_whatsapp + notify_on_assignment + 4 paused-related).
- `conversations` — `assigned_at TIMESTAMPTZ` novo.
- `instance_settings` — tabela nova (PK `instance_id`, FK `instances`). Feature flag `notifications_enabled`.
- `notification_log` — tabela nova. UNIQUE (conv, vendor) garante idempotência.

## Edge functions

- `notify-vendor-assignment` — pipeline com 7 guards + envio via UAZAPI + log + batching.
- `escalate-stale-handoffs` — cron 1min: re-ping em 5min, alerta gerente em 10min se vendor não respondeu.
- `_shared/handoffQueue.ts` — após UPDATE `assigned_to + assigned_at`, dispara fetch fire-and-forget com `previous_assigned_to_id` pra notif de reatribuição órfã.

## RPC

`pause_user_notifications(_target_user_id, _until, _reason)` — super_admin OK pra qualquer vendedor; gerente só pra mesmo dept; rejeita cross-dept com `forbidden_cross_dept`. Reativar = `_until = NULL`.

## Onde está a UI

| Função | Localização |
|--------|-------------|
| Cadastrar número/toggle/pausar vendedor | Admin → Equipe → expand vendedor → seção "Notificações WhatsApp" |
| Toggle por instância (feature flag on/off) | Admin → Caixas → card da inbox → seção "Notificações WhatsApp pra vendedores" |
| Histórico de envios + skips | Admin → /dashboard/admin/notifications |
| Banner no helpdesk (vendedor) | Header do helpdesk — só aparece se vendor não tem `personal_whatsapp` cadastrado |

## Gaps resolvidos em v7.32.1 (2026-05-07)

1. ✅ **Gap A** — `business_hours` real (era placeholder hardcoded `true`).
2. ✅ **Gap B** — Notif "removido" pro vendor anterior em reatribuição.
3. ✅ **Gap C** — Escalation 5min/10min via cron `notify-vendor-escalation` + edge function `escalate-stale-handoffs`.
4. ✅ **Gap D** — Batching de rajada (msg compacta se outra notif <60s atrás).
5. ✅ **Gap E** — Custo UAZAPI estimado exibido no painel admin (R$ 0,08/msg × count).
6. ✅ **Gap F** — KPI `kpi_avg_first_response_minutes(days)` (avg/p50/p90 do tempo até 1ª resposta).
7. ✅ **Gap G** — Banner "no_number" alerta vendedor sem cadastro.

## Roadmap F3+ (dependente de fator externo)

- **Gap I** — Template HSM Meta (aprovação 1-3 dias + custo recorrente ~R$ 0,10-0,30/msg).
- **Gap J** — LGPD termo formal com timestamp/IP (decisão jurídica + UI nova).
- **Gap K** — i18n da mensagem (só pt-BR ok p/ escopo BR atual).
- **Gap L** — Multi-org isolation (precisa `instances.org_id` — refactor estrutural).
- **Gap M** — Validação periódica de número (cron mensal — vendedor demitido).
- Dashboard tempo Disponível vs Pausado por vendedor (precisa `queue_pause_history` audit).

Plan completo + decisões em [[../.planning/phases/notify-vendor-handoff/PLAN.md]] e [[../.planning/phases/notify-vendor-handoff/RESEARCH.md]].
