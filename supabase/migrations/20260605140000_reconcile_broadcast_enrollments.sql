-- Reconciliação do auto-cadastro de leads na base do Disparador (rede de segurança).
--
-- Contexto: o cadastro em tempo real vive no `whatsapp-webhook` (fire-and-forget da
-- RPC `enroll_lead_in_instance_database`). Sob rajada de mensagens, alguns enrolls
-- atrasam/falham e NÃO há retry — um lead de mensagem ÚNICA cujo enroll falhe nunca
-- entraria na base. (O path antigo via `job_queue` 'lead_auto_add' em `process-jobs`
-- está morto e quebrado: usa upsert com ON CONFLICT em índice parcial + chama a RPC
-- inexistente `update_lead_count_from_entries`.)
--
-- Auditoria 2026-06-05: cobertura era 100% (496/496 messagers na base), mas observou-se
-- lag/lote (mediana 5s, p90 ~32min, máx ~58min) por causa do fire-and-forget sem rede.
-- Esta função varre, por instância com `auto_enroll_broadcast_db=true`, os messagers
-- INDIVIDUAIS ativos na janela e cadastra os que faltam. Idempotente (ON CONFLICT DO
-- NOTHING). Agendada via pg_cron a cada 2 min → cobertura garantida + lag ≤ 2 min.

CREATE OR REPLACE FUNCTION public.reconcile_broadcast_enrollments(p_lookback interval DEFAULT '2 hours')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total int := 0;
  v_count int;
  r record;
  v_db uuid;
BEGIN
  FOR r IN
    SELECT i.id AS instance_id, i.user_id, i.name
    FROM instances i
    JOIN instance_settings s ON s.instance_id = i.id
    WHERE s.auto_enroll_broadcast_db IS TRUE
  LOOP
    -- garante a base (espelha enroll_lead_in_instance_database: predicado casa o índice parcial)
    INSERT INTO lead_databases (name, user_id, instance_id, leads_count)
    VALUES (coalesce(nullif(r.name,''), 'Instância ' || r.instance_id), r.user_id, r.instance_id, 0)
    ON CONFLICT (instance_id) WHERE instance_id IS NOT NULL
    DO UPDATE SET updated_at = now()
    RETURNING id INTO v_db;

    -- cadastra messagers individuais ativos na janela que ainda não estão na base
    INSERT INTO lead_database_entries (database_id, phone, jid, name, source, is_verified, verification_status)
    SELECT v_db,
           split_part(c.jid,'@',1) AS phone,
           c.jid,
           nullif(c.name, split_part(c.jid,'@',1)) AS name,
           'helpdesk', true, 'valid'
    FROM (
      SELECT DISTINCT conv.contact_id
      FROM conversations conv
      JOIN inboxes ib ON ib.id = conv.inbox_id AND ib.instance_id = r.instance_id
      JOIN conversation_messages m ON m.conversation_id = conv.id
        AND m.direction = 'incoming'
        AND m.created_at > now() - p_lookback
    ) recent
    JOIN contacts c ON c.id = recent.contact_id
    WHERE c.jid LIKE '%@s.whatsapp.net'
      AND length(split_part(c.jid,'@',1)) >= 10
    ON CONFLICT (database_id, phone) DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN
      PERFORM recalc_lead_database_count(v_db);
      v_total := v_total + v_count;
    END IF;
  END LOOP;
  RETURN v_total;
END;
$$;

-- Service-only (lição v7.69.0: Postgres concede EXECUTE a PUBLIC por padrão).
REVOKE EXECUTE ON FUNCTION public.reconcile_broadcast_enrollments(interval) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reconcile_broadcast_enrollments(interval) TO service_role;

-- Rede de segurança: a cada 2 min (lookback default 2h). Idempotente por nome.
SELECT cron.schedule(
  'reconcile-broadcast-enrollments',
  '*/2 * * * *',
  $$select public.reconcile_broadcast_enrollments()$$
);
