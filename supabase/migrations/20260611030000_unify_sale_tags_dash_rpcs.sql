-- Unifica a família de tags de VENDA nos RPCs do dashboard insights:
-- venda:fechada (IA, saleClosedDetection determinístico) OU resultado:venda
-- (humano, TicketResolutionDrawer). Antes cada contador olhava só uma das duas
-- → KPI "Vendas Fechadas" não somava as confirmações manuais do drawer.

CREATE OR REPLACE FUNCTION public.dash_kpis_resumo(p_instance_id text, p_since timestamp with time zone, p_until timestamp with time zone DEFAULT now())
 RETURNS TABLE(total_conversas bigint, total_vendas bigint, total_cotacoes bigint, total_handoffs bigint, total_objecoes bigint, taxa_conversao_pct numeric, taxa_handoff_pct numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT
      COUNT(*)::bigint AS total_c,
      COUNT(*) FILTER (WHERE 'venda:fechada' = ANY(c.tags) OR 'resultado:venda' = ANY(c.tags))::bigint AS total_v,
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
$function$;

CREATE OR REPLACE FUNCTION public.dash_vendas_por_vendedor(p_instance_id text, p_since timestamp with time zone, p_until timestamp with time zone DEFAULT now())
 RETURNS TABLE(seller_id uuid, seller_name text, vendas bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.assigned_to AS seller_id, COALESCE(up.full_name, 'Não atribuído') AS seller_name, COUNT(DISTINCT c.id)::bigint AS vendas
  FROM public.conversations c
  JOIN public.inboxes i ON i.id = c.inbox_id
  LEFT JOIN public.user_profiles up ON up.id = c.assigned_to
  WHERE i.instance_id = p_instance_id
    AND c.last_message_at >= p_since AND c.last_message_at < p_until
    AND ('venda:fechada' = ANY(c.tags) OR 'resultado:venda' = ANY(c.tags))
  GROUP BY c.assigned_to, up.full_name ORDER BY vendas DESC LIMIT 30;
$function$;

CREATE OR REPLACE FUNCTION public.dash_cotacoes(p_instance_id text, p_since timestamp with time zone, p_until timestamp with time zone DEFAULT now())
 RETURNS TABLE(total_cotacoes bigint, com_handoff bigint, fechadas bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    COUNT(*) FILTER (WHERE 'motivo:orcamento' = ANY(c.tags))::bigint AS total_cotacoes,
    COUNT(*) FILTER (WHERE 'motivo:orcamento' = ANY(c.tags) AND c.status_ia = 'shadow')::bigint AS com_handoff,
    COUNT(*) FILTER (WHERE 'motivo:orcamento' = ANY(c.tags) AND ('venda:fechada' = ANY(c.tags) OR 'resultado:venda' = ANY(c.tags)))::bigint AS fechadas
  FROM public.conversations c
  JOIN public.inboxes i ON i.id = c.inbox_id
  WHERE i.instance_id = p_instance_id
    AND c.last_message_at >= p_since AND c.last_message_at < p_until;
$function$;

CREATE OR REPLACE FUNCTION public.dash_conversao_orcamento_venda(p_instance_id text, p_since timestamp with time zone, p_until timestamp with time zone DEFAULT now())
 RETURNS TABLE(total_cotacoes bigint, fechadas bigint, taxa_conversao_pct numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT
      COUNT(*) FILTER (WHERE 'motivo:orcamento' = ANY(c.tags))::bigint AS total_cot,
      COUNT(*) FILTER (WHERE 'motivo:orcamento' = ANY(c.tags) AND ('venda:fechada' = ANY(c.tags) OR 'resultado:venda' = ANY(c.tags)))::bigint AS fechadas
    FROM public.conversations c
    JOIN public.inboxes i ON i.id = c.inbox_id
    WHERE i.instance_id = p_instance_id
      AND c.last_message_at >= p_since AND c.last_message_at < p_until
  ) SELECT total_cot, fechadas, ROUND(fechadas * 100.0 / NULLIF(total_cot, 0), 1) AS taxa_conversao_pct FROM base;
$function$;
