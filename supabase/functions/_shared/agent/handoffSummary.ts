/**
 * Premium seller handoff summary.
 *
 * Converts tag-based qualification into a readable internal note for the human
 * seller. Never send this text to the lead.
 */

export interface HandoffSummaryInput {
  tags?: string[] | null
  leadName?: string | null
  fallbackReason?: string | null
  /**
   * Histórico recente da conversa (ordem cronológica asc). Usado como FALLBACK
   * universal (2026-05-30): quando a qualificação não virou tags estruturadas — o
   * que acontece na MAIORIA das categorias não-premium, onde o specialist conversa
   * mas não chama set_tags — montamos um "Resumo da conversa" com os pares
   * pergunta(bot)→resposta(lead). Garante que o vendedor SEMPRE receba o que foi
   * coletado, mesmo sem tags. Categorias premium (tags ricas) não recebem o digest.
   */
  messages?: Array<{ direction?: string | null; content?: string | null }> | null
}

const LABELS: Record<string, string> = {
  interesse: 'Categoria',
  pedido_original: 'Pedido original',
  produto: 'Produto',
  selected_product: 'Produto escolhido',
  aplicacao: 'Aplicacao',
  aplicacao_revestimento: 'Aplicacao',
  ambiente: 'Ambiente',
  ambiente_revestimento: 'Ambiente',
  ambiente_torneira: 'Aplicacao',
  formato: 'Formato',
  acabamento: 'Acabamento',
  acabamento_torneira: 'Acabamento',
  cor: 'Cor',
  local_aplicacao: 'Local de aplicacao',
  area: 'Area',
  instalacao: 'Instalacao',
  tipo_torneira: 'Instalacao',
  modelo: 'Modelo',
  modelo_torneira: 'Modelo',
  tipo_cuba: 'Tipo de cuba',
  perfil: 'Perfil',
  tipo_tinta: 'Tipo de tinta',
  objetivo: 'Objetivo',
  quantidade: 'Quantidade',
  bairro: 'Bairro',
  entrega_modo: 'Entrega',
  catalog_result: 'Resultado catalogo',
  qualification_score: 'Qualification Score',
  lead_score: 'Qualification Score',
}

const ORDER = [
  'interesse',
  'pedido_original',
  'produto',
  'selected_product',
  'objetivo',
  'aplicacao',
  'aplicacao_revestimento',
  'ambiente_torneira',
  'ambiente',
  'ambiente_revestimento',
  'local_aplicacao',
  'formato',
  'instalacao',
  'tipo_torneira',
  'modelo',
  'modelo_torneira',
  'tipo_tinta',
  'acabamento',
  'acabamento_torneira',
  'cor',
  'tipo_cuba',
  'perfil',
  'area',
  'quantidade',
  'entrega_modo',
  'bairro',
  'catalog_result',
  'lead_score',
  'qualification_score',
]

const INTERNAL_SKIP_KEYS = new Set([
  'pedido_original',
  'ia',
  'ia_cleared',
  'agent_status',
  'handoff_created',
  'human_assigned',
  'seller_notified',
  'followups_paused',
  'flow_mode',
  'physical_stock_required',
  'search_enabled',
  'show_carousel',
  'ready_to_handoff',
  'questions_after_empty',
  'enrich_count',
])

// Keys que NÃO contam como "atributo de produto" pro gate do digest (são meta/categoria).
const NON_ATTRIBUTE_KEYS = new Set([
  'interesse', 'pedido_original', 'produto', 'selected_product',
  'catalog_result', 'lead_score', 'qualification_score',
])

// Mensagens do bot que NÃO são perguntas de qualificação (saudação, pedido de nome,
// transbordo, ponte) — não viram par no digest.
const NON_QUESTION_RE = /bem-vindo|com quem eu falo|qual.*\bnome\b|j[áa] passei tudo|nosso (vendedor|consultor|atendente)|vou te (passar|conectar|encaminhar)|um instante|um momento|s[óo] um instante/i

/**
 * Monta um resumo da conversa em pares pergunta(bot)→resposta(lead) a partir do
 * histórico (ordem cronológica asc). Pareia cada resposta do lead com a última
 * pergunta do bot; descarta saudação/pedido-de-nome/transbordo. Cap nos últimos
 * pares pra não inflar a nota. Vazio quando não há nada útil.
 */
export function buildConversationDigest(
  messages: HandoffSummaryInput['messages'],
  maxPairs = 8,
): string {
  if (!Array.isArray(messages) || messages.length === 0) return ''
  const pairs: string[] = []
  let lastBotQ = ''
  for (const m of messages) {
    if (!m || typeof m.content !== 'string') continue
    const text = m.content.replace(/\s+/g, ' ').trim()
    if (!text) continue
    if (m.direction === 'outgoing') {
      lastBotQ = text
    } else if (m.direction === 'incoming') {
      const answer = text.slice(0, 80)
      const hasUsefulQ = lastBotQ && !NON_QUESTION_RE.test(lastBotQ)
      pairs.push(hasUsefulQ ? `• ${lastBotQ.slice(0, 100)} → ${answer}` : `• ${answer}`)
      lastBotQ = ''
    }
  }
  return pairs.slice(-maxPairs).join('\n')
}

export function buildPremiumHandoffSummary(input: HandoffSummaryInput): string {
  const tagMap = readTags(input.tags)
  const lines: string[] = []

  if (input.leadName?.trim()) {
    lines.push(`Cliente: ${formatValue(input.leadName)}`)
  }

  let attributeCount = 0
  for (const key of ORDER) {
    const value = tagMap.get(key)
    if (!value) continue
    if (!NON_ATTRIBUTE_KEYS.has(key)) attributeCount++
    lines.push(`${LABELS[key] || key}: ${formatValueForKey(key, value)}`)
  }

  // Fallback universal (2026-05-30): poucas tags estruturadas (típico das categorias
  // não-premium, onde o LLM conversa mas não chama set_tags) → anexa um resumo da
  // conversa (pares pergunta→resposta) pra o vendedor nunca receber uma nota vazia.
  if (attributeCount < 3) {
    const digest = buildConversationDigest(input.messages)
    if (digest) lines.push(`Resumo da conversa:\n${digest}`)
  }

  const tags = buildUsefulTags(tagMap)
  if (tags.length > 0) {
    lines.push(`Tags: ${tags.join(', ')}`)
  }

  const needsPhysicalStock = tagMap.get('catalog_result') === 'empty' ||
    tagMap.get('physical_stock_required') === 'true'
  if (needsPhysicalStock) {
    lines.push('Necessita: Validacao humana de estoque fisico e alternativas equivalentes.')
  }

  const fallback = (input.fallbackReason || '').trim()
  if (fallback && !summaryAlreadyContains(lines, fallback)) {
    lines.push(`Observacao: ${fallback}`)
  }

  return lines.join('\n').trim()
}

function readTags(tags: string[] | null | undefined): Map<string, string> {
  const out = new Map<string, string>()
  if (!Array.isArray(tags)) return out

  for (const tag of tags) {
    if (typeof tag !== 'string') continue
    const idx = tag.indexOf(':')
    if (idx <= 0) continue
    const key = tag.slice(0, idx).trim()
    const value = tag.slice(idx + 1).trim()
    if (!key || !value) continue
    out.set(key, value)
  }

  return out
}

function buildUsefulTags(tagMap: Map<string, string>): string[] {
  const out: string[] = []
  for (const [key, value] of tagMap.entries()) {
    if (INTERNAL_SKIP_KEYS.has(key)) continue
    if (key === 'lead_score' || key === 'qualification_score') continue
    out.push(`${key}:${value}`)
  }
  return out.slice(0, 20)
}

function formatValueForKey(key: string, value: string): string {
  if (key === 'catalog_result' && value === 'empty') return 'Nenhum produto localizado no catalogo digital'
  if (key === 'entrega_modo') {
    if (value === 'delivery') return 'Receber em casa'
    if (value === 'pickup') return 'Retirada na loja'
  }
  if (key === 'area' && /^\d+(?:[.,]\d+)?$/.test(value)) return `${value}m2`
  return formatValue(value)
}

function formatValue(value: string): string {
  return value.replace(/_/g, ' ').trim()
}

function summaryAlreadyContains(lines: string[], fallback: string): boolean {
  const normFallback = normalize(fallback)
  return lines.some((line) => normFallback.includes(normalize(line)) || normalize(line).includes(normFallback))
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}
