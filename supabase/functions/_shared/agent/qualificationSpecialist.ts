/**
 * Sprint D (2026-05-24) — qualification_specialist.
 *
 * Dispara quando o router classifica intent='qualificacao' (lead respondeu um
 * campo perguntado pelo bot, ou pediu produto sem detalhes que precisam de mais
 * descoberta antes da busca).
 *
 * Boundary explícito (MAST anti-misalignment):
 *   - Faz UMA pergunta de descoberta por vez (estilo SPIN), registra a resposta.
 *   - NÃO busca catálogo (isso é do product), NÃO trata objeção (isso é do
 *     objection), NÃO faz handoff. Quando o lead já deu o suficiente, o router
 *     no próximo turno manda pro product.
 *
 * Reusa buildQualificationContext (Sprint B5) — a MESMA lógica determinística
 * (R131 phrasing curto, R135 anti-loop, R134 idempotência) que o monolith usava.
 * O specialist recebe a "PRÓXIMA PERGUNTA OBRIGATÓRIA" computada e a formula
 * naturalmente.
 *
 * Tools (strict): set_tags, update_lead_profile.
 *
 * Prompt design: escape hatch anti-arg-inventado (mata Bug 12 — LLM cravava
 * interesse:valor fora dos IDs); 1 pergunta por turno; regra-chave por último.
 */

import { setTagsToolDef, updateLeadProfileToolDef } from './specialistTools.ts'
import { buildQualificationContext, type RecentMessage } from './qualificationContext.ts'
import type { SpecialistCtx, SpecialistDef } from './specialistBase.ts'

/** Converte geminiContents (role/parts) em RecentMessage[] pro buildQualificationContext. */
function recentFromGemini(geminiContents: any[]): RecentMessage[] {
  return (geminiContents || [])
    .slice(-8)
    .map((c) => ({
      direction: (c.role === 'model' ? 'outgoing' : 'incoming') as 'incoming' | 'outgoing',
      content: (c.parts?.[0]?.text || '').toString(),
    }))
    .filter((m) => m.content.trim().length > 0)
}

export function buildQualificationPrompt(args: {
  agentName: string
  qualificationContext: string
}): string {
  const { agentName, qualificationContext } = args

  const ctxBlock = qualificationContext && qualificationContext.trim()
    ? qualificationContext.trim()
    : '(sem pergunta obrigatória computada — faça UMA pergunta de descoberta natural sobre o que o lead precisa)'

  return `Você é ${agentName || 'o consultor'}, fazendo a DESCOBERTA (qualificação) de um lead no WhatsApp, em português brasileiro.

OBJETIVO: entender o que o lead precisa coletando os campos que faltam, UMA pergunta por vez. Texto curto e natural (1 frase de pergunta, tom WhatsApp). Acolha brevemente a resposta anterior antes de perguntar o próximo.

REGRA UNIVERSAL: sua resposta SEMPRE inclui uma frase de texto pro lead — o texto é o que importa. set_tags/update_lead_profile são secundárias e NUNCA substituem a resposta. Se uma tool falhar ou for rejeitada, ignore e responda o lead mesmo assim. NUNCA termine um turno sem texto.

COMO QUALIFICAR (estilo SPIN — uma coisa de cada vez):
- Faça SÓ UMA pergunta por mensagem. Nunca empilhe 2-3 perguntas.
- Acompanhe o que o sistema computou abaixo como próximo passo e formule a pergunta com suas palavras (não cite a regra, soe humano).
- Quando o lead responder, registre o valor com set_tags no formato "chave:valor" (ex.: "ambiente:interno", "cor:branco"). Use update_lead_profile pra nome/cidade/interesses.

Se você não tiver certeza da categoria/valor exato, PERGUNTE ao lead — NUNCA invente um valor nem chame uma tool com argumento adivinhado. Um valor errado quebra a busca depois.

CONTEXTO DETERMINÍSTICO (próximo passo computado pelo sistema):
${ctxBlock}

REGRA QUE SOBRESCREVE TUDO: você SÓ qualifica. Não busque produto, não cote preço, não trate objeção e não acione vendedor — quando houver dados suficientes, o sistema leva o lead pro especialista de produto automaticamente.`
}

/** SpecialistDef do qualification. Modelo default gpt-4.1 (qualidade de conversa). */
export function buildQualificationSpecialistDef(model = 'gpt-4.1'): SpecialistDef {
  return {
    name: 'qualification',
    intent: 'qualificacao',
    model,
    toolDefs: [setTagsToolDef, updateLeadProfileToolDef],
    buildPrompt: (ctx) =>
      buildQualificationPrompt({
        agentName: (ctx.agent.name as string) || 'consultor',
        qualificationContext: buildQualificationContext(
          (ctx.conversation.tags as string[]) || [],
          ctx.agent,
          recentFromGemini(ctx.geminiContents),
        ),
      }),
    disableHandoffGuard: false,
  }
}
