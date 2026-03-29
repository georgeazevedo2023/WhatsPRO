/**
 * Tests for Playground v4 — Greeting injection and history building
 */

interface GeminiContent { role: 'user' | 'model'; parts: { text: string }[] }

function buildGeminiContents(params: {
  hasAssistantMsg: boolean;
  greetingMessage: string | null;
  chatMessages: { content?: string; direction: string }[];
}): GeminiContent[] {
  const { hasAssistantMsg, greetingMessage, chatMessages } = params;
  const geminiContents: GeminiContent[] = [];

  if (!hasAssistantMsg && greetingMessage) {
    geminiContents.push(
      { role: 'user', parts: [{ text: chatMessages[0]?.content || 'oi' }] },
      { role: 'model', parts: [{ text: greetingMessage }] },
    );
    const userText = chatMessages[0]?.content || 'oi';
    geminiContents.push({ role: 'user', parts: [{ text: `O lead disse: "${userText}". Você já enviou a saudação acima. Agora responda SEM repetir a saudação.` }] });

    for (const m of chatMessages.slice(1)) {
      if (m.content?.trim()) {
        geminiContents.push({ role: m.direction === 'incoming' ? 'user' : 'model', parts: [{ text: m.content }] });
      }
    }
  } else {
    for (const m of chatMessages) {
      if (m.content?.trim()) {
        geminiContents.push({ role: m.direction === 'incoming' ? 'user' : 'model', parts: [{ text: m.content }] });
      }
    }
  }

  return geminiContents;
}

describe('Playground Greeting', () => {
  it('1. injects greeting as model message on first interaction', () => {
    const contents = buildGeminiContents({
      hasAssistantMsg: false,
      greetingMessage: 'Olá! Bem-vindo à Eletropiso!',
      chatMessages: [{ content: 'oi', direction: 'incoming' }],
    });
    expect(contents[1].role).toBe('model');
    expect(contents[1].parts[0].text).toBe('Olá! Bem-vindo à Eletropiso!');
  });

  it('2. adds "don\'t repeat" instruction after greeting', () => {
    const contents = buildGeminiContents({
      hasAssistantMsg: false,
      greetingMessage: 'Olá!',
      chatMessages: [{ content: 'oi', direction: 'incoming' }],
    });
    expect(contents[2].role).toBe('user');
    expect(contents[2].parts[0].text).toContain('SEM repetir a saudação');
  });

  it('3. does NOT inject greeting when hasAssistantMsg=true', () => {
    const contents = buildGeminiContents({
      hasAssistantMsg: true,
      greetingMessage: 'Olá!',
      chatMessages: [
        { content: 'oi', direction: 'incoming' },
        { content: 'Olá!', direction: 'outgoing' },
        { content: 'tem tinta?', direction: 'incoming' },
      ],
    });
    // No greeting injection — just raw messages
    expect(contents[0].parts[0].text).toBe('oi');
    expect(contents[1].parts[0].text).toBe('Olá!');
    expect(contents[2].parts[0].text).toBe('tem tinta?');
  });

  it('4. skips greeting when greetingMessage is null', () => {
    const contents = buildGeminiContents({
      hasAssistantMsg: false,
      greetingMessage: null,
      chatMessages: [{ content: 'oi', direction: 'incoming' }],
    });
    expect(contents).toHaveLength(1);
    expect(contents[0].parts[0].text).toBe('oi');
  });

  it('5. handles multiple user messages after greeting', () => {
    const contents = buildGeminiContents({
      hasAssistantMsg: false,
      greetingMessage: 'Olá!',
      chatMessages: [
        { content: 'oi', direction: 'incoming' },
        { content: 'Olá! Como posso ajudar?', direction: 'outgoing' },
        { content: 'tem tinta?', direction: 'incoming' },
      ],
    });
    // greeting injected + instruction + remaining messages
    expect(contents.length).toBeGreaterThanOrEqual(4);
    const lastContent = contents[contents.length - 1];
    expect(lastContent.parts[0].text).toBe('tem tinta?');
  });

  it('6. preserves greeting with emojis', () => {
    const contents = buildGeminiContents({
      hasAssistantMsg: false,
      greetingMessage: 'Olá! 👋 Bem-vindo! 😊',
      chatMessages: [{ content: 'oi', direction: 'incoming' }],
    });
    expect(contents[1].parts[0].text).toContain('👋');
    expect(contents[1].parts[0].text).toContain('😊');
  });

  it('7. filters empty/whitespace messages', () => {
    const contents = buildGeminiContents({
      hasAssistantMsg: true,
      greetingMessage: null,
      chatMessages: [
        { content: 'oi', direction: 'incoming' },
        { content: '', direction: 'outgoing' },
        { content: '   ', direction: 'incoming' },
        { content: 'tem cimento?', direction: 'incoming' },
      ],
    });
    expect(contents).toHaveLength(2); // only 'oi' and 'tem cimento?'
    expect(contents[0].parts[0].text).toBe('oi');
    expect(contents[1].parts[0].text).toBe('tem cimento?');
  });

  it('8. returns empty array when all messages are empty', () => {
    const contents = buildGeminiContents({
      hasAssistantMsg: true,
      greetingMessage: null,
      chatMessages: [{ content: '', direction: 'incoming' }, { content: '  ', direction: 'incoming' }],
    });
    expect(contents).toHaveLength(0);
  });
});
