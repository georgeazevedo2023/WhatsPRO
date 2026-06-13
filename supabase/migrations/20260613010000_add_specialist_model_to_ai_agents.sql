-- v7.91.0 (2026-06-13): specialist_model configurável por agente (decisão de config #4 do dono)
--
-- Contexto: o backend (routerPipeline) já lia `agent.specialist_model || DEFAULT_SPECIALIST_MODEL`
-- em 5 pontos (build*SpecialistDef), mas a COLUNA nunca existiu no DB — então `select('*')` nunca
-- a trazia, `agent.specialist_model` era sempre undefined e TODO agente caía no default fixo 'gpt-4.1'.
-- O handoff anterior dizia "backend já lê, só falta a UI"; na verdade faltava a coluna inteira.
--
-- Esta migration cria a coluna com default = 'gpt-4.1' (IDÊNTICO ao fallback atual), então o
-- comportamento de todos os agentes existentes permanece inalterado. A UI (BrainConfig) passa a
-- escrever esta coluna, permitindo escolher o modelo dos specialists do router por agente.
--
-- Mirroring de `routing_mode` (text NOT NULL DEFAULT): config de router com valor sempre presente.

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS specialist_model text NOT NULL DEFAULT 'gpt-4.1';

COMMENT ON COLUMN public.ai_agents.specialist_model IS
  'Modelo LLM dos specialists do router (product/qualification/objection/handoff). Lido em routerPipeline via agent.specialist_model || DEFAULT_SPECIALIST_MODEL. Default gpt-4.1 (bom instruction-following e sem vazar tool call como texto). Só tem efeito quando routing_mode = router.';
