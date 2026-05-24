/**
 * Sprint D (2026-05-24) — greeting_specialist.
 *
 * Dispara quando o router classifica intent='saudacao' OU 'fora_escopo'.
 * Substitui o handler hardcoded de saudação do monolith (index.ts ~1465).
 *
 * Responsabilidades (boundary explícito — MAST anti-misalignment):
 *   - Cumprimentar / capturar nome / reconhecer lead que volta.
 *   - fora_escopo: redirecionar educadamente pra vendas. NÃO inventa resposta
 *     de assunto fora do negócio.
 *   - NUNCA qualifica produto, NUNCA busca catálogo, NUNCA faz handoff. Se o lead
 *     já trouxe um produto, o router teria mandado pra outro specialist — aqui só
 *     cumprimenta e devolve a bola.
 *
 * Tools (strict, mínimas): set_tags (lead_name:), update_lead_profile (full_name).
 *
 * Prompt design (pesquisa 2026 OpenAI/Anthropic):
 *   - instrução positiva + o "porquê" (não "NUNCA repita saudação")
 *   - exemplos few-shot wrapped, cada comportamento também vira regra
 *   - regra mais importante POR ÚLTIMO (resolução de conflito GPT-4.1/5)
 */

import { setTagsToolDef, updateLeadProfileToolDef } from './specialistTools.ts'
import type { SpecialistCtx, SpecialistDef } from './specialistBase.ts'

/** Extrai nome conhecido do lead das tags (lead_name:) ou do leadProfile. */
function knownLeadName(ctx: SpecialistCtx): string | null {
  const tags = (ctx.conversation.tags as string[]) || []
  const tag = tags.find((t) => typeof t === 'string' && t.startsWith('lead_name:'))
  if (tag) {
    const v = tag.slice('lead_name:'.length).trim()
    if (v) return v
  }
  const fromProfile = ctx.leadProfile?.full_name || ctx.profileData?.full_name
  return (typeof fromProfile === 'string' && fromProfile.trim()) ? fromProfile.trim() : null
}

export function buildGreetingPrompt(args: { agentName: string; businessName?: string; leadName?: string | null }): string {
  const { agentName, businessName, leadName } = args
  const nameLine = leadName
    ? `O lead já é conhecido: ${leadName}. Cumprimente pelo nome (sem pedir o nome de novo).`
    : `O lead ainda não disse o nome. Cumprimente e, na MESMA mensagem, pergunte com quem você fala (peça o nome de forma leve).`

  return `Você é ${agentName || 'o atendente'}${businessName ? ` da ${businessName}` : ''}, atendendo no WhatsApp em português brasileiro. Você cuida da ABERTURA da conversa.

OBJETIVO: receber bem o lead e dar o primeiro passo da conversa. Texto curto e caloroso (1-2 frases, tom WhatsApp).

${nameLine}

FLUXO:
1. Saudação pura ("oi", "bom dia", "tudo bem?") → ESPELHE a saudação do lead (se ele disse "bom dia", comece com "Bom dia!") de forma calorosa e, em seguida, pergunte com quem fala / o que ele procura. Pare aí — não despeje perguntas.
2. Lead disse o nome → agradeça usando o nome e pergunte como pode ajudar.
3. Pergunta fora do escopo do negócio (assunto que a loja não trata) → seja gentil, diga em 1 frase que aqui você ajuda com [tema do negócio] e pergunte se ele precisa de algo nessa linha. NÃO responda o assunto fora do escopo nem invente informação.

PERSISTÊNCIA DO NOME (obrigatório): sempre que o lead disser o nome dele (ex.: "meu nome é João", "sou a Ana", "aqui é o Pedro"), chame update_lead_profile com full_name preenchido (os demais campos null) NO MESMO TURNO, além de responder. Isso é o que faz o sistema lembrar dele depois. Não dependa só de escrever o nome na resposta.

VARIE a formulação da abertura entre conversas — repetir sempre a mesma frase soa robótico. Use o nome do lead no máximo 1x por mensagem; é WhatsApp, mensagens enxutas parecem mais humanas.

Se faltar informação pra registrar algo (ex.: nome ainda não dito), apenas pergunte — NUNCA invente valor numa tool.

<exemplos>
[lead] oi, bom dia
[você] Bom dia! 😊 Seja bem-vindo. Com quem eu falo? E me conta o que você está procurando.

[lead] meu nome é Marcos
[você] Prazer, Marcos! Me conta o que você está procurando que eu te ajudo.  → AÇÃO: update_lead_profile(full_name="Marcos", demais campos null)

[lead] vocês fazem entrega de pizza?
[você] Opa! Aqui na loja eu ajudo com [linha do negócio]. Posso te ajudar com algo nessa área?
</exemplos>

REGRA QUE SOBRESCREVE TUDO: nesta etapa você SÓ abre a conversa e registra o nome quando souber. Não qualifique produto, não busque catálogo, não acione vendedor. Assim que o lead disser o que procura, o próprio sistema leva pro especialista certo.`
}

/** SpecialistDef do greeting. Modelo default gpt-4.1-mini (tarefa leve, latência baixa). */
export function buildGreetingSpecialistDef(model = 'gpt-4.1-mini'): SpecialistDef {
  return {
    name: 'greeting',
    intent: 'saudacao',
    model,
    toolDefs: [setTagsToolDef, updateLeadProfileToolDef],
    buildPrompt: (ctx) =>
      buildGreetingPrompt({
        agentName: (ctx.agent.name as string) || 'atendente',
        businessName: (ctx.agent.business_name as string) || undefined,
        leadName: knownLeadName(ctx),
      }),
    // greeting não chama handoff_to_human; guard é irrelevante.
    disableHandoffGuard: false,
  }
}
