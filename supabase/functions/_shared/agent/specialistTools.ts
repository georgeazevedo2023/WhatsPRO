/**
 * Sprint D (2026-05-24) — tool defs canônicas compartilhadas pelos specialists.
 *
 * Cópia 1:1 dos schemas do monolith (ai-agent/index.ts toolDefs) que mapeiam
 * direto pros handlers do executeToolSafe. Cada specialist escolhe seu SUBSET
 * mínimo (strict mode) — princípio "tool overload é sobre sobreposição, não
 * quantidade" (OpenAI Practical Guide). Reusar daqui evita drift entre o schema
 * que o LLM vê e o que o handler espera.
 *
 * NÃO inclui product tools (search/carousel/media) — essas ficam no
 * productSpecialist.ts (tuned/testadas). Aqui só as tools dos specialists novos:
 * set_tags, update_lead_profile, handoff_to_human, send_poll.
 */

import type { LLMToolDef } from '../llmProvider.ts'

export const setTagsToolDef: LLMToolDef = {
  name: 'set_tags',
  strict: true,
  description: 'Adiciona tags à conversa para rastrear interesses e informações. Tags são cumulativas. Formato: "chave:valor".',
  parameters: {
    type: 'object',
    properties: {
      tags: {
        type: 'array',
        description: 'Tags no formato "chave:valor" (ex: "motivo:compra", "interesse:tinta", "objecao:preco")',
        items: { type: 'string' },
      },
    },
    required: ['tags'],
  },
}

export const updateLeadProfileToolDef: LLMToolDef = {
  name: 'update_lead_profile',
  strict: true,
  description: 'Atualiza perfil do lead com informações coletadas. Use para salvar nome, cidade, interesses, motivo do contato e ticket médio. Campos não conhecidos devem ser null.',
  parameters: {
    type: 'object',
    properties: {
      full_name: { type: ['string', 'null'], description: 'Nome completo do lead. null se não souber.' },
      city: { type: ['string', 'null'], description: 'Cidade do lead. null se não souber.' },
      interests: { type: ['array', 'null'], description: 'Interesses do lead. null se não souber.', items: { type: 'string' } },
      notes: { type: ['string', 'null'], description: 'Observações adicionais. null se não houver.' },
      reason: { type: ['string', 'null'], description: 'Motivo do contato (ex: compra, orçamento, dúvida, suporte). null se não souber.' },
      average_ticket: { type: ['number', 'null'], description: 'Valor estimado do ticket/orçamento em reais. null se não souber.' },
      objections: { type: ['array', 'null'], description: 'Objeções do lead. null se nenhuma identificada.', items: { type: 'string' } },
    },
    required: ['full_name', 'city', 'interests', 'notes', 'reason', 'average_ticket', 'objections'],
  },
}

export const handoffToHumanToolDef: LLMToolDef = {
  name: 'handoff_to_human',
  strict: true,
  description: 'Transfere a conversa para um atendente humano. Use quando lead pedir vendedor, confirmar pedido completo, ou quando detectar frustração/objeção que você não conseguiu resolver. SEMPRE inclua no reason um resumo dos dados coletados (produto, nome, cidade, interesses, objeções).',
  parameters: {
    type: 'object',
    properties: {
      reason: { type: 'string', description: 'Motivo do transbordo com resumo dos dados coletados (produto, nome, cidade, interesses, objeções)' },
    },
    required: ['reason'],
  },
}

export const sendPollToolDef: LLMToolDef = {
  name: 'send_poll',
  strict: true,
  description: 'Envia enquete nativa do WhatsApp com opcoes clicaveis. Use para perguntas com respostas predefinidas. NUNCA numere as opcoes — use nomes descritivos.',
  parameters: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'Pergunta da enquete (max 255 caracteres)' },
      options: { type: 'array', description: 'Opcoes de resposta (2-12 items, nomes limpos, max 100 chars cada)', items: { type: 'string' } },
      selectable_count: { type: ['number', 'null'], description: '1 para escolha unica, 0 para multipla escolha. Default 1. null = 1.' },
    },
    required: ['question', 'options', 'selectable_count'],
  },
}
