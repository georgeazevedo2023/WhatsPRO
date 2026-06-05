/** Lógica PURA de rótulo "quem enviou" do modal da Fila (ConversationModal).
 *  Separada do componente de propósito: sem React/Supabase → testável isoladamente.
 *  Histórico desta área (muito churn): v7.73.0 (5 kinds) → v7.73.1 (nome do assignee)
 *  → v7.73.2 (gate assigned_at<=created_at, mostrava "Atendente") → 2026-06-05 (revisão:
 *  "(responsável)"). NÃO reverter sem ler o teste irmão (conversationLabel.test.ts). */

export interface LabelMessage {
  direction: string;
  sender_id: string | null;
  external_id: string | null;
}

/** Prefixos de external_id usados por mensagens enviadas pela IA/automação.
 *  Mensagens digitadas pelo atendente no celular (takeover) chegam pelo webhook com
 *  external_id = id cru do WhatsApp (hex, sem prefixo) e sem sender_id. */
export const AI_EXTERNAL_ID_PREFIX = /^(ai_|abandon_|follow_up_|auto_|nps_|queue_oof_|poll_vote_)/;

/** Outgoing sem sender_id: IA (external_id NULL ou prefixo de automação) vs atendente
 *  que respondeu pelo celular (external_id hex cru, sem prefixo). */
export function isAiSent(externalId: string | null): boolean {
  return !externalId || AI_EXTERNAL_ID_PREFIX.test(externalId);
}

export type MsgKind = 'lead' | 'note' | 'agent' | 'agentPhone' | 'ia';

/** Classifica a mensagem em 1 das 5 categorias de remetente. */
export function msgKind(msg: LabelMessage): MsgKind {
  if (msg.direction === 'incoming') return 'lead';
  if (msg.direction === 'private_note') return 'note';
  if (msg.sender_id) return 'agent';            // app (Helpdesk): autor EXATO via sender_id
  if (isAiSent(msg.external_id)) return 'ia';   // IA / automação
  return 'agentPhone';                          // takeover pelo celular (sem sender_id)
}

/** Nome curto do atendente: tira o sufixo de instância " - Eletropiso" do full_name
 *  cadastrado (ex.: "Djavan - Eletropiso" → "Djavan"). Nomes sem " - " ficam intactos. */
export function shortName(full?: string | null): string | undefined {
  if (!full) return undefined;
  const trimmed = full.trim();
  const sep = trimmed.indexOf(' - ');
  return (sep > 0 ? trimmed.slice(0, sep) : trimmed).trim() || undefined;
}

export interface SenderLabelCtx {
  contactName: string;
  assignedTo: string | null;
  agentNamesMap: Record<string, string>;
}

/** Rótulo "quem enviou" por mensagem:
 *  - lead       → nome do lead (fallback "Lead")
 *  - note       → "Nota interna"
 *  - agent      → autor EXATO via sender_id (nome curto) — autoria precisa, sem sufixo
 *  - agentPhone → resposta digitada no CELULAR (sem sender_id). A linha é COMPARTILHADA e
 *    o sistema NÃO registra quem digitou. Decisão do dono (2026-06-05): mostrar o
 *    RESPONSÁVEL atual da conversa (assigned_to) marcado "(responsável)" — é atribuição
 *    de DONO, NÃO afirmação de autoria da bolha. O sufixo "(responsável)" é o que mantém
 *    honesto sem reintroduzir nome falso (ver [[feedback_never_false_data]]); por isso
 *    revisa o gate assigned_at<=created_at da v7.73.2 (que mostrava "Atendente"). Sem
 *    responsável resolvido → "Atendente". NOTA: usa o assigned_to ATUAL → reatribuir a
 *    conversa renomeia TODAS as bolhas de celular pro novo dono (aceitável: é rótulo de
 *    DONO, não de autor; ver teste "reatribuição renomeia…").
 *  - ia         → "IA" */
export function senderLabelFor(msg: LabelMessage, ctx: SenderLabelCtx): string {
  const responsavel = shortName(ctx.assignedTo ? ctx.agentNamesMap[ctx.assignedTo] : undefined);
  const agentPhoneName = responsavel ? `${responsavel} (responsável)` : 'Atendente';
  switch (msgKind(msg)) {
    case 'lead':
      return ctx.contactName?.trim() || 'Lead';
    case 'note':
      return 'Nota interna';
    case 'agent':
      // App (sender_id) = autor conhecido e ESPECÍFICO. Se o nome não resolve (RLS negou),
      // cai em "Atendente" genérico — NUNCA no nome do responsável: atribuir a mensagem de
      // um humano a OUTRA pessoa (o dono da conversa) seria inventar autor.
      return shortName(ctx.agentNamesMap[msg.sender_id!]) || 'Atendente';
    case 'agentPhone':
      return agentPhoneName;
    default:
      return 'IA';
  }
}
