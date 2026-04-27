-- M19-S10 v2 — Service Categories com Stages + Score Progressivo
--
-- Substitui o schema plano (qualification_fields[] + ask_pre_search boolean) de v1
-- por um schema de stages com score progressivo. Cada categoria agora tem N stages,
-- cada stage tem fields com score_value, e um exit_action que dispara quando o
-- lead atinge max_score (search_products | enrichment | handoff | continue).
--
-- HIST:
--   - v1 (20260427000001) shipou schema plano. Apenas 1 agente em prod com seed default.
--   - v2 substitui o schema. Migration UPDATE remapeia agentes em formato v1 (detectados
--     por presenca de qualification_fields no array de categorias) para o seed v2 default.
--     Como v1 nunca chegou ao admin (UI nao foi shipada), o remapeamento e seguro:
--     todos os agentes ainda tem o seed default plano -> substituicao integral.
--
-- Schema v2 do JSONB (mesmo formato exposto pelo helper _shared/serviceCategories.ts):
--   {
--     "categories": [
--       { "id": str, "label": str, "interesse_match": regex_str,
--         "stages": [
--           { "id": str, "label": str,
--             "min_score": int, "max_score": int,
--             "exit_action": "search_products"|"enrichment"|"handoff"|"continue",
--             "fields": [
--               { "key": str, "label": str, "examples": str,
--                 "score_value": int, "priority": int }
--             ],
--             "phrasing": str_template
--           }
--         ]
--       }
--     ],
--     "default": { "stages": [ ... ] }
--   }
--
-- Defesas:
--   - O helper TypeScript faz fallback para DEFAULT_SERVICE_CATEGORIES_V2 caso receba
--     schema invalido ou v1 (detecta ausencia de "stages" no array de categorias).
--   - O DEFAULT da coluna passa a ser o seed v2.
--   - Funcao add_lead_score_event registra eventos em lead_score_history com metadata
--     contendo agent_id/category_id/stage_id/field_key (campos sao salvos no JSONB
--     metadata pois a tabela nao tem colunas dedicadas).

-- =============================================================================
-- 1) UPDATE remapeando dados v1 -> v2 ANTES de mudar o DEFAULT
--    Detecta agentes onde service_categories->'categories'->0 ? 'qualification_fields'
--    (formato v1) e substitui pelo novo seed v2 default.
-- =============================================================================

UPDATE public.ai_agents
SET service_categories = '{
  "categories": [
    {
      "id": "tintas",
      "label": "Tintas e Vernizes",
      "interesse_match": "tinta|esmalte|verniz|impermeabilizante",
      "stages": [
        {
          "id": "identificacao",
          "label": "Identificação",
          "min_score": 0,
          "max_score": 30,
          "exit_action": "search_products",
          "fields": [
            { "key": "ambiente", "label": "ambiente", "examples": "interno ou externo", "score_value": 15, "priority": 1 },
            { "key": "cor",      "label": "cor",      "examples": "branco, cinza, etc.", "score_value": 15, "priority": 2 }
          ],
          "phrasing": "Para encontrar a melhor opção, qual {label}? ({examples})"
        },
        {
          "id": "detalhamento",
          "label": "Detalhamento",
          "min_score": 30,
          "max_score": 70,
          "exit_action": "enrichment",
          "fields": [
            { "key": "acabamento",      "label": "acabamento",      "examples": "fosco, acetinado, brilho, semibrilho", "score_value": 20, "priority": 1 },
            { "key": "marca_preferida", "label": "marca preferida", "examples": "Coral, Suvinil",                       "score_value": 20, "priority": 2 }
          ],
          "phrasing": "Certo! E sobre {label}, prefere {examples}?"
        },
        {
          "id": "fechamento",
          "label": "Pronto para Handoff",
          "min_score": 70,
          "max_score": 100,
          "exit_action": "handoff",
          "fields": [
            { "key": "quantidade", "label": "quantidade",       "examples": "litros ou galões", "score_value": 15, "priority": 1 },
            { "key": "area",       "label": "metragem da área", "examples": "em m²",            "score_value": 15, "priority": 2 }
          ],
          "phrasing": "Antes de te conectar com o vendedor, {label}?"
        }
      ]
    },
    {
      "id": "impermeabilizantes",
      "label": "Impermeabilizantes e Mantas",
      "interesse_match": "impermeabilizante|manta",
      "stages": [
        {
          "id": "triagem",
          "label": "Triagem",
          "min_score": 0,
          "max_score": 60,
          "exit_action": "search_products",
          "fields": [
            { "key": "area",      "label": "área",              "examples": "tamanho da área",    "score_value": 30, "priority": 1 },
            { "key": "aplicacao", "label": "tipo de aplicação", "examples": "laje, parede, piso", "score_value": 30, "priority": 2 }
          ],
          "phrasing": "Para encontrar a melhor opção, qual {label}? ({examples})"
        },
        {
          "id": "fechamento",
          "label": "Pronto para Handoff",
          "min_score": 60,
          "max_score": 100,
          "exit_action": "handoff",
          "fields": [
            { "key": "marca_preferida", "label": "marca preferida", "examples": "", "score_value": 40, "priority": 1 }
          ],
          "phrasing": "Antes de transferir, {label}?"
        }
      ]
    }
  ],
  "default": {
    "stages": [
      {
        "id": "qualificacao_basica",
        "label": "Qualificação básica",
        "min_score": 0,
        "max_score": 100,
        "exit_action": "handoff",
        "fields": [
          { "key": "especificacao",   "label": "detalhes",              "examples": "qualquer informação relevante", "score_value": 25, "priority": 1 },
          { "key": "marca_preferida", "label": "marca preferida",       "examples": "",                              "score_value": 25, "priority": 2 },
          { "key": "quantidade",      "label": "quantidade necessária", "examples": "",                              "score_value": 25, "priority": 3 }
        ],
        "phrasing": "Para te ajudar melhor, me conta {label}?"
      }
    ]
  }
}'::jsonb
WHERE service_categories IS NOT NULL
  AND service_categories ? 'categories'
  AND jsonb_typeof(service_categories->'categories') = 'array'
  AND jsonb_array_length(service_categories->'categories') > 0
  AND service_categories->'categories'->0 ? 'qualification_fields'
  AND NOT (service_categories->'categories'->0 ? 'stages');

-- =============================================================================
-- 2) Substitui o DEFAULT da coluna service_categories pelo seed v2
-- =============================================================================

ALTER TABLE public.ai_agents
  ALTER COLUMN service_categories SET DEFAULT '{
    "categories": [
      {
        "id": "tintas",
        "label": "Tintas e Vernizes",
        "interesse_match": "tinta|esmalte|verniz|impermeabilizante",
        "stages": [
          {
            "id": "identificacao",
            "label": "Identificação",
            "min_score": 0,
            "max_score": 30,
            "exit_action": "search_products",
            "fields": [
              { "key": "ambiente", "label": "ambiente", "examples": "interno ou externo", "score_value": 15, "priority": 1 },
              { "key": "cor",      "label": "cor",      "examples": "branco, cinza, etc.", "score_value": 15, "priority": 2 }
            ],
            "phrasing": "Para encontrar a melhor opção, qual {label}? ({examples})"
          },
          {
            "id": "detalhamento",
            "label": "Detalhamento",
            "min_score": 30,
            "max_score": 70,
            "exit_action": "enrichment",
            "fields": [
              { "key": "acabamento",      "label": "acabamento",      "examples": "fosco, acetinado, brilho, semibrilho", "score_value": 20, "priority": 1 },
              { "key": "marca_preferida", "label": "marca preferida", "examples": "Coral, Suvinil",                       "score_value": 20, "priority": 2 }
            ],
            "phrasing": "Certo! E sobre {label}, prefere {examples}?"
          },
          {
            "id": "fechamento",
            "label": "Pronto para Handoff",
            "min_score": 70,
            "max_score": 100,
            "exit_action": "handoff",
            "fields": [
              { "key": "quantidade", "label": "quantidade",       "examples": "litros ou galões", "score_value": 15, "priority": 1 },
              { "key": "area",       "label": "metragem da área", "examples": "em m²",            "score_value": 15, "priority": 2 }
            ],
            "phrasing": "Antes de te conectar com o vendedor, {label}?"
          }
        ]
      },
      {
        "id": "impermeabilizantes",
        "label": "Impermeabilizantes e Mantas",
        "interesse_match": "impermeabilizante|manta",
        "stages": [
          {
            "id": "triagem",
            "label": "Triagem",
            "min_score": 0,
            "max_score": 60,
            "exit_action": "search_products",
            "fields": [
              { "key": "area",      "label": "área",              "examples": "tamanho da área",    "score_value": 30, "priority": 1 },
              { "key": "aplicacao", "label": "tipo de aplicação", "examples": "laje, parede, piso", "score_value": 30, "priority": 2 }
            ],
            "phrasing": "Para encontrar a melhor opção, qual {label}? ({examples})"
          },
          {
            "id": "fechamento",
            "label": "Pronto para Handoff",
            "min_score": 60,
            "max_score": 100,
            "exit_action": "handoff",
            "fields": [
              { "key": "marca_preferida", "label": "marca preferida", "examples": "", "score_value": 40, "priority": 1 }
            ],
            "phrasing": "Antes de transferir, {label}?"
          }
        ]
      }
    ],
    "default": {
      "stages": [
        {
          "id": "qualificacao_basica",
          "label": "Qualificação básica",
          "min_score": 0,
          "max_score": 100,
          "exit_action": "handoff",
          "fields": [
            { "key": "especificacao",   "label": "detalhes",              "examples": "qualquer informação relevante", "score_value": 25, "priority": 1 },
            { "key": "marca_preferida", "label": "marca preferida",       "examples": "",                              "score_value": 25, "priority": 2 },
            { "key": "quantidade",      "label": "quantidade necessária", "examples": "",                              "score_value": 25, "priority": 3 }
          ],
          "phrasing": "Para te ajudar melhor, me conta {label}?"
        }
      ]
    }
  }'::jsonb;

-- =============================================================================
-- 3) Atualiza COMMENT da coluna mencionando v2 com stages + score
-- =============================================================================

COMMENT ON COLUMN public.ai_agents.service_categories IS
  'M19-S10 v2 — Schema com stages e score progressivo. Cada categoria tem N stages com [min_score, max_score], exit_action (search_products|enrichment|handoff|continue) e fields com score_value. O AI Agent calcula stage atual via getCurrentStage(score, category), persiste score em tag lead_score:N e em lead_score_history (RPC add_lead_score_event). Backward compat: helper detecta v1 (sem stages) e faz fallback para DEFAULT_SERVICE_CATEGORIES_V2.';

-- =============================================================================
-- 4) Atualiza system_settings.default_service_categories com seed v2 (idempotente)
-- =============================================================================

INSERT INTO public.system_settings (key, value, description, is_secret) VALUES (
  'default_service_categories',
  '{
    "categories": [
      {
        "id": "tintas",
        "label": "Tintas e Vernizes",
        "interesse_match": "tinta|esmalte|verniz|impermeabilizante",
        "stages": [
          {
            "id": "identificacao",
            "label": "Identificação",
            "min_score": 0,
            "max_score": 30,
            "exit_action": "search_products",
            "fields": [
              { "key": "ambiente", "label": "ambiente", "examples": "interno ou externo", "score_value": 15, "priority": 1 },
              { "key": "cor",      "label": "cor",      "examples": "branco, cinza, etc.", "score_value": 15, "priority": 2 }
            ],
            "phrasing": "Para encontrar a melhor opção, qual {label}? ({examples})"
          },
          {
            "id": "detalhamento",
            "label": "Detalhamento",
            "min_score": 30,
            "max_score": 70,
            "exit_action": "enrichment",
            "fields": [
              { "key": "acabamento",      "label": "acabamento",      "examples": "fosco, acetinado, brilho, semibrilho", "score_value": 20, "priority": 1 },
              { "key": "marca_preferida", "label": "marca preferida", "examples": "Coral, Suvinil",                       "score_value": 20, "priority": 2 }
            ],
            "phrasing": "Certo! E sobre {label}, prefere {examples}?"
          },
          {
            "id": "fechamento",
            "label": "Pronto para Handoff",
            "min_score": 70,
            "max_score": 100,
            "exit_action": "handoff",
            "fields": [
              { "key": "quantidade", "label": "quantidade",       "examples": "litros ou galões", "score_value": 15, "priority": 1 },
              { "key": "area",       "label": "metragem da área", "examples": "em m²",            "score_value": 15, "priority": 2 }
            ],
            "phrasing": "Antes de te conectar com o vendedor, {label}?"
          }
        ]
      },
      {
        "id": "impermeabilizantes",
        "label": "Impermeabilizantes e Mantas",
        "interesse_match": "impermeabilizante|manta",
        "stages": [
          {
            "id": "triagem",
            "label": "Triagem",
            "min_score": 0,
            "max_score": 60,
            "exit_action": "search_products",
            "fields": [
              { "key": "area",      "label": "área",              "examples": "tamanho da área",    "score_value": 30, "priority": 1 },
              { "key": "aplicacao", "label": "tipo de aplicação", "examples": "laje, parede, piso", "score_value": 30, "priority": 2 }
            ],
            "phrasing": "Para encontrar a melhor opção, qual {label}? ({examples})"
          },
          {
            "id": "fechamento",
            "label": "Pronto para Handoff",
            "min_score": 60,
            "max_score": 100,
            "exit_action": "handoff",
            "fields": [
              { "key": "marca_preferida", "label": "marca preferida", "examples": "", "score_value": 40, "priority": 1 }
            ],
            "phrasing": "Antes de transferir, {label}?"
          }
        ]
      }
    ],
    "default": {
      "stages": [
        {
          "id": "qualificacao_basica",
          "label": "Qualificação básica",
          "min_score": 0,
          "max_score": 100,
          "exit_action": "handoff",
          "fields": [
            { "key": "especificacao",   "label": "detalhes",              "examples": "qualquer informação relevante", "score_value": 25, "priority": 1 },
            { "key": "marca_preferida", "label": "marca preferida",       "examples": "",                              "score_value": 25, "priority": 2 },
            { "key": "quantidade",      "label": "quantidade necessária", "examples": "",                              "score_value": 25, "priority": 3 }
          ],
          "phrasing": "Para te ajudar melhor, me conta {label}?"
        }
      ]
    }
  }',
  'M19-S10 v2 - Seed default de service_categories (stages + score) usado pelo AI Agent quando ai_agents.service_categories e null. Mesmo conteudo do DEFAULT JSONB da coluna ai_agents.service_categories.',
  false
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;

-- =============================================================================
-- 5) Funcao SQL add_lead_score_event
--
-- Schema real de lead_score_history (descoberto via information_schema):
--   id uuid PK, lead_id uuid NOT NULL, conversation_id uuid NULLABLE,
--   score_delta integer NOT NULL, reason text NOT NULL, score_after integer NOT NULL,
--   metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
--
-- Como NAO existem colunas dedicadas para agent_id/category_id/stage_id/field_key,
-- esses dados sao salvos no campo metadata JSONB. score_after e calculado dentro
-- da funcao lendo a tag lead_score:N do array de tags do lead (fonte de verdade)
-- e somando score_delta. Se nao houver tag previa, score anterior = 0.
--
-- A funcao NAO atualiza a tag lead_score:N do lead. Esse update e responsabilidade
-- do AI Agent (set_tags handler) para manter o fluxo unico de atualizacao de tags.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.add_lead_score_event(
  _lead_id uuid,
  _agent_id uuid,
  _score_delta integer,
  _category_id text DEFAULT NULL,
  _stage_id text DEFAULT NULL,
  _field_key text DEFAULT NULL,
  _conversation_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event_id uuid;
  _current_tags text[];
  _score_tag text;
  _previous_score integer := 0;
  _new_score integer;
  _reason text;
BEGIN
  -- Le score anterior da tag lead_score:N (se existir).
  -- Score vive em conversations.tags (TEXT[]), nao em lead_profiles.tags (JSONB).
  -- Se _conversation_id for null, _previous_score=0 (caso edge — chamada sem contexto de conversa).
  IF _conversation_id IS NOT NULL THEN
    SELECT tags INTO _current_tags FROM public.conversations WHERE id = _conversation_id;
  END IF;

  IF _current_tags IS NOT NULL THEN
    SELECT tag INTO _score_tag
    FROM unnest(_current_tags) AS tag
    WHERE tag LIKE 'lead_score:%'
    LIMIT 1;

    IF _score_tag IS NOT NULL THEN
      BEGIN
        _previous_score := (split_part(_score_tag, ':', 2))::integer;
      EXCEPTION WHEN OTHERS THEN
        _previous_score := 0;
      END;
    END IF;
  END IF;

  _new_score := GREATEST(0, _previous_score + _score_delta);

  -- Constroi reason legivel para o gestor (ex: "field acabamento (stage detalhamento)")
  _reason := COALESCE(
    NULLIF(
      concat_ws(' ',
        CASE WHEN _field_key  IS NOT NULL THEN 'field ' || _field_key ELSE NULL END,
        CASE WHEN _stage_id   IS NOT NULL THEN '(stage ' || _stage_id || ')' ELSE NULL END,
        CASE WHEN _category_id IS NOT NULL AND _stage_id IS NULL THEN '(cat ' || _category_id || ')' ELSE NULL END
      ),
      ''
    ),
    'service_category_score'
  );

  INSERT INTO public.lead_score_history (
    lead_id,
    conversation_id,
    score_delta,
    reason,
    score_after,
    metadata
  ) VALUES (
    _lead_id,
    _conversation_id,
    _score_delta,
    _reason,
    _new_score,
    jsonb_strip_nulls(jsonb_build_object(
      'agent_id',    _agent_id,
      'category_id', _category_id,
      'stage_id',    _stage_id,
      'field_key',   _field_key,
      'source',      'service_category'
    ))
  )
  RETURNING id INTO _event_id;

  RETURN _event_id;
END;
$$;

COMMENT ON FUNCTION public.add_lead_score_event(uuid, uuid, integer, text, text, text, uuid) IS
  'M19-S10 v2 — Adiciona evento em lead_score_history com metadata JSONB contendo agent_id/category_id/stage_id/field_key. Le score anterior da tag lead_score:N do lead e calcula score_after = max(0, anterior + delta). NAO atualiza a tag lead_score do lead (responsabilidade do AI Agent set_tags handler).';

-- Permissoes — service_role e authenticated (RLS controla quem ve os eventos)
GRANT EXECUTE ON FUNCTION public.add_lead_score_event(uuid, uuid, integer, text, text, text, uuid) TO authenticated, service_role;
