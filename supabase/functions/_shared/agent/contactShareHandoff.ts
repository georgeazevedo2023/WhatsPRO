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

/** media_type que o whatsapp-webhook grava pra mensagem de contato (vCard nativo). */
export const INCOMING_CONTACT_MEDIA_TYPE = 'contact'

type IncomingLike = { media_type?: string | null; content?: string | null }

/**
 * IMPORTANTE (2026-06-26, validação E2E do dono): na prática o contato NÃO chega
 * como `media_type='contact'`. O pipeline real é UAZAPI → **n8n** → whatsapp-webhook,
 * e o n8n **achata o vCard em TEXTO** antes de entregar. A mensagem chega como
 * `media_type='text'` com o `content` renderizado pelo WhatsApp assim:
 *
 *     Lara Eletropiso Lucas
 *     Phone: +55 87 99676-2520
 *
 * Então detectamos o contato pelo PADRÃO do texto — a linha `Phone: +<número>` (ou um
 * `BEGIN:VCARD` cru) que só o app gera ao compartilhar um contato; um lead humano não
 * digita "Phone:" em inglês com dois-pontos. Mantemos também o check por `media_type`
 * pra cobrir qualquer caminho que entregue o vCard nativo (defesa em profundidade).
 */
const CONTACT_TEXT_PATTERNS: RegExp[] = [
  // Linha "Phone: +55 ..." gerada ao renderizar o TEL do vCard como texto.
  /(^|\n)\s*Phone:\s*\+?[\d(]/i,
  // vCard cru, caso algum caminho entregue o conteúdo bruto.
  /BEGIN:VCARD/i,
]

/** A mensagem de TEXTO é um contato compartilhado achatado (Nome\nPhone: +número)? */
export function looksLikeSharedContactText(content: string | null | undefined): boolean {
  if (!content || typeof content !== 'string') return false
  return CONTACT_TEXT_PATTERNS.some((re) => re.test(content))
}

/**
 * Detector puro: alguma das mensagens recebidas neste turno é um contato (vCard)?
 * Aceita tanto NormalizedMessage (caminho DB) quanto entradas cruas do queue — ambos
 * carregam `media_type` E `content`. Dispara por `media_type==='contact'` OU pelo
 * padrão de texto do vCard achatado pelo n8n.
 */
export function detectSharedContact(
  messages: ReadonlyArray<IncomingLike> | null | undefined,
): boolean {
  if (!Array.isArray(messages)) return false
  return messages.some(
    (m) =>
      (typeof m?.media_type === 'string' && m.media_type === INCOMING_CONTACT_MEDIA_TYPE) ||
      looksLikeSharedContactText(m?.content),
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
