import { describe, it, expect } from 'vitest';
import {
  shortName,
  msgKind,
  isAiSent,
  senderLabelFor,
  type LabelMessage,
  type SenderLabelCtx,
} from '../conversationLabel';

// IDs/external_ids reais da conversa do caso Djavan (EletropisoV2, 2026-06-05).
const DJAVAN_ID = '4d79e021-6695-42fe-8606-f1a296b643c8';
const ctx: SenderLabelCtx = {
  contactName: '❤️',
  assignedTo: DJAVAN_ID,
  agentNamesMap: { [DJAVAN_ID]: 'Djavan - Eletropiso' },
};

const mk = (m: Partial<LabelMessage>): LabelMessage => ({
  direction: 'outgoing',
  sender_id: null,
  external_id: null,
  ...m,
});

describe('shortName', () => {
  it('tira o sufixo de instância " - Eletropiso"', () => {
    expect(shortName('Djavan - Eletropiso')).toBe('Djavan');
    expect(shortName('Lucas - Eletropiso')).toBe('Lucas');
    expect(shortName('Josafá - Eletropiso')).toBe('Josafá');
  });
  it('mantém nomes sem " - " (e faz trim)', () => {
    expect(shortName('Jussara')).toBe('Jussara');
    expect(shortName('Letícia ')).toBe('Letícia');
  });
  it('retorna undefined para vazio/nulo', () => {
    expect(shortName(undefined)).toBeUndefined();
    expect(shortName(null)).toBeUndefined();
    expect(shortName('   ')).toBeUndefined();
  });
});

describe('isAiSent / msgKind — discriminação IA vs atendente-celular', () => {
  it('external_id com prefixo de automação ⇒ IA', () => {
    expect(isAiSent('ai_agent_1780683961400')).toBe(true);
    expect(isAiSent('abandon_handoff_xyz')).toBe(true);
    expect(isAiSent(null)).toBe(true);
  });
  it('external_id hex cru (WhatsApp) ⇒ NÃO é IA (atendente pelo celular)', () => {
    expect(isAiSent('A5E50A0CE92211A492CC815DC2457AC7')).toBe(false);
  });
  it('classifica as 5 categorias', () => {
    expect(msgKind(mk({ direction: 'incoming' }))).toBe('lead');
    expect(msgKind(mk({ direction: 'private_note' }))).toBe('note');
    expect(msgKind(mk({ sender_id: 'u1' }))).toBe('agent');
    expect(msgKind(mk({ external_id: 'ai_agent_1' }))).toBe('ia');
    expect(msgKind(mk({ external_id: 'A5E50A0CE92211A4' }))).toBe('agentPhone');
  });
});

describe('senderLabelFor', () => {
  it('lead → nome do contato (fallback "Lead")', () => {
    expect(senderLabelFor(mk({ direction: 'incoming' }), ctx)).toBe('❤️');
    expect(senderLabelFor(mk({ direction: 'incoming' }), { ...ctx, contactName: '' })).toBe('Lead');
  });

  it('nota interna', () => {
    expect(senderLabelFor(mk({ direction: 'private_note' }), ctx)).toBe('Nota interna');
  });

  it('IA', () => {
    expect(senderLabelFor(mk({ external_id: 'ai_agent_1780683961400' }), ctx)).toBe('IA');
  });

  it('app (sender_id) → autor EXATO, nome curto, SEM "(responsável)"', () => {
    const c: SenderLabelCtx = { ...ctx, agentNamesMap: { ...ctx.agentNamesMap, jus: 'Jussara' } };
    expect(senderLabelFor(mk({ sender_id: 'jus' }), c)).toBe('Jussara');
  });

  // app com autor conhecido (sender_id) mas nome NÃO resolvido (RLS negou) NÃO pode virar
  // o nome do responsável — seria atribuir a msg de um humano a OUTRA pessoa.
  it('app com autor não resolvido → "Atendente", NUNCA "(responsável)"', () => {
    const label = senderLabelFor(mk({ sender_id: 'ghost' }), ctx); // ctx.assignedTo=Djavan resolve
    expect(label).toBe('Atendente');
    expect(label).not.toContain('(responsável)');
  });

  // Pino do efeito de reatribuição (aceitável-por-design): "(responsável)" é rótulo de DONO
  // atual, então reatribuir renomeia as bolhas de celular pro novo dono.
  it('reatribuição renomeia bolhas de celular pro DONO atual', () => {
    const celular = mk({ external_id: 'A54C10E9860FD91B443035D5243071A2' });
    const reassigned: SenderLabelCtx = { ...ctx, assignedTo: 'pedro', agentNamesMap: { pedro: 'Pedro - Eletropiso' } };
    expect(senderLabelFor(celular, reassigned)).toBe('Pedro (responsável)');
  });

  // CASO DJAVAN — pino da decisão do dono (2026-06-05) que revisa o gate da v7.73.2:
  // msg pelo celular (sem sender_id), atribuído DEPOIS → mostra o responsável atual,
  // marcado "(responsável)", e NÃO "Atendente".
  it('celular (agentPhone) + responsável resolvido → "{nome} (responsável)" mesmo se atribuído depois', () => {
    const msg = mk({ external_id: 'A5E50A0CE92211A492CC815DC2457AC7' }); // "No que posso ajudar" 16h08
    expect(senderLabelFor(msg, ctx)).toBe('Djavan (responsável)');
  });

  it('celular sem responsável (ou nome não resolvido) → "Atendente"', () => {
    const msg = mk({ external_id: 'A54C10E9860FD91B443035D5243071A2' });
    expect(senderLabelFor(msg, { ...ctx, assignedTo: null })).toBe('Atendente');
    expect(senderLabelFor(msg, { ...ctx, agentNamesMap: {} })).toBe('Atendente'); // RLS não resolveu o nome
  });
});
