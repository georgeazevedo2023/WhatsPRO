/**
 * Sprint E.greeting (2026-05-24) — Política de saudação/reconhecimento UNIFICADA.
 *
 * Fonte ÚNICA da verdade pra "lead novo × recorrente × ativo" e pra diretiva de
 * abertura da conversa. Consumida por DOIS caminhos pra nunca mais divergirem:
 *   - monolith (index.ts): usa classifyLeadRecency p/ shouldGreet/isReturningLead
 *   - router (specialistBase.runSpecialist): injeta buildOpeningDirective no topo
 *     do system prompt de QUALQUER specialist que pegar o 1º contato.
 *
 * Motivação (auditoria 2026-05-24): sob routing_mode='router' o bloco determinístico
 * de saudação do monolith era PULADO (index.ts:1373), então:
 *   - a saudação configurada não era usada (LLM inventava genérica, sem citar a loja)
 *   - lead frio que abria com produto não era cumprimentado nem tinha o nome capturado
 *   - lead recorrente não era reconhecido se não dissesse "oi" puro
 * Esta política devolve esse comportamento DENTRO do pipeline novo, sem hardcode
 * espalhado: a regra mora aqui, os dois modos leem daqui.
 *
 * Decisões do contrato (aprovadas pelo dono 2026-05-24, P1-P9):
 *   P1 lead novo abre com produto → responde produto + pede nome na MESMA msg
 *   P2 recorrente → reconhece + retoma 1 fato da memória (vale até abrindo c/ produto)
 *   P3 textos do admin = guia de tom/intenção + SEMPRE citar o nome da loja
 *   P4 só "oi" → cumprimenta + cita loja + pede nome + convida, e espelha o cumprimento
 *   P5 nome dito em qualquer etapa → update_lead_profile na hora (qualquer specialist)
 *   P7 usar primeiro nome com parcimônia (máx 1x/msg)
 *   P9 sem saber novo/recorrente (sem nome) → trata como novo
 */

export type LeadRecency = 'novo' | 'recorrente' | 'ativo'

export interface RecencyInput {
  /** já interagiu nas últimas 24h (conversa "quente"/ativa) */
  hasInteracted: boolean
  /** já interagiu alguma vez (qualquer data) */
  hasEverInteracted: boolean
  /** nome confirmado do lead (lead_profiles.full_name), null se desconhecido */
  fullName?: string | null
}

/**
 * Classifica a recência do lead em uma de três categorias. Fonte única —
 * substitui os cálculos inline de `shouldGreet`/`isReturningLead` no monolith.
 *
 *   recorrente: tem nome confirmado + já interagiu antes + conversa esfriou (>24h)
 *   ativo:      está numa conversa em andamento (interagiu nas últimas 24h)
 *   novo:       primeiro contato (ou voltou sem nome conhecido → P9 trata como novo)
 */
export function classifyLeadRecency(input: RecencyInput): LeadRecency {
  const { hasInteracted, hasEverInteracted, fullName } = input
  const hasName = !!(fullName && fullName.trim())
  if (hasName && hasEverInteracted && !hasInteracted) return 'recorrente'
  if (hasInteracted) return 'ativo'
  return 'novo'
}

export interface OpeningDirectiveInput {
  recency: LeadRecency
  /** nome do agente/persona (ex.: "Eletropiso") */
  agentName?: string | null
  /** nome da loja/negócio a citar SEMPRE na abertura (P3). Default = agentName. */
  businessName?: string | null
  /** primeiro nome do lead recorrente (já conhecido); null se desconhecido */
  leadName?: string | null
  /**
   * Quando true, a saudação do 1º contato JÁ é feita por fora (bloco determinístico
   * do index.ts — decisão A). Aí a diretiva NÃO injeta o cumprimento (evita saudação
   * dupla) e emite apenas a regra de REGISTRO DO NOME (P5), que vale em qualquer etapa.
   */
  greetingHandledExternally?: boolean
}

/**
 * Monta a DIRETIVA DE ABERTURA injetada no topo do system prompt do specialist.
 * Retorna null quando não há nada a injetar (conversa ativa com nome conhecido).
 *
 * É aditiva e curta: instrui o specialist a ABRIR a conversa corretamente ANTES
 * (ou junto) de fazer seu trabalho normal. Como vive no specialistBase, vale pra
 * TODOS os specialists (produto, qualificação, etc.) sem copiar regra em cada um.
 */
export function buildOpeningDirective(input: OpeningDirectiveInput): string | null {
  const { recency, agentName, leadName } = input
  const loja = (input.businessName || agentName || 'a loja').trim()
  const parts: string[] = []

  // Decisão A (2026-05-24): saudação do 1º contato é determinística (index.ts). Aqui
  // só emitimos a regra de registro do nome (P5) — sem cumprimento, pra não duplicar.
  if (input.greetingHandledExternally) {
    if (!leadName) {
      return `[REGISTRO DO NOME] Assim que o lead disser o nome dele (e/ou a cidade) em qualquer momento, chame update_lead_profile com full_name (e city, se disser) NO MESMO TURNO, além de responder. É isso que faz o sistema lembrar dele depois — não dependa só de escrever o nome na resposta.`
    }
    return null
  }

  if (recency === 'novo') {
    parts.push(
      `⚠️ OBRIGATÓRIO NESTE TURNO — É O PRIMEIRO CONTATO. Esta instrução SOBREPÕE o fluxo descrito acima.
Sua resposta DEVE, numa ÚNICA mensagem e nesta ordem:
1) Cumprimentar com calor citando a loja "${loja}" (se o lead disse "bom dia/boa tarde/boa noite", ESPELHE: comece com o mesmo cumprimento).
2) Perguntar com quem você fala (pedir o nome de forma leve).
3) SÓ ENTÃO fazer seu trabalho normal (responder / buscar o produto que o lead pediu).
NUNCA pule os passos 1 e 2 — mesmo que o lead já tenha perguntado de um produto, o cumprimento + pedido do nome vêm primeiro, na MESMA mensagem (não mande mensagens separadas pra isso).
Exemplo: lead "vcs têm tinta branca?" → "Oi! Bem-vindo à ${loja} 😊 Com quem eu falo? Sobre tinta branca, te mostro as opções 👇". Depois siga seu fluxo (ex.: buscar/mostrar produto).
1 fôlego só — não despeje várias perguntas.`,
    )
  } else if (recency === 'recorrente') {
    const nome = (leadName && leadName.trim()) || null
    parts.push(
      `[ABERTURA — LEAD QUE VOLTOU${nome ? `: ${nome}` : ''}]
Você JÁ conhece este lead. NÃO peça o nome de novo.
- Cumprimente${nome ? ` pelo primeiro nome ("Oi ${nome}!")` : ''} com calor, deixando claro que é bom revê-lo, e cite "${loja}" de forma natural.
- Se houver "MEMÓRIA DO LEAD" acima, referencie UM fato relevante pra RETOMAR de onde parou (ex.: "você estava vendo [interesse], quer continuar?"). Escolha o mais útil — não recite tudo que sabe.
- Use o primeiro nome com parcimônia (no máximo 1x por mensagem).`,
    )
  }

  // P5: registrar o nome (e cidade) em QUALQUER etapa/specialist, sempre que o
  // lead informar e ainda não soubermos. Vale inclusive em conversa já em andamento.
  if (!leadName) {
    parts.push(
      `[REGISTRO DO NOME] Assim que o lead disser o nome dele (e/ou a cidade) em qualquer momento, chame update_lead_profile com full_name (e city, se disser) NO MESMO TURNO, além de responder. É isso que faz o sistema lembrar dele depois — não dependa só de escrever o nome na resposta.`,
    )
  }

  return parts.length ? parts.join('\n\n') : null
}
