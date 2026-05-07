# RESEARCH — Notificação de Vendedor por WhatsApp no Handoff

**Data**: 2026-05-07
**Escopo**: MVP enxuto (F0 + F1 + F2). Gaps F3+ documentados em "Dívida técnica".

---

## Contexto e motivação

Hoje quando o ai-agent (ou gestor manualmente) atribui um lead a um vendedor via `assignHandoff()`, a conversa cai no Helpdesk e o vendedor precisa **estar logado no painel** ou abrir o app pra perceber. Lead morno (Eletropiso, piso vinílico) esfria em 10-15min — a janela é estreita.

Solução: notificar o vendedor **no canal onde ele já vive** (WhatsApp pessoal) com fricção mínima — link direto pra conversa no helpdesk, info do lead e última mensagem.

---

## Achados técnicos

### Pontos de integração existentes

| Item | Status | Localização |
|------|--------|-------------|
| `assignHandoff()` (ponto único de atribuição) | ✅ existe | `supabase/functions/_shared/handoffQueue.ts` |
| `whatsapp-webhook` (1253 linhas) | ✅ existe, ponto de intercept identificado | linha ~577-580 (após resolver `inbox`, antes de `chatId`) |
| `uazapi-proxy` edge function | ✅ existe | `supabase/functions/uazapi-proxy/` |
| `user_profiles` table | ✅ existe | migration `20260124170541` |
| `business_hours` per-org | ✅ existe (D30 Sprint A) | `20260504000005_handoff_queue_business_hours.sql` |
| `department_members.queue_paused` | ✅ existe (D30 Sprint F) | toggle "Disponível ↔ Pausado" no helpdesk |
| `app_role` enum: `super_admin`, `user`, `gerente` | ✅ existe | controle de permissão de pausa |
| URL helpdesk com `?conv={chat_id}&inbox={id}` | ✅ funciona | `HelpDesk.tsx` linha 32 (`useSearchParams`) |

### Gaps no schema (precisam migration)

- `user_profiles.personal_whatsapp TEXT` — número E.164 do vendedor.
- `user_profiles.notify_on_assignment BOOLEAN DEFAULT true` — opt-in geral.
- `user_profiles.whatsapp_session_until TIMESTAMPTZ` — controle da janela WhatsApp 24h.
- `user_profiles.whatsapp_handshake_at TIMESTAMPTZ` — primeira ativação registrada.
- `user_profiles.notifications_paused_until TIMESTAMPTZ` — pause temporário pelo admin/gestor.
- `user_profiles.notifications_paused_by_user_id UUID` + `notifications_paused_at TIMESTAMPTZ` + `notifications_paused_reason TEXT` — auditoria de quem pausou.
- `helpdesk_chats.assigned_at TIMESTAMPTZ` — momento da atribuição (não existe; backfill = NULL).
- `org_settings.notification_instance_id UUID` (nullable, FK `instances`) — instância que envia as notifs (MVP: reuso do helpdesk).
- `org_settings.notifications_enabled BOOLEAN DEFAULT false` — feature flag de rollback per-org.
- Tabela `notification_log` — auditoria de envios + base do rate limit.

### Decisões arquiteturais (já fechadas com o user)

1. **Janela WhatsApp 24h**: aceitar limitação. Vendedor renova handshake no início do turno mandando qualquer msg pro WhatsApp da empresa. Sistema rastreia `whatsapp_session_until` e alerta admin/vendedor quando vai expirar. **Sem template HSM no MVP** (custo + 1-3 dias aprovação Meta).
2. **Instância**: reuso da instância do helpdesk (mesmo número que atende cliente). **Implica refactor do webhook** pra interceptar msg do vendedor ANTES de criar conversa fantasma.
3. **Permissão pra pausar notif**: `super_admin` qualquer um. `gerente` só vendedores do mesmo dept (validado por `department_members`).
4. **Rate limit**: 3 notifs/hora por vendedor (filtro `status='sent'`).
5. **Idempotência**: UNIQUE em `notification_log(chat_id, assigned_to_id)` + upsert. Reatribuição = nova linha (apaga e re-cria) → dispara nova notif.
6. **Token de handshake**: REMOVIDO. Admin já cadastra o número, qualquer msg do vendedor ativa janela.
7. **Auditoria de pause**: 3 colunas (paused_by, paused_at, reason) + log.

### Riscos conhecidos e mitigações

| Risco | Mitigação no MVP |
|-------|------------------|
| Banimento WhatsApp por msg fora da janela 24h | Skip silencioso se `whatsapp_session_until < now()` |
| Vendedor sem `personal_whatsapp` cadastrado | Skip + log warning + badge vermelho no painel admin |
| Rajada de leads → spam no vendedor | Cap 3 notifs/hora |
| `notify-vendor-assignment` falhando estoura `assignHandoff()` | Try/catch silencioso + feature flag `org_settings.notifications_enabled` pra rollback |
| Conversa fantasma no helpdesk | Intercept no webhook por matching `personal_whatsapp` |
| Race condition em idempotência | UNIQUE constraint + upsert |
| Última msg da conv ser do bot (não do lead) | Query filtra `from='lead'` |
| Multi-tenant: 2 vendedores em orgs diferentes com mesmo número | Aceito como dívida (improvável). v2 trata via `org_id`. |

---

## Dívida técnica (fora do MVP — F3+)

- Escalation: re-ping em 5min sem resposta + alerta gerente em 10min (precisa detectar "1ª resposta do vendedor" via `helpdesk_messages.from='operator'`).
- Reatribuição manual: notif "removido" pro vendedor anterior.
- Dashboard gestor: tempo Disponível vs Pausado por vendedor (precisa `queue_pause_history` audit).
- Template HSM (Meta) pra remover dependência da janela 24h.
- Validação periódica de número (vendedor demitido = número reaproveitado).
- i18n da mensagem (hoje só pt-BR).
- LGPD: tela formal de aceite com timestamp/IP.
- Onboarding de vendedor novo (banner persistente forçando cadastro).
- Multi-org isolation no matching `personal_whatsapp`.
