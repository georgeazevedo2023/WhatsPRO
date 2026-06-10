-- Security Advisor 2026-06-10: as 6 views de métricas são SECURITY DEFINER e
-- tinham GRANT pra anon — qualquer um com a anon key (pública no bundle) lia
-- métricas de negócio SEM login. Fecha o acesso anônimo; o dashboard do gestor
-- usa sessão authenticated e continua funcionando. DML em view de agregação é
-- inútil — revoga também de authenticated (mantém só SELECT).
REVOKE ALL ON public.v_conversion_funnel,
              public.v_vendor_activity,
              public.v_lead_metrics,
              public.v_handoff_details,
              public.v_ia_vs_vendor,
              public.v_agent_performance
FROM anon;

REVOKE INSERT, UPDATE, DELETE ON public.v_conversion_funnel,
              public.v_vendor_activity,
              public.v_lead_metrics,
              public.v_handoff_details,
              public.v_ia_vs_vendor,
              public.v_agent_performance
FROM authenticated;
