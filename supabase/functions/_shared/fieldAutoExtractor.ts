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

// Fields com valor numérico/dimensional — pulados na auto-extração padrão
// (regex de examples não casa "12v" porque value já é numérico, não palavra-chave).
// Cada chave aqui PODE ter um extractor específico em NUMERIC_REGEX_EXTRACTORS.
// Se a chave não tem extractor, continua sendo pulada (comportamento original).
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

// R119 (2026-05-19): extractores para campos numéricos comuns. Sem isso, lead
// que responde "12v" ou "220v" não tem o field setado, prompt fica em loop
// "PRÓXIMA PERGUNTA OBRIGATÓRIA: qual a voltagem?" infinitamente porque o LLM
// também não consegue mapear pra value canônico sem o assist do regex.
const NUMERIC_REGEX_EXTRACTORS: Record<string, { regex: RegExp; normalize?: (m: RegExpMatchArray) => string }> = {
  voltagem: {
    // Casa "12v", "12 V", "220v", "127", "110v", "bivolt", "sem fio" (bateria=12v)
    regex: /\b(12|110|127|220|240|bivolt|sem\s*fio|a\s*bateria|com\s*fio)\s*v?\b/i,
    normalize: (m) => {
      const raw = m[1].toLowerCase().replace(/\s+/g, ' ').trim()
      if (raw === 'sem fio' || raw === 'a bateria') return '12v'
      if (raw === 'com fio') return '220v'
      if (raw === 'bivolt') return 'bivolt'
      return `${raw}v`
    },
  },
  voltagem_chuveiro: {
    regex: /\b(127|220|240)\s*v?\b/i,
    normalize: (m) => `${m[1]}v`,
  },
  amperagem_disjuntor: {
    regex: /\b(10|16|20|25|32|40|50|63|80|100)\s*a\b/i,
    normalize: (m) => `${m[1]}A`,
  },
}

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
  const base = cleaned
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
    .map((t) => t.replace(/^(o|a|os|as|um|uma|uns|umas)\s+/i, ''))
    .filter((t) => t.length >= 3)
  // R119 (2026-05-19): para tokens com hífen (ex: "tetra-chave"), também
  // adiciona as partes individuais como candidatos. Lead frequentemente fala
  // só a primeira parte ("tetra"), e o `\btetra-chave\b` não casa só "tetra".
  const expanded: string[] = []
  for (const t of base) {
    expanded.push(t)
    if (t.includes('-')) {
      for (const part of t.split('-')) {
        const p = part.trim()
        if (p.length >= 3 && !expanded.includes(p)) expanded.push(p)
      }
    }
  }
  return expanded
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
 * Monta o regex de match de um candidato com FLEXÃO de gênero + número.
 * O lead responde "branca"/"fosca" enquanto o example é "branco"/"fosco" — sem
 * flexão, o word-boundary exato não casava (gênero) e o field não era extraído
 * → score nunca acumulava. (Achado no E2E qualify-first 2026-05-24.)
 *
 * Regra: candidato com >=4 chars terminando em 'o'/'a' → último vogal vira [oa]
 * + 's' opcional (branco→branc[oa]s? casa branco/branca/brancos/brancas;
 * fosco→fosc[oa]s? casa fosco/fosca). Demais candidatos: só plural opcional 's'.
 * Conservador: não mexe em terminações que não sejam o/a (coral, inox, etc.).
 */
function buildCandidateRegex(norm: string): RegExp {
  if (norm.length >= 4 && /[oa]$/.test(norm)) {
    const stem = escapeRegex(norm.slice(0, -1))
    return new RegExp(`\\b${stem}[oa]s?\\b`, 'i')
  }
  return new RegExp(`\\b${escapeRegex(norm)}s?\\b`, 'i')
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
    if (seenKeys.has(field.key)) continue
    // R119: tenta extractor numérico específico (voltagem, amperagem...) antes
    // de pular. Se field é numérico mas tem extractor configurado, usa ele.
    if (NUMERIC_KEYS.has(field.key)) {
      const extractor = NUMERIC_REGEX_EXTRACTORS[field.key]
      if (!extractor) continue
      const m = rawText.match(extractor.regex)
      if (m && m.index !== undefined && !hasNegationBefore(text, m.index)) {
        const value = extractor.normalize ? extractor.normalize(m) : m[1] || m[0]
        results.push({ key: field.key, value, evidence: m[0] })
        seenKeys.add(field.key)
      }
      continue
    }

    if (field.key === 'local_aplicacao') {
      const integrated = text.match(/\b(sala)\b.*\b(cozinha)\b|\b(cozinha)\b.*\b(sala)\b|\barea integrada\b/)
      if (integrated && integrated.index !== undefined && !hasNegationBefore(text, integrated.index)) {
        results.push({ key: field.key, value: 'sala e cozinha integradas', evidence: integrated[0] })
        seenKeys.add(field.key)
        continue
      }
    }

    const candidates = parseExamples(field.examples)
    for (const candidate of candidates) {
      const normCandidate = normalizeText(candidate)
      if (normCandidate.length < 3) continue
      const re = buildCandidateRegex(normCandidate)
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
