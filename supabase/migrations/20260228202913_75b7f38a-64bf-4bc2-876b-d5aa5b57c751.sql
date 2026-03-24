
-- Scheduled messages: a cada 1 hora
SELECT cron.schedule(
  'process-scheduled-messages',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://crzcpnczpuzwieyzbqev.supabase.co/functions/v1/process-scheduled-messages',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyemNwbmN6cHV6d2lleXpicWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODI1NDUsImV4cCI6MjA4NzM1ODU0NX0.49SQU4odU9nNL9rdIXRsE92HFZFcrRmjQIuur5LRHh4"}'::jsonb,
    body := '{"time": "now"}'::jsonb
  ) AS request_id;
  $$
);

-- Auto-summarize inactive: a cada 3 horas
SELECT cron.schedule(
  'auto-summarize-inactive',
  '0 */3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://crzcpnczpuzwieyzbqev.supabase.co/functions/v1/auto-summarize',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyemNwbmN6cHV6d2lleXpicWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3ODI1NDUsImV4cCI6MjA4NzM1ODU0NX0.49SQU4odU9nNL9rdIXRsE92HFZFcrRmjQIuur5LRHh4"}'::jsonb,
    body := '{"mode": "inactive", "limit": 20}'::jsonb
  ) AS request_id;
  $$
);
