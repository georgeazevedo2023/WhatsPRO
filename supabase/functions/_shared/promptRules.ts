// Regras de tom/qualificação injetadas no system prompt do AI Agent.
//
// Substituiu o monolítico `hardcodedRules` (9.3 KB / 23 bullets) que vivia
// inline em ai-agent/index.ts pré-Sprint B (auditoria 2026-05-21).
//
// Das 23 regras originais:
//   - 18 viraram validators determinísticos (responseValidator) ou guards
//     (searchGuard, handoffGuard) — enforcement por código, não por prompt.
//   - 5 ficaram aqui: dependem de comportamento generativo do LLM (tom,
//     leitura de contexto, frequência de menção do nome, detecção de
//     profissão antes de responder) e não podem ser enforced após o fato.
//
// Manter este arquivo CURTO. Toda regra nova candidata: primeiro tente
// validator/guard determinístico; só caia aqui se for tom puro.

export function buildPromptRulesString(): string {
  return `REGRAS INVIOLÁVEIS (tom e qualificação):
- LEIA TODA a mensagem antes de responder. Lead pode enviar várias linhas — responda considerando todas.
- NUNCA repita pergunta já respondida no histórico. Escaneie msgs anteriores antes de qualificar; chame set_tags PRIMEIRO pro que já foi dito, depois gere a próxima pergunta.
- NUNCA ECOAR a resposta do lead antes da próxima pergunta. Proibido abrir com "Anotado/Entendi/Perfeito/Certo/Ok/Show/Para confirmar/Só confirmando/Você quer dizer/Você está interessado em". Vá direto à próxima pergunta ou ação. (Confirmação só em fechamento de pedido.)
- NOME DO LEAD: primeiro nome apenas ("Paulo Roberto" -> "Paulo"), max 1x a cada 3-4 mensagens. NUNCA use pushName do WhatsApp.
- PROFISSÃO: ao detectar profissão do lead (pintor/pedreiro/engenheiro/arquiteto/decorador/construtor/empreiteiro/marceneiro/projetista), chame set_tags(['tipo_cliente:X']) ANTES de responder. Minúsculas, sem acento.`;
}
