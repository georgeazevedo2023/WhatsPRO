-- M19-S10 — Service Categories (Unified Qualification Config)
--
-- Substitui 4 hardcodes de qualificacao no AI Agent por 1 schema editavel pelo admin.
-- Resolve "brilho/fosco" e habilita multi-tenant real (clinica, e-commerce, politica)
-- sem precisar editar codigo por nicho.
--
-- Hardcodes que sao substituidos (ver ai-agent/index.ts):
--   - linha ~1167  "QUALIFICACAO DE TINTAS" no prompt
--   - linha ~1171  texto literal "fosco ou brilho"
--   - linha ~1336-1368  funcao buildEnrichmentInstructions com if (interesse.includes('tinta'))
--
-- Schema do JSONB (mesma estrutura usada pelo helper _shared/serviceCategories.ts):
--   {
--     "categories": [
--       { "id": str, "label": str, "interesse_match": regex_str,
--         "qualification_fields": [
--           { "key": str, "label": str, "examples": str,
--             "ask_pre_search": bool, "priority": int }
--         ],
--         "phrasing_pre_search": str_template,
--         "phrasing_enrichment": str_template
--       }
--     ],
--     "default": {
--       "qualification_fields": [...],
--       "phrasing_pre_search": str_template,
--       "phrasing_enrichment": str_template
--     }
--   }
--
-- Backward compat: o DEFAULT JSONB reproduz EXATAMENTE o comportamento hardcoded
-- atual (categorias "tintas", "impermeabilizantes" e "default" generico).
-- Agentes existentes herdam o seed -> zero regressao.

ALTER TABLE ai_agents
  ADD COLUMN IF NOT EXISTS service_categories JSONB NOT NULL DEFAULT
    '{
      "categories": [
        {
          "id": "tintas",
          "label": "Tintas e Vernizes",
          "interesse_match": "tinta|esmalte|verniz|impermeabilizante",
          "qualification_fields": [
            { "key": "ambiente",        "label": "ambiente",          "examples": "interno ou externo",                "ask_pre_search": true,  "priority": 1 },
            { "key": "cor",             "label": "cor",               "examples": "branco, cinza, etc.",               "ask_pre_search": true,  "priority": 2 },
            { "key": "acabamento",      "label": "acabamento",        "examples": "fosco, acetinado, brilho, semibrilho", "ask_pre_search": false, "priority": 3 },
            { "key": "marca_preferida", "label": "marca preferida",   "examples": "Coral, Suvinil",                    "ask_pre_search": false, "priority": 4 },
            { "key": "quantidade",      "label": "quantidade",        "examples": "litros ou galões",                  "ask_pre_search": false, "priority": 5 },
            { "key": "area",            "label": "metragem da área",  "examples": "em m²",                             "ask_pre_search": false, "priority": 6 }
          ],
          "phrasing_pre_search": "Para encontrar a melhor opção, qual {label}? ({examples})",
          "phrasing_enrichment": "Certo! E sobre {label}, prefere {examples}?"
        },
        {
          "id": "impermeabilizantes",
          "label": "Impermeabilizantes e Mantas",
          "interesse_match": "impermeabilizante|manta",
          "qualification_fields": [
            { "key": "area",            "label": "área",                "examples": "tamanho da área",        "ask_pre_search": false, "priority": 1 },
            { "key": "aplicacao",       "label": "tipo de aplicação",   "examples": "laje, parede, piso",     "ask_pre_search": false, "priority": 2 },
            { "key": "marca_preferida", "label": "marca preferida",     "examples": "",                       "ask_pre_search": false, "priority": 3 }
          ],
          "phrasing_pre_search": "Para encontrar a melhor opção, qual {label}? ({examples})",
          "phrasing_enrichment": "Certo! E sobre {label}, prefere {examples}?"
        }
      ],
      "default": {
        "qualification_fields": [
          { "key": "especificacao",   "label": "detalhes",              "examples": "qualquer informação relevante", "ask_pre_search": false, "priority": 1 },
          { "key": "marca_preferida", "label": "marca preferida",       "examples": "",                              "ask_pre_search": false, "priority": 2 },
          { "key": "quantidade",      "label": "quantidade necessária", "examples": "",                              "ask_pre_search": false, "priority": 3 }
        ],
        "phrasing_pre_search": "Para te ajudar melhor, me conta {label}?",
        "phrasing_enrichment": "Antes de transferir, {label}?"
      }
    }'::jsonb;

COMMENT ON COLUMN ai_agents.service_categories IS
  'M19-S10 — Schema de categorias de servico/produto com qualification fields editaveis. Substitui hardcodes "QUALIFICACAO DE TINTAS" e funcao buildEnrichmentInstructions. Cada agente tem N categorias com regex de match (interesse_match), fields ordenados por priority, e flag ask_pre_search (true = pergunta na qualificacao pre-busca, false = pergunta no enrichment pos-busca). Templates {label} e {examples} sao substituidos no prompt.';

-- SYNC RULE item 7 — defaults globais em system_settings (tabela key-value)
-- Usado como fallback caso o JSONB do agente seja null/undefined em runtime.
-- O helper _shared/serviceCategories.ts tem fallback hardcoded tambem (defesa em profundidade).
INSERT INTO public.system_settings (key, value, description, is_secret) VALUES (
  'default_service_categories',
  '{
    "categories": [
      {
        "id": "tintas",
        "label": "Tintas e Vernizes",
        "interesse_match": "tinta|esmalte|verniz|impermeabilizante",
        "qualification_fields": [
          { "key": "ambiente",        "label": "ambiente",          "examples": "interno ou externo",                "ask_pre_search": true,  "priority": 1 },
          { "key": "cor",             "label": "cor",               "examples": "branco, cinza, etc.",               "ask_pre_search": true,  "priority": 2 },
          { "key": "acabamento",      "label": "acabamento",        "examples": "fosco, acetinado, brilho, semibrilho", "ask_pre_search": false, "priority": 3 },
          { "key": "marca_preferida", "label": "marca preferida",   "examples": "Coral, Suvinil",                    "ask_pre_search": false, "priority": 4 },
          { "key": "quantidade",      "label": "quantidade",        "examples": "litros ou galões",                  "ask_pre_search": false, "priority": 5 },
          { "key": "area",            "label": "metragem da área",  "examples": "em m²",                             "ask_pre_search": false, "priority": 6 }
        ],
        "phrasing_pre_search": "Para encontrar a melhor opção, qual {label}? ({examples})",
        "phrasing_enrichment": "Certo! E sobre {label}, prefere {examples}?"
      },
      {
        "id": "impermeabilizantes",
        "label": "Impermeabilizantes e Mantas",
        "interesse_match": "impermeabilizante|manta",
        "qualification_fields": [
          { "key": "area",            "label": "área",                "examples": "tamanho da área",        "ask_pre_search": false, "priority": 1 },
          { "key": "aplicacao",       "label": "tipo de aplicação",   "examples": "laje, parede, piso",     "ask_pre_search": false, "priority": 2 },
          { "key": "marca_preferida", "label": "marca preferida",     "examples": "",                       "ask_pre_search": false, "priority": 3 }
        ],
        "phrasing_pre_search": "Para encontrar a melhor opção, qual {label}? ({examples})",
        "phrasing_enrichment": "Certo! E sobre {label}, prefere {examples}?"
      }
    ],
    "default": {
      "qualification_fields": [
        { "key": "especificacao",   "label": "detalhes",              "examples": "qualquer informação relevante", "ask_pre_search": false, "priority": 1 },
        { "key": "marca_preferida", "label": "marca preferida",       "examples": "",                              "ask_pre_search": false, "priority": 2 },
        { "key": "quantidade",      "label": "quantidade necessária", "examples": "",                              "ask_pre_search": false, "priority": 3 }
      ],
      "phrasing_pre_search": "Para te ajudar melhor, me conta {label}?",
      "phrasing_enrichment": "Antes de transferir, {label}?"
    }
  }',
  'M19-S10 - Seed default de service_categories usado pelo AI Agent quando ai_agents.service_categories e null. Mesmo conteudo do DEFAULT JSONB da coluna ai_agents.service_categories.',
  false
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
