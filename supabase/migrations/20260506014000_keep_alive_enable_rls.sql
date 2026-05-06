-- P2-7 da auditoria 2026-05-05: ENABLE RLS em keep_alive
-- Sem policies = apenas service_role (bypass RLS) pode ler/escrever.
-- Cron `keep_alive_daily` roda como service_role, continua funcionando.
-- Defense-in-depth: bloqueia anon e authenticated de listar a tabela.

ALTER TABLE public.keep_alive ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.keep_alive IS
  'Cron Free Forever: insere 1 row/dia (jobid 7, 04:00 UTC) pra impedir Supabase pausar projeto inativo. RLS ENABLED (sem policies) = só service_role acessa.';
