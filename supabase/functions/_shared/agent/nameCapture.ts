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
  // Ambientes/cômodos — caso real 2026-06-12: IA gravou o INTERESSE ("produtos para
  // garagem") como full_name do lead → lista/header exibiam "Garagem" como nome.
  'garagem', 'cozinha', 'banheiro', 'quarto', 'sala', 'varanda', 'quintal', 'lavanderia',
  'escritorio', 'escritório', 'area', 'área', 'externa', 'interna', 'externo', 'interno',
  'casa', 'apartamento', 'obra', 'reforma', 'loja', 'terraco', 'terraço', 'lavabo', 'sacada',
  // Papéis/genéricos que o LLM confunde com nome
  'cliente', 'gerente', 'vendedor', 'vendedora', 'atendente', 'empresa', 'pessoal', 'amigo', 'amiga',
  // Materiais/produtos comuns do nicho
  'ceramica', 'cerâmica', 'porcelanato', 'azulejo', 'argamassa', 'cimento', 'rejunte',
  'chuveiro', 'torneira', 'cuba', 'telhado', 'madeira', 'aluminio', 'alumínio', 'vidro', 'ferro',
  'produto', 'produtos', 'material', 'materiais', 'orcamento', 'orçamento', 'entrega',
])

/** Conectivos de nome composto ("Maria da Silva") — ignorados na checagem lexical. */
const NAME_CONNECTIVES = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])

const deaccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

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
  //    (2026-05-28) Estendido: "sou João" (sem o/a obrigatório), "tô X", "aqui [é] X".
  //    Caso real de prod (E2E S2/S5): "Boa tarde, sou João" / "Bom dia, sou Carlos."
  //    A regex antiga exigia "sou (?:o|a)" → não casava sem o artigo → o greeting
  //    determinístico pedia o nome de novo (double-ask "com quem eu falo?").
  const m = text.match(
    /\b(?:meu nome (?:é|e)|me chamo|pode (?:me )?chamar de|sou(?:\s+(?:o|a))?|aqui (?:é|e) (?:o |a )?|aqui)\s+([A-Za-zÀ-ÿ]{2,}(?:\s+[A-Za-zÀ-ÿ]{2,}){0,2})/i,
  )
  if (m && m[1]) {
    const cand = m[1].trim()
    const firstWord = cand.split(/\s+/)[0].toLowerCase()
    // valida que não capturou palavra comum (ex.: "sou o cliente", "sou o gerente")
    if (!NON_NAME_WORDS.has(firstWord) && firstWord.length >= 2) return capitalizeName(cand)
  }
  // 2. "Boa tarde, NOME" — saudação seguida de vírgula + nome puro (sem "sou/meu nome").
  //    Caso real: "Boa tarde, João". Conservador: precisa começar com saudação clara
  //    + vírgula + 1 palavra que pareça nome.
  const greetingNameMatch = text.match(
    /^\s*(?:bom\s+dia|boa\s+tarde|boa\s+noite|ol[áa]|oi|opa|e[íi]a[íi]?)\s*[,!\s]+([A-Za-zÀ-ÿ]{2,})(?:\s|[!?.,]|$)/i,
  )
  if (greetingNameMatch && greetingNameMatch[1]) {
    const cand = greetingNameMatch[1].trim()
    if (!NON_NAME_WORDS.has(cand.toLowerCase()) && cand.length >= 2) return capitalizeName(cand)
  }
  // 3. Primeira linha como nome puro (caso "George\nQual preço...")
  return plausibleBareName(text.split('\n')[0])
}

/**
 * Validação de plausibilidade do full_name vindo do LLM (tool update_lead_profile).
 *
 * Caso real (2026-06-12): a IA atribuiu o INTERESSE do lead ("produtos para garagem")
 * como nome → lista e header do Helpdesk exibiam "Garagem" como nome do cliente.
 * Regras (todas determinísticas):
 *  - estrutura: só letras/apóstrofo, 1-5 palavras, sem dígito/?/@
 *  - léxico: nenhuma palavra significativa pode ser termo comum/ambiente/produto
 *    (NON_NAME_WORDS, com e sem acento); conectivos ("da", "de") são ignorados
 *  - contexto: candidato que aparece dentro dos interesses do lead é interesse, não nome
 *
 * Mantém a capitalização original e colapsa o doubling do LLM ("PedroPedro" → "Pedro",
 * regra herdada do dedup do crmTools: cada metade >= 3 chars pra não comer "dudu"/"Ana").
 * Retorna null quando implausível — o chamador NÃO deve gravar nada nesse caso.
 */
export function sanitizeProfileName(
  raw: string | null | undefined,
  interests: Array<string | null | undefined> = [],
): string | null {
  if (!raw) return null
  let name = String(raw).trim().replace(/[.,!?;:]+$/g, '')
  if (name.length >= 6 && name.length % 2 === 0) {
    const half = name.length / 2
    if (name.slice(0, half).toLowerCase() === name.slice(half).toLowerCase()) {
      name = name.slice(0, half)
    }
  }
  if (!name || /[?@\d]/.test(name)) return null
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length < 1 || words.length > 5) return null
  const significant = words.filter((w) => !NAME_CONNECTIVES.has(w.toLowerCase()))
  if (!significant.length) return null
  for (const w of significant) {
    if (!/^[A-Za-zÀ-ÿ']{2,}$/.test(w)) return null
    const lw = w.toLowerCase()
    if (NON_NAME_WORDS.has(lw) || NON_NAME_WORDS.has(deaccent(lw))) return null
  }
  // "Garagem" ⊂ interesse "produtos para garagem" → é interesse, não nome.
  // Trade-off aceito: nome real igual a palavra do interesse (lead "Rosa" comprando
  // "tinta rosa") é rejeitado — não gravar é mais seguro que gravar nome errado.
  const normName = deaccent(name.toLowerCase())
  for (const it of interests) {
    const normIt = deaccent(String(it || '').toLowerCase())
    if (!normIt) continue
    const itTokens = normIt.split(/[^a-z']+/).filter(Boolean)
    if (normIt === normName || itTokens.includes(normName) || (normName.includes(' ') && normIt.includes(normName))) {
      return null
    }
  }
  return name
}
