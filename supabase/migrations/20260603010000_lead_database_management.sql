-- Módulo de gestão de bases do Disparador: RPCs atômicas para mover/copiar
-- contatos entre bases e fazer merge de bases, sempre com dedup por phone e
-- recálculo do leads_count (corrige a desnormalização sem transação apontada
-- na auditoria 2026-06-03).
--
-- Todas SECURITY DEFINER + search_path fixo; ownership validado contra
-- auth.uid() (espelha a RLS "Users can manage own lead databases").

-- Índice p/ dedup e busca por (database_id, phone) — hoje só há em database_id.
CREATE INDEX IF NOT EXISTS idx_lead_entries_db_phone
  ON public.lead_database_entries (database_id, phone);

-- Recalcula o contador desnormalizado de uma base.
CREATE OR REPLACE FUNCTION public.recalc_lead_database_count(p_db uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.lead_databases
  SET leads_count = (
        SELECT count(*) FROM public.lead_database_entries WHERE database_id = p_db
      ),
      updated_at = now()
  WHERE id = p_db;
$$;

-- Move (ou copia) contatos selecionados para uma base destino, com dedup por
-- phone no destino. Move: phones novos trocam database_id; phones já presentes
-- no destino são removidos da origem (consolidação). Copia: insere só os novos.
CREATE OR REPLACE FUNCTION public.move_lead_entries(
  p_entry_ids uuid[],
  p_target_db uuid,
  p_copy boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sources uuid[];
  v_moved int := 0;
  v_deduped int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'forbidden: no auth context';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM lead_databases WHERE id = p_target_db AND user_id = v_uid) THEN
    RAISE EXCEPTION 'forbidden: target database not owned by user';
  END IF;
  IF EXISTS (
    SELECT 1 FROM lead_database_entries e
    JOIN lead_databases d ON d.id = e.database_id
    WHERE e.id = ANY(p_entry_ids) AND d.user_id <> v_uid
  ) THEN
    RAISE EXCEPTION 'forbidden: some entries not owned by user';
  END IF;

  SELECT array_agg(DISTINCT database_id) INTO v_sources
  FROM lead_database_entries WHERE id = ANY(p_entry_ids);

  IF p_copy THEN
    INSERT INTO lead_database_entries
      (database_id, phone, name, jid, is_verified, verified_name, verification_status, source, group_name)
    SELECT p_target_db, e.phone, e.name, e.jid, e.is_verified, e.verified_name,
           e.verification_status, e.source, e.group_name
    FROM lead_database_entries e
    WHERE e.id = ANY(p_entry_ids)
      AND NOT EXISTS (
        SELECT 1 FROM lead_database_entries t
        WHERE t.database_id = p_target_db AND t.phone = e.phone
      );
    GET DIAGNOSTICS v_moved = ROW_COUNT;
  ELSE
    -- remove da origem os que já existem no destino (dedup)
    DELETE FROM lead_database_entries e
    WHERE e.id = ANY(p_entry_ids)
      AND e.database_id <> p_target_db
      AND EXISTS (
        SELECT 1 FROM lead_database_entries t
        WHERE t.database_id = p_target_db AND t.phone = e.phone
      );
    GET DIAGNOSTICS v_deduped = ROW_COUNT;
    -- move o restante
    UPDATE lead_database_entries e
    SET database_id = p_target_db
    WHERE e.id = ANY(p_entry_ids)
      AND e.database_id <> p_target_db;
    GET DIAGNOSTICS v_moved = ROW_COUNT;
  END IF;

  PERFORM recalc_lead_database_count(p_target_db);
  IF v_sources IS NOT NULL THEN
    PERFORM recalc_lead_database_count(s) FROM unnest(v_sources) AS s WHERE s <> p_target_db;
  END IF;

  RETURN jsonb_build_object('moved', v_moved, 'deduped', v_deduped, 'copy', p_copy);
END;
$$;

-- Une 2+ bases origem numa base destino, dedup por phone (contra destino e
-- entre origens). Opcionalmente exclui as bases origem ao final.
CREATE OR REPLACE FUNCTION public.merge_lead_databases(
  p_source_ids uuid[],
  p_target_db uuid,
  p_delete_sources boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_merged int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'forbidden: no auth context';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM lead_databases WHERE id = p_target_db AND user_id = v_uid) THEN
    RAISE EXCEPTION 'forbidden: target not owned by user';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_source_ids) sid
    WHERE NOT EXISTS (SELECT 1 FROM lead_databases WHERE id = sid AND user_id = v_uid)
  ) THEN
    RAISE EXCEPTION 'forbidden: some source not owned by user';
  END IF;

  -- 1) remove das origens os phones que já existem no destino
  DELETE FROM lead_database_entries e
  USING lead_database_entries t
  WHERE e.database_id = ANY(p_source_ids)
    AND e.database_id <> p_target_db
    AND t.database_id = p_target_db
    AND t.phone = e.phone;

  -- 2) dedup ENTRE origens (mesmo phone em 2+ origens): mantém o menor id
  DELETE FROM lead_database_entries e
  USING lead_database_entries e2
  WHERE e.database_id = ANY(p_source_ids) AND e.database_id <> p_target_db
    AND e2.database_id = ANY(p_source_ids) AND e2.database_id <> p_target_db
    AND e.phone = e2.phone
    AND e.id > e2.id;

  -- 3) move o restante pro destino
  UPDATE lead_database_entries e
  SET database_id = p_target_db
  WHERE e.database_id = ANY(p_source_ids)
    AND e.database_id <> p_target_db;
  GET DIAGNOSTICS v_merged = ROW_COUNT;

  PERFORM recalc_lead_database_count(p_target_db);

  IF p_delete_sources THEN
    DELETE FROM lead_databases WHERE id = ANY(p_source_ids) AND id <> p_target_db;
  ELSE
    PERFORM recalc_lead_database_count(s) FROM unnest(p_source_ids) AS s WHERE s <> p_target_db;
  END IF;

  RETURN jsonb_build_object('merged', v_merged);
END;
$$;

-- Postgres concede EXECUTE a PUBLIC por padrão — revogar e conceder só ao
-- necessário. move/merge checam ownership via auth.uid() (frontend usa role
-- authenticated). recalc é interno (chamado pelas outras via SECURITY DEFINER).
REVOKE EXECUTE ON FUNCTION public.recalc_lead_database_count(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_lead_entries(uuid[], uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.merge_lead_databases(uuid[], uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_lead_entries(uuid[], uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_lead_databases(uuid[], uuid, boolean) TO authenticated;
