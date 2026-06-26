/**
 * Contato compartilhado (vCard) → saudação + transbordo (v7.98.0, 2026-06-26).
 *
 * PROBLEMA (queixa do dono, print 2026-06-26): quando o lead COMPARTILHA UM CONTATO
 * no WhatsApp, o webhook salva a mensagem como `media_type='contact'` e usa o NOME
 * do contato como `content` (ex.: "Fernando Amaral Caprice"). O ai-agent então recebe
 * esse nome como se fosse o texto digitado pelo lead → o LLM tratou o nome como uma
 * consulta de produto e respondeu "Esse não é o nosso forte aqui...". Errado.
 *
 * PEDIDO: a IA não deve responder/vender quando recebe um contato — deve só dar uma
 * saudação ("Bom dia/Boa tarde, obrigado pelo contato. Só um instante que estou te
 * encaminhando para um de nossos atendentes.") e transbordar pra um humano.
 *
 * DESIGN (decisões do dono 2026-06-26):
 *  - GLOBAL: vale pra todos os agentes, sem config (um vCard nunca é consulta de
 *    produto, então transbordar é universalmente correto).
 *  - SEMPRE QUE HOUVER CONTATO: qualquer mensagem que contenha um contato dispara o
 *    transbordo, mesmo que venha texto junto.
 *  - MODE-AGNOSTIC: nenhum specialist trata vCard, então roda mesmo sob
 *    routing_mode='router' (sem caminho paralelo conflitante — igual ao jobVacancy).
 *
 * Este módulo guarda só as PARTES PURAS (detecção + saudação + mensagem) pra ficarem
 * testáveis. A execução do transbordo (fila + shadow + tags + nota) vive inline no
 * `ai-agent/index.ts` reusando `runQueueAssignment` (igual ao path `sale_closed`).
 */

/** media_type que o whatsapp-webhook grava pra mensagem de contato (vCard). */
export const INCOMING_CONTACT_MEDIA_TYPE = 'contact'

type IncomingLike = { media_type?: string | null }

/**
 * Detector puro: alguma das mensagens recebidas neste turno é um contato (vCard)?
 * Aceita tanto NormalizedMessage (caminho DB) quanto entradas cruas do queue —
 * ambos carregam `media_type`.
 */
export function detectSharedContact(
  messages: ReadonlyArray<IncomingLike> | null | undefined,
): boolean {
  if (!Array.isArray(messages)) return false
  return messages.some(
    (m) => typeof m?.media_type === 'string' && m.media_type === INCOMING_CONTACT_MEDIA_TYPE,
  )
}

/**
 * Saudação por horário (fuso America/Sao_Paulo — o caller calcula a hora local e
 * passa aqui pra manter a função pura/testável).
 *   05–11 → Bom dia · 12–17 → Boa tarde · 18–04 → Boa noite
 */
export function greetingForHour(hour: number): string {
  const h = Number.isFinite(hour) ? ((Math.trunc(hour) % 24) + 24) % 24 : 12
  if (h >= 5 && h < 12) return 'Bom dia'
  if (h >= 12 && h < 18) return 'Boa tarde'
  return 'Boa noite'
}

/**
 * Mensagem pronta enviada ao lead quando ele compartilha um contato: saudação +
 * agradecimento + aviso de transbordo. Cita o primeiro nome do lead se conhecido
 * (1x só — é uma mensagem isolada, soa caloroso sem ficar robótico).
 */
export function buildContactShareReply(opts: { greeting: string; leadName?: string | null }): string {
  const first = (opts.leadName || '').trim().split(/\s+/)[0]
  const hi = first ? `${opts.greeting}, ${first}!` : `${opts.greeting}!`
  return `${hi} Obrigado pelo contato 😊 Só um instante que estou te encaminhando para um de nossos atendentes.`
}
