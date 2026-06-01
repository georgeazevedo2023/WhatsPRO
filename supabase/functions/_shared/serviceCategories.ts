/**
 * Service Categories v2 — Stages + Score Progressivo (M19-S10 v2).
 *
 * Substitui o schema plano de v1 (qualification_fields[] + ask_pre_search boolean)
 * por stages com score progressivo. Cada categoria tem N stages, cada stage tem
 * fields com score_value, e um exit_action que dispara quando o lead atinge
 * max_score (search_products | enrichment | handoff | continue).
 *
 * Backward compat:
 *   - getCategoriesOrDefault detecta v1 (sem "stages" em categorias) e retorna
 *     DEFAULT_SERVICE_CATEGORIES_V2 — degrade gracefully em vez de crashar.
 *   - getQualificationFields() existe como compat shim para chamadas legadas; usa
 *     stages internamente: askPreSearch=true -> fields do PRIMEIRO stage,
 *     false -> fields dos stages restantes.
 *
 * Usage (em ai-agent/index.ts apos F3 v2):
 *   import {
 *     getCategoriesOrDefault, matchCategory,
 *     getCurrentStage, getNextField, getScoreFromTags, getExitAction,
 *     calculateScoreDelta, formatPhrasing, extractInteresseFromTags,
 *   } from '../_shared/serviceCategories.ts'
 *
 *   const config = getCategoriesOrDefault(agent)
 *   const interesse = extractInteresseFromTags(currentTags)
 *   const cat = matchCategory(interesse, config)
 *   const score = getScoreFromTags(currentTags)
 *   const stage = getCurrentStage(score, cat, config.default)
 *   const next = getNextField(stage, currentTags)
 *   const text = formatPhrasing(stage.phrasing, next!)
 *   // apos handler set_tags adicionar tags:
 *   const delta = calculateScoreDelta(addedTags, cat, config.default)
 *   const action = getExitAction(score + delta, cat, config.default)
 */

// =============================================================================
// Tipos
// =============================================================================

export type ExitAction = 'search_products' | 'enrichment' | 'handoff' | 'continue'

export interface QualificationField {
  key: string
  label: string
  examples: string
  score_value: number
  priority: number
}

export interface Stage {
  id: string
  label: string
  min_score: number
  max_score: number
  exit_action: ExitAction
  fields: QualificationField[]
  /** Template com placeholders {label} e {examples}, usado para formular a pergunta. */
  phrasing: string
}

export interface ServiceCategory {
  id: string
  label: string
  /** Regex string usado contra a tag interesse:VALUE. Validado em runtime com try/catch. */
  interesse_match: string
  stages: Stage[]
  /**
   * Disponibilidade do catalogo digital para esta categoria.
   * - 'digital' (default): produtos cadastrados em ai_agent_products com foto/preco. search_products retorna inventory.
   * - 'offline': vendemos a categoria mas inventory nao esta cadastrado. search_products retorna 0 = comportamento esperado;
   *   fluxo deve qualificar fields e fazer handoff com contexto rico, sem dizer "nao temos".
   * - 'none': uso futuro. tratar como offline.
   * Ausente = 'digital' (backward compat).
   */
  catalog_status?: 'digital' | 'offline' | 'none'
}

export interface DefaultCategory {
  stages: Stage[]
}

export interface ServiceCategoriesConfig {
  categories: ServiceCategory[]
  default: DefaultCategory
}

// =============================================================================
// Seed default v2 — IDENTICO ao DEFAULT JSONB da migration v2.
// =============================================================================

export const DEFAULT_SERVICE_CATEGORIES_V2: ServiceCategoriesConfig = {
  categories: [
    {
      id: 'tintas',
      label: 'Tintas e Vernizes',
      // R133 (2026-05-21): removido `impermeabilizante` — sobrepunha com categoria
      // `impermeabilizantes` causando lead que disse só "impermeabilizante" virar
      // multi-categoria fantasma (tintas + impermeabilizantes detectadas).
      interesse_match: 'tinta|esmalte|verniz',
      stages: [
        {
          id: 'identificacao',
          label: 'Identificação',
          min_score: 0,
          max_score: 30,
          exit_action: 'search_products',
          fields: [
            { key: 'ambiente', label: 'ambiente', examples: 'interno ou externo', score_value: 15, priority: 1 },
            { key: 'cor',      label: 'cor',      examples: 'branco, cinza, etc.', score_value: 15, priority: 2 },
          ],
          phrasing: 'Para encontrar a melhor opção, qual {label}? ({examples})',
        },
        {
          id: 'detalhamento',
          label: 'Detalhamento',
          min_score: 30,
          max_score: 70,
          exit_action: 'enrichment',
          fields: [
            { key: 'acabamento',      label: 'acabamento',      examples: 'fosco, acetinado, brilho, semibrilho', score_value: 20, priority: 1 },
            { key: 'marca_preferida', label: 'marca preferida', examples: 'Coral, Suvinil',                       score_value: 20, priority: 2 },
          ],
          phrasing: 'Certo! E sobre {label}, prefere {examples}?',
        },
        {
          id: 'fechamento',
          label: 'Pronto para Handoff',
          min_score: 70,
          max_score: 100,
          exit_action: 'handoff',
          fields: [
            { key: 'quantidade', label: 'quantidade',       examples: 'litros ou galões', score_value: 15, priority: 1 },
            { key: 'area',       label: 'metragem da área', examples: 'em m²',            score_value: 15, priority: 2 },
          ],
          phrasing: 'Antes de te conectar com o vendedor, {label}?',
        },
      ],
    },
    {
      id: 'porcelanatos_revestimentos',
      label: 'Porcelanatos e Revestimentos',
      interesse_match: 'porcelanato|revestimento|piso',
      catalog_status: 'digital',
      stages: [
        {
          id: 'pre_busca',
          label: 'Pre Busca',
          min_score: 0,
          max_score: 30,
          exit_action: 'search_products',
          fields: [
            { key: 'aplicacao', label: 'aplicacao', examples: 'piso ou parede', score_value: 10, priority: 1 },
            { key: 'ambiente', label: 'ambiente', examples: 'residencial ou comercial', score_value: 10, priority: 2 },
            { key: 'formato', label: 'formato', examples: '60x60, 90x90, 120x120', score_value: 10, priority: 3 },
          ],
          phrasing: 'Qual {label}? ({examples})',
        },
        {
          id: 'sem_catalogo',
          label: 'Qualificacao para Estoque Fisico',
          min_score: 30,
          max_score: 100,
          exit_action: 'handoff',
          fields: [
            { key: 'acabamento', label: 'acabamento', examples: 'brilhante, acetinado, fosco', score_value: 15, priority: 1 },
            { key: 'cor', label: 'cor', examples: 'bege, cinza, branco, off-white', score_value: 15, priority: 2 },
            { key: 'local_aplicacao', label: 'local de aplicacao', examples: 'sala, cozinha, quarto, area integrada', score_value: 20, priority: 3 },
            { key: 'area', label: 'metragem aproximada', examples: 'em m2', score_value: 20, priority: 4 },
          ],
          phrasing: 'Qual {label}? ({examples})',
        },
      ],
    },
    {
      id: 'torneiras_metais',
      label: 'Torneiras e Metais',
      interesse_match: 'torneira|misturador|metal',
      catalog_status: 'digital',
      stages: [
        {
          id: 'pre_busca',
          label: 'Pre Busca',
          min_score: 0,
          max_score: 30,
          exit_action: 'search_products',
          fields: [
            { key: 'aplicacao', label: 'aplicacao', examples: 'cozinha ou area gourmet', score_value: 10, priority: 1 },
            { key: 'instalacao', label: 'instalacao', examples: 'bancada ou parede', score_value: 10, priority: 2 },
            { key: 'modelo', label: 'modelo', examples: 'ducha flexivel, bica alta', score_value: 10, priority: 3 },
          ],
          phrasing: 'Qual {label}? ({examples})',
        },
        {
          id: 'sem_catalogo',
          label: 'Qualificacao para Estoque Fisico',
          min_score: 30,
          max_score: 100,
          exit_action: 'handoff',
          fields: [
            { key: 'acabamento', label: 'acabamento', examples: 'cromado, preto fosco, dourado, escovado', score_value: 25, priority: 1 },
            { key: 'tipo_cuba', label: 'tipo de cuba', examples: 'simples ou dupla', score_value: 20, priority: 2 },
            { key: 'perfil', label: 'perfil', examples: 'custo-beneficio ou premium', score_value: 25, priority: 3 },
          ],
          phrasing: 'Qual {label}? ({examples})',
        },
      ],
    },
    {
      id: 'impermeabilizantes',
      label: 'Impermeabilizantes e Mantas',
      interesse_match: 'impermeabilizante|manta',
      stages: [
        {
          id: 'triagem',
          label: 'Triagem',
          min_score: 0,
          max_score: 60,
          exit_action: 'search_products',
          fields: [
            { key: 'area',      label: 'área',              examples: 'tamanho da área',    score_value: 30, priority: 1 },
            { key: 'aplicacao', label: 'tipo de aplicação', examples: 'laje, parede, piso', score_value: 30, priority: 2 },
          ],
          phrasing: 'Para encontrar a melhor opção, qual {label}? ({examples})',
        },
        {
          id: 'fechamento',
          label: 'Pronto para Handoff',
          min_score: 60,
          max_score: 100,
          exit_action: 'handoff',
          fields: [
            { key: 'marca_preferida', label: 'marca preferida', examples: '', score_value: 40, priority: 1 },
          ],
          phrasing: 'Antes de transferir, {label}?',
        },
      ],
    },
  ],
  default: {
    stages: [
      {
        id: 'qualificacao_basica',
        label: 'Qualificação básica',
        min_score: 0,
        max_score: 100,
        exit_action: 'handoff',
        fields: [
          { key: 'especificacao',   label: 'detalhes',              examples: 'qualquer informação relevante', score_value: 25, priority: 1 },
          { key: 'marca_preferida', label: 'marca preferida',       examples: '',                              score_value: 25, priority: 2 },
          { key: 'quantidade',      label: 'quantidade necessária', examples: '',                              score_value: 25, priority: 3 },
        ],
        phrasing: 'Para te ajudar melhor, me conta {label}?',
      },
    ],
  },
}

// =============================================================================
// Validacao de schema
// =============================================================================

const VALID_EXIT_ACTIONS: ReadonlySet<string> = new Set([
  'search_products',
  'enrichment',
  'handoff',
  'continue',
])

function isValidQualificationField(v: unknown): v is QualificationField {
  if (!v || typeof v !== 'object') return false
  const f = v as Record<string, unknown>
  return (
    typeof f.key === 'string' &&
    typeof f.label === 'string' &&
    typeof f.examples === 'string' &&
    typeof f.score_value === 'number' &&
    typeof f.priority === 'number'
  )
}

function isValidStage(v: unknown): v is Stage {
  if (!v || typeof v !== 'object') return false
  const s = v as Record<string, unknown>
  return (
    typeof s.id === 'string' &&
    typeof s.label === 'string' &&
    typeof s.min_score === 'number' &&
    typeof s.max_score === 'number' &&
    typeof s.exit_action === 'string' &&
    VALID_EXIT_ACTIONS.has(s.exit_action) &&
    Array.isArray(s.fields) &&
    s.fields.every(isValidQualificationField) &&
    typeof s.phrasing === 'string'
  )
}

function isValidCategory(v: unknown): v is ServiceCategory {
  if (!v || typeof v !== 'object') return false
  const c = v as Record<string, unknown>
  return (
    typeof c.id === 'string' &&
    typeof c.label === 'string' &&
    typeof c.interesse_match === 'string' &&
    Array.isArray(c.stages) &&
    c.stages.length > 0 &&
    c.stages.every(isValidStage)
  )
}

function isValidDefault(v: unknown): v is DefaultCategory {
  if (!v || typeof v !== 'object') return false
  const d = v as Record<string, unknown>
  return (
    Array.isArray(d.stages) &&
    d.stages.length > 0 &&
    d.stages.every(isValidStage)
  )
}

function isValidConfig(v: unknown): v is ServiceCategoriesConfig {
  if (!v || typeof v !== 'object') return false
  const c = v as Record<string, unknown>
  return (
    Array.isArray(c.categories) &&
    c.categories.every(isValidCategory) &&
    isValidDefault(c.default)
  )
}

// =============================================================================
// API publica
// =============================================================================

/**
 * Retorna a config valida do agente, ou DEFAULT_SERVICE_CATEGORIES_V2 caso a
 * coluna esteja null, undefined, malformada, ou no formato v1 (sem "stages").
 *
 * Defesa em profundidade — nunca lanca; sempre retorna config valida v2.
 * Detecta v1 quando categoria tem qualification_fields mas nao tem stages.
 */
export function getCategoriesOrDefault(
  agent: { service_categories?: unknown } | null | undefined,
): ServiceCategoriesConfig {
  if (!agent) return withPremiumCategoryOverrides(DEFAULT_SERVICE_CATEGORIES_V2)
  const raw = agent.service_categories
  if (raw == null) return withPremiumCategoryOverrides(DEFAULT_SERVICE_CATEGORIES_V2)
  if (isValidConfig(raw)) return withPremiumCategoryOverrides(raw)
  // Salvamento (2026-05-30): antes, UMA categoria malformada (ex.: `motores` sem
  // `label`) fazia isValidConfig=false → a config INTEIRA do agente era descartada e
  // caíamos no DEFAULT (4 categorias premium), ignorando as outras ~24 que o admin
  // configurou. Em vez de tudo-ou-nada, filtramos as categorias VÁLIDAS e completamos
  // o default. Uma categoria quebrada não derruba as demais. Só caímos no DEFAULT
  // completo quando NENHUMA categoria é válida.
  const salvaged = salvageConfig(raw)
  if (salvaged) return withPremiumCategoryOverrides(salvaged)
  return withPremiumCategoryOverrides(DEFAULT_SERVICE_CATEGORIES_V2)
}

/**
 * Recupera o máximo de uma config parcialmente inválida: mantém só as categorias
 * que passam em isValidCategory + usa o default do agente se válido, senão o do
 * DEFAULT. Retorna null se não houver nenhuma categoria válida (caller usa DEFAULT).
 */
function salvageConfig(raw: unknown): ServiceCategoriesConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const c = raw as Record<string, unknown>
  if (!Array.isArray(c.categories)) return null
  const validCategories = c.categories.filter(isValidCategory) as ServiceCategory[]
  if (validCategories.length === 0) return null
  const def = isValidDefault(c.default)
    ? (c.default as ServiceCategoriesConfig['default'])
    : DEFAULT_SERVICE_CATEGORIES_V2.default
  return { categories: validCategories, default: def }
}

function withPremiumCategoryOverrides(config: ServiceCategoriesConfig): ServiceCategoriesConfig {
  let changed = false
  const categories = config.categories.map((category) => {
    if (isTorneirasCategory(category)) {
      changed = true
      return buildPremiumTorneirasCategory(category)
    }
    if (isRevestimentosCategory(category)) {
      changed = true
      return buildPremiumRevestimentosCategory(category)
    }
    return category
  })

  if (!changed) return config

  return {
    ...config,
    categories,
  }
}

/**
 * Bug 1 (loop Dauana, 2026-06-01): o override premium hardcoded SOBRESCREVIA a config
 * do admin. O admin definiu `revestimentos`/`torneiras` como OFFLINE (qualifica e
 * transborda, sem catálogo digital), mas `buildPremium*Category` FORÇAVA `digital` e
 * injetava o funil pré-busca com o campo `formato` (60x60/90x90/120x120). Quando o lead
 * mandou foto de um tijolo 32,5x57 e disse "o da foto", nenhum formato casava → a mesma
 * pergunta repetia pra sempre, sem transbordar.
 *
 * Decisão do dono (2026-06-01): RESPEITAR a config do admin. O preset premium só se
 * aplica quando o admin NÃO configurou a categoria de forma intencional — ou seja,
 * quando ela está `digital` (ou sem status, default digital). Se o admin marcou
 * `offline`, isso é uma escolha deliberada (vende mas não tem catálogo digital →
 * qualifica + handoff) e o código não deve transformá-la em digital nem injetar campos.
 */
function adminConfiguredOffline(category: ServiceCategory): boolean {
  return category.catalog_status === 'offline' || category.catalog_status === 'none'
}

function isTorneirasCategory(category: ServiceCategory): boolean {
  return category.id === 'torneiras' && !adminConfiguredOffline(category)
}

function isRevestimentosCategory(category: ServiceCategory): boolean {
  return category.id === 'revestimentos' && !adminConfiguredOffline(category)
}

function buildPremiumTorneirasCategory(category: ServiceCategory): ServiceCategory {
  return {
    ...category,
    label: category.label || 'Torneiras e Metais',
    catalog_status: 'digital',
    interesse_match: mergeRegex(category.interesse_match, 'torneira|torneiras|torneira gourmet|misturador|metal'),
    stages: [
      {
        id: 'pre_busca',
        label: 'Pre Busca',
        min_score: 0,
        max_score: 30,
        exit_action: 'search_products',
        fields: [
          { key: 'ambiente_torneira', label: 'aplicacao', examples: 'cozinha ou area gourmet', score_value: 10, priority: 1 },
          { key: 'tipo_torneira', label: 'instalacao', examples: 'bancada ou parede', score_value: 10, priority: 2 },
          { key: 'modelo_torneira', label: 'modelo', examples: 'ducha flexivel ou bica alta', score_value: 10, priority: 3 },
        ],
        phrasing: 'Qual {label}? ({examples})',
      },
      {
        id: 'sem_catalogo',
        label: 'Qualificacao para Estoque Fisico',
        min_score: 30,
        max_score: 100,
        exit_action: 'handoff',
        fields: [
          { key: 'acabamento_torneira', label: 'acabamento', examples: 'cromado, preto fosco, dourado ou escovado', score_value: 25, priority: 1 },
          { key: 'tipo_cuba', label: 'tipo de cuba', examples: 'simples ou dupla', score_value: 20, priority: 2 },
          { key: 'perfil', label: 'perfil', examples: 'custo-beneficio ou premium', score_value: 25, priority: 3 },
        ],
        phrasing: 'Qual {label}? ({examples})',
      },
    ],
  }
}

function buildPremiumRevestimentosCategory(category: ServiceCategory): ServiceCategory {
  return {
    ...category,
    label: category.label || 'Porcelanatos e Revestimentos',
    catalog_status: 'digital',
    interesse_match: mergeRegex(category.interesse_match, 'porcelanato|porcelanatos|revestimento|revestimentos|ceramica|ceramicas|cerâmica|cerâmicas|azulejo|azulejos|piso|pisos'),
    stages: [
      {
        id: 'pre_busca',
        label: 'Pre Busca',
        min_score: 0,
        max_score: 30,
        exit_action: 'search_products',
        fields: [
          { key: 'aplicacao_revestimento', label: 'aplicacao', examples: 'piso ou parede', score_value: 10, priority: 1 },
          { key: 'ambiente_revestimento', label: 'ambiente', examples: 'residencial ou comercial', score_value: 10, priority: 2 },
          { key: 'formato', label: 'formato', examples: '60x60, 90x90 ou 120x120', score_value: 10, priority: 3 },
        ],
        phrasing: 'Qual {label}? ({examples})',
      },
      {
        id: 'sem_catalogo',
        label: 'Qualificacao para Estoque Fisico',
        min_score: 30,
        max_score: 100,
        exit_action: 'handoff',
        fields: [
          { key: 'acabamento', label: 'acabamento', examples: 'brilhante, acetinado ou fosco', score_value: 15, priority: 1 },
          { key: 'cor', label: 'cor', examples: 'bege, cinza, branco ou off-white', score_value: 15, priority: 2 },
          { key: 'local_aplicacao', label: 'local de aplicacao', examples: 'sala, cozinha, quarto ou area integrada', score_value: 20, priority: 3 },
          { key: 'area', label: 'metragem aproximada', examples: 'em m2', score_value: 20, priority: 4 },
        ],
        phrasing: 'Qual {label}? ({examples})',
      },
    ],
  }
}

function mergeRegex(current: string, required: string): string {
  const trimmed = String(current || '').trim()
  if (!trimmed) return required
  return `(?:${trimmed})|(?:${required})`
}

/**
 * R149 (2026-05-30) — monta o regex de `interesse_match` com FRONTEIRA DE PALAVRA
 * accent-safe + tolerância a plural. Fonte única usada por TODAS as 4 funções de
 * match (+ o filtro de produtos) pra não divergir.
 *
 * Bug que motivou (caso Rodolfo, EletropisoV2 PROD 2026-05-30): a categoria portas
 * tem `interesse_match: "porta|portas"` e o regex era montado como
 * `new RegExp(pattern, 'i')` SEM fronteira → casava o substring "porta" dentro de
 * "portanto" (transcrição de áudio "Agora, portanto, que ele tenha 1.500 litros")
 * → IA ofereceu PORTAS pra quem pediu biodigestor. Mesma classe pega `cabo` em
 * "acabou", `cano` em "canoa", `mesa` em "mesada", etc.
 *
 * Por que lookaround manual e não `\b`: em JS `\b` usa `\w` (= [A-Za-z0-9_]), que
 * NÃO inclui acentos — `porta\b` casaria "portã..." e `\bárea` falharia. Usamos
 * lookbehind/lookahead de "letra" explícitos cobrindo Latin-1 (À-ÿ).
 *
 * Por que o sufixo `(?:s|es|ns)?`: preserva o match de plural mesmo quando a config
 * só lista o singular (ex.: pattern "tinta" continua casando "tintas"). "portanto"
 * NÃO casa: "porta" + (sufixo vazio) + lookahead vê "n" (letra) → falha.
 *
 * Pode LANÇAR se o pattern for regex inválido — caller mantém o try/catch que já tinha.
 */
const INTERESSE_WORD_CHARS = 'A-Za-zÀ-ÿ0-9'
export function buildInteresseRegex(pattern: string): RegExp {
  // Valida o pattern CRU primeiro. Isso (1) preserva o contrato "lança se inválido"
  // que os callers já tratam com try/catch (pulando a categoria), e (2) impede que o
  // wrapping abaixo "conserte" acidentalmente um pattern com brackets desbalanceados
  // (ex.: '[unclosed' viraria válido porque o `]` do meu char-class final fecharia a
  // classe aberta — mascarando config inválida e gerando match-garbage).
  new RegExp(pattern) // throws on invalid → caller pula a categoria
  return new RegExp(
    `(?<![${INTERESSE_WORD_CHARS}])(?:${pattern})(?:s|es|ns)?(?![${INTERESSE_WORD_CHARS}])`,
    'i',
  )
}

/**
 * Retorna a primeira categoria cujo regex `interesse_match` casa com `interesse`.
 * Se nenhuma categoria casar (ou se interesse for vazio/null), retorna null —
 * caller deve usar config.default como fallback.
 *
 * Regex invalido em uma categoria e logado e ignorado (nao crasha).
 */
export function matchCategory(
  interesse: string | null | undefined,
  config: ServiceCategoriesConfig,
): ServiceCategory | null {
  if (!interesse) return null
  const trimmed = String(interesse).trim()
  if (!trimmed) return null

  for (const cat of config.categories) {
    let re: RegExp
    try {
      re = buildInteresseRegex(cat.interesse_match)
    } catch {
      // eslint-disable-next-line no-console
      console.warn(`[serviceCategories] Regex invalido em categoria "${cat.id}": ${cat.interesse_match}`)
      continue
    }
    if (re.test(trimmed)) return cat
  }
  return null
}

/**
 * Como `matchCategory`, mas testa o regex contra o texto da MENSAGEM do lead
 * (nao contra a tag `interesse:`). Util quando a tag ainda nao foi setada —
 * ex: na 1a mensagem do lead, antes do LLM chamar set_tags.
 *
 * Permite ao auto-extract resolver a categoria diretamente de "tem mesa de
 * plastico pra cozinha?" -> categoria=mesas (regex `mesa|mesas` casa).
 *
 * Mesma protecao contra regex invalido. Texto vazio/null retorna null.
 */
export function matchCategoryBySearchText(
  searchText: string | null | undefined,
  config: ServiceCategoriesConfig,
): ServiceCategory | null {
  if (!searchText) return null
  const trimmed = String(searchText).trim()
  if (!trimmed) return null

  for (const cat of config.categories) {
    let re: RegExp
    try {
      re = buildInteresseRegex(cat.interesse_match)
    } catch {
      // eslint-disable-next-line no-console
      console.warn(`[serviceCategories] Regex invalido em categoria "${cat.id}": ${cat.interesse_match}`)
      continue
    }
    if (re.test(trimmed)) return cat
  }
  return null
}

/**
 * R129 (2026-05-21): retorna TODAS as categorias cujo `interesse_match` regex
 * casa no texto. Necessário pra detectar multi-categoria ("quero porta E janela")
 * antes do auto-extract escolher silenciosamente a 1ª.
 *
 * Mesma proteção contra regex inválido. Texto vazio retorna [].
 * Resultado deduplicado por categoria.id (não retorna a mesma 2x).
 */
export function matchAllCategoriesBySearchText(
  searchText: string | null | undefined,
  config: ServiceCategoriesConfig,
): ServiceCategory[] {
  if (!searchText) return []
  const trimmed = String(searchText).trim()
  if (!trimmed) return []

  const found: ServiceCategory[] = []
  const seenIds = new Set<string>()

  for (const cat of config.categories) {
    if (seenIds.has(cat.id)) continue
    let re: RegExp
    try {
      re = buildInteresseRegex(cat.interesse_match)
    } catch {
      // eslint-disable-next-line no-console
      console.warn(`[serviceCategories] Regex invalido em categoria "${cat.id}": ${cat.interesse_match}`)
      continue
    }
    if (re.test(trimmed)) {
      found.push(cat)
      seenIds.add(cat.id)
    }
  }
  return found
}

/**
 * Descobre o stage atual com base no score acumulado.
 *
 * - Stages sao ordenados por min_score crescente (input ja deveria estar, mas
 *   ordenamos defensivamente).
 * - O stage retornado e aquele cujo intervalo [min_score, max_score) inclui o
 *   score atual.
 * - Se score >= max_score do ultimo stage (overflow), retorna o ultimo —
 *   significa "passou de tudo" (handoff/exit ja deveria ter disparado).
 * - Se score < min_score do primeiro stage (clamp), retorna o primeiro.
 * - Se a categoria for null/sem stages, usa fallback.default.stages.
 *
 * NUNCA retorna null — sempre ha pelo menos 1 stage no fallback default.
 */
export function getCurrentStage(
  score: number,
  category: ServiceCategory | null,
  fallback: DefaultCategory,
): Stage {
  const sourceStages = (category && category.stages.length > 0)
    ? category.stages
    : fallback.stages

  // Defesa: se fallback tambem nao tem stages (config quebrada), usa default v2
  const stages = (sourceStages && sourceStages.length > 0)
    ? sourceStages
    : DEFAULT_SERVICE_CATEGORIES_V2.default.stages

  // Ordena defensivamente por min_score crescente
  const sorted = stages.slice().sort((a, b) => a.min_score - b.min_score)

  const safeScore = Number.isFinite(score) ? score : 0

  // Se score < min_score do primeiro, retorna primeiro stage (clamp)
  if (safeScore < sorted[0].min_score) return sorted[0]

  // Procura stage cujo intervalo [min, max) contem o score
  for (const stage of sorted) {
    if (safeScore >= stage.min_score && safeScore < stage.max_score) {
      return stage
    }
  }

  // Overflow: score >= max_score do ultimo stage -> retorna o ultimo
  return sorted[sorted.length - 1]
}

/**
 * Le score acumulado do array de tags procurando "lead_score:N".
 *
 * - Retorna 0 se nao houver tag.
 * - Retorna 0 se valor nao for inteiro valido (ex: "lead_score:abc").
 * - Se houver multiplas tags lead_score:N, retorna a ULTIMA com valor valido
 *   (a mais recente na lista — convencao do AI Agent que append no fim).
 */
export function getScoreFromTags(tags: string[] | null | undefined): number {
  if (!Array.isArray(tags)) return 0

  let lastValid = 0
  let foundAny = false

  for (const tag of tags) {
    if (typeof tag !== 'string') continue
    if (!tag.startsWith('lead_score:')) continue

    const rawValue = tag.slice('lead_score:'.length).trim()
    const parsed = Number.parseInt(rawValue, 10)

    if (Number.isFinite(parsed) && /^-?\d+$/.test(rawValue)) {
      lastValid = parsed
      foundAny = true
    }
  }

  return foundAny ? lastValid : 0
}

/**
 * Dado um stage e tags atuais, retorna o proximo field NAO RESPONDIDO,
 * ordenado por priority crescente (tie-breaker: alfabetica por key).
 *
 * Field "respondido" = ja existe tag "key:value" no array (qualquer valor).
 * Ex: stage com fields [ambiente, cor]; tags=['ambiente:externo']
 *      -> retorna field "cor".
 *
 * Retorna null se todos os fields ja foram respondidos.
 */
export function getNextField(
  stage: Stage | null | undefined,
  currentTags: string[] | null | undefined,
): QualificationField | null {
  if (!stage || !Array.isArray(stage.fields) || stage.fields.length === 0) return null

  const tags: string[] = Array.isArray(currentTags) ? currentTags : []
  const answeredKeys = new Set<string>()

  for (const tag of tags) {
    if (typeof tag !== 'string') continue
    const colonIdx = tag.indexOf(':')
    if (colonIdx <= 0) continue // ignora "interesse" sem valor ou tag sem ":"
    const key = tag.slice(0, colonIdx).trim()
    if (key) answeredKeys.add(key)
  }

  const sorted = stage.fields.slice().sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    return a.key.localeCompare(b.key)
  })

  for (const field of sorted) {
    if (!answeredKeys.has(field.key)) return field
  }
  return null
}

/**
 * Dado um conjunto de tags ADICIONADAS pelo handler set_tags do AI Agent,
 * calcula quanto score adicionar olhando os fields de TODOS os stages da
 * categoria atual cuja key corresponde.
 *
 * - Se a tag nao tiver formato "key:value", e ignorada.
 * - Se a key nao existir em nenhum field da categoria atual, soma 0.
 * - Se a categoria for null, usa fallback.default.stages.
 * - Cada tag e contada UMA vez mesmo que apareca duplicada.
 */
export function calculateScoreDelta(
  addedTags: string[] | null | undefined,
  category: ServiceCategory | null,
  fallback: DefaultCategory,
): number {
  if (!Array.isArray(addedTags) || addedTags.length === 0) return 0

  const stages = (category && category.stages.length > 0)
    ? category.stages
    : fallback.stages

  if (!stages || stages.length === 0) return 0

  // Constroi mapa key -> score_value (primeiro field que matcha vence)
  const scoreMap = new Map<string, number>()
  for (const stage of stages) {
    if (!Array.isArray(stage.fields)) continue
    for (const field of stage.fields) {
      if (!scoreMap.has(field.key)) {
        scoreMap.set(field.key, field.score_value)
      }
    }
  }

  const seenKeys = new Set<string>()
  let delta = 0

  for (const tag of addedTags) {
    if (typeof tag !== 'string') continue
    const colonIdx = tag.indexOf(':')
    if (colonIdx <= 0) continue
    const key = tag.slice(0, colonIdx).trim()
    if (!key || seenKeys.has(key)) continue

    const value = scoreMap.get(key)
    if (typeof value === 'number' && Number.isFinite(value)) {
      delta += value
      seenKeys.add(key)
    }
  }

  return delta
}

/**
 * Retorna o exit_action do stage atual com base no score.
 * Wrapper de conveniencia: equivale a getCurrentStage(...).exit_action.
 */
export function getExitAction(
  score: number,
  category: ServiceCategory | null,
  fallback: DefaultCategory,
): ExitAction {
  const stage = getCurrentStage(score, category, fallback)
  return stage.exit_action
}

/**
 * Substitui os placeholders {label} e {examples} no template.
 * Ex: formatPhrasing("Sobre {label}, prefere {examples}?", { label: "cor", examples: "azul", ... })
 *      -> "Sobre cor, prefere azul?"
 */
export function formatPhrasing(
  template: string,
  field: QualificationField,
  answeredCountInStage: number = 0,
): string {
  // R131 (2026-05-21): segunda+ pergunta do mesmo stage usa variante curta sem
  // preâmbulo — evita o LLM repetir "Para encontrar a melhor opção, qual X?"
  // 3x seguidas quando o stage tem múltiplos fields.
  const effectiveTemplate = answeredCountInStage >= 1
    ? (field.examples ? 'Qual {label}? ({examples})' : 'Qual {label}?')
    : template
  if (!effectiveTemplate) return ''
  return effectiveTemplate
    .replace(/\{label\}/g, field.label)
    .replace(/\{examples\}/g, field.examples)
}

/**
 * Helper de conveniencia: extrai o valor da tag "interesse:X" de um array de tags.
 * Tags seguem o formato "key:value". Retorna string vazia se nao encontrar.
 *
 * Ex: ["motivo:compra", "interesse:tinta", "cidade:recife"] -> "tinta"
 */
export function extractInteresseFromTags(tags: string[] | null | undefined): string {
  if (!Array.isArray(tags)) return ''
  const found = tags.find(t => typeof t === 'string' && t.startsWith('interesse:'))
  if (!found) return ''
  return found.slice('interesse:'.length).trim()
}

/**
 * Bug 8 — Filtra produtos mantendo apenas os que casam com a `interesse_match`
 * regex da categoria esperada. Usado para evitar cross-category leak:
 * fuzzy/AND-fallback do search_products as vezes retorna produto de categoria
 * errada (ex: "chuveiro" -> "Sol e Chuva" tinta via trigram match).
 *
 * Compara contra category + subcategory + title (sem acentos, lower-case).
 * Se expectedCategory for null OU regex invalido OU products vazio: no-op.
 */
export function filterProductsByExpectedCategory<T extends {
  title?: string | null
  category?: string | null
  subcategory?: string | null
}>(
  products: T[] | null | undefined,
  expectedCategory: ServiceCategory | null | undefined,
): T[] {
  if (!Array.isArray(products) || products.length === 0) return products ?? []
  if (!expectedCategory) return products

  let re: RegExp
  try {
    re = buildInteresseRegex(expectedCategory.interesse_match)
  } catch {
    return products
  }

  const stripAccents = (s: string): string =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

  return products.filter((p) => {
    const haystack = stripAccents(
      `${p.category || ''} ${p.subcategory || ''} ${p.title || ''}`,
    )
    return re.test(haystack)
  })
}

// =============================================================================
// VALID_KEYS dinamico (R84) — set_tags handler whitelist
//
// O handler `set_tags` em ai-agent/index.ts valida que cada tag "key:value"
// tem `key` em uma whitelist. Antes de R84 essa whitelist era um Set hardcoded
// com ~80 chaves; sempre que se adicionava categoria nova ao service_categories
// JSONB, era preciso lembrar de atualizar o Set + redeploy. Ja causou tag
// rejeitada silenciosa (ex: `tipo_tinta` no Eletropiso) — score nao subia, IA
// entrava em loop de enrichment.
//
// buildValidTagKeys(config) combina:
//   1. BASE_VALID_TAG_KEYS — chaves de SISTEMA (nao vem de service_categories):
//      identidade do lead, telemetria, controle de fluxo, vendas, etc.
//   2. Chaves dinamicas — todos os field.key de config.categories[].stages[]
//      e config.default.stages[].
//
// Resultado: nova categoria + field.key novo => valida automaticamente sem
// alterar codigo. Chaves de sistema continuam protegidas pela base.
// =============================================================================

/**
 * Chaves de sistema (nao derivadas de service_categories).
 * Inclui:
 *  - identidade do lead: nome, cidade, dado_pessoal
 *  - controle/telemetria: ia, ia_cleared, search_fail, enrich_count,
 *    qualificacao_completa, lead_score, qualif_stage, marca_indisponivel
 *  - taxonomia comum: motivo, interesse, produto, objecao, sentimento,
 *    servico, agendamento, funil, intencao
 *  - vendas/negociacao: tipo_cliente, concorrente, motivo_perda, conversao,
 *    venda_status, pagamento
 *  - shadow do vendedor: vendedor_tom, vendedor_desconto, vendedor_upsell,
 *    vendedor_followup, vendedor_alternativa
 */
export const BASE_VALID_TAG_KEYS: ReadonlySet<string> = new Set([
  // identidade
  'nome', 'cidade', 'dado_pessoal',
  // controle/telemetria
  'ia', 'ia_cleared', 'search_fail', 'enrich_count',
  'qualificacao_completa', 'lead_score', 'qualif_stage', 'marca_indisponivel',
  'multi_interesse_pending', // R129 (2026-05-21): lista CSV de categorias quando lead pede 2+
  // taxonomia comum
  'motivo', 'interesse', 'produto', 'objecao', 'sentimento',
  'servico', 'agendamento', 'funil', 'intencao',
  // vendas/negociacao
  'tipo_cliente', 'concorrente', 'motivo_perda', 'conversao',
  'venda_status', 'venda', 'pagamento', 'marca_citada',
  // entrega (v7.58: coleta de retirada/entrega + bairro pré-handoff)
  'entrega_modo', 'bairro',
  // shadow do vendedor
  'vendedor_tom', 'vendedor_desconto', 'vendedor_upsell',
  'vendedor_followup', 'vendedor_alternativa',
])

/**
 * Constroi o Set de chaves validas para o handler `set_tags` combinando
 * BASE_VALID_TAG_KEYS com todas as chaves dinamicas de stages.fields[].key.
 *
 * - Aceita config null/undefined/malformada — usa DEFAULT_SERVICE_CATEGORIES_V2.
 * - Itera sobre config.categories[].stages[].fields[] e config.default.stages[]
 *   .fields[]. Dedup automatico via Set.
 * - Sempre retorna Set nao-vazio (BASE garante minimo).
 *
 * Ex (Eletropiso, 23 categorias):
 *   buildValidTagKeys(config) inclui BASE + ~52 chaves dinamicas
 *   (material_porta, tipo_churrasqueira, tipo_tinta, etc.)
 */
export function buildValidTagKeys(
  config: ServiceCategoriesConfig | null | undefined,
): Set<string> {
  const result = new Set<string>(BASE_VALID_TAG_KEYS)

  const safe: ServiceCategoriesConfig = (config && isValidConfig(config))
    ? config
    : DEFAULT_SERVICE_CATEGORIES_V2

  const collectFromStages = (stages: Stage[] | undefined): void => {
    if (!Array.isArray(stages)) return
    for (const stage of stages) {
      if (!stage || !Array.isArray(stage.fields)) continue
      for (const field of stage.fields) {
        if (field && typeof field.key === 'string' && field.key.length > 0) {
          result.add(field.key)
        }
      }
    }
  }

  if (Array.isArray(safe.categories)) {
    for (const cat of safe.categories) {
      if (cat) collectFromStages(cat.stages)
    }
  }
  if (safe.default) collectFromStages(safe.default.stages)

  return result
}

// =============================================================================
// LEGACY v1 — compat shim para chamadas existentes em ai-agent/index.ts
//
// askPreSearch=true  -> retorna fields do PRIMEIRO stage (equivale a "Identificação"
//                       em tintas, "Triagem" em impermeabilizantes, etc.)
// askPreSearch=false -> retorna fields dos stages a partir do segundo (enrichment).
//
// Mantem ordenacao por priority dentro de cada batch. Se a categoria so tem 1
// stage (ex: default), askPreSearch=true retorna [] e askPreSearch=false retorna
// todos os fields desse unico stage.
// =============================================================================

export function getQualificationFields(
  category: ServiceCategory | null,
  fallback: DefaultCategory,
  askPreSearch: boolean,
): QualificationField[] {
  const stages = (category && category.stages.length > 0)
    ? category.stages
    : fallback.stages

  if (!stages || stages.length === 0) return []

  // Ordena defensivamente por min_score crescente para definir "primeiro stage"
  const sorted = stages.slice().sort((a, b) => a.min_score - b.min_score)

  let pickedFields: QualificationField[] = []

  if (askPreSearch) {
    // So o primeiro stage. Para default (1 stage so), retorna [] — comportamento
    // identico ao v1 onde category=null com askPreSearch=true retornava [].
    if (sorted.length > 1) {
      pickedFields = sorted[0].fields ?? []
    } else {
      // Categoria com 1 stage so (ex: default) -> nao ha "pre_search" separado
      pickedFields = []
    }
  } else {
    if (sorted.length > 1) {
      // Stages 2+ (enrichment + fechamento + ...)
      for (let i = 1; i < sorted.length; i++) {
        pickedFields = pickedFields.concat(sorted[i].fields ?? [])
      }
    } else {
      // Categoria com 1 stage so (default) -> retorna todos os fields desse stage
      pickedFields = sorted[0].fields ?? []
    }
  }

  return pickedFields
    .slice()
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return a.key.localeCompare(b.key)
    })
}
