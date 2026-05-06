-- R101 hotfix — GRANTs faltando para service_role no schema public.
--
-- Sintoma: whatsapp-webhook retornava 404 "Instance not found" mesmo com instância no DB.
-- Atendentes Eletropiso não recebiam mensagens novas; smoke E2E pós-cutover quebrado.
--
-- Causa: 91 tabelas public sem GRANT para service_role no projeto novo (`prfcbfumyrrycsrcrvms`).
-- Edge fns que usam createServiceClient() recebiam silenciosamente arrays vazios em SELECTs
-- (sem erro, apenas zero rows) — nem RLS bloqueando, mas falta de privilégio básico de SELECT.
--
-- Mesma classe do R98 (que tinha GRANTado anon/authenticated mas esqueceu service_role).
-- Aplicar igual, mas restrito a service_role.
--
-- Detectado: 2026-05-06 via smoke E2E (usuária mandou msg WhatsApp pro 558181696546,
-- n8n recebeu webhook UAZAPI, n8n encaminhou para whatsapp-webhook, retornou 404).
--
-- Validação pós-aplicação:
--   curl -X POST https://prfcbfumyrrycsrcrvms.supabase.co/functions/v1/whatsapp-webhook
--     -H 'Content-Type: application/json' -d '{...payload UAZAPI Eletropiso...}'
--   → 200 OK + conversation_id (antes: 404 Instance not found)

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;
