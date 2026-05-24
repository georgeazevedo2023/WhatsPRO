/**
 * Sprint D (2026-05-24) — objection_specialist.
 *
 * Dispara quando o router classifica intent='objecao' OU 'pagamento'.
 * (pagamento cai aqui porque este specialist carrega business_info com preço/
 * formas de pagamento — decisão de design Sprint D, endossada por "agent-per-intent".)
 *
 * Boundary explícito:
 *   - Trata objeção (preço/prazo/qualidade/concorrente) com EMPATIA primeiro,
 *     depois ancora valor. Responde dúvidas de pagamento (pix/parcelar/boleto)
 *     a partir do business_info.
 *   - NÃO qualifica do zero, NÃO busca catálogo. Mantém o pedido aberto.
 *   - 2+ objeções não resolvidas OU lead pede vendedor → handoff_to_human com resumo.
 *
 * Tools (strict): set_tags (objecao:tipo), update_lead_profile, handoff_to_human.
 * disableHandoffGuard: true — controla o handoff via prompt (não é o guard do monolith).
 *
 * Prompt design (pesquisa 2026 — Feel-Felt-Found / value-anchoring):
 *   validar concern → prova social/empatia → reancorar no resultado/valor.
 *   NUNCA oferecer desconto por conta própria (política). Regra-chave por último.
 */

import { setTagsToolDef, updateLeadProfileToolDef, handoffToHumanToolDef } from './specialistTools.ts'
import type { SpecialistCtx, SpecialistDef } from './specialistBase.ts'

/** Conta objeções já registradas nas tags (objecao:*). 2+ → tende a handoff. */
function priorObjectionCount(ctx: SpecialistCtx): number {
  const tags = (ctx.conversation.tags as string[]) || []
  return tags.filter((t) => typeof t === 'string' && t.startsWith('objecao:')).length
}

export function buildObjectionPrompt(args: {
  agentName: string
  businessInfo?: any
  priorObjections: number
}): string {
  const { agentName, businessInfo, priorObjections } = args
  const businessLine = businessInfo
    ? (typeof businessInfo === 'string' ? businessInfo : JSON.stringify(businessInfo)).substring(0, 600)
    : '(informações de negócio não cadastradas — não invente preços nem condições)'

  const escalateHint = priorObjections >= 1
    ? `\n⚠️ O lead já levantou ${priorObjections} objeção(ões) antes. Se ele insistir nesta, NÃO fique em loop: chame handoff_to_human com um resumo (item cotado + objeção + tudo que já coletou) pra um vendedor fechar.`
    : ''

  return `Você é ${agentName || 'o consultor'}, atendendo no WhatsApp em português brasileiro. Sua especialidade é CONTORNAR OBJEÇÕES e responder dúvidas de pagamento, mantendo o lead avançando na compra. Texto curto e empático (1-3 frases, tom WhatsApp).

REGRA UNIVERSAL: sua resposta SEMPRE inclui uma frase de texto empática pro lead — o texto é o que importa. set_tags/handoff são secundárias e NUNCA substituem a resposta. Se uma tool falhar ou for rejeitada, ignore e responda o lead mesmo assim. NUNCA termine um turno sem texto.

COMO TRATAR UMA OBJEÇÃO (preço / prazo / qualidade / "no concorrente é mais barato"):
1. VALIDE o sentimento primeiro, com sinceridade ("entendo, faz sentido se preocupar com isso").
2. REANCORE no valor: defenda qualidade, durabilidade, garantia, rendimento/cobertura — o que justifica o preço daquele item.
3. Se ajudar, lembre as formas de pagamento (do bloco NEGÓCIO abaixo). Mantenha o pedido aberto e pergunte se quer seguir.
Registre o tipo com set_tags(["objecao:preco"]) / "objecao:prazo" / "objecao:qualidade" / "objecao:concorrente".

DÚVIDA DE PAGAMENTO (pix, parcelar, boleto, desconto):
- Responda com base no bloco NEGÓCIO. Se não estiver lá, diga que confirma com o vendedor — NÃO invente condição.
- NUNCA ofereça desconto por conta própria; isso é decisão do vendedor humano.

Se faltar informação pra responder com segurança, diga que vai confirmar e, se for o caso, passe pro vendedor — NUNCA invente preço, prazo ou condição.${escalateHint}

NEGÓCIO (preços/condições/pagamento):
${businessLine}

REGRA QUE SOBRESCREVE TUDO: empatia SEMPRE vem antes de qualquer argumento. Nunca rebata a objeção com uma pergunta de qualificação seca ("interno ou externo?") — primeiro acolha, depois defenda o valor. Se o lead pedir explicitamente um vendedor ou a objeção não ceder, chame handoff_to_human com resumo completo.`
}

/** SpecialistDef do objection. Modelo default gpt-4.1 (conversa consultiva). */
export function buildObjectionSpecialistDef(model = 'gpt-4.1'): SpecialistDef {
  return {
    name: 'objection',
    intent: 'objecao',
    model,
    toolDefs: [setTagsToolDef, updateLeadProfileToolDef, handoffToHumanToolDef],
    buildPrompt: (ctx) =>
      buildObjectionPrompt({
        agentName: (ctx.agent.name as string) || 'consultor',
        businessInfo: ctx.agent.business_info,
        priorObjections: priorObjectionCount(ctx),
      }),
    // controla fechamento/handoff via prompt; handoffGuard é proteção do monolith.
    disableHandoffGuard: true,
  }
}
