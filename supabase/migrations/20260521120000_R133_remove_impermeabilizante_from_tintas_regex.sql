-- R133 (2026-05-21): remove `impermeabilizante` da regex `interesse_match` da
-- categoria `tintas` em todos ai_agents. Causa: overlap silencioso com a categoria
-- `impermeabilizantes` (que também tem `impermeabilizante` no regex). Lead que
-- mencionava só "impermeabilizante" disparava matchAllCategoriesBySearchText com
-- 2 categorias (tintas + impermeabilizantes), provocando R129 com label "tintas
-- e vernizes" fantasma. Caso real: conv 176f7c6f-6067-4ee8-b6e8-3fae64dffbb3
-- (Branca Eletropiso, 2026-05-21).
--
-- Estratégia: pra cada objeto em service_categories.categories[] cujo `id`='tintas',
-- substitui em interesse_match os tokens `|impermeabilizante` e `impermeabilizante|`
-- por string vazia. Usa replace() literal (sem regex word-boundary) pra evitar
-- problemas de escape em pipelines de deploy.
--
-- Idempotente: rodar 2x não tem efeito adicional (replace de string já removida).

UPDATE ai_agents
SET service_categories = jsonb_set(
  service_categories,
  '{categories}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN cat->>'id' = 'tintas' THEN
          jsonb_set(
            cat,
            '{interesse_match}',
            to_jsonb(
              replace(
                replace(cat->>'interesse_match', '|impermeabilizante', ''),
                'impermeabilizante|', ''
              )
            )
          )
        ELSE cat
      END
    )
    FROM jsonb_array_elements(service_categories->'categories') AS cat
  )
)
WHERE service_categories IS NOT NULL
  AND service_categories ? 'categories'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(service_categories->'categories') c
    WHERE c->>'id' = 'tintas'
      AND c->>'interesse_match' LIKE '%impermeabilizante%'
  );
