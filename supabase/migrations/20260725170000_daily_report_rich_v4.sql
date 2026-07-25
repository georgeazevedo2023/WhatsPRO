-- =============================================================================
-- v7.108.0 — RPC v4 do resumo do gestor: formato RICO aprovado pelo dono
-- (2026-07-25, "esse será o padrão relatório diário").
-- Novos campos no jsonb:
--   - prev            : mesmas métricas-chave do MESMO DIA DA SEMANA ANTERIOR
--                       (v_day - 7) pra linha de comparação ▲/▼ (varejo tem
--                       sazonalidade forte de dia-da-semana; sáb compara c/ sáb)
--   - category_mentions: varredura das msgs (content+transcription) contra
--                       p_categories jsonb [{n,p}] — "o que procuraram" por
--                       nº de conversas (métrica mais fiel que marca: só ~10%
--                       das conversas citam marca, auditoria 2026-07-25)
--   - human_panel_msgs/human_panel_convs: outgoing com sender_id no dia —
--                       alimenta o ponto de atenção "time responde pelo celular"
--   - nps_sent         : enquetes NPS enviadas no dia — expõe "NPS travado na
--                       origem" (enquete sai no Finalizar, que quase não ocorre)
-- DROP+CREATE de novo: param novo com default criaria overload ambíguo.
-- =============================================================================

drop function if exists public.get_daily_manager_report(text, date, text[]);

create or replace function public.get_daily_manager_report(
  p_instance_id text,
  p_day date default null,
  p_brands text[] default null,
  p_categories jsonb default null
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
  v_pstart timestamptz := ((v_day - 7)::timestamp) at time zone 'America/Sao_Paulo';
  v_pend timestamptz := ((v_day - 6)::timestamp) at time zone 'America/Sao_Paulo';
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
  panel_out as (
    select m.conversation_id
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
  brand_norms as (
    select distinct
      regexp_replace(
        translate(lower(trim(u.b)),
                  'áàãâäéèêëíìîïóòõôöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
        '[^a-z0-9 _-]', '', 'g') as bn
    from unnest(coalesce(p_brands, array[]::text[])) as u(b)
    where coalesce(trim(u.b), '') <> ''
  ),
  scan_msgs as (
    select m.id, m.conversation_id,
           translate(lower(coalesce(m.content, '') || ' ' || coalesce(m.transcription, '')),
                     'áàãâäéèêëíìîïóòõôöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') as t
    from conversation_messages m
    join convs cv on cv.id = m.conversation_id
    where m.direction = 'incoming'
      and m.created_at >= v_start and m.created_at < v_end
      and (coalesce(m.content, '') <> '' or coalesce(m.transcription, '') <> '')
  ),
  brands as (
    select regexp_replace(bn.bn, '[\s-]+', '_', 'g') as b
    from scan_msgs bm
    join brand_norms bn
      on bm.t ~ ('(^|[^a-z0-9])' || bn.bn || '([^a-z0-9]|$)')
    union all
    select lower(trim(split_part(t.tag, ':', 2))) as b
    from tool_calls
    cross join lateral jsonb_array_elements_text(
      case when jsonb_typeof(tc->'args'->'tags') = 'array' then tc->'args'->'tags' else '[]'::jsonb end
    ) as t(tag)
    where p_brands is null
      and tc->>'name' = 'set_tags'
      and t.tag like 'marca%:%'
      and coalesce(trim(split_part(t.tag, ':', 2)), '') <> ''
  ),
  cats as (
    select x.n, x.p
    from jsonb_to_recordset(coalesce(p_categories, '[]'::jsonb)) as x(n text, p text)
    where coalesce(trim(x.n), '') <> '' and coalesce(trim(x.p), '') <> ''
  ),
  cat_hits as (
    select c.n, sm.id, sm.conversation_id
    from scan_msgs sm
    join cats c on sm.t ~ ('(^|[^a-z0-9])' || c.p || '([^a-z0-9]|$)')
  ),
  nps as (
    select pr.numeric_score, pr.selected_options
    from poll_responses pr
    join poll_messages pm on pm.id = pr.poll_message_id
    where pm.instance_id = p_instance_id and pm.is_nps = true
      and pr.voted_at >= v_start and pr.voted_at < v_end
  ),
  prev_inbound as (
    select m.conversation_id, m.created_at
    from conversation_messages m
    join convs cv on cv.id = m.conversation_id
    where m.direction = 'incoming'
      and m.created_at >= v_pstart and m.created_at < v_pend
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
    'nps_sent', (select count(*) from poll_messages pm
                  where pm.instance_id = p_instance_id and pm.is_nps = true
                    and pm.created_at >= v_start and pm.created_at < v_end),
    'human_panel_msgs', (select count(*) from panel_out),
    'human_panel_convs', (select count(distinct conversation_id) from panel_out),
    'top_searches', coalesce(
      (select jsonb_agg(jsonb_build_object('q', q, 'n', n) order by n desc, q)
         from (select q, count(*) as n from searches group by q order by count(*) desc, q limit 10) s),
      '[]'::jsonb),
    'top_brands', coalesce(
      (select jsonb_agg(jsonb_build_object('b', b, 'n', n) order by n desc, b)
         from (select b, count(*) as n from brands group by b order by count(*) desc, b limit 10) s),
      '[]'::jsonb),
    'category_mentions', coalesce(
      (select jsonb_agg(jsonb_build_object('c', n, 'msgs', msgs, 'convs', convs) order by convs desc, n)
         from (select n, count(distinct id) as msgs, count(distinct conversation_id) as convs
                 from cat_hits group by n) s),
      '[]'::jsonb),
    'prev', jsonb_build_object(
      'day', to_char(v_day - 7, 'YYYY-MM-DD'),
      'conversations_total', (select count(distinct conversation_id) from prev_inbound),
      'conversations_new', (select count(distinct pi.conversation_id)
                              from prev_inbound pi
                              join convs cv on cv.id = pi.conversation_id
                              join contacts ct on ct.id = cv.contact_id
                             where ct.created_at >= v_pstart and ct.created_at < v_pend),
      'inbound_total', (select count(*) from prev_inbound),
      'handoffs_total', (select count(distinct h.conversation_id)
                           from handoff_queue_events h
                           join convs cv on cv.id = h.conversation_id
                          where h.created_at >= v_pstart and h.created_at < v_pend),
      'sales', (select count(*) from conversion_funnel_events f
                 where f.instance_id = p_instance_id and f.stage = 'conversion'
                   and f.created_at >= v_pstart and f.created_at < v_pend))
  )
  into v_result;

  return v_result;
end;
$$;

comment on function public.get_daily_manager_report(text, date, text[], jsonb) is
  'Resumo diário RICO pro gestor (edge fn daily-manager-report). Janela America/Sao_Paulo. '
  'p_brands (DEFAULT_BRANDS) e p_categories (REPORT_CATEGORIES) vêm do TS — fonte única. '
  'prev = mesmo dia da semana anterior. Só service_role.';

revoke execute on function public.get_daily_manager_report(text, date, text[], jsonb) from public, anon, authenticated;
grant execute on function public.get_daily_manager_report(text, date, text[], jsonb) to service_role;
