-- v7.103.0 (dieta de egress / "voltar ao Free"):
-- (a) updated_at confiável em ai_agent_knowledge — a sonda do cache 48h do
--     ai-agent compara count+max(updated_at); sem trigger, EDITAR um item de
--     FAQ não bumpava o fingerprint e a edição levaria até 48h pra propagar.
-- (b) faxineiro purge_stale_operational_data() em cron a cada 48h: poda os
--     acumuladores operacionais (logs/runs/eventos/notifs) que crescem sem
--     teto e pressionam o limite de 500 MB do plano Free.

-- (a) trigger de updated_at no knowledge (reusa a fn padrão da casa)
alter table public.ai_agent_knowledge alter column updated_at set default now();
update public.ai_agent_knowledge
   set updated_at = coalesce(updated_at, created_at, now())
 where updated_at is null;
drop trigger if exists ai_agent_knowledge_updated_at on public.ai_agent_knowledge;
create trigger ai_agent_knowledge_updated_at
  before update on public.ai_agent_knowledge
  for each row execute function public.update_updated_at_column();

-- (b) faxineiro dos acumuladores operacionais
-- Janelas: ai_agent_logs 30d (debug); ai_agent_runs 60d (dashboard Roteamento
-- olha até 30d); handoff_queue_events 60d (stats da Fila olham até 30d);
-- notification_log 60d (escalate só varre recentes). 0 FKs apontam pra essas
-- tabelas (verificado 2026-07-02).
create or replace function public.purge_stale_operational_data()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_logs int; v_runs int; v_events int; v_notif int;
begin
  delete from public.ai_agent_logs where created_at < now() - interval '30 days';
  get diagnostics v_logs = row_count;

  delete from public.ai_agent_runs where created_at < now() - interval '60 days';
  get diagnostics v_runs = row_count;

  delete from public.handoff_queue_events where created_at < now() - interval '60 days';
  get diagnostics v_events = row_count;

  delete from public.notification_log where sent_at is not null and sent_at < now() - interval '60 days';
  get diagnostics v_notif = row_count;

  return jsonb_build_object(
    'ai_agent_logs', v_logs,
    'ai_agent_runs', v_runs,
    'handoff_queue_events', v_events,
    'notification_log', v_notif
  );
end;
$$;

revoke all on function public.purge_stale_operational_data() from public, anon, authenticated;

-- cron a cada 48h (dias alternados, 03:15 UTC — fora do horário comercial)
select cron.schedule(
  'purge-stale-operational-48h',
  '15 3 */2 * *',
  $$select public.purge_stale_operational_data()$$
);
