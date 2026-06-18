-- =============================================================================
-- v7.95.0 — Hardening de segurança (auditoria de pendências 2026-06-17)
--
-- Fecha 2 dos achados do advisor que são SEGUROS (não tocam UI):
--   1. RLS `USING(true) TO public` em tabelas internas → restringe a service_role.
--      (service_role já bypassa RLS; a policy `TO public` concedia acesso a
--       authenticated/anon sem querer.) Só as tabelas que o frontend NÃO lê:
--       ai_debounce_queue (fila interna) e scrape_jobs (scraping). As outras 2
--       (ai_agent_validations, follow_up_executions) SÃO lidas pela UID (score/
--       agent-detail) → ficam pra um fix com policy tenant-scoped, não flip cego.
--   2. search_path mutável em SECURITY DEFINER → fixa em `public`.
--      Só `get_previous_e2e_batch` (nossa); `install_flow_template` cai no drop do
--      schema órfão dos Fluxos v3.0; `dblink_connect_u` é da extensão (não tocar).
-- =============================================================================

ALTER POLICY "all_debounce" ON public.ai_debounce_queue TO service_role;
ALTER POLICY "Service role full access on scrape_jobs" ON public.scrape_jobs TO service_role;

ALTER FUNCTION public.get_previous_e2e_batch(uuid, uuid) SET search_path = public;
