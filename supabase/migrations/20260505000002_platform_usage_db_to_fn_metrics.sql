-- Estende snapshot_platform_usage com 2 métricas de saúde DB→fn
-- Motivação: R96 — chamadas externas (n8n) batendo no gateway são invisíveis ao monitoring DB.
-- Mas a sub-fração que vem via net.http_post (DB→fn) AINDA pode ser monitorada e
-- detecta ressurgência do R92 (vault rotation invalidando Bearer): se >50% dos
-- _http_response retornarem 4xx/5xx, eleva alert_level pra yellow no mínimo.

ALTER TABLE platform_usage_history
  ADD COLUMN IF NOT EXISTS db_to_fn_calls_24h integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS db_to_fn_error_pct_24h numeric(5,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.snapshot_platform_usage()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'storage'
AS $function$
DECLARE
  v_db_bytes bigint;
  v_storage_bytes bigint;
  v_mau integer;
  v_active_crons integer;

  v_db_pct numeric(5,2);
  v_storage_pct numeric(5,2);
  v_mau_pct numeric(5,2);
  v_highest_pct numeric(5,2);
  v_highest_dim text;
  v_alert_level text;

  v_db_to_fn_calls_24h integer;
  v_db_to_fn_errors_24h integer;
  v_db_to_fn_error_pct numeric(5,2);

  v_admin_id uuid;
  v_id bigint;

  c_db_limit constant bigint := 500 * 1024 * 1024;
  c_storage_limit constant bigint := 1024 * 1024 * 1024;
  c_mau_limit constant integer := 50000;
BEGIN
  v_db_bytes := pg_database_size(current_database());
  v_storage_bytes := COALESCE(
    (SELECT SUM((metadata->>'size')::bigint) FROM storage.objects),
    0
  );
  v_mau := (SELECT COUNT(*) FROM auth.users
            WHERE last_sign_in_at >= now() - interval '30 days');
  v_active_crons := (SELECT COUNT(*) FROM cron.job WHERE active = true);

  -- DB→fn health (R96 sentinel): só conta chamadas que vêm do próprio DB via net.http_post
  -- Não vê tráfego externo (n8n) — pra esse, ver auditoria mensal manual no playbook.
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status_code >= 400)
  INTO v_db_to_fn_calls_24h, v_db_to_fn_errors_24h
  FROM net._http_response
  WHERE created > now() - interval '24 hours';

  v_db_to_fn_error_pct := CASE
    WHEN v_db_to_fn_calls_24h = 0 THEN 0
    ELSE ROUND(100.0 * v_db_to_fn_errors_24h / v_db_to_fn_calls_24h, 2)
  END;

  v_db_pct := ROUND(100.0 * v_db_bytes / c_db_limit, 2);
  v_storage_pct := ROUND(100.0 * v_storage_bytes / c_storage_limit, 2);
  v_mau_pct := ROUND(100.0 * v_mau / c_mau_limit, 2);

  v_highest_pct := GREATEST(v_db_pct, v_storage_pct, v_mau_pct);
  v_highest_dim := CASE
    WHEN v_highest_pct = v_db_pct THEN 'db_size'
    WHEN v_highest_pct = v_storage_pct THEN 'storage'
    ELSE 'mau'
  END;

  v_alert_level := CASE
    WHEN v_highest_pct >= 85 THEN 'critical'
    WHEN v_highest_pct >= 70 THEN 'red'
    WHEN v_highest_pct >= 60 THEN 'orange'
    WHEN v_highest_pct >= 50 THEN 'yellow'
    ELSE 'green'
  END;

  -- Eleva pra yellow se DB→fn está azedo (sintoma forte de R92 voltando ou config quebrada)
  -- Só eleva — nunca rebaixa um alerta legítimo de db_size/storage/mau.
  IF v_db_to_fn_calls_24h >= 10
     AND v_db_to_fn_error_pct >= 50
     AND v_alert_level IN ('green','yellow') THEN
    v_alert_level := 'yellow';
    v_highest_dim := 'db_to_fn_health';
  END IF;

  INSERT INTO platform_usage_history (
    db_bytes, storage_bytes, mau, active_crons,
    db_pct, storage_pct, mau_pct,
    highest_pct, highest_dim, alert_level,
    db_to_fn_calls_24h, db_to_fn_error_pct_24h
  ) VALUES (
    v_db_bytes, v_storage_bytes, v_mau, v_active_crons,
    v_db_pct, v_storage_pct, v_mau_pct,
    v_highest_pct, v_highest_dim, v_alert_level,
    v_db_to_fn_calls_24h, v_db_to_fn_error_pct
  ) RETURNING id INTO v_id;

  IF v_alert_level IN ('orange','red','critical') THEN
    FOR v_admin_id IN (
      SELECT user_id FROM user_roles WHERE role = 'super_admin'
    ) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE user_id = v_admin_id
          AND type = 'platform_usage_alert'
          AND metadata->>'alert_level' = v_alert_level
          AND created_at >= now() - interval '20 hours'
      ) THEN
        INSERT INTO notifications (user_id, type, title, message, metadata, read)
        VALUES (
          v_admin_id,
          'platform_usage_alert',
          CASE v_alert_level
            WHEN 'orange'   THEN '🟠 Free Tier — ' || v_highest_pct || '% em ' || v_highest_dim
            WHEN 'red'      THEN '🔴 Free Tier — ' || v_highest_pct || '% em ' || v_highest_dim || ' (passou de 70%)'
            WHEN 'critical' THEN '🚨 Free Tier CRÍTICO — ' || v_highest_pct || '% em ' || v_highest_dim
          END,
          'db: ' || v_db_pct || '% | storage: ' || v_storage_pct || '% | mau: ' || v_mau_pct || '%. ' ||
          'DB→fn 24h: ' || v_db_to_fn_calls_24h || ' chamadas, ' || v_db_to_fn_error_pct || '% erro. ' ||
          'Consultar wiki/free-forever-playbook.md para ações.',
          jsonb_build_object(
            'alert_level', v_alert_level,
            'highest_pct', v_highest_pct,
            'highest_dim', v_highest_dim,
            'db_pct', v_db_pct,
            'storage_pct', v_storage_pct,
            'mau_pct', v_mau_pct,
            'db_to_fn_calls_24h', v_db_to_fn_calls_24h,
            'db_to_fn_error_pct_24h', v_db_to_fn_error_pct,
            'snapshot_id', v_id
          ),
          false
        );
      END IF;
    END LOOP;
  END IF;

  -- Notificação dedicada quando R92-like detectado (yellow por DB→fn, não por capacidade)
  IF v_alert_level = 'yellow'
     AND v_highest_dim = 'db_to_fn_health' THEN
    FOR v_admin_id IN (
      SELECT user_id FROM user_roles WHERE role = 'super_admin'
    ) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE user_id = v_admin_id
          AND type = 'db_to_fn_health_alert'
          AND created_at >= now() - interval '20 hours'
      ) THEN
        INSERT INTO notifications (user_id, type, title, message, metadata, read)
        VALUES (
          v_admin_id,
          'db_to_fn_health_alert',
          '⚠️ DB→fn ' || v_db_to_fn_error_pct || '% erro nas últimas 24h',
          v_db_to_fn_calls_24h || ' chamadas via net.http_post, ' || v_db_to_fn_errors_24h || ' falharam (4xx/5xx). ' ||
          'Sintoma típico: vault rotation (R92). Conferir net._http_response e SUPABASE_ANON_KEY.',
          jsonb_build_object(
            'db_to_fn_calls_24h', v_db_to_fn_calls_24h,
            'db_to_fn_errors_24h', v_db_to_fn_errors_24h,
            'db_to_fn_error_pct_24h', v_db_to_fn_error_pct,
            'snapshot_id', v_id
          ),
          false
        );
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'snapshot_id', v_id,
    'measured_at', now(),
    'db_pct', v_db_pct,
    'storage_pct', v_storage_pct,
    'mau_pct', v_mau_pct,
    'highest_pct', v_highest_pct,
    'highest_dim', v_highest_dim,
    'alert_level', v_alert_level,
    'db_to_fn_calls_24h', v_db_to_fn_calls_24h,
    'db_to_fn_error_pct_24h', v_db_to_fn_error_pct
  );
END;
$function$;
