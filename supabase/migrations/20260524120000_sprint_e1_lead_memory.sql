-- Sprint E.1 (2026-05-24): memória longa por lead — campos aditivos em lead_profiles.
--
-- Pesquisa (Mem0 arXiv:2504.19413 structured-facts + Zep arXiv:2501.13956 validity):
-- pra domínio de vendas BOUNDED com Postgres, memória ESTRUTURADA > vector RAG.
-- lead_profiles já guarda full_name/interests/objections/average_ticket/
-- conversation_summaries/sentiment_history. Faltam 3 campos pro "onde paramos":
--
--   products_seen     — produtos que o lead viu/escolheu (resume de catálogo)
--   qualification_stage — estágio onde a qualificação parou (resume de qualif)
--   memory_updated_at  — validity timestamp (Zep): quando a memória foi consolidada
--
-- Aditivo, nullable, zero impacto em quem já lê lead_profiles.

ALTER TABLE lead_profiles
  ADD COLUMN IF NOT EXISTS products_seen JSONB,
  ADD COLUMN IF NOT EXISTS qualification_stage TEXT,
  ADD COLUMN IF NOT EXISTS memory_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN lead_profiles.products_seen IS
  'Sprint E.1: produtos vistos/escolhidos pelo lead (array de strings ou objetos). Memória longa.';
COMMENT ON COLUMN lead_profiles.qualification_stage IS
  'Sprint E.1: estágio onde a qualificação parou (resume — lead que volta não refaz campos já respondidos).';
COMMENT ON COLUMN lead_profiles.memory_updated_at IS
  'Sprint E.1: validity timestamp (ideia Zep) — quando a memória do lead foi consolidada pela última vez.';
