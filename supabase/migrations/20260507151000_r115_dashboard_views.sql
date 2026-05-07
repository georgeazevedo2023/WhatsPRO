-- R115 F2: 13 SQL functions pro dashboard do gestor
-- Padrão: cada função aceita p_instance_id text, p_since timestamptz, p_until timestamptz
-- e retorna TABLE com colunas tipadas. STABLE + SECURITY DEFINER + search_path=public.
-- Grants: service_role + authenticated.
--
-- Aplicada em 2026-05-07 via mcp apply_migration (fn referência usa user_profiles, não profiles).

CREATE OR REPLACE FUNCTION public.dash_top_produtos_citados(
  p_instance_id text, p_since timestamptz, p_until timestamptz DEFAULT NOW()
) RETURNS TABLE(query text, qty bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT LOWER(TRIM(t->'args'->>'query')) AS query, COUNT(*)::bigint AS qty
  FROM public.ai_agent_logs l
  JOIN public.conversations c ON c.id = l.conversation_id
  JOIN public.inboxes i ON i.id = c.inbox_id,
    LATERAL jsonb_array_elements(COALESCE(l.tool_calls, '[]'::jsonb)) AS t
  WHERE i.instance_id = p_instance_id
    AND l.created_at >= p_since AND l.created_at < p_until
    AND t->>'name' = 'search_products'
    AND COALESCE(t->'args'->>'query', '') <> ''
  GROUP BY 1 ORDER BY qty DESC LIMIT 50;
$$;

CREATE OR REPLACE FUNCTION public.dash_top_marcas_citadas(
  p_instance_id text, p_since timestamptz, p_until timestamptz DEFAULT NOW()
) RETURNS TABLE(marca text, qty bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT SPLIT_PART(tag, ':', 2) AS marca, COUNT(DISTINCT c.id)::bigint AS qty
  FROM public.conversations c
  JOIN public.inboxes i ON i.id = c.inbox_id,
    LATERAL UNNEST(c.tags) AS tag
  WHERE i.instance_id = p_instance_id
    AND c.last_message_at >= p_since AND c.last_message_at < p_until
    AND tag LIKE 'marca_citada:%'
  GROUP BY 1 ORDER BY qty DESC LIMIT 50;
$$;

CREATE OR REPLACE FUNCTION public.dash_top_objecoes(
  p_instance_id text, p_since timestamptz, p_until timestamptz DEFAULT NOW()
) RETURNS TABLE(objecao text, qty bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT SPLIT_PART(tag, ':', 2) AS objecao, COUNT(DISTINCT c.id)::bigint AS qty
  FROM public.conversations c
  JOIN public.inboxes i ON i.id = c.inbox_id,
    LATERAL UNNEST(c.tags) AS tag
  WHERE i.instance_id = p_instance_id
    AND c.last_message_at >= p_since AND c.last_message_at < p_until
    AND tag LIKE 'objecao:%'
  GROUP BY 1 ORDER BY qty DESC LIMIT 20;
$$;

CREATE OR REPLACE FUNCTION public.dash_top_pagamentos(
  p_instance_id text, p_since timestamptz, p_until timestamptz DEFAULT NOW()
) RETURNS TABLE(metodo text, qty bigint, pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT SPLIT_PART(tag, ':', 2) AS metodo, c.id
    FROM public.conversations c
    JOIN public.inboxes i ON i.id = c.inbox_id,
      LATERAL UNNEST(c.tags) AS tag
    WHERE i.instance_id = p_instance_id
      AND c.last_message_at >= p_since AND c.last_message_at < p_until
      AND tag LIKE 'pagamento:%'
  ), total AS (SELECT COUNT(DISTINCT id)::numeric AS t FROM base)
  SELECT b.metodo, COUNT(DISTINCT b.id)::bigint AS qty,
    ROUND(COUNT(DISTINCT b.id) * 100.0 / NULLIF((SELECT t FROM total), 0), 1) AS pct
  FROM base b GROUP BY b.metodo ORDER BY qty DESC;
$$;

CREATE OR REPLACE FUNCTION public.dash_top_tipos_cliente(
  p_instance_id text, p_since timestamptz, p_until timestamptz DEFAULT NOW()
) RETURNS TABLE(profissao text, qty bigint, pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT SPLIT_PART(tag, ':', 2) AS profissao, c.id
    FROM public.conversations c
    JOIN public.inboxes i ON i.id = c.inbox_id,
      LATERAL UNNEST(c.tags) AS tag
    WHERE i.instance_id = p_instance_id
      AND c.last_message_at >= p_since AND c.last_message_at < p_until
      AND tag LIKE 'tipo_cliente:%'
  ), total AS (SELECT COUNT(DISTINCT id)::numeric AS t FROM base)
  SELECT b.profissao, COUNT(DISTINCT b.id)::bigint AS qty,
    ROUND(COUNT(DISTINCT b.id) * 100.0 / NULLIF((SELECT t FROM total), 0), 1) AS pct
  FROM base b GROUP BY b.profissao ORDER BY qty DESC;
$$;

CREATE OR REPLACE FUNCTION public.dash_produtos_em_falta(
  p_instance_id text, p_since timestamptz, p_until timestamptz DEFAULT NOW()
) RETURNS TABLE(query text, qty bigint, ultima_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT LOWER(TRIM(t->'args'->>'query')) AS query, COUNT(*)::bigint AS qty, MAX(l.created_at) AS ultima_em
  FROM public.ai_agent_logs l
  JOIN public.conversations c ON c.id = l.conversation_id
  JOIN public.inboxes i ON i.id = c.inbox_id,
    LATERAL jsonb_array_elements(COALESCE(l.tool_calls, '[]'::jsonb)) AS t
  WHERE i.instance_id = p_instance_id
    AND l.created_at >= p_since AND l.created_at < p_until
    AND t->>'name' = 'search_products'
    AND (t->>'result' ILIKE '%nenhum%' OR t->>'result' ILIKE '%n%o encontr%' OR t->>'result' ILIKE '%vazio%' OR LENGTH(t->>'result') < 30)
    AND COALESCE(t->'args'->>'query', '') <> ''
  GROUP BY 1 ORDER BY qty DESC LIMIT 30;
$$;

CREATE OR REPLACE FUNCTION public.dash_marcas_nao_trabalhadas(
  p_instance_id text, p_since timestamptz, p_until timestamptz DEFAULT NOW()
) RETURNS TABLE(marca text, qty bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT REPLACE(SPLIT_PART(tag, ':', 2), '_', ' ') AS marca, COUNT(DISTINCT c.id)::bigint AS qty
  FROM public.conversations c
  JOIN public.inboxes i ON i.id = c.inbox_id,
    LATERAL UNNEST(c.tags) AS tag
  WHERE i.instance_id = p_instance_id
    AND c.last_message_at >= p_since AND c.last_message_at < p_until
    AND tag LIKE 'marca_indisponivel:%'
  GROUP BY 1 ORDER BY qty DESC LIMIT 30;
$$;

CREATE OR REPLACE FUNCTION public.dash_excluded_match(
  p_instance_id text, p_since timestamptz, p_until timestamptz DEFAULT NOW()
) RETURNS TABLE(keyword text, qty bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(l.metadata->>'keyword', l.metadata->>'detection_type', 'desconhecido') AS keyword, COUNT(*)::bigint AS qty
  FROM public.ai_agent_logs l
  JOIN public.conversations c ON c.id = l.conversation_id
  JOIN public.inboxes i ON i.id = c.inbox_id
  WHERE i.instance_id = p_instance_id
    AND l.created_at >= p_since AND l.created_at < p_until
    AND l.event = 'excluded_product_match'
  GROUP BY 1 ORDER BY qty DESC LIMIT 30;
$$;

CREATE OR REPLACE FUNCTION public.dash_vendas_por_vendedor(
  p_instance_id text, p_since timestamptz, p_until timestamptz DEFAULT NOW()
) RETURNS TABLE(seller_id uuid, seller_name text, vendas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.assigned_to AS seller_id, COALESCE(up.full_name, 'Não atribuído') AS seller_name, COUNT(DISTINCT c.id)::bigint AS vendas
  FROM public.conversations c
  JOIN public.inboxes i ON i.id = c.inbox_id
  LEFT JOIN public.user_profiles up ON up.id = c.assigned_to
  WHERE i.instance_id = p_instance_id
    AND c.last_message_at >= p_since AND c.last_message_at < p_until
    AND 'venda:fechada' = ANY(c.tags)
  GROUP BY c.assigned_to, up.full_name ORDER BY vendas DESC LIMIT 30;
$$;

CREATE OR REPLACE FUNCTION public.dash_cotacoes(
  p_instance_id text, p_since timestamptz, p_until timestamptz DEFAULT NOW()
) RETURNS TABLE(total_cotacoes bigint, com_handoff bigint, fechadas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COUNT(*) FILTER (WHERE 'motivo:orcamento' = ANY(c.tags))::bigint AS total_cotacoes,
    COUNT(*) FILTER (WHERE 'motivo:orcamento' = ANY(c.tags) AND c.status_ia = 'shadow')::bigint AS com_handoff,
    COUNT(*) FILTER (WHERE 'motivo:orcamento' = ANY(c.tags) AND 'venda:fechada' = ANY(c.tags))::bigint AS fechadas
  FROM public.conversations c
  JOIN public.inboxes i ON i.id = c.inbox_id
  WHERE i.instance_id = p_instance_id
    AND c.last_message_at >= p_since AND c.last_message_at < p_until;
$$;

CREATE OR REPLACE FUNCTION public.dash_conversao_orcamento_venda(
  p_instance_id text, p_since timestamptz, p_until timestamptz DEFAULT NOW()
) RETURNS TABLE(total_cotacoes bigint, fechadas bigint, taxa_conversao_pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT
      COUNT(*) FILTER (WHERE 'motivo:orcamento' = ANY(c.tags))::bigint AS total_cot,
      COUNT(*) FILTER (WHERE 'motivo:orcamento' = ANY(c.tags) AND 'venda:fechada' = ANY(c.tags))::bigint AS fechadas
    FROM public.conversations c
    JOIN public.inboxes i ON i.id = c.inbox_id
    WHERE i.instance_id = p_instance_id
      AND c.last_message_at >= p_since AND c.last_message_at < p_until
  ) SELECT total_cot, fechadas, ROUND(fechadas * 100.0 / NULLIF(total_cot, 0), 1) AS taxa_conversao_pct FROM base;
$$;

CREATE OR REPLACE FUNCTION public.dash_sla_sem_resposta(
  p_instance_id text, p_threshold_in_minutes integer DEFAULT 30
) RETURNS TABLE(conversation_id uuid, contact_name text, contact_phone text, primeira_msg timestamptz, minutos_sem_resposta integer, status_ia text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH primeira AS (
    SELECT cm.conversation_id,
      MIN(cm.created_at) FILTER (WHERE cm.direction = 'incoming') AS primeira_in,
      MIN(cm.created_at) FILTER (WHERE cm.direction = 'outgoing') AS primeira_out
    FROM public.conversation_messages cm
    JOIN public.conversations c ON c.id = cm.conversation_id
    JOIN public.inboxes i ON i.id = c.inbox_id
    WHERE i.instance_id = p_instance_id
    GROUP BY cm.conversation_id
  )
  SELECT p.conversation_id, co.name, co.phone, p.primeira_in,
    (EXTRACT(EPOCH FROM (NOW() - p.primeira_in))::integer / 60), c.status_ia
  FROM primeira p
  JOIN public.conversations c ON c.id = p.conversation_id
  JOIN public.contacts co ON co.id = c.contact_id
  WHERE p.primeira_in IS NOT NULL
    AND (p.primeira_out IS NULL OR p.primeira_out < p.primeira_in)
    AND NOW() - p.primeira_in > (p_threshold_in_minutes || ' minutes')::interval
    AND c.archived = false
  ORDER BY p.primeira_in ASC LIMIT 100;
$$;

CREATE OR REPLACE FUNCTION public.dash_kpis_resumo(
  p_instance_id text, p_since timestamptz, p_until timestamptz DEFAULT NOW()
) RETURNS TABLE(total_conversas bigint, total_vendas bigint, total_cotacoes bigint, total_handoffs bigint, total_objecoes bigint, taxa_conversao_pct numeric, taxa_handoff_pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT
      COUNT(*)::bigint AS total_c,
      COUNT(*) FILTER (WHERE 'venda:fechada' = ANY(c.tags))::bigint AS total_v,
      COUNT(*) FILTER (WHERE 'motivo:orcamento' = ANY(c.tags))::bigint AS total_cot,
      COUNT(*) FILTER (WHERE c.status_ia = 'shadow')::bigint AS total_h,
      COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM UNNEST(c.tags) t WHERE t LIKE 'objecao:%'))::bigint AS total_o
    FROM public.conversations c
    JOIN public.inboxes i ON i.id = c.inbox_id
    WHERE i.instance_id = p_instance_id
      AND c.last_message_at >= p_since AND c.last_message_at < p_until
  ) SELECT total_c, total_v, total_cot, total_h, total_o,
    ROUND(total_v * 100.0 / NULLIF(total_c, 0), 1),
    ROUND(total_h * 100.0 / NULLIF(total_c, 0), 1) FROM base;
$$;

GRANT EXECUTE ON FUNCTION public.dash_top_produtos_citados TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.dash_top_marcas_citadas TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.dash_top_objecoes TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.dash_top_pagamentos TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.dash_top_tipos_cliente TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.dash_produtos_em_falta TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.dash_marcas_nao_trabalhadas TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.dash_excluded_match TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.dash_vendas_por_vendedor TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.dash_cotacoes TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.dash_conversao_orcamento_venda TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.dash_sla_sem_resposta TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.dash_kpis_resumo TO service_role, authenticated;
