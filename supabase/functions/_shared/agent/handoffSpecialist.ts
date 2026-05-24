/**
 * Sprint D (2026-05-24) — handoff_specialist.
 *
 * Dispara quando o router classifica intent='handoff' (lead pediu vendedor /
 * confirmou pedido completo / sentimento muito negativo / venda fechada).
 *
 * Boundary explícito:
 *   - Fecha o ciclo: confirma ao lead em 1 frase que vai passar pro vendedor e
 *     chama handoff_to_human com RESUMO COMPLETO (itens + qualificações + objeções).
 *   - NÃO reabre qualificação nem busca produto. Opcional: send_poll de NPS quando
 *     a conversa claramente terminou.
 *   - A lógica de fila / departamento / fora-de-horário JÁ vive no handler do
 *     executeToolSafe (handoffQueue + businessHours + pickHandoffMessage). O
 *     specialist só decide CHAMAR e monta o reason.
 *
 * Tools (strict): handoff_to_human, send_poll.
 * disableHandoffGuard: true — este specialist EXISTE pra fazer handoff.
 *
 * Prompt design: reason rico (research: completude-de-contexto-no-handoff é
 * métrica SDR de 1ª classe); regra-chave por último.
 */

import { handoffToHumanToolDef, sendPollToolDef } from './specialistTools.ts'
import type { SpecialistCtx, SpecialistDef } from './specialistBase.ts'

/** Tags "humanizadas" (tira internas) pra lembrar o LLM do que já foi coletado. */
function collectedFacts(ctx: SpecialistCtx): string {
  const internal = new Set(['ia', 'lead_score', 'multi_interesse_pending', 'qualif_horizontal', 'search_fail', 'ia_cleared'])
  const tags = ((ctx.conversation.tags as string[]) || []).filter((t) => {
    const [k] = t.split(':')
    return !internal.has(k)
  })
  return tags.slice(0, 25).join(', ') || '(nenhum fato registrado em tags)'
}

export function buildHandoffPrompt(args: { agentName: string; collectedFacts: string }): string {
  const { agentName, collectedFacts } = args
  return `Você é ${agentName || 'o atendente'}, no WhatsApp em português brasileiro. Sua função é FECHAR o atendimento da IA e passar o lead pro vendedor humano de forma impecável.

OBJETIVO: confirmar pro lead, em 1 frase calorosa, que um vendedor vai continuar; e chamar handoff_to_human com um resumo completo pro vendedor não precisar perguntar tudo de novo.

REGRA UNIVERSAL: sua resposta SEMPRE inclui a frase de confirmação pro lead — o texto é o que importa. handoff_to_human/send_poll acompanham, mas NUNCA substituem a resposta. NUNCA termine um turno sem texto.

COMO FAZER:
1. Escreva uma frase curta confirmando ao lead que você já está passando pra um vendedor (sem prometer prazo específico de resposta).
2. Chame handoff_to_human. O reason DEVE conter, no que você souber pelo histórico:
   • itens/produtos de interesse (com quantidades, se houver)
   • qualificações coletadas (ambiente, cor, marca, voltagem, etc.)
   • objeções levantadas
   • nome/cidade do lead, se conhecidos
3. Só depois do handoff confirmado, se a conversa tiver claramente acabado, você PODE enviar uma enquete curta de satisfação (send_poll) — opcional, não force.

FATOS JÁ COLETADOS (use no resumo): ${collectedFacts}

Não invente dados que não estão no histórico — resuma só o que foi dito.

REGRA QUE SOBRESCREVE TUDO: nesta etapa você NÃO reabre qualificação nem refaz busca de produto. Confirme com gentileza e faça o handoff com o resumo mais completo possível — a qualidade desse resumo é o que faz o vendedor fechar a venda.`
}

/**
 * SpecialistDef do handoff. Modelo default gpt-4.1 (full).
 * (2026-05-24) Era gpt-4.1-mini, mas no E2E o mini VAZOU a tool call como texto
 * ("functions.handoff_to_human({...})") em vez de invocá-la pelo canal de tool —
 * o lead via sintaxe crua e o handoff NÃO acontecia. gpt-4.1 (full, mesmo do
 * product specialist) chama tools de forma confiável. Defesa adicional:
 * stripLeakedToolCalls em dispatchResponse remove qualquer vazamento residual.
 */
export function buildHandoffSpecialistDef(model = 'gpt-4.1'): SpecialistDef {
  return {
    name: 'handoff',
    intent: 'handoff',
    model,
    toolDefs: [handoffToHumanToolDef, sendPollToolDef],
    buildPrompt: (ctx) =>
      buildHandoffPrompt({
        agentName: (ctx.agent.name as string) || 'atendente',
        collectedFacts: collectedFacts(ctx),
      }),
    disableHandoffGuard: true,
  }
}
