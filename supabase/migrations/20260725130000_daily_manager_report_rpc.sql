-- =============================================================================
-- v7.106.0 — RPC agregadora do "Resumo do dia" dos gestores (daily-manager-report)
-- 1 chamada = todas as métricas do dia (janela America/Sao_Paulo) em jsonb —
-- egress mínimo (agrega server-side, nada de listar mensagens na edge fn).
-- Consumida SÓ pela edge fn daily-manager-report (service_role); sem acesso
-- anon/authenticated (postura da auditoria 2026-06-14).
--
-- Definições (contrato de consistência — espelhado no formatter dailyReport.ts):
--   atendimento = conversa com ≥1 msg incoming no dia; novo = contact criado no dia;
--   histograma = hora da 1ª msg incoming do dia por conversa (soma = atendimentos);
--   ai_only = atendimento sem msg outgoing humana (sender_id) e sem human_handling no dia;
--   transbordo = CONVERSA DISTINTA com handoff_queue_events no dia (eventos repetidos de
--   rotação/requeue da fila NÃO inflam a contagem); 1ª resposta humana = o que vier
--   primeiro entre outgoing com sender_id (app) e human_handling_at (celular, v7.94)
--   após o 1º evento do dia; vendas = conversion_funnel_events stage='conversion'.
-- =============================================================================

create or replace function public.get_daily_manager_report(
  p_instance_id text,
  p_day date default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_day date := coalesce(p_day, (now() at time zone 'America/Sao_Paulo')::date);
  v_start timestamptz := (v_day::timestamp) at time zone 'America/Sao_Paulo';
  v_end timestamptz := ((v_day + 1)::timestamp) at time zone 'America/Sao_Paulo';
  v_agent_id uuid := (select id from ai_agents where instance_id = p_instance_id);
  v_result jsonb;
begin
  with convs as (
    select c.id, c.contact_id, c.human_handling_at
    from conversations c
    join inboxes i on i.id = c.inbox_id
    where i.instance_id = p_instance_id
  ),
  inbound as (
    select m.conversation_id, m.created_at,
           extract(hour from (m.created_at at time zone 'America/Sao_Paulo'))::int as hr
    from conversation_messages m
    join convs cv on cv.id = m.conversation_id
    where m.direction = 'incoming'
      and m.created_at >= v_start and m.created_at < v_end
  ),
  conv_first as (
    select conversation_id, min(created_at) as first_at
    from inbound
    group by conversation_id
  ),
  active_convs as (
    select cf.conversation_id,
           extract(hour from (cf.first_at at time zone 'America/Sao_Paulo'))::int as hr,
           cv.contact_id, cv.human_handling_at
    from conv_first cf
    join convs cv on cv.id = cf.conversation_id
  ),
  new_convs as (
    select ac.conversation_id
    from active_convs ac
    join contacts ct on ct.id = ac.contact_id
    where ct.created_at >= v_start and ct.created_at < v_end
  ),
  human_out as (
    select distinct m.conversation_id
    from conversation_messages m
    join convs cv on cv.id = m.conversation_id
    where m.direction = 'outgoing' and m.sender_id is not null
      and m.created_at >= v_start and m.created_at < v_end
  ),
  handoffs as (
    select h.conversation_id, min(h.created_at) as first_event_at
    from handoff_queue_events h
    join convs cv on cv.id = h.conversation_id
    where h.created_at >= v_start and h.created_at < v_end
    group by h.conversation_id
  ),
  handoff_response as (
    select h.conversation_id, h.first_event_at,
           least(
             coalesce((select min(m.created_at)
                         from conversation_messages m
                        where m.conversation_id = h.conversation_id
                          and m.direction = 'outgoing' and m.sender_id is not null
                          and m.created_at >= h.first_event_at and m.created_at < v_end),
                      'infinity'::timestamptz),
             coalesce((select cv.human_handling_at
                         from convs cv
                        where cv.id = h.conversation_id
                          and cv.human_handling_at >= h.first_event_at
                          and cv.human_handling_at < v_end),
                      'infinity'::timestamptz)
           ) as first_human_at
    from handoffs h
  ),
  tool_calls as (
    select tc
    from ai_agent_runs r
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(r.tools_called) = 'array' then r.tools_called else '[]'::jsonb end
    ) tc
    where r.agent_id = v_agent_id
      and r.created_at >= v_start and r.created_at < v_end
  ),
  searches as (
    select lower(trim(tc->'args'->>'query')) as q
    from tool_calls
    where tc->>'name' = 'search_products'
      and coalesce(trim(tc->'args'->>'query'), '') <> ''
  ),
  brands as (
    select lower(trim(split_part(t.tag, ':', 2))) as b
    from tool_calls
    cross join lateral jsonb_array_elements_text(
      case when jsonb_typeof(tc->'args'->'tags') = 'array' then tc->'args'->'tags' else '[]'::jsonb end
    ) as t(tag)
    where tc->>'name' = 'set_tags'
      and t.tag like 'marca%:%'
      and coalesce(trim(split_part(t.tag, ':', 2)), '') <> ''
  ),
  nps as (
    select pr.numeric_score, pr.selected_options
    from poll_responses pr
    join poll_messages pm on pm.id = pr.poll_message_id
    where pm.instance_id = p_instance_id and pm.is_nps = true
      and pr.voted_at >= v_start and pr.voted_at < v_end
  )
  select jsonb_build_object(
    'day', to_char(v_day, 'YYYY-MM-DD'),
    'inbound_total', (select count(*) from inbound),
    'inbound_by_hour', coalesce(
      (select jsonb_object_agg(hr::text, n) from (select hr, count(*) as n from inbound group by hr) x),
      '{}'::jsonb),
    'conversations_total', (select count(*) from active_convs),
    'conversations_new', (select count(*) from new_convs),
    'conv_starts_by_hour', coalesce(
      (select jsonb_object_agg(hr::text, n) from (select hr, count(*) as n from active_convs group by hr) x),
      '{}'::jsonb),
    'ai_only', (select count(*) from active_convs ac
                 where ac.conversation_id not in (select conversation_id from human_out)
                   and (ac.human_handling_at is null
                        or ac.human_handling_at < v_start
                        or ac.human_handling_at >= v_end)),
    'handoffs_total', (select count(*) from handoffs),
    'handoff_first_response_minutes', coalesce(
      (select jsonb_agg(round(extract(epoch from (first_human_at - first_event_at)) / 60.0))
         from handoff_response where first_human_at < 'infinity'::timestamptz),
      '[]'::jsonb),
    'sales', (select count(*) from conversion_funnel_events f
               where f.instance_id = p_instance_id and f.stage = 'conversion'
                 and f.created_at >= v_start and f.created_at < v_end),
    'nps_votes', coalesce(
      (select jsonb_agg(jsonb_build_object('score', numeric_score, 'options', selected_options)) from nps),
      '[]'::jsonb),
    'top_searches', coalesce(
      (select jsonb_agg(jsonb_build_object('q', q, 'n', n) order by n desc, q)
         from (select q, count(*) as n from searches group by q order by count(*) desc, q limit 10) s),
      '[]'::jsonb),
    'top_brands', coalesce(
      (select jsonb_agg(jsonb_build_object('b', b, 'n', n) order by n desc, b)
         from (select b, count(*) as n from brands group by b order by count(*) desc, b limit 5) s),
      '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

comment on function public.get_daily_manager_report(text, date) is
  'Resumo diário pro gestor (edge fn daily-manager-report). Janela America/Sao_Paulo. Só service_role.';

revoke execute on function public.get_daily_manager_report(text, date) from public, anon, authenticated;
grant execute on function public.get_daily_manager_report(text, date) to service_role;
