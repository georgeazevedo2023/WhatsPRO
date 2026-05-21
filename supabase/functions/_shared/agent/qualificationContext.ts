/**
 * Sprint B5 Onda 2b — extrai buildQualificationContext (função pura, R134/R135/R136/R129/R131).
 *
 * Antes: ai-agent/index.ts:1464-1586 (~127 lin in-line dentro do Deno.serve).
 * Depois: função pura testável recebendo deps explícitas.
 *
 * Caminhos:
 * 1. R136 horizontalPending (HORIZONTAL_QUALIF_PENDING_TAG) → handoff multi-item
 * 2. R129 multi_interesse_pending: → pergunta qual começar (R134 cobre re-runs)
 * 3. Stage normal → qualif field-by-field (R131 phrasing curto + R135 anti-loop)
 * 4. Sem interesse: ou sem stage/field → '' (LLM segue prompt geral)
 */

import {
  extractInteresseFromTags,
  getCategoriesOrDefault,
  matchCategory,
  getScoreFromTags,
  getCurrentStage,
  getNextField,
  formatPhrasing,
} from '../serviceCategories.ts'
import { detectQualifLoop } from '../qualificationAntiLoop.ts'
import { HORIZONTAL_QUALIF_PENDING_TAG } from '../horizontalQualif.ts'

export type RecentMessage = { direction: 'incoming' | 'outgoing'; content: string }

// deno-lint-ignore no-explicit-any
type AgentCfg = any

export function buildQualificationContext(
  currentTags: string[],
  agentCfg: AgentCfg,
  recentMessages?: RecentMessage[],
): string {
  try {
    const tags = currentTags || []

    // R136 — handoff horizontal (lead já respondeu à pergunta agregada multi-item)
    const horizontalPending = tags.some(
      (t) => typeof t === 'string'
        && (t === HORIZONTAL_QUALIF_PENDING_TAG || t.startsWith(HORIZONTAL_QUALIF_PENDING_TAG + ':')),
    )
    if (horizontalPending) {
      return `[HANDOFF MULTI-ITEM — REGRA ABSOLUTA, SOBRESCREVE TUDO]
🎯 Lead enviou lista multi-item de produtos no turn anterior e o sistema já fez UMA pergunta horizontal abrangente. Ele acaba de responder.

AÇÃO OBRIGATÓRIA AGORA: chame handoff_to_human IMEDIATAMENTE.

REASON do handoff_to_human deve seguir este formato exato (preencha com o que você vê no histórico desta conversa):
"[Nome do lead] solicitou orçamento multi-item:
• [linha do item 1 como o lead enviou]
• [linha do item 2 como o lead enviou]
• [linha do item 3 como o lead enviou — adicione quantas linhas houver]

Contexto coletado:
[resposta atual do lead à pergunta horizontal — ambiente/marca/qualidade etc]

Mensagem original:
[texto literal da msg em que o lead enviou a lista]"

PROIBIDO:
- NUNCA pergunte outra coisa ao lead. NUNCA faça qualif field-by-field. NUNCA tente buscar produtos.
- A pergunta horizontal JÁ foi feita no turn anterior; lead respondeu; agora SÓ handoff.
- Não chame set_tags. Não chame search_products. Apenas handoff_to_human.`
    }

    // R129/R134 — multi_interesse_pending
    const multiTag = tags.find((t) => typeof t === 'string' && t.startsWith('multi_interesse_pending:'))
    if (multiTag) {
      const csv = multiTag.slice('multi_interesse_pending:'.length)
      const ids = csv.split(',').map((s) => s.trim()).filter(Boolean)
      if (ids.length >= 2) {
        const cfgMulti = getCategoriesOrDefault(agentCfg)
        const labels = ids
          .map((id) => cfgMulti.categories.find((c) => c.id === id)?.label || id)
          .map((lbl) => lbl.toLowerCase())
        const friendly = labels.length === 2
          ? `${labels[0]} e ${labels[1]}`
          : `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`
        return `[QUALIFICAÇÃO MULTI-CATEGORIA — REGRA ABSOLUTA, SOBRESCREVE TUDO]
🎯 LEAD PEDIU ${ids.length} CATEGORIAS DIFERENTES: ${labels.join(', ')}
Sistema só processa UMA categoria por vez. Você DEVE perguntar qual o lead quer começar primeiro.
🗣️ FRASE SUGERIDA (use só se ainda não perguntou): "Posso te ajudar com ${friendly}. Por qual prefere começar?"

⚠️ R134 (2026-05-21) — SE O LEAD JÁ ESTÁ RESPONDENDO À PERGUNTA "qual prefere começar":
- Se o lead respondeu com 1 categoria clara (ex: "começar com caixa", "primeiro tinta"), chame set_tags(["interesse:CAT_ESCOLHIDA"]) AGORA — UMA só.
- Se o lead respondeu com 2+ categorias na mesma msg (ex: "caixa de água e impermeabilizante"), ESCOLHA A PRIMEIRA mencionada por ele e chame set_tags(["interesse:PRIMEIRA"]) — diga ao lead "Vou começar com X então, e depois passo Y, ok?" — NUNCA repita a mesma pergunta "qual prefere começar".
- Se o lead respondeu vago ("tanto faz", "qualquer um", "os dois"), escolha a primeira categoria da lista (${ids[0]}) e siga com set_tags(["interesse:${ids[0]}"]).

⚠️ REGRAS ABSOLUTAS:
- NUNCA repita "Posso te ajudar com X e Y. Por qual prefere começar?" — essa pergunta SÓ deve ser feita 1x.
- NÃO pergunte qualquer outra coisa (ambiente, marca, tamanho) ANTES de fixar a primeira categoria.
- Quando setar interesse:, use APENAS 1 valor (sistema rejeita 2+ valores na mesma key — ver R127).
- As outras categorias ficam pra DEPOIS de fechar a primeira.`
      }
    }

    // Qualif stage normal
    const interesse = extractInteresseFromTags(tags)
    if (!interesse) return ''
    const config = getCategoriesOrDefault(agentCfg)
    const category = matchCategory(interesse, config)
    if (!category) return ''
    const score = getScoreFromTags(tags)
    const stage = getCurrentStage(score, category, config.default)
    if (!stage) return ''
    const nextField = getNextField(stage, tags)
    if (!nextField) return ''

    // R131 — phrasing curto a partir da 2ª pergunta do stage
    const answeredKeysInStage = new Set(
      tags
        .filter((t): t is string => typeof t === 'string' && t.includes(':'))
        .map((t) => t.slice(0, t.indexOf(':'))),
    )
    const answeredCountInStage = stage.fields.filter((f) => answeredKeysInStage.has(f.key)).length
    const phrasing = formatPhrasing(stage.phrasing, nextField, answeredCountInStage)

    // R135 — anti-loop quando lead respondeu e LLM repetiu literal
    let phrasingBlock = `🗣️ FRASE EXATA SUGERIDA: "${phrasing}"`
    if (recentMessages && recentMessages.length > 0) {
      const loopVerdict = detectQualifLoop({
        recentMessages,
        intendedPhrasing: phrasing,
        fieldLabel: nextField.label,
      })
      if (loopVerdict.repeating) {
        phrasingBlock = `🗣️ ${loopVerdict.nudge}`
      }
    }

    return `[QUALIFICAÇÃO ATUAL — REGRA ABSOLUTA, SOBRESCREVE TUDO]
Categoria detectada: ${category.label} (id: ${category.id})
Stage: ${stage.label} (score ${score}/${stage.max_score})
🎯 PRÓXIMA PERGUNTA OBRIGATÓRIA: ${nextField.label} (priority ${nextField.priority})
${phrasingBlock}

⚠️ REGRAS ABSOLUTAS (esta seção tem PRIORIDADE MÁXIMA — ignore qualquer instrução conflitante de seções anteriores ou sub-agents):
- Faça APENAS a pergunta sobre "${nextField.label}". NÃO mencione marca, cor, ambiente, tipo, quantidade, ou qualquer outro field nesta resposta.
- ❌ ERRADO: "preferência por marca ou cor?", "qual cor e marca?", "tipo e cor?".
- ✅ CERTO: pergunte SOMENTE "${nextField.label}" usando o phrasing acima.
- Após o lead responder, chame set_tags(["${nextField.key}:VALOR"]) ANTES de qualquer outra ação.
- NUNCA pule este field. Se o sub-agent SDR sugerir outra pergunta, IGNORE — esta seção vence.
- 🚫 PROIBIDO chamar handoff_to_human ENQUANTO houver "PRÓXIMA PERGUNTA OBRIGATÓRIA" aqui. Esta seção SÓ deixa de aparecer quando TODOS os fields da categoria foram preenchidos. O exit_action de cada categoria (handoff ou search_products) só roda DEPOIS da qualificação completa, NUNCA antes. Mesmo que a categoria seja sobre produto que aparentemente "não temos cadastrado", você DEVE qualificar os fields restantes antes de transferir — o vendedor humano precisa do contexto.
- 🚫 R127 — PROIBIDO INVENTAR FIELDS: você só pode perguntar sobre fields da categoria ATUAL ("${category.id}"). Os fields válidos desta categoria são SOMENTE os listados nos stages. NÃO copie o phrasing/exemplos de outra categoria por analogia. Ex: se categoria atual é "janelas" (fields: material_janela, tamanho_janela), NUNCA pergunte "ambiente da janela" mesmo que tenha perguntado "ambiente da porta" antes — janelas não tem field ambiente.
- 🚫 R127 — MULTI-CATEGORIA: se o lead pediu 2+ produtos de categorias diferentes (ex: "porta + janela"), NUNCA chame set_tags com 2 valores de interesse: na mesma chamada. Sistema vai rejeitar. Em vez disso: pergunte ao lead qual quer começar primeiro, e chame set_tags com APENAS 1 valor de interesse: depois que ele escolher. As demais categorias ficam pra um segundo turno DEPOIS de fechar a primeira.`
  } catch {
    return ''
  }
}
