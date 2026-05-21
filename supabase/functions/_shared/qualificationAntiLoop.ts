// R135 anti-loop: detecta quando o sistema está prestes a injetar a MESMA "FRASE EXATA SUGERIDA"
// que já foi enviada no turn anterior e o lead respondeu sem casar com keywords.
// Caso paz (558791319539, 2026-05-21): IA perguntou material da pia, lead respondeu
// "Mas simples mesmo" (não bateu com granito/marmore/inox/sintetico), e no turn seguinte
// buildQualificationContext reinjetou a frase literal — LLM transcreveu, virou loop.

export interface RecentMessage {
  direction: 'incoming' | 'outgoing'
  content: string
}

export interface AntiLoopDetectorInput {
  recentMessages: RecentMessage[]
  intendedPhrasing: string
  fieldLabel: string
}

export type AntiLoopVerdict =
  | { repeating: false; reason: 'first_attempt' | 'phrasing_not_in_history' }
  | { repeating: true; lastIncoming: string; nudge: string }

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/"/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildNudge(intendedPhrasing: string, lastIncoming: string): string {
  return [
    `ATENÇÃO: você JÁ perguntou '${intendedPhrasing}' no turn anterior e o lead respondeu: '${lastIncoming}'.`,
    `A resposta não casa com keywords pré-definidas MAS pode carregar intenção (preço/qualidade/simplicidade).`,
    `AÇÕES PERMITIDAS (escolha 1):`,
    `1. INTERPRETE a resposta do lead — se demonstra preferência por preço (ex: 'mais simples', 'mais barato'), escolha a opção mais econômica e chame set_tags com o valor inferido + breve confirmação cordial ('Vou seguir com X, ok?').`,
    `2. REFORMULE a pergunta com contexto explicativo curto que ajude o lead a entender as opções — NÃO repita a frase literal.`,
    `PROIBIDO repetir literalmente '${intendedPhrasing}' — isso é loop.`,
  ].join('\n')
}

export function detectQualifLoop(input: AntiLoopDetectorInput): AntiLoopVerdict {
  const { recentMessages, intendedPhrasing } = input

  if (!recentMessages || recentMessages.length < 2) {
    return { repeating: false, reason: 'first_attempt' }
  }

  const needle = normalize(intendedPhrasing)
  if (!needle) {
    return { repeating: false, reason: 'phrasing_not_in_history' }
  }

  // Procura, do mais recente pro mais antigo, a outgoing MAIS RECENTE que contém a phrasing.
  let matchingOutgoingIdx = -1
  for (let i = recentMessages.length - 1; i >= 0; i--) {
    const msg = recentMessages[i]
    if (msg.direction !== 'outgoing') continue
    const haystack = normalize(msg.content || '')
    if (haystack.includes(needle)) {
      matchingOutgoingIdx = i
      break
    }
  }

  if (matchingOutgoingIdx === -1) {
    return { repeating: false, reason: 'phrasing_not_in_history' }
  }

  // Procura a próxima incoming APÓS essa outgoing — é a resposta do lead que não casou com keywords.
  let lastIncoming: string | null = null
  for (let i = matchingOutgoingIdx + 1; i < recentMessages.length; i++) {
    const msg = recentMessages[i]
    if (msg.direction === 'incoming' && msg.content && msg.content.trim()) {
      lastIncoming = msg.content.trim().replace(/\s+/g, ' ')
      break
    }
  }

  if (!lastIncoming) {
    return { repeating: false, reason: 'phrasing_not_in_history' }
  }

  return {
    repeating: true,
    lastIncoming,
    nudge: buildNudge(intendedPhrasing, lastIncoming),
  }
}
