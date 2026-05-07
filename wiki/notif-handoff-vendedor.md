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

## Janela WhatsApp 24h (limitação aceita)

WhatsApp Business só permite mensagem livre se contato mandou msg pra empresa nas últimas 24h. **Vendedor precisa "renovar handshake" no início do turno** — manda qualquer msg pro WhatsApp da empresa, sistema responde "✅ Notificações ativas pelas próximas 24h, Lucas!".

- Sem isso: notif **não envia** (skip `skip_session_expired`).
- UI alerta: badge ⚠️ no painel admin + banner amarelo/vermelho no helpdesk header do próprio vendedor.

## 8 guards (skip silencioso + log em `notification_log.skip_reason`)

| Reason | Quando |
|--------|--------|
| `skip_disabled` | `instance_settings.notifications_enabled = false` |
| `skip_optout` | Vendedor desativou opt-in (`notify_on_assignment = false`) |
| `skip_no_number` | Vendedor sem `personal_whatsapp` cadastrado |
| `skip_session_expired` | Janela WhatsApp 24h expirou |
| `skip_paused` | Admin/gestor pausou via `notifications_paused_until` |
| `skip_off_hours` | Fora de business_hours (D30 Sprint A) |
| `skip_queue_paused` | Vendedor pausou a fila no helpdesk header |
| `skip_rate_limited` | Mais de 3 notif/hora pro mesmo vendedor |

## Tabelas tocadas

- `user_profiles` — 8 colunas novas (personal_whatsapp + notify + handshake + session_until + 4 paused).
- `conversations` — `assigned_at TIMESTAMPTZ` novo.
- `instance_settings` — tabela nova (PK `instance_id`, FK `instances`). Feature flag `notifications_enabled`.
- `notification_log` — tabela nova. UNIQUE (conv, vendor) garante idempotência.

## Edge functions

- `notify-vendor-assignment` (nova) — pipeline com 8 guards + envio via UAZAPI + log.
- `whatsapp-webhook` (modificada) — intercept antes de criar conversa: matching por `personal_whatsapp` → atualiza `whatsapp_session_until` + auto-resposta.
- `_shared/handoffQueue.ts` (modificado) — após UPDATE `assigned_to`, dispara fetch fire-and-forget pra `notify-vendor-assignment`.

## RPC

`pause_user_notifications(_target_user_id, _until, _reason)` — super_admin OK pra qualquer vendedor; gerente só pra mesmo dept; rejeita cross-dept com `forbidden_cross_dept`. Reativar = `_until = NULL`.

## Onde está a UI

| Função | Localização |
|--------|-------------|
| Cadastrar número/toggle/pausar vendedor | Admin → Equipe → expand vendedor → seção "Notificações WhatsApp" |
| Toggle por instância (feature flag on/off) | Admin → Caixas → card da inbox → seção "Notificações WhatsApp pra vendedores" |
| Histórico de envios + skips | Admin → /dashboard/admin/notifications |
| Banner no helpdesk (vendedor) | Header do helpdesk, abaixo dos filtros |

## Limitações conhecidas (dívida técnica F3+)

1. Sem escalation de timeout (não re-pinga em 5min, não alerta gerente em 10min).
2. Sem notif de "reatribuição removida" pro vendedor anterior.
3. Sem dashboard de tempo Disponível vs Pausado por vendedor (precisa `queue_pause_history` audit).
4. Multi-tenant: vendedor com mesmo número em 2 orgs = ambos renovam janela ao mesmo tempo (improvável).
5. Mensagem só em pt-BR.
6. Sem template HSM Meta — depende 100% de handshake diário.
7. LGPD: não tem tela formal de aceite com timestamp/IP.

Plan completo + decisões em [[../.planning/phases/notify-vendor-handoff/PLAN.md]] e [[../.planning/phases/notify-vendor-handoff/RESEARCH.md]].
