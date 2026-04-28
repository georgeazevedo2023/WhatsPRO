/**
 * Service Categories v2 — schema com Stages + Score.
 *
 * Cada categoria tem um funil composto por etapas (stages). Conforme o lead
 * responde, acumula score (`score_value` por field) e progride entre stages.
 * Ao atingir o range de um stage, a IA executa `exit_action`:
 *   - search_products → chama buscar produtos no catálogo
 *   - enrichment      → segue perguntando para coletar mais contexto
 *   - handoff         → transfere para vendedor humano
 *   - continue        → não faz nada especial, segue para próximo stage
 *
 * Substitui o schema plano da v1 (que tinha apenas `qualification_fields[]` e
 * dois templates) por um modelo de funil escalonado por score.
 *
 * Espelho dos tipos de `supabase/functions/_shared/serviceCategories.ts` —
 * mantenha em sincronia até consolidação final.
 */

export type ExitAction = 'search_products' | 'enrichment' | 'handoff' | 'continue';

export interface QualificationField {
  /** slug minúsculo (a-z0-9_) — usado como chave da tag e match no buildQualificationChain */
  key: string;
  /** label legível para humano — usado no template `{label}` */
  label: string;
  /** exemplos do valor esperado — usado no template `{examples}` */
  examples: string;
  /** pontos somados ao score quando este field é respondido pelo lead */
  score_value: number;
  /** ordem crescente — 1 = primeiro a perguntar dentro do stage */
  priority: number;
}

export interface Stage {
  /** slug único do stage dentro da categoria (a-z0-9_) */
  id: string;
  /** label legível para humano */
  label: string;
  /** score mínimo para entrar neste stage (inclusive) */
  min_score: number;
  /** score máximo deste stage (exclusive — quando atinge, dispara exit_action) */
  max_score: number;
  /** ação ao atingir o teto de score do stage */
  exit_action: ExitAction;
  fields: QualificationField[];
  /** template Markdown com placeholders `{label}` e `{examples}` */
  phrasing: string;
}

export interface ServiceCategory {
  /** slug único da categoria (a-z0-9_) */
  id: string;
  /** label legível para humano */
  label: string;
  /** regex string que casa contra a tag interesse:X */
  interesse_match: string;
  stages: Stage[];
}

export interface DefaultCategory {
  stages: Stage[];
}

export interface ServiceCategoriesConfig {
  categories: ServiceCategory[];
  default: DefaultCategory;
}

export const EXIT_ACTION_OPTIONS: { value: ExitAction; label: string; description: string }[] = [
  { value: 'search_products', label: '🔍 IA busca produto',          description: 'Quando atingir esse score, IA mostra produtos do catálogo (search_products)' },
  { value: 'enrichment',      label: '➕ Continua perguntando',       description: 'IA segue coletando mais detalhes para refinar a recomendação' },
  { value: 'handoff',         label: '👤 Chama vendedor humano',      description: 'IA passa a conversa para um atendente humano' },
  { value: 'continue',        label: '⏭️ Avança para próxima etapa',  description: 'Sem ação especial — apenas progride no funil' },
];

/**
 * Seed default v2 — funil escalonado por score.
 * Reproduz o comportamento da v1 mas em formato de stages.
 */
export const DEFAULT_SERVICE_CATEGORIES_V2: ServiceCategoriesConfig = {
  categories: [
    {
      id: 'tintas',
      label: 'Tintas e Vernizes',
      interesse_match: 'tinta|esmalte|verniz|impermeabilizante',
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
            { key: 'quantidade', label: 'quantidade',        examples: 'litros ou galões', score_value: 15, priority: 1 },
            { key: 'area',       label: 'metragem da área', examples: 'em m²',             score_value: 15, priority: 2 },
          ],
          phrasing: 'Antes de te conectar com o vendedor, {label}?',
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
};
