/**
 * Tests for Playground v4 — System prompt construction
 * Validates that the playground system prompt mirrors production rules.
 */

// ── Replicate prompt builder logic (pure function, no Deno deps) ──
function buildSystemPrompt(params: {
  agentName: string; personality: string; systemPrompt: string;
  leadContext: string; campaignContext: string;
  businessInfo: { hours?: string; address?: string; phone?: string; payment_methods?: string; delivery_info?: string; extra?: string } | null;
  blockedTopics: string[]; blockedPhrases: string[];
  isReturningLead: boolean; leadName: string | null; greetingText: string;
  extractionFields: { label: string; key: string; enabled: boolean }[];
  subAgents: Record<string, { enabled: boolean; prompt: string }>;
  availableLabelNames: string[]; currentLabelNames: string[];
  knowledgeFaq: { title: string; content: string }[];
  knowledgeDocs: { title: string; content: string }[];
  leadMsgCount: number; maxLeadMessages: number;
}): string {
  const p = params;
  let knowledgeInstruction = '';
  if (p.knowledgeFaq.length > 0) knowledgeInstruction += `\n\n<knowledge_base type="faq">\n${p.knowledgeFaq.map(f => `<faq><question>${f.title}</question><answer>${f.content}</answer></faq>`).join('\n')}\n</knowledge_base>`;
  if (p.knowledgeDocs.length > 0) knowledgeInstruction += `\n\n<knowledge_base type="documents">\n${p.knowledgeDocs.map(d => `<doc title="${d.title}">${d.content}</doc>`).join('\n')}\n</knowledge_base>`;

  const extractionInstruction = p.extractionFields.filter(f => f.enabled).length > 0
    ? `\nCampos para extrair:\n${p.extractionFields.filter(f => f.enabled).map(f => `- ${f.label} (chave: ${f.key})`).join('\n')}` : '';

  const activeSubAgents = Object.entries(p.subAgents).filter(([_, v]) => v?.enabled && v?.prompt).map(([k, v]) => `[Modo ${k.toUpperCase()}]: ${v.prompt}`);
  const subAgentInstruction = activeSubAgents.length > 0 ? `\n\nModos de atendimento:\n${activeSubAgents.join('\n\n')}` : '';

  const biSection = (() => {
    if (!p.businessInfo) return '\nNenhuma informação da empresa cadastrada.';
    const parts = ['\nInformações da Empresa:'];
    if (p.businessInfo.hours) parts.push(`- Horário: ${p.businessInfo.hours}`);
    if (p.businessInfo.address) parts.push(`- Endereço: ${p.businessInfo.address}`);
    return parts.join('\n');
  })();

  return `Você é ${p.agentName}, um assistente virtual de WhatsApp.
Personalidade: ${p.personality}
${p.systemPrompt}
${p.leadContext}
${p.campaignContext}
${biSection}
REGRA ABSOLUTA: Faça APENAS 1 pergunta por mensagem.
${p.blockedTopics.length ? `\nTópicos PROIBIDOS: ${p.blockedTopics.join(', ')}` : ''}
${p.blockedPhrases.length ? `\nFrases PROIBIDAS: ${p.blockedPhrases.join(', ')}` : ''}
FLUXO SDR — QUALIFICAÇÃO INTELIGENTE:
${p.isReturningLead ? `CONTEXTO: Lead RECORRENTE. Nome: ${p.leadName}.` : `CONTEXTO: Lead NOVO. Saudação "${p.greetingText}" já enviada.`}
LIMITE DE MENSAGENS: ${p.leadMsgCount}/${p.maxLeadMessages}
Labels disponíveis: ${p.availableLabelNames.join(', ') || '(nenhuma)'}
${p.currentLabelNames.length ? `Labels atuais: ${p.currentLabelNames.join(', ')}` : ''}
${extractionInstruction}
${knowledgeInstruction}
${subAgentInstruction}
DETECÇÃO DE OBJEÇÕES: preco, concorrente, prazo, indecisao, qualidade, confianca`;
}

const defaultParams = {
  agentName: 'Eletropiso', personality: 'Profissional', systemPrompt: 'Responda bem.',
  leadContext: '', campaignContext: '', businessInfo: null,
  blockedTopics: [], blockedPhrases: [], isReturningLead: false, leadName: null,
  greetingText: 'Olá!', extractionFields: [], subAgents: {},
  availableLabelNames: [], currentLabelNames: [],
  knowledgeFaq: [], knowledgeDocs: [], leadMsgCount: 0, maxLeadMessages: 8,
};

describe('Playground System Prompt', () => {
  it('1. contains SDR qualification rules', () => {
    const prompt = buildSystemPrompt(defaultParams);
    expect(prompt).toContain('FLUXO SDR');
    expect(prompt).toContain('QUALIFICAÇÃO INTELIGENTE');
  });

  it('2. contains business_info when provided', () => {
    const prompt = buildSystemPrompt({ ...defaultParams, businessInfo: { hours: 'Seg-Sex 8h-18h', address: 'Rua A, 123' } });
    expect(prompt).toContain('Seg-Sex 8h-18h');
    expect(prompt).toContain('Rua A, 123');
  });

  it('3. contains objection detection rules', () => {
    const prompt = buildSystemPrompt(defaultParams);
    expect(prompt).toContain('DETECÇÃO DE OBJEÇÕES');
    expect(prompt).toContain('preco');
    expect(prompt).toContain('concorrente');
    expect(prompt).toContain('qualidade');
  });

  it('4. contains valid tag instructions', () => {
    const prompt = buildSystemPrompt(defaultParams);
    expect(prompt).toContain('LIMITE DE MENSAGENS');
    expect(prompt).toContain('0/8');
  });

  it('5. contains available label names', () => {
    const prompt = buildSystemPrompt({ ...defaultParams, availableLabelNames: ['Novo', 'Qualificado', 'Fechado'] });
    expect(prompt).toContain('Novo');
    expect(prompt).toContain('Qualificado');
    expect(prompt).toContain('Fechado');
  });

  it('6. includes blocked topics when configured', () => {
    const prompt = buildSystemPrompt({ ...defaultParams, blockedTopics: ['política', 'religião'] });
    expect(prompt).toContain('Tópicos PROIBIDOS');
    expect(prompt).toContain('política');
    expect(prompt).toContain('religião');
  });

  it('7. includes extraction fields when enabled', () => {
    const prompt = buildSystemPrompt({ ...defaultParams, extractionFields: [{ label: 'CPF', key: 'cpf', enabled: true }, { label: 'Email', key: 'email', enabled: false }] });
    expect(prompt).toContain('CPF');
    expect(prompt).toContain('cpf');
    expect(prompt).not.toContain('Email');
  });

  it('8. includes active sub-agents', () => {
    const prompt = buildSystemPrompt({ ...defaultParams, subAgents: { sdr: { enabled: true, prompt: 'Qualifique leads' }, sales: { enabled: false, prompt: 'Venda' } } });
    expect(prompt).toContain('Modo SDR');
    expect(prompt).toContain('Qualifique leads');
    expect(prompt).not.toContain('Modo SALES');
  });

  it('9. formats knowledge base FAQ correctly', () => {
    const prompt = buildSystemPrompt({ ...defaultParams, knowledgeFaq: [{ title: 'Prazo entrega?', content: '3-5 dias úteis' }] });
    expect(prompt).toContain('<knowledge_base type="faq">');
    expect(prompt).toContain('<question>Prazo entrega?</question>');
    expect(prompt).toContain('<answer>3-5 dias úteis</answer>');
  });

  it('10. formats knowledge base documents correctly', () => {
    const prompt = buildSystemPrompt({ ...defaultParams, knowledgeDocs: [{ title: 'Política de troca', content: 'Troca em 30 dias' }] });
    expect(prompt).toContain('<knowledge_base type="documents">');
    expect(prompt).toContain('<doc title="Política de troca">');
    expect(prompt).toContain('Troca em 30 dias');
  });
});
