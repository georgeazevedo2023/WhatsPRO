// Validador determinístico para o tool call `set_tags` no ai-agent.
//
// R127 (2026-05-20): LLM em conversa multi-produto (lead pede "porta + janela alumínio")
// chama `set_tags(["interesse:portas", "interesse:janelas"])` numa única chamada.
// O `mergeTags` faz REPLACE por chave → a SEGUNDA tag sobrescreve a PRIMEIRA, silenciosamente.
// Sistema esquece de portas, fica só com janelas. Fields de portas viram órfãos.
// Lead que pediu 2 produtos vê IA em loop perguntando coisas erradas.
//
// Fix: detectar duplicate keys ANTES do merge e devolver instrução pro LLM:
//  - pra qualquer key com 2+ valores diferentes → rejeita TODOS, devolve aviso genérico.
//  - pra `interesse:` especificamente → devolve instrução pra perguntar ao lead qual começar.

export interface DuplicateKeyDetection {
  key: string
  values: string[]
}

export interface SetTagsValidationResult {
  hasDuplicateKeys: boolean
  duplicates: DuplicateKeyDetection[]
  /** Tags que sobraram após remover duplicates. Vazio se houver duplicate em interesse:. */
  cleanedTags: string[]
  /** Mensagem pro LLM. Não-vazia quando hasDuplicateKeys=true. */
  message: string
}

/**
 * Analisa o array `tags` em busca de chaves duplicadas com valores diferentes.
 *
 * Regras:
 *  - Duplicate em `interesse:` → caso especial (lead multi-categoria). Retorna
 *    cleanedTags vazio + instrução explícita pra IA perguntar qual produto começar primeiro.
 *  - Duplicate em qualquer outra key → rejeita todas as ocorrências dessa key
 *    (deixa o LLM tentar de novo com a correta) e mantém as outras tags.
 *  - Tag mal formatada (sem `:` ou sem value) é ignorada — caller faz validação separada.
 *  - Duplicate com MESMO valor é OK (mergeTags já é idempotente nesse caso).
 */
export function validateSetTagsInput(tags: string[]): SetTagsValidationResult {
  if (!Array.isArray(tags) || tags.length === 0) {
    return { hasDuplicateKeys: false, duplicates: [], cleanedTags: [], message: '' }
  }

  // Agrupar valores por chave
  const valuesByKey = new Map<string, Set<string>>()
  const tagsByKey = new Map<string, string[]>()

  for (const raw of tags) {
    if (typeof raw !== 'string') continue
    const colonIdx = raw.indexOf(':')
    if (colonIdx <= 0 || colonIdx === raw.length - 1) continue
    const key = raw.slice(0, colonIdx).trim()
    const value = raw.slice(colonIdx + 1).trim()
    if (!key || !value) continue

    if (!valuesByKey.has(key)) {
      valuesByKey.set(key, new Set())
      tagsByKey.set(key, [])
    }
    valuesByKey.get(key)!.add(value)
    tagsByKey.get(key)!.push(raw)
  }

  // Identificar duplicates (mesmo key com 2+ valores diferentes)
  const duplicates: DuplicateKeyDetection[] = []
  for (const [key, values] of valuesByKey) {
    if (values.size >= 2) {
      duplicates.push({ key, values: Array.from(values) })
    }
  }

  if (duplicates.length === 0) {
    return { hasDuplicateKeys: false, duplicates: [], cleanedTags: tags, message: '' }
  }

  // Tem duplicate em interesse: → caso especial multi-categoria
  const interesseConflict = duplicates.find((d) => d.key === 'interesse')
  if (interesseConflict) {
    const values = interesseConflict.values
    const friendlyList = values.map((v) => formatInteresseValue(v)).join(' e ')
    return {
      hasDuplicateKeys: true,
      duplicates,
      cleanedTags: [],
      message:
        `[INTERNO — não mostre ao lead] Você passou interesse: com valores conflitantes (${values.join(', ')}). ` +
        `O lead falou de ${values.length} categorias diferentes — sistema só processa uma por vez. ` +
        `AÇÃO: pergunte ao lead qual ele quer começar primeiro. Exemplo: ` +
        `"Posso te ajudar com ${friendlyList}. Qual você prefere ver primeiro?". ` +
        `Quando o lead escolher, chame set_tags com apenas 1 valor de interesse:.`,
    }
  }

  // Outros duplicates: remove TODAS as tags das keys conflitantes e devolve aviso
  const conflictKeys = new Set(duplicates.map((d) => d.key))
  const cleanedTags: string[] = []
  const seenKeys = new Set<string>()
  for (const raw of tags) {
    if (typeof raw !== 'string') continue
    const colonIdx = raw.indexOf(':')
    if (colonIdx <= 0) {
      cleanedTags.push(raw)
      continue
    }
    const key = raw.slice(0, colonIdx).trim()
    if (conflictKeys.has(key)) continue
    if (seenKeys.has(raw)) continue
    seenKeys.add(raw)
    cleanedTags.push(raw)
  }

  const conflictsDesc = duplicates
    .map((d) => `${d.key}: [${d.values.join(', ')}]`)
    .join('; ')

  return {
    hasDuplicateKeys: true,
    duplicates,
    cleanedTags,
    message:
      `[INTERNO — não mostre ao lead] Você passou múltiplos valores conflitantes pra ` +
      `mesma chave: ${conflictsDesc}. Tags da(s) chave(s) ${[...conflictKeys].join(', ')} ` +
      `foram REJEITADAS. Decida UM valor por chave e chame set_tags de novo se necessário.`,
  }
}

/* ──────────────────────────────────────────────────────────────────────
 * Sprint A I2 (2026-05-21, Bug 12 fix) — anti-hallucination:
 *   `interesse:VALUE` exige que VALUE seja um id válido em service_categories.
 *
 * LLM crava interesse com value inventado (ex: "interesse:hidraulica" em
 * agente sem essa categoria) — backend persiste lixo + qualif/search caem
 * no default. Defesa determinística: rejeitar valores fora das category ids.
 *
 * Hoje o ai-agent tem mitigação via fallback chain (D33), mas o tag
 * inválido fica persistido na conv até clear_context. Esta validação
 * BLOQUEIA a persistência logo na entrada do set_tags handler.
 * ────────────────────────────────────────────────────────────────────── */

export interface InteresseCategoryValidation {
  ok: boolean
  /** Tag rejeitada (ex: "interesse:hidraulica") quando ok=false */
  invalidTag?: string
  /** Mensagem pro LLM com lista válida quando ok=false */
  message: string
}

/**
 * Valida que cada tag `interesse:VALUE` tem VALUE ∈ validCategoryIds.
 * Retorna OK se não há tag interesse: ou se todas batem.
 *
 * Argumentos:
 *  - tags: array que será passado para mergeTags
 *  - validCategoryIds: ids permitidos derivados de agent.service_categories.
 *    Ex: ['tintas', 'portas', 'janelas', ...]. Caso vazio, valida sempre OK
 *    (agente sem categories configurado — preserva compat).
 */
export function validateInteresseCategory(
  tags: string[],
  validCategoryIds: string[],
): InteresseCategoryValidation {
  if (!Array.isArray(validCategoryIds) || validCategoryIds.length === 0) {
    return { ok: true, message: '' }
  }
  if (!Array.isArray(tags)) {
    return { ok: true, message: '' }
  }
  const validSet = new Set(validCategoryIds.map((id) => id.toLowerCase()))
  for (const raw of tags) {
    if (typeof raw !== 'string') continue
    if (!raw.toLowerCase().startsWith('interesse:')) continue
    const value = raw.slice('interesse:'.length).trim().toLowerCase()
    if (!value) continue
    if (validSet.has(value)) continue
    return {
      ok: false,
      invalidTag: raw,
      message:
        `[INTERNO — não mostre ao lead] interesse:${value} não existe nas categorias do agente. ` +
        `Categorias válidas: ${validCategoryIds.join(', ')}. ` +
        `AÇÃO: pergunte ao lead com qual produto você pode ajudar (use a lista acima) — ` +
        `NÃO use set_tags com interesse: até saber.`,
    }
  }
  return { ok: true, message: '' }
}

/**
 * Formata um slug de interesse pra texto amigável.
 * Ex: "portas" → "porta", "vasos_sanitarios" → "vaso sanitário",
 *     "cimento_argamassa" → "cimento argamassa".
 */
function formatInteresseValue(slug: string): string {
  const map: Record<string, string> = {
    portas: 'porta',
    janelas: 'janela',
    tintas: 'tinta',
    chuveiros: 'chuveiro',
    vasos_sanitarios: 'vaso sanitário',
    fechaduras: 'fechadura',
    escadas: 'escada',
    torneiras: 'torneira',
    lampadas: 'lâmpada',
    pias: 'pia',
    canos: 'cano',
    revestimentos: 'revestimento',
    mesas: 'mesa',
    furadeiras: 'furadeira',
    disjuntores: 'disjuntor',
    tomadas_interruptores: 'tomada/interruptor',
    impermeabilizantes: 'impermeabilizante',
    cabos: 'cabo',
    caixas_dagua: 'caixa d\'água',
    registros: 'registro',
    cimento_argamassa: 'cimento/argamassa',
    pregos_parafusos: 'prego/parafuso',
    ferramentas_manuais: 'ferramenta',
    churrasqueiras: 'churrasqueira',
  }
  return map[slug] || slug.replace(/_/g, ' ')
}
