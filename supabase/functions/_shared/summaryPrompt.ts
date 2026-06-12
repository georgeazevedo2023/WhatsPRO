/**
 * summaryPrompt — fonte única do prompt de resumo de conversa (auto-summarize +
 * summarize-conversation) e da taxonomia de categorias de motivo de contato.
 *
 * Regra de negócio (dono, 2026-06-11): pedido de informação/preço/disponibilidade
 * sobre PRODUTO = interesse_compra; "dúvida técnica" é só uso/instalação/aplicação.
 */

export const SUMMARY_CATEGORIES = [
  'interesse_compra',
  'duvida_tecnica',
  'troca_devolucao',
  'status_entrega',
  'reclamacao',
  'vaga_emprego',
  'fornecedor',
  'outro',
] as const

export type SummaryCategory = (typeof SUMMARY_CATEGORIES)[number]

/** Coage o que o LLM devolver pra um valor válido da taxonomia (default 'outro'). */
export function normalizeSummaryCategory(raw: unknown): SummaryCategory {
  const v = String(raw ?? '').toLowerCase().trim()
  return (SUMMARY_CATEGORIES as readonly string[]).includes(v)
    ? (v as SummaryCategory)
    : 'outro'
}

/**
 * Coage o sale_closed do LLM pra boolean estrito (default false — na dúvida,
 * NÃO conta venda; o funil prefere subnotificar a inventar conversão).
 */
export function normalizeSaleClosed(raw: unknown): boolean {
  if (raw === true) return true
  const v = String(raw ?? '').toLowerCase().trim()
  return v === 'true' || v === 'sim'
}

export const SUMMARY_SYSTEM_PROMPT = `Você é um assistente de atendimento ao cliente de uma loja de material de construção. Analise esta conversa de WhatsApp e gere um resumo estruturado.

Responda APENAS com um JSON válido, sem markdown, sem blocos de código, sem texto extra. O JSON deve ter exatamente estas chaves:
- "category": categoria do contato, OBRIGATORIAMENTE uma destas: interesse_compra | duvida_tecnica | troca_devolucao | status_entrega | reclamacao | vaga_emprego | fornecedor | outro
- "reason": motivo principal do contato em 1 frase curta (cite o produto quando houver, ex: "Interesse em telha de PVC")
- "summary": resumo da conversa em 2-3 frases
- "resolution": como foi resolvido ou qual o próximo passo (ou "Em aberto" se não resolvido)
- "sale_closed": true ou false — a venda foi EFETIVAMENTE concluída nesta conversa?

REGRAS de categorização:
- Lead pedindo informação, preço, valor, modelos, disponibilidade ou orçamento de um PRODUTO = "interesse_compra" (ele quer comprar). NÃO classifique isso como dúvida.
- "duvida_tecnica" é SÓ quando a pergunta é sobre como usar, instalar, aplicar, dimensionar ou compatibilidade — sem pedido de compra/preço na conversa.
- "troca_devolucao" = trocar/devolver produto já comprado. "status_entrega" = saber onde está um pedido já feito ou prazo de entrega de compra realizada.
- "reclamacao" = insatisfação com produto/atendimento. "vaga_emprego" = busca emprego/envia currículo. "fornecedor" = empresa/representante oferecendo produtos ou parceria.
- Na dúvida entre interesse_compra e outra categoria, prefira "interesse_compra".

REGRAS para sale_closed:
- true SOMENTE com sinal explícito de fechamento: pagamento feito/confirmado, pix enviado ou recebido, comprovante enviado/recebido, pedido confirmado/faturado, nota fiscal emitida, entrega de compra combinada/agendada.
- INTENÇÃO não é venda: "quero comprar", "vou levar", pedido de orçamento, negociação de preço ou de forma de pagamento = false.
- Na dúvida, sale_closed = false.`
