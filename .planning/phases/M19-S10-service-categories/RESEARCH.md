---
title: M19-S10 — Research (Service Categories)
phase: M19-S10
created: 2026-04-27
updated: 2026-04-27
---

# M19-S10 — Research

## Estado Atual (auditoria 2026-04-27)

### Os 4 hardcodes

#### Hardcode 1 — `ai-agent/index.ts:1167` (regra de prompt)

```text
- QUALIFICAÇÃO DE TINTAS: quando o lead quer tinta/verniz/impermeabilizante SEM mencionar marca,
  qualifique nesta ordem: (1) cor ou acabamento, (2) ambiente se necessário.
  NUNCA pergunte quantidade ou volume antes de buscar.
  Se o lead JÁ mencionou marca, PULE a qualificação e vá direto para search_products.
```

Concatenado depois de `prompt_sections` no prompt builder. Editar Prompt Studio NÃO sobrepõe.

#### Hardcode 2 — `ai-agent/index.ts:1171` (regra de prompt)

```text
- ENRIQUECIMENTO PÓS-BUSCA: quando a busca retorna 0 resultados e o [INTERNO] indica FASE DE ENRIQUECIMENTO,
  siga as instruções exatamente — faça a pergunta sugerida e salve a resposta com set_tags
  (acabamento, marca_preferida, quantidade, area, aplicacao).
  NÃO diga que o produto não foi encontrado.
  Diga algo natural como "Certo! E sobre acabamento, prefere fosco ou brilho?".
```

Texto literal "fosco ou brilho" hardcoded.

#### Hardcode 3 — `ai-agent/index.ts:1336-1368` (função TS)

```typescript
function buildEnrichmentInstructions(currentTags, step, maxSteps, brandNotFound): string {
  const has = (key) => currentTags.some(t => t.startsWith(`${key}:`))
  const interesse = currentTags.find(t => t.startsWith('interesse:'))?.split(':')[1] || ''

  const suggestions: string[] = []
  if (interesse.includes('tinta') || interesse.includes('esmalte')) {
    if (!has('acabamento')) suggestions.push('acabamento (fosco, acetinado, brilho, semibrilho)')
    if (!has('marca_preferida') && !brandNotFound) suggestions.push('marca preferida')
    if (!has('quantidade')) suggestions.push('quantidade (litros ou galões)')
    if (!has('area')) suggestions.push('metragem da área a pintar')
  } else if (interesse.includes('impermeabilizante') || interesse.includes('manta')) {
    // ...
  } else {
    // default genérico
  }

  return `AÇÃO: faça UMA pergunta de enriquecimento... Diga algo natural como "Certo! E sobre acabamento, prefere fosco ou brilho?"...`
}
```

#### Hardcode 4 — `src/data/nicheTemplates.ts:55`

```typescript
system_prompt: `...
- Pergunte sempre: tipo de produto, ambiente de uso, metragem/quantidade, acabamento preferido
...`
```

Carregado UMA vez na criação do agente. Após isso, fica preso no `system_prompt` salvo no DB.

### Conceitos relacionados (não tocar)

- **`ai_agents.extraction_fields`** — campos do PERFIL do lead para extrair (nome, cidade, profissão). Editor: `ExtractionConfig.tsx`. Continua independente — diferente de "perguntas por categoria".
- **`agent_profiles`** (M17 F3) — pacotes de prompt+handoff por funil/contexto. D10. Sub-agents deprecated.
- **`prompt_sections`** — 9 seções editáveis no Prompt Studio. Texto livre.
- **`max_pre_search_questions`** + **`max_enrichment_questions`** — controlam QUANTIDADE de perguntas. Já editáveis em `RulesConfig.tsx`. O que falta é controlar CONTEÚDO.
- **`buildQualificationChain`** (linha 1370) — usa `tagMap.has('acabamento')` dinamicamente. Funciona com qualquer key. **Sem mudanças necessárias.**

## Decisões Técnicas

### Schema final (após auditoria de unificação)

`ai_agents.service_categories JSONB` com flag `ask_pre_search` boolean em cada field:
- `true` → pergunta vai na fase de qualificação (regida por `max_pre_search_questions`)
- `false` → pergunta vai na fase de enrichment pós-busca (regida por `max_enrichment_questions`)

Isso unifica em 1 schema o que hoje está espalhado em 2 fluxos (qualificação ANTES de search, enrichment DEPOIS de search falha).

### `interesse_match` é regex

Por flexibilidade: `tinta|esmalte|verniz|impermeabilizante` em vez de array `["tinta", "esmalte"]`. UI valida com `try { new RegExp(value) } catch`. Backend defende com try/catch + fallback para default.

### `priority` é `number`

Permite reordenação fácil (drag-drop na UI). Numérico crescente (1 = primeiro a perguntar).

### `phrasing_pre_search` vs `phrasing_enrichment`

Templates Markdown-style com placeholders `{label}` e `{examples}`. O LLM recebe a frase pronta e usa como sugestão. Validator agent já trunca múltiplas perguntas se LLM se empolgar.

### Backward compat 100%

Migration popula DEFAULT com seed que reproduz EXATAMENTE o comportamento hardcoded atual:

```jsonc
{
  "categories": [
    {
      "id": "tintas",
      "interesse_match": "tinta|esmalte|verniz|impermeabilizante",
      "qualification_fields": [
        // ambiente, cor, acabamento (fosco/brilho), marca, quantidade, area
        // exatamente como o if/else atual
      ],
      "phrasing_enrichment": "Certo! E sobre {label}, prefere {examples}?"
    },
    {
      "id": "impermeabilizantes",
      "interesse_match": "impermeabilizante|manta",
      "qualification_fields": [/* area, aplicacao, marca */]
    }
  ],
  "default": { /* especificacao, marca, quantidade */ }
}
```

Agentes existentes recebem esse default → comportamento idêntico ao hardcoded → zero regressão.

## Helpers a criar

`supabase/functions/_shared/serviceCategories.ts`:

```typescript
export interface QualificationField {
  key: string;
  label: string;
  examples: string;
  ask_pre_search: boolean;
  priority: number;
}

export interface ServiceCategory {
  id: string;
  label: string;
  interesse_match: string;  // regex string
  qualification_fields: QualificationField[];
  phrasing_pre_search: string;
  phrasing_enrichment: string;
}

export interface ServiceCategoriesConfig {
  categories: ServiceCategory[];
  default: {
    qualification_fields: QualificationField[];
    phrasing_pre_search: string;
    phrasing_enrichment: string;
  };
}

// Defesa em profundidade: retorna seed se null/undefined
export function getCategoriesOrDefault(agent: { service_categories?: any }): ServiceCategoriesConfig

// Match regex contra interesse:X tag
export function matchCategory(interesse: string, config: ServiceCategoriesConfig): ServiceCategory | null

// Filtra fields por fase, ordena por priority
export function getQualificationFields(category: ServiceCategory | null, fallback: ServiceCategoriesConfig['default'], askPreSearch: boolean): QualificationField[]

// Substitui {label} e {examples} no template
export function formatPhrasing(template: string, field: QualificationField): string
```

## Casos de teste (F1)

1. `matchCategory("tinta", config)` → retorna categoria `tintas` (regex match)
2. `matchCategory("verniz", config)` → retorna categoria `tintas` (mesma regex)
3. `matchCategory("camiseta", config)` → retorna `null` (sem match)
4. `getQualificationFields(category, default, true)` → retorna fields com `ask_pre_search=true` ordenados por priority
5. `getQualificationFields(null, default, false)` → retorna fields do default
6. `formatPhrasing("E sobre {label}, prefere {examples}?", field)` → "E sobre acabamento, prefere fosco, acetinado, brilho?"
7. `getCategoriesOrDefault({ service_categories: null })` → retorna seed default
8. `matchCategory(...)` com regex inválido em config → não crasha, retorna null (defesa)

## Decisão D26 a documentar (ao final)

**Service Categories — qualificação dinâmica por nicho**

> Substitui regras hardcoded "QUALIFICAÇÃO DE TINTAS" + "fosco ou brilho" + função `buildEnrichmentInstructions` por schema editável em `ai_agents.service_categories JSONB`. Cada agente pode ter N categorias com regex de match, fields ordenados por priority, flag `ask_pre_search` (qualif vs enrichment), e templates de phrasing. Backward compat: seed default reproduz hardcoded atual.

## Lição R78 a documentar (ao final)

**R78 — Hardcoded por nicho não escala em multi-tenant.** Regras `if (interesse.includes('tinta'))` no AI Agent quebram quando plataforma é vendida para clínica/RH/e-commerce. SEMPRE estruturar regras por nicho como dado configurável (JSONB) editável pelo admin, não como código. Verificar antes de codar: "essa regra serve para todos os agentes ou só pro nicho que estou pensando?"

## Referências

- [[wiki/ai-agent]]
- [[wiki/casos-de-uso/ai-agent-detalhado]]
- [[wiki/melhorias-modulos-inteligencia]] (item #10 AI Agent)
- [[wiki/decisoes-chave]] (D10 Agent Profiles, futuro D26)
- [[.planning/phases/M19-S10-service-categories/PLAN]]
