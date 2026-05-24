/**
 * Captura determinística de nome (P5, 2026-05-24).
 *
 * PROBLEMA: o greeting determinístico pergunta "com quem eu falo?". Quando o lead
 * responde com o nome JUNTO de uma pergunta de produto na mesma leva de debounce
 * (ex.: "George\nQual preço de telha brasilit 244x110"), o router manda pro product
 * specialist, que foca no produto e NÃO chama update_lead_profile → o nome se perde.
 * Regra de prompt não é confiável (testado: LLM ignora). A captura tem que ser
 * determinística.
 *
 * SOLUÇÃO: este módulo é usado SOMENTE quando a última mensagem do bot foi o pedido
 * de nome (wasNameAsked). Aí a resposta do lead é, com altíssima probabilidade, o
 * nome — extraímos e persistimos sem depender do LLM. Escopo estreito = seguro:
 * só dispara logo após "com quem eu falo?", nunca no meio de qualificação.
 */

/** Última outgoing foi o PEDIDO DE NOME do greeting? (não confundir com pergunta de qualif) */
export function wasNameAsked(lastOutgoing: string | null | undefined): boolean {
  if (!lastOutgoing) return false
  return /com quem (?:eu )?falo|qual (?:é |e )?(?:o )?seu nome|como (?:posso te chamar|voc[êe] se chama)|me diz seu nome/i
    .test(lastOutgoing)
}

const NON_NAME_WORDS = new Set([
  'oi', 'ola', 'olá', 'opa', 'eai', 'eaí', 'bom', 'boa', 'dia', 'tarde', 'noite',
  'sim', 'nao', 'não', 'quero', 'queria', 'gostaria', 'preciso', 'tem', 'tema', 'têm',
  'qual', 'quanto', 'quanta', 'como', 'onde', 'quando', 'vcs', 'voces', 'vocês', 'voce', 'você',
  'obrigado', 'obrigada', 'valeu', 'tudo', 'bem', 'aqui', 'ok', 'okay', 'blz', 'beleza',
  'preço', 'preco', 'valor', 'telha', 'tinta', 'porta', 'janela', 'piso', 'lampada', 'lâmpada',
])

function capitalizeName(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function plausibleBareName(line: string): string | null {
  const trimmed = (line || '').trim().replace(/[.,!?;:]+$/g, '')
  if (!trimmed) return null
  if (/[?@\d]/.test(trimmed)) return null // perguntas, e-mails, números não são nome
  const words = trimmed.split(/\s+/)
  if (words.length < 1 || words.length > 3) return null
  // todos os tokens precisam ser alfabéticos (acentos ok) e nenhum ser palavra comum
  for (const w of words) {
    if (!/^[A-Za-zÀ-ÿ]{2,}$/.test(w)) return null
    if (NON_NAME_WORDS.has(w.toLowerCase())) return null
  }
  return capitalizeName(trimmed)
}

/**
 * Extrai o nome do lead a partir da resposta ao pedido de nome.
 * Tenta padrões explícitos ("meu nome é X", "sou o X", "me chamo X") e, se não casar,
 * usa a PRIMEIRA linha se ela parecer um nome puro. Retorna null se não parecer nome.
 *
 * @param raw texto incoming (pode ter várias linhas — debounce junta com \n)
 */
export function extractLeadName(raw: string | null | undefined): string | null {
  if (!raw) return null
  const text = raw.trim()
  // 1. Padrões explícitos (funcionam mesmo no meio da frase)
  const m = text.match(
    /\b(?:meu nome (?:é|e)|me chamo|pode (?:me )?chamar de|sou (?:o|a)|aqui (?:é|e) (?:o |a )?)\s+([A-Za-zÀ-ÿ]{2,}(?:\s+[A-Za-zÀ-ÿ]{2,}){0,2})/i,
  )
  if (m && m[1]) {
    const cand = m[1].trim()
    // valida que não capturou palavra comum (ex.: "sou o cliente")
    if (!NON_NAME_WORDS.has(cand.split(/\s+/)[0].toLowerCase())) return capitalizeName(cand)
  }
  // 2. Primeira linha como nome puro (caso "George\nQual preço...")
  return plausibleBareName(text.split('\n')[0])
}
