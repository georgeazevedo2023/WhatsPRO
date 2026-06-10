-- Free Forever 2026-06-10: o sink net._http_response acumulou 150MB de BLOAT
-- físico em ~5 semanas (1.094 linhas vivas; autovacuum não devolve espaço ao
-- SO). Os crons via pg_net são todos fire-and-forget — ninguém lê respostas
-- antigas. TRUNCATE semanal (domingo 04:50 UTC, janela morta) zera o bloat na
-- raiz e protege os 500MB do plano Free. Idempotente (unschedule antes).
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'pgnet-truncate-weekly';
SELECT cron.schedule(
  'pgnet-truncate-weekly',
  '50 4 * * 0',
  $$TRUNCATE net._http_response$$
);
