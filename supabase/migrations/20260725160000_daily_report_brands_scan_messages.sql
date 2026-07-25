-- =============================================================================
-- v7.107.0 — top_brands do resumo do gestor passa a VARRER AS MENSAGENS
-- (auditoria 2026-07-25 "por que só 1 marca?"):
--   - Antes: contava só tags `marca%:%` gravadas pelo LLM via tool set_tags em
--     ai_agent_runs.tools_called → capturou 1 de ~27 menções reais na semana (4%).
--     (O detector determinístico R115 grava marca_citada: direto em
--     conversations.tags — que a RPC nem lia; e tags não têm timestamp por dia.)
--   - Agora: varre content + transcription das msgs INCOMING do dia (áudio
--     transcrito e foto descrita CONTAM — 1/3 das menções reais vem de foto,
--     o describe-image lê a embalagem) contra a lista p_brands com fronteira
--     de palavra (mesma política do detectBrand: "coralina" não casa "coral").
--   - Fonte única da lista: DEFAULT_BRANDS (_shared/brandDetection.ts), passada
--     pela edge fn daily-manager-report. p_brands NULL (chamador antigo) →
--     fallback legado set_tags, comportamento idêntico ao anterior.
--   - DROP + CREATE porque adicionar param com default criaria OVERLOAD
--     ambíguo pro PostgREST (2 args casariam as duas assinaturas).
--   - top_brands limit 5 → 10 (pedido do dono: "top 10 marcas").
-- =============================================================================

drop function if exists public.get_daily_manager_report(text, date);

create or replace function public.get_daily_manager_report(
  p_instance_id text,
  p_day date default null,
  p_brands text[] default null
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
  brand_norms as (
    -- normaliza igual ao detectBrand: lowercase + sem acento; remove chars
    -- regex-especiais (marca real é [a-z0-9 -]) → regex sem escaping manual
    select distinct
      regexp_replace(
        translate(lower(trim(u.b)),
                  'áàãâäéèêëíìîïóòõôöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
        '[^a-z0-9 _-]', '', 'g') as bn
    from unnest(coalesce(p_brands, array[]::text[])) as u(b)
    where coalesce(trim(u.b), '') <> ''
  ),
  brand_msgs as (
    select m.id,
           translate(lower(coalesce(m.content, '') || ' ' || coalesce(m.transcription, '')),
                     'áàãâäéèêëíìîïóòõôöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') as t
    from conversation_messages m
    join convs cv on cv.id = m.conversation_id
    where m.direction = 'incoming'
      and m.created_at >= v_start and m.created_at < v_end
      and (coalesce(m.content, '') <> '' or coalesce(m.transcription, '') <> '')
  ),
  brands as (
    -- caminho novo: 1 linha por (msg, marca) — msg citando 2 marcas conta ambas,
    -- msg repetindo a mesma marca conta 1
    select regexp_replace(bn.bn, '[\s-]+', '_', 'g') as b
    from brand_msgs bm
    join brand_norms bn
      on bm.t ~ ('(^|[^a-z0-9])' || bn.bn || '([^a-z0-9]|$)')
    union all
    -- fallback legado (p_brands null): tags marca% via tool set_tags
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
         from (select b, count(*) as n from brands group by b order by count(*) desc, b limit 10) s),
      '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

comment on function public.get_daily_manager_report(text, date, text[]) is
  'Resumo diário pro gestor (edge fn daily-manager-report). Janela America/Sao_Paulo. '
  'p_brands = lista de marcas (DEFAULT_BRANDS do TS) → top_brands varre msgs incoming '
  '(content+transcription); null → fallback legado set_tags. Só service_role.';

revoke execute on function public.get_daily_manager_report(text, date, text[]) from public, anon, authenticated;
grant execute on function public.get_daily_manager_report(text, date, text[]) to service_role;
