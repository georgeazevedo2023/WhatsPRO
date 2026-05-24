/**
 * Sprint E.1 (2026-05-24) — memória longa por lead (injeção).
 *
 * Pesquisa (Mem0/Zep/LangMem 2025-2026): pra domínio de vendas BOUNDED, memória
 * ESTRUTURADA injetada como bloco key:value compacto no TOPO do contexto bate
 * vector RAG em exatidão/custo/latência. "Retrieval > ingestion": injetar POUCOS
 * fatos de alta relevância, não o transcript.
 *
 * Este helper lê o lead_profiles (já carregado upstream) e monta um bloco curto
 * (~150-250 tokens) que o specialistBase prepara no system prompt de TODO specialist.
 * Só emite bloco pra lead com memória real (returning) — lead novo retorna ''.
 *
 * IMPORTANTE (anti-poisoning + privacidade): memória = só FATOS semânticos do lead
 * (nome/interesse/objeções/produtos/estágio). NUNCA instruções/regras procedurais
 * (essas ficam no prompt). Isolamento tenant/lead é garantido na query upstream + RLS,
 * nunca aqui. Uso pra RETOMAR a conversa, não pra recitar tudo (evita "creepiness").
 */

type LeadProfileLike = {
  full_name?: string | null
  interests?: string[] | null
  objections?: string[] | null
  average_ticket?: number | null
  reason?: string | null
  current_score?: number | null
  products_seen?: unknown
  qualification_stage?: string | null
  conversation_summaries?: unknown
  last_contact_at?: string | null
  total_interactions?: number | null
  memory_updated_at?: string | null
} | null | undefined

function fmtList(v: unknown, max = 6): string | null {
  if (!Array.isArray(v) || v.length === 0) return null
  return v
    .map((x) => (typeof x === 'string' ? x : (x && typeof x === 'object' && 'title' in (x as any) ? String((x as any).title) : String(x))))
    .filter(Boolean)
    .slice(0, max)
    .join(', ') || null
}

function daysAgo(iso?: string | null): string | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return null
  const days = Math.floor((Date.now() - then) / 86400000)
  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  return `há ${days} dias`
}

/**
 * Extrai o último resumo de conversa de conversation_summaries (jsonb).
 * Tolera array de {summary}|string ou objeto único.
 */
function lastSummary(v: unknown): string | null {
  if (!v) return null
  if (typeof v === 'string') return v.substring(0, 240)
  if (Array.isArray(v) && v.length > 0) {
    const last = v[v.length - 1]
    const s = typeof last === 'string' ? last : (last && typeof last === 'object' ? ((last as any).summary || (last as any).text) : null)
    return s ? String(s).substring(0, 240) : null
  }
  if (typeof v === 'object') {
    const s = (v as any).summary || (v as any).text
    return s ? String(s).substring(0, 240) : null
  }
  return null
}

/**
 * Monta o bloco de memória do lead. Retorna '' quando não há memória relevante
 * (lead novo / sem fatos) — nesse caso o specialist abre do zero normalmente.
 *
 * O bloco é rotulado e factual pra o LLM tratar como verdade-base (não como chat).
 */
export function buildLeadMemoryBlock(leadProfile: LeadProfileLike): string {
  if (!leadProfile) return ''

  const lines: string[] = []
  const name = leadProfile.full_name?.trim()
  if (name) lines.push(`Nome: ${name}`)

  const interests = fmtList(leadProfile.interests)
  if (interests) lines.push(`Interesses: ${interests}`)

  if (leadProfile.qualification_stage) lines.push(`Qualificação parou em: ${leadProfile.qualification_stage}`)

  const products = fmtList(leadProfile.products_seen)
  if (products) lines.push(`Produtos já vistos: ${products}`)

  const objections = fmtList(leadProfile.objections)
  if (objections) lines.push(`Objeções levantadas: ${objections}`)

  if (typeof leadProfile.average_ticket === 'number' && leadProfile.average_ticket > 0) {
    lines.push(`Orçamento/ticket: ~R$${leadProfile.average_ticket}`)
  }
  if (leadProfile.reason) lines.push(`Motivo do contato: ${leadProfile.reason}`)

  const summary = lastSummary(leadProfile.conversation_summaries)
  if (summary) lines.push(`Resumo da última conversa: ${summary}`)

  const seen = daysAgo(leadProfile.last_contact_at)
  // Só marca "última visita" se NÃO foi hoje (relevante pra lead que volta após dias).
  if (seen && seen !== 'hoje') lines.push(`Última visita: ${seen}`)

  // Sem fatos úteis (ex.: só "última visita: hoje" de uma conv em andamento) → não injeta.
  const meaningful = lines.filter((l) => !l.startsWith('Última visita'))
  if (meaningful.length === 0) return ''

  return `MEMÓRIA DO LEAD (fatos já conhecidos — use pra CONTINUAR de onde parou, NÃO recite tudo nem pergunte o que já sabe):
${lines.join('\n')}`
}

// =============================================================================
// Consolidação (escrita) — barata, sem LLM, fire-and-forget pós-resposta
// =============================================================================

/** Extrai títulos de produto vistos a partir do toolCallsLog do turno. */
function extractProductsSeen(toolCallsLog: Array<{ name: string; args?: any; result?: string }>): string[] {
  const seen = new Set<string>()
  for (const t of toolCallsLog || []) {
    // send_carousel/send_media carregam os produtos efetivamente mostrados
    if (t.name === 'send_carousel' && Array.isArray(t.args?.product_ids)) {
      for (const p of t.args.product_ids) if (typeof p === 'string') seen.add(p.trim())
    }
    if (t.name === 'send_media' && typeof t.args?.caption === 'string') {
      // primeira linha da caption costuma ser o nome do produto
      const firstLine = t.args.caption.split('\n')[0]?.trim()
      if (firstLine) seen.add(firstLine.substring(0, 80))
    }
    // search_products result inclui "...ENVIADO ao lead: Title1, Title2, Title3"
    if (t.name === 'search_products' && typeof t.result === 'string') {
      const m = t.result.match(/ao lead:\s*(.+)$/i)
      if (m && m[1]) {
        for (const title of m[1].split(',')) {
          const cleaned = title.trim().substring(0, 80)
          if (cleaned) seen.add(cleaned)
        }
      }
    }
  }
  return Array.from(seen).slice(0, 12)
}

/**
 * Deriva o estágio de qualificação a partir das tags (interesse + campos coletados).
 * Barato e determinístico — não precisa de LLM. Ex.: "tintas (ambiente, cor)".
 */
function deriveQualificationStage(tags: string[]): string | null {
  const internal = new Set(['ia', 'lead_score', 'multi_interesse_pending', 'qualif_horizontal', 'search_fail', 'ia_cleared', 'marca_citada', 'tipo_cliente'])
  const interesse = tags.find((t) => t.startsWith('interesse:'))?.slice('interesse:'.length)
  if (!interesse) return null
  const fields = tags
    .map((t) => t.split(':')[0])
    .filter((k) => k && !internal.has(k) && k !== 'interesse' && k !== 'produto' && k !== 'objecao' && k !== 'pagamento' && k !== 'motivo' && k !== 'lead_name')
  const uniqueFields = Array.from(new Set(fields)).slice(0, 6)
  return uniqueFields.length > 0 ? `${interesse} (${uniqueFields.join(', ')})` : interesse
}

/**
 * Consolida a memória do lead após o turno (escrita barata, sem LLM).
 * - products_seen: merge dedupe com o que já havia
 * - qualification_stage: derivado das tags
 * - memory_updated_at: now (validity timestamp, ideia Zep)
 *
 * Fire-and-forget: a resposta ao lead JÁ foi enviada pelo dispatchResponse.
 * Não bloqueia nada crítico; falha é logada e ignorada (observabilidade não
 * pode derrubar o turno). Só FATOS verificados (toolCallsLog real) — anti-poisoning.
 */
export async function consolidateLeadMemory(args: {
  supabase: any
  contactId: string
  currentTags: string[]
  toolCallsLog: Array<{ name: string; args?: any; result?: string }>
  existingProductsSeen?: unknown
  existingInterests?: unknown
  log: { info: (m: string, d?: object) => void; warn: (m: string, d?: object) => void }
}): Promise<void> {
  const { supabase, contactId, currentTags, toolCallsLog, existingProductsSeen, existingInterests, log } = args
  try {
    const newProducts = extractProductsSeen(toolCallsLog)
    const stage = deriveQualificationStage(currentTags || [])
    // interesses: fato conhecido das tags interesse:CAT (merge com o existente).
    const interesseTags = (currentTags || [])
      .filter((t) => t.startsWith('interesse:'))
      .map((t) => t.slice('interesse:'.length).trim())
      .filter(Boolean)

    // Nada novo pra gravar → evita UPDATE inútil.
    if (newProducts.length === 0 && !stage && interesseTags.length === 0) return

    const prev = Array.isArray(existingProductsSeen)
      ? (existingProductsSeen as unknown[]).map((x) => (typeof x === 'string' ? x : String((x as any)?.title ?? x)))
      : []
    const mergedProducts = Array.from(new Set([...prev, ...newProducts])).slice(0, 20)

    const prevInterests = Array.isArray(existingInterests) ? (existingInterests as unknown[]).map(String) : []
    const mergedInterests = Array.from(new Set([...prevInterests, ...interesseTags])).slice(0, 10)

    const patch: Record<string, unknown> = { memory_updated_at: new Date().toISOString() }
    if (newProducts.length > 0) patch.products_seen = mergedProducts
    if (stage) patch.qualification_stage = stage
    if (interesseTags.length > 0) patch.interests = mergedInterests

    const { error } = await supabase.from('lead_profiles').update(patch).eq('contact_id', contactId)
    if (error) {
      log.warn('consolidateLeadMemory update failed (non-fatal)', { error: error.message })
    } else {
      log.info('Lead memory consolidated', { products: newProducts.length, stage: stage || null })
    }
  } catch (err) {
    log.warn('consolidateLeadMemory threw (non-fatal)', { error: (err as Error).message })
  }
}
