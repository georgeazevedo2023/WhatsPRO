-- Sprint A #1 (Auditoria 2026-05-21): resolver constraints rivais em ai_agent_logs.event
--
-- Estado antes: 2 CHECK constraints coexistindo:
--   - ai_agent_logs_event_check (criado 2026-05-17, 20 eventos)
--   - chk_ai_agent_logs_event (ressuscitado 2026-05-20/21, 22 eventos)
--
-- Sintoma: as 3 migrations recentes (search_guard_blocked, set_tags_duplicate)
-- só atualizavam o chk_ — o _event_check antigo BLOQUEAVA inserts silenciosos
-- dos eventos novos. Observabilidade dos fixes R126/R127 estava cega.
--
-- Resolução: DROP o constraint redundante, deixar chk_ai_agent_logs_event
-- como FONTE ÚNICA DE VERDADE. Aplicado via MCP em 2026-05-21.
-- Arquivo retroativo committado no repo pra preservar consistência supabase db reset.

ALTER TABLE public.ai_agent_logs DROP CONSTRAINT IF EXISTS ai_agent_logs_event_check;

-- Validar que chk_ existe e contém os eventos novos
DO $$
DECLARE
  ck text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO ck
  FROM pg_constraint
  WHERE conrelid='public.ai_agent_logs'::regclass
    AND conname='chk_ai_agent_logs_event';
  IF ck IS NULL THEN
    RAISE EXCEPTION 'chk_ai_agent_logs_event missing — aborting consolidation';
  END IF;
  IF ck NOT LIKE '%search_guard_blocked%' OR ck NOT LIKE '%set_tags_duplicate_keys_rejected%' THEN
    RAISE EXCEPTION 'chk_ai_agent_logs_event missing required events — aborting';
  END IF;
END $$;
