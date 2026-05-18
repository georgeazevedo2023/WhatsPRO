-- D30 Fila Inteligente — adiciona handoff_queue_events ao publication realtime.
-- Sem isso o hook useActiveQueueEvents só recebia broadcast HTTP do cron
-- (fireAndForget, sem retry). Quando o broadcast falhava silenciosamente a UI
-- ficava com badge stale "Em fila — X (0:00)" enquanto o DB já tinha rotacionado.
-- Com a tabela na publication, postgres_changes entrega INSERT/UPDATE direto via
-- WebSocket sob a RLS existente ("Inbox users can view handoff queue events").

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'handoff_queue_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.handoff_queue_events;
  END IF;
END $$;
