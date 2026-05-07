# PLAN — Notificação de Vendedor por WhatsApp no Handoff

**Data**: 2026-05-07
**Estimativa**: ~21h (~2.5-3 dias focados)
**Status**: aguardando aprovação

---

## Goal

Quando `assignHandoff()` atribui um lead a um vendedor, enviar mensagem rica pelo WhatsApp pessoal do vendedor com link direto pra conversa no helpdesk, respeitando janela 24h, business_hours, queue_paused, opt-in, pause administrativo e rate limit.

## Out-of-scope (F3+)

Escalation por timeout, dashboard de tempo pausado, reatribuição órfã, template HSM, i18n, LGPD formal, onboarding banner.

---

## F0 — Handshake do vendedor (~4h)

### F0.1 Migration: tracking de janela 24h
- `ALTER TABLE user_profiles ADD COLUMN whatsapp_handshake_at TIMESTAMPTZ;`
- `ALTER TABLE user_profiles ADD COLUMN whatsapp_session_until TIMESTAMPTZ;`

### F0.2 Refactor `whatsapp-webhook/index.ts` — intercept antes de criar conversa
- Localização do intercept: entre linhas 577 (após `inbox` resolvido) e 580 (antes de extrair `chatId`).
- Lógica:
  1. Se `message.fromMe === true` → não é vendedor mandando, segue fluxo normal.
  2. Extrai `senderPhone` via helper `extractPhone()` existente (linha 101).
  3. Query `user_profiles WHERE personal_whatsapp = '+' || senderPhone`.
  4. Se vendedor encontrado:
     - UPDATE `whatsapp_session_until = now() + interval '24 hours'`.
     - Se `whatsapp_handshake_at IS NULL`, setar `whatsapp_handshake_at = now()`.
     - Chamar `uazapi-proxy` com auto-resposta: `"✅ Notificações ativas pelas próximas 24h, {full_name}!"`.
     - Retornar early `{ ok: true, vendor_handshake: true }` — NÃO criar conversa.
  5. Se não é vendedor → continua fluxo normal.

### F0.3 Helper compartilhado `_shared/sendWhatsApp.ts`
- Função `sendUazapiText(instance_token, to_phone, text)` que reusa `uazapi-proxy` ou chama UAZAPI direto.
- Usado pelo intercept do webhook E pelo `notify-vendor-assignment`.

### F0.4 Tests F0
- Vendedor cadastrado manda "oi" → `whatsapp_session_until` atualizado, conversa NÃO criada, auto-resposta enviada.
- Lead normal manda "oi" → fluxo segue normal, conversa criada.
- Vendedor com `notify_on_assignment=false` → handshake ainda ativa (vendedor pode renovar mesmo desativado).

---

## F1 — DB + painel admin (~8h)

### F1.1 Migration: campos no user_profiles
```sql
ALTER TABLE user_profiles
  ADD COLUMN personal_whatsapp TEXT,
  ADD COLUMN notify_on_assignment BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN notifications_paused_until TIMESTAMPTZ,
  ADD COLUMN notifications_paused_by_user_id UUID REFERENCES user_profiles(id),
  ADD COLUMN notifications_paused_at TIMESTAMPTZ,
  ADD COLUMN notifications_paused_reason TEXT;

CREATE INDEX idx_user_profiles_personal_whatsapp ON user_profiles(personal_whatsapp)
  WHERE personal_whatsapp IS NOT NULL;
```

### F1.2 Migration: assigned_at no helpdesk_chats
```sql
ALTER TABLE helpdesk_chats ADD COLUMN assigned_at TIMESTAMPTZ;
-- Sem backfill — só NULL pros antigos.
```

### F1.3 Migration: org_settings (cria se não existir, ou estende)
```sql
ALTER TABLE org_settings
  ADD COLUMN notification_instance_id UUID REFERENCES instances(id),
  ADD COLUMN notifications_enabled BOOLEAN NOT NULL DEFAULT false;
```
- Se `org_settings` ainda não existe (verificar antes), criar tabela com FK pra `instances`.

### F1.4 Migration: tabela notification_log
```sql
CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES helpdesk_chats(id),
  assigned_to_id UUID REFERENCES user_profiles(id),
  instance_id UUID REFERENCES instances(id),
  status TEXT NOT NULL CHECK (status IN ('sent', 'error', 'skipped')),
  skip_reason TEXT,
  error_message TEXT,
  message_text TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chat_id, assigned_to_id)
);

CREATE INDEX idx_notif_log_rate_limit
  ON notification_log(assigned_to_id, sent_at)
  WHERE status = 'sent';
```

### F1.5 RLS policies em notification_log
- super_admin: SELECT all.
- gerente: SELECT do mesmo dept que `assigned_to_id`.
- user comum: nada.
- INSERT: só service_role.

### F1.6 RPC `pause_user_notifications`
```sql
CREATE FUNCTION pause_user_notifications(
  _target_user_id UUID,
  _until TIMESTAMPTZ,  -- NULL = reativar
  _reason TEXT
) RETURNS jsonb
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_caller_role app_role;
  v_shares_dept BOOLEAN;
BEGIN
  -- Caller deve ser super_admin OU gerente do mesmo dept
  SELECT role INTO v_caller_role FROM user_roles WHERE user_id = v_caller LIMIT 1;
  IF v_caller_role = 'super_admin' THEN
    -- ok, prossegue
  ELSIF v_caller_role = 'gerente' THEN
    SELECT EXISTS (
      SELECT 1 FROM department_members dm1
      JOIN department_members dm2 ON dm1.department_id = dm2.department_id
      WHERE dm1.user_id = v_caller AND dm2.user_id = _target_user_id
    ) INTO v_shares_dept;
    IF NOT v_shares_dept THEN
      RETURN jsonb_build_object('error', 'forbidden_cross_dept');
    END IF;
  ELSE
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  UPDATE user_profiles SET
    notifications_paused_until = _until,
    notifications_paused_by_user_id = CASE WHEN _until IS NULL THEN NULL ELSE v_caller END,
    notifications_paused_at = CASE WHEN _until IS NULL THEN NULL ELSE now() END,
    notifications_paused_reason = _reason
  WHERE id = _target_user_id;

  RETURN jsonb_build_object('ok', true);
END $$;
```

### F1.7 UI admin — cadastro de número (`AdminUsersTab.tsx` ou similar)
- Coluna nova "WhatsApp pessoal" + status:
  - 🟢 Ativo (`whatsapp_session_until > now() + 2h`).
  - ⚠️ Expira em <2h.
  - 🔴 Expirado.
  - ⚙️ Não cadastrado.
  - ⏸ Pausado pelo admin (mostra até quando + quem pausou).
- Modal de edição: input E.164 com máscara `+55 (XX) XXXXX-XXXX` + parse Libphonenumber-js + toggle `notify_on_assignment`.

### F1.8 UI admin — modal de pausa
- Botão "⏸ Pausar notif" → modal com presets:
  - 1h / fim do dia / 3 dias / indefinido / data customizada.
  - Campo opcional "motivo" (ex.: "Férias").
- Se já pausado: mostra "Pausado até X por Y" + botão "Reativar agora".
- Chama RPC `pause_user_notifications`.

### F1.9 UI admin — seleção de instância de notif (`OrgSettingsTab.tsx`)
- Dropdown com instâncias da org → seta `org_settings.notification_instance_id`.
- Toggle "Ativar notificações de handoff" → seta `notifications_enabled`.
- Texto: "Quando ativado, vendedores recebem ping no WhatsApp pessoal sempre que receberem um lead. Eles precisam mandar qualquer mensagem pra este número uma vez por dia pra reativar a janela do WhatsApp."

### F1.10 UI vendedor — banner no helpdesk header
- Se `whatsapp_session_until < now()` → banner vermelho: "Notificações WhatsApp inativas — mande qualquer mensagem pra +55 11 X-XXXX pra reativar pelas próximas 24h".
- Se `whatsapp_session_until < now() + 2h` → banner amarelo: "Sua janela WhatsApp expira em X min — renove agora".
- Se `personal_whatsapp IS NULL` → não mostra nada (vendedor sem cadastro não recebe notif).

### F1.11 Tests F1
- Migrations idempotentes (rodar 2x sem erro).
- RLS de `notification_log` com user de outra org.
- Validação E.164 (rejeita `11987654321`, aceita `+5511987654321`).
- RPC `pause_user_notifications`: super_admin OK cross-dept, gerente cross-dept retorna `forbidden_cross_dept`, user comum `forbidden`.
- Reativar: `_until = NULL` limpa todos os campos de pause.

---

## F2 — Notificação core (~9h)

### F2.1 Edge function `notify-vendor-assignment`
- Input: `{ chat_id, assigned_to_id }`.
- Pipeline:
  1. Carrega chat (com lead nome, whatsapp, inbox_id), vendedor (com personal_whatsapp, notify_on_assignment, notifications_paused_until, whatsapp_session_until), org_settings (notification_instance_id, notifications_enabled, business_hours).
  2. Aplica guards (skip + log com `skip_reason`):
     - `org_settings.notifications_enabled = false` → `skip_disabled`.
     - `vendor.notify_on_assignment = false` → `skip_optout`.
     - `vendor.personal_whatsapp IS NULL` → `skip_no_number`.
     - `vendor.whatsapp_session_until < now()` → `skip_session_expired`.
     - `vendor.notifications_paused_until > now()` → `skip_paused`.
     - Fora de `business_hours` → `skip_off_hours`.
     - `department_members.queue_paused = true` pra vendedor → `skip_queue_paused`.
     - `count(notification_log WHERE assigned_to=X AND sent_at > now()-1h AND status='sent') >= 3` → `skip_rate_limited`.
  3. Carrega última mensagem do lead: `helpdesk_messages WHERE chat_id=X AND from='lead' ORDER BY created_at DESC LIMIT 1`.
  4. Formata via helper `formatLastMessage(msg)` (texto truncado 80 chars / "🎙️ Áudio (Xs)" / "📷 Imagem" / "📎 Documento" / "🎴 Carrossel" / "_(sem mensagem ainda)_").
  5. Monta mensagem:
     ```
     🔔 Novo atendimento, {vendor.full_name}!

     👤 Cliente: {lead.full_name}
     📱 WhatsApp: {lead.whatsapp formatado}
     💬 Última msg: {formatted}
     ⏰ Aguardando há: {minutos desde assigned_at}min

     Atender: {APP_URL}/helpdesk?conv={chat_id}&inbox={inbox_id}
     ```
  6. Chama `sendUazapiText(notification_instance.token, vendor.personal_whatsapp, message_text)`.
  7. UPSERT em `notification_log` com `ON CONFLICT (chat_id, assigned_to_id)` (reatribuição = atualiza row).

### F2.2 Hook em `_shared/handoffQueue.ts assignHandoff()`
- Após o UPDATE de `assigned_to`, **antes do retorno**:
  ```ts
  await supabase.from('helpdesk_chats').update({ assigned_at: new Date().toISOString() }).eq('id', conversation_id);
  // Fire-and-forget — try/catch silencioso, NUNCA propaga erro pro handoff
  fetch(`${baseUrl}/functions/v1/notify-vendor-assignment`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: conversation_id, assigned_to_id: result.assigned_to_id }),
  }).catch(err => logger.warn('notify-vendor failed', { err: err.message }));
  ```

### F2.3 Painel admin — aba "Notificações" (`NotificationLogTab.tsx`)
- Tabela: data | vendedor | cliente | status | skip_reason | preview da msg | erro.
- Filtros: status (sent/error/skipped), vendedor, data range.
- Útil pra admin diagnosticar "por que Lucas não recebeu nada hoje".

### F2.4 Tests F2 E2E
- Lead chega → handoff atribui Lucas com sessão ativa → notif disparada → row `status='sent'`.
- Lucas com `notify_on_assignment=false` → `status='skipped'`, `skip_reason='skip_optout'`.
- Lucas sem `personal_whatsapp` → `skip_no_number`.
- Lucas com sessão expirada → `skip_session_expired`.
- Lucas pausado pelo gerente → `skip_paused`.
- Fora de business_hours → `skip_off_hours`.
- 4ª notif na mesma hora → `skip_rate_limited`.
- Mesmo handoff atribuído 2x → 1 row só (idempotência via UNIQUE).
- Reatribuído pra Maria → 2 rows (1 Lucas, 1 Maria).
- Edge function falhando → `assignHandoff()` retorna sucesso normalmente.

---

## Sequência de execução (waves)

**Onda 1 — paralelo** (migrations, sem conflito):
- F0.1, F1.1, F1.2, F1.3, F1.4

**Onda 2 — paralelo** (RPC + helper backend):
- F1.5 (RLS policies), F1.6 (RPC pause), F0.3 (helper sendUazapiText)

**Onda 3 — sequencial** (frontend admin):
- F1.7 → F1.8 → F1.9 (mesmas telas/módulo, evita conflito)

**Onda 4 — paralelo** (frontend vendedor + edge function):
- F1.10 (banner helpdesk), F2.1 (edge function notify-vendor)

**Onda 5 — sequencial** (integração final):
- F0.2 (refactor webhook) → F2.2 (hook em handoffQueue) → F2.3 (painel notif log)

**Onda 6 — paralelo** (testes):
- F0.4, F1.11, F2.4

---

## Critério de "Done" (DoD)

- [ ] Todas migrations aplicadas (idempotentes, rodam 2x sem erro).
- [ ] Webhook intercept funciona — vendedor cadastrado renova janela sem criar conversa fantasma.
- [ ] `assignHandoff()` dispara notif, falha silenciosa não quebra handoff.
- [ ] Todos 8 guards do F2.1 cobertos por teste.
- [ ] UI admin mostra status do vendedor (5 estados visuais).
- [ ] UI vendedor banner amarelo/vermelho funciona.
- [ ] Modal de pausa com 5 presets + reativar.
- [ ] Painel admin de log inspecionável.
- [ ] PRD.md atualizado com entrada de versão.
- [ ] Vault: `wiki/notif-handoff-vendedor.md` criada + log.md + index.md.

## Rollback strategy

Feature flag `org_settings.notifications_enabled = false` (default). Pra desligar em prod: UPDATE em 1 row → guard `skip_disabled` para tudo silenciosamente. Sem necessidade de rollback de código.
