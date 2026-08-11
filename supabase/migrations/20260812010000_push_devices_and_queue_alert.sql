-- ============================================================================
-- Push "cliente esperando" no APP do vendedor (fase 3 do APK, v7.117.0)
-- Receita herdada do Casa do Agricultor (migrations 43/44 + pushCheck), adaptada
-- ao modelo WhatsPRO (department_members + queue_paused).
-- ============================================================================

-- Cada instalação do APK registra o token FCM do aparelho (upsert por token:
-- trocar de usuário no mesmo celular REASSINA o token pro novo dono).
create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fcm_token text not null unique,
  app_build int not null default 1,
  platform text not null default 'android',
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.push_devices enable row level security;
drop policy if exists push_devices_own on public.push_devices;
create policy push_devices_own on public.push_devices
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Anti-ruído do sender: 1 aviso por mensagem + cooldown por conversa.
-- Service-role only (RLS ligada sem policy).
create table if not exists public.push_alert_log (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  last_message_id uuid,
  notified_at timestamptz not null default now()
);
alter table public.push_alert_log enable row level security;

-- Varredura a cada 2 min (mesmo padrão vault/CRON_AUTH_KEY dos demais crons).
-- Sem FIREBASE_SERVICE_ACCOUNT nos secrets a fn sai barato com skipped —
-- agendar já é seguro e o push "liga sozinho" quando o secret existir.
select cron.schedule(
  'push-queue-alert',
  '*/2 * * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://prfcbfumyrrycsrcrvms.supabase.co/functions/v1/push-queue-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='CRON_AUTH_KEY' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $cmd$
);
