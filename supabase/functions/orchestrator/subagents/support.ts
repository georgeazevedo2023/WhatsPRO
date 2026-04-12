// =============================================================================
// Support Subagent (S8)
// Busca knowledge_base via ILIKE + word overlap scoring (sem pgvector).
// 3 faixas de confiança:
//   >= high (0.80) → resposta direta do content (0 tokens LLM)
//   >= medium (0.50) → LLM formula resposta usando knowledge como contexto
//   < medium → handoff humano
//
// Regras:
//   - Usa ai_agent_knowledge (type=faq|document) filtrado por agent_id
//   - NUNCA inventa resposta — se não tem knowledge, faz handoff
//   - Track unanswered_count no step_data
// =============================================================================

import { createServiceClient } from '../../_shared/supabaseClient.ts'
import { callLLM } from '../../_shared/llmProvider.ts'
import type { SubagentResult, SubagentInput, SupportConfig } from '../types.ts'

const supabase = createServiceClient()

// ── Tipos internos ──────────────────────────────────────────────────────────

interface KnowledgeItem {
  id: string
  type: string      // 'faq' | 'document'
  title: string
  content: string
  score: number      // 0.0-1.0 calculado por word overlap
}

// ── Handler principal ───────────────────────────────────────────────────────

export async function supportSubagent(
  input: SubagentInput<SupportConfig>,
): Promise<SubagentResult> {
  const { context, config } = input
  const { flow_state, agent_config } = context
  const messageText = context.input.message_text ?? ''
  const stepData = flow_state.step_data

  const agentId = agent_config?.agent_id
  if (!agentId) {
    console.error('[support] agent_id not found — cannot search knowledge')
    return { status: 'error', error: 'agent_id_not_found' }
  }

  const confidenceHigh = config.confidence_high ?? 0.80
  const confidenceMedium = config.confidence_medium ?? 0.50
  const maxUnanswered = config.max_unanswered ?? 2
  const enableLLM = config.enable_llm_formulation !== false

  const unansweredCount = (stepData.unanswered_count as number) ?? 0

  // ── Check exit rules: max_messages ──────────────────────────────────────
  const msgCount = (stepData.message_count ?? 0) + 1
  for (const rule of context.exit_rules) {
    if (rule.trigger === 'max_messages' && typeof rule.value === 'number' && msgCount >= rule.value) {
      return {
        status: rule.action === 'next_step' ? 'advance' : 'handoff',
        response_text: rule.message ?? undefined,
        exit_rule_triggered: rule,
        step_data_patch: { last_subagent: 'support' },
      }
    }
  }

  // ── Busca knowledge_base ───────────────────────────────────────────────
  if (!messageText.trim()) {
    return { status: 'continue', step_data_patch: { last_subagent: 'support' } }
  }

  const matches = await searchKnowledge(agentId, messageText)
  const bestMatch = matches[0] ?? null

  // ── Roteamento por confiança ───────────────────────────────────────────

  // Alta confiança → resposta direta (0 tokens)
  if (bestMatch && bestMatch.score >= confidenceHigh) {
    console.log('[support] direct answer, score:', bestMatch.score.toFixed(2), '| title:', bestMatch.title)
    const answer = bestMatch.type === 'faq' ? bestMatch.content : bestMatch.content.substring(0, 500)

    return {
      status: 'continue',
      response_text: answer,
      step_data_patch: { last_subagent: 'support', unanswered_count: 0 },
    }
  }

  // Confiança média → LLM formula resposta com contexto do knowledge
  if (bestMatch && bestMatch.score >= confidenceMedium && enableLLM) {
    console.log('[support] LLM formulation, score:', bestMatch.score.toFixed(2))

    // Pega top 3 matches para dar contexto mais rico ao LLM
    const knowledgeContext = matches.slice(0, 3).map(m =>
      m.type === 'faq'
        ? `Pergunta: ${m.title}\nResposta: ${m.content}`
        : `Documento "${m.title}": ${m.content.substring(0, 300)}`
    ).join('\n\n')

    const personality = agent_config?.personality ?? 'amigável e prestativo'

    try {
      const llmResult = await callLLM({
        systemPrompt: [
          `Você é um assistente de suporte ${personality}.`,
          'Responda a pergunta do cliente usando APENAS as informações abaixo.',
          'NUNCA invente informações. Se a base não cobre, diga que vai verificar.',
          'Responda em português BR, máx 400 chars, direto e útil.',
          '',
          '--- Base de Conhecimento ---',
          knowledgeContext,
        ].join('\n'),
        messages: [{ role: 'user', content: messageText }],
        tools: [],
        temperature: 0.3,
        maxTokens: 250,
      })

      return {
        status: 'continue',
        response_text: llmResult.text || undefined,
        step_data_patch: { last_subagent: 'support', unanswered_count: 0 },
      }
    } catch (err) {
      console.error('[support] LLM formulation error:', err)
      // Fallback: retorna o conteúdo direto
      return {
        status: 'continue',
        response_text: bestMatch.content.substring(0, 400),
        step_data_patch: { last_subagent: 'support', unanswered_count: 0 },
      }
    }
  }

  // Confiança baixa → incrementa unanswered, possivelmente handoff
  const newUnanswered = unansweredCount + 1
  console.log('[support] low confidence, unanswered:', newUnanswered, '/', maxUnanswered,
    bestMatch ? `best_score: ${bestMatch.score.toFixed(2)}` : 'no_match')

  if (newUnanswered >= maxUnanswered) {
    const handoffRule = context.exit_rules.find(r => r.trigger === 'unanswered')
    return {
      status: 'handoff',
      response_text: handoffRule?.message ?? 'Vou transferir para um atendente que pode ajudar melhor com essa questão.',
      exit_rule_triggered: handoffRule ?? { trigger: 'unanswered', action: 'handoff_human' },
      step_data_patch: { last_subagent: 'support', unanswered_count: newUnanswered },
    }
  }

  return {
    status: 'continue',
    response_text: 'Não encontrei uma resposta exata para isso. Poderia reformular a pergunta?',
    step_data_patch: { last_subagent: 'support', unanswered_count: newUnanswered },
  }
}

// ── Busca knowledge_base via ILIKE + word overlap scoring ────────────────────
// Sem pgvector — usa word overlap como proxy de similaridade.
// Score = (palavras matchadas / total palavras da query) * boost por tipo.

async function searchKnowledge(
  agentId: string,
  queryText: string,
): Promise<KnowledgeItem[]> {
  // Carrega todos os items do agente (limitado a 50 — knowledge_base geralmente é pequena)
  const { data: items } = await supabase
    .from('ai_agent_knowledge')
    .select('id, type, title, content')
    .eq('agent_id', agentId)
    .order('position')
    .limit(50)

  if (!items?.length) return []

  // Normaliza query
  const queryWords = normalizeText(queryText).split(/\s+/).filter(w => w.length > 2)
  if (queryWords.length === 0) return []

  // Score cada item por word overlap
  const scored: KnowledgeItem[] = items
    .filter(item => item.title && item.content)
    .map(item => {
      const haystack = normalizeText(`${item.title} ${item.content}`)

      // Conta quantas palavras da query aparecem no haystack
      let matchedWords = 0
      for (const word of queryWords) {
        if (haystack.includes(word)) matchedWords++
      }

      const baseScore = queryWords.length > 0 ? matchedWords / queryWords.length : 0

      // Boost: FAQ com match no título vale mais
      const titleNorm = normalizeText(item.title)
      const titleMatchCount = queryWords.filter(w => titleNorm.includes(w)).length
      const titleBoost = titleMatchCount >= 2 ? 0.15 : titleMatchCount === 1 ? 0.05 : 0

      // Boost: FAQ type vale mais que document
      const typeBoost = item.type === 'faq' ? 0.05 : 0

      const score = Math.min(1.0, baseScore + titleBoost + typeBoost)

      return {
        id: item.id,
        type: item.type,
        title: item.title,
        content: item.content,
        score,
      }
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, 5)
}

// ── Normalização de texto (remove acentos, lowercase, limpa) ────────────────

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // remove acentos
    .replace(/[^a-z0-9\s]/g, ' ')     // remove pontuação
    .replace(/\s+/g, ' ')
    .trim()
}
