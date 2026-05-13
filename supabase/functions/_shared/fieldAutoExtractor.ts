/**
 * Auto-extração de fields de qualificação a partir da mensagem do lead.
 *
 * Resolve o gap entre `service_categories` (engine de qualificação determinística)
 * e o LLM (que esquece de chamar `set_tags` na 1ª resposta). O extractor scaneia
 * o texto incoming buscando os `examples` de cada field e popula tags
 * automaticamente ANTES de o `qualificationContext` ser computado.
 *
 * Exemplo:
 *   Input: "Tem tinta acrílica fosco?"
 *   Fields (tintas): ambiente, tipo_tinta (ex "acrílica, esmalte..."), cor, acabamento (ex "fosco, acetinado...")
 *   Output: [{key:'tipo_tinta', value:'acrilica'}, {key:'acabamento', value:'fosco'}]
 *
 * Restrições:
 *   - Pula fields numéricos (quantidade, voltagem, bitola, etc.) — esses precisam
 *     de regex específica que extraia números/unidades, fora do escopo MVP.
 *   - Word boundary regex (`\bacrílica\b`, não substring).
 *   - Detecta negação (`não|sem|nada de|nenhum`) nos 25 chars antes do match.
 *   - Normaliza acento (NFD) pra comparar.
 *   - Só seta cada field uma vez (primeiro match vence).
 */

import type { QualificationField } from './serviceCategories.ts'

// Fields com valor numérico/dimensional — pulados na auto-extração MVP.
// Pra extrair (futuro): regex como `\b(\d+)\s*(W|mm|m²|L|A|v)\b`.
const NUMERIC_KEYS = new Set([
  'quantidade',
  'quantidade_cimento',
  'quantidade_eletrico',
  'area',
  'voltagem',
  'voltagem_chuveiro',
  'tamanho_janela',
  'tamanho_registro',
  'tamanho_fixacao',
  'capacidade_caixa',
  'amperagem_disjuntor',
  'bitola',
  'diametro',
  'degraus',
  'potencia_lampada',
])

const NEGATION_WINDOW = 25

export interface ExtractedField {
  key: string
  value: string
  evidence: string
}

// Remove diacríticos combining (U+0300 a U+036F) — escape unicode explícito
// para evitar problemas de encoding em diferentes editores/SOs.
const COMBINING_MARKS_RE = new RegExp('[\\u0300-\\u036f]', 'g')
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(COMBINING_MARKS_RE, '')
}

function normalizeText(s: string): string {
  return stripAccents(s.toLowerCase())
}

/**
 * Parseia a string `examples` num array de candidatos.
 *
 * "acrílica, esmalte sintético, epóxi"   -> ["acrilica", "esmalte sintetico", "epoxi"]
 * "interno ou externo"                    -> ["interno", "externo"]
 * "branco, cinza, etc."                   -> ["branco", "cinza"]
 * "Coral, Suvinil, Sherwin-Williams"      -> ["coral", "suvinil", "sherwin-williams"]
 * "instalação predial (tomada, lâmpada) ou força (...)" -> ["instalacao predial", "forca"]
 */
export function parseExamples(rawExamples: string | null | undefined): string[] {
  if (!rawExamples) return []
  // Remove conteúdo entre parênteses + "etc.", troca "ou" e "/" por vírgula
  let cleaned = String(rawExamples)
    .replace(/\([^)]*\)/g, '')
    .replace(/\betc\.?\b/gi, '')
    .replace(/\bou\b/gi, ',')
    .replace(/\//g, ',')
  return cleaned
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
    .map((t) => t.replace(/^(o|a|os|as|um|uma|uns|umas)\s+/i, ''))
    .filter((t) => t.length >= 3)
}

function hasNegationBefore(normalizedText: string, matchStart: number): boolean {
  const start = Math.max(0, matchStart - NEGATION_WINDOW)
  const before = normalizedText.slice(start, matchStart)
  // Gatilho de negação seguido por até 4 palavras antes do match.
  // Cobre "não quero acrílica" e "sem preferência de Coral".
  return /\b(nao|sem|nenhum[ao]?|nada de|exceto|fora|tirando)\b(\s+\w+){0,4}\s*$/.test(before)
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Extrai fields detectados na mensagem do lead.
 *
 * @param rawText        Texto bruto da mensagem incoming
 * @param fields         Lista de fields candidatos (geralmente union de todos os stages da categoria detectada)
 * @param alreadySetKeys Set de keys já presentes em conversation.tags — não re-extrai
 */
export function autoExtractFields(
  rawText: string,
  fields: QualificationField[],
  alreadySetKeys: Set<string> = new Set(),
): ExtractedField[] {
  if (!rawText || !Array.isArray(fields) || fields.length === 0) return []
  const text = normalizeText(rawText)
  const results: ExtractedField[] = []
  const seenKeys = new Set<string>(alreadySetKeys)

  // Ordena por priority pra dar preferência aos fields mais importantes em caso de overlap
  const sorted = fields.slice().sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))

  for (const field of sorted) {
    if (NUMERIC_KEYS.has(field.key)) continue
    if (seenKeys.has(field.key)) continue

    const candidates = parseExamples(field.examples)
    for (const candidate of candidates) {
      const normCandidate = normalizeText(candidate)
      if (normCandidate.length < 3) continue
      const re = new RegExp(`\\b${escapeRegex(normCandidate)}\\b`, 'i')
      const m = text.match(re)
      if (m && typeof m.index === 'number' && !hasNegationBefore(text, m.index)) {
        // Preserva o candidato ORIGINAL (com acento/case) como value pra LLM ver naturalmente
        results.push({ key: field.key, value: candidate, evidence: m[0] })
        seenKeys.add(field.key)
        break
      }
    }
  }

  return results
}

/**
 * Achata os fields de TODOS os stages de uma categoria num array único.
 * Útil pra auto-extração — quer matchear fields de qualquer stage, não só do atual.
 */
export function flattenCategoryFields(stages: { fields?: QualificationField[] }[] | null | undefined): QualificationField[] {
  if (!Array.isArray(stages)) return []
  const out: QualificationField[] = []
  const seenKeys = new Set<string>()
  for (const stage of stages) {
    for (const field of stage.fields || []) {
      if (seenKeys.has(field.key)) continue
      seenKeys.add(field.key)
      out.push(field)
    }
  }
  return out
}
