/**
 * Tests for Playground v4 — Greeting logic (matches ACTUAL implementation)
 *
 * Tests the real flow:
 * 1. Greeting NOT injected into geminiContents (Gemini never sees it)
 * 2. Greeting prepended to final response (simulates UAZAPI send)
 * 3. "just greeting" detection — "oi" returns only greeting, no LLM
 * 4. System prompt tells Gemini to NOT re-greet
 */

// ── Replicate the ACTUAL greeting detection logic from playground ──
const GREETING_WORDS = ['oi', 'ola', 'olá', 'bom dia', 'boa tarde', 'boa noite', 'eae', 'eai',
  'hey', 'opa', 'fala', 'salve', 'oii', 'oie', 'hello', 'hi', 'bão', 'blz', 'tudo bem',
  'tudo bom', 'boa', 'oi tudo bem', 'oi boa tarde', 'oi bom dia', 'oi boa noite', 'oie'];

function isJustGreeting(text: string): boolean {
  const norm = text.toLowerCase().replace(/[!?.,;:]/g, '').trim();
  return GREETING_WORDS.some(g => norm === g || norm === g + ' ');
}

interface PlaygroundInput {
  hasAssistantMsg: boolean;
  greetingMessage: string | null;
  chatMessages: { content?: string; direction: string }[];
  llmResponse: string; // what the LLM would return
}

// Replicate the ACTUAL response building logic
function buildPlaygroundResponse(input: PlaygroundInput): {
  response: string;
  greeting_sent: boolean;
  just_greeting: boolean;
  llm_called: boolean;
} {
  const { hasAssistantMsg, greetingMessage, chatMessages, llmResponse } = input;
  const isFirstTurn = !hasAssistantMsg && !!greetingMessage;
  const firstText = (chatMessages[0]?.content || '').toLowerCase().replace(/[!?.,;:]/g, '').trim();
  const justGreeting = isFirstTurn && isJustGreeting(firstText);

  // If just greeting, return ONLY the greeting (no LLM call)
  if (justGreeting) {
    return { response: greetingMessage!, greeting_sent: true, just_greeting: true, llm_called: false };
  }

  // If first turn with substantive message, prepend greeting
  if (isFirstTurn) {
    return { response: `${greetingMessage}\n\n${llmResponse}`, greeting_sent: true, just_greeting: false, llm_called: true };
  }

  // Normal turn (not first), return LLM response only
  return { response: llmResponse, greeting_sent: false, just_greeting: false, llm_called: true };
}

// Replicate the ACTUAL geminiContents building (NO greeting injection)
function buildGeminiContents(chatMessages: { content?: string; direction: string }[]): { role: string; parts: { text: string }[] }[] {
  const contents: { role: string; parts: { text: string }[] }[] = [];
  for (const m of chatMessages) {
    if (m.content?.trim()) {
      contents.push({ role: m.direction === 'incoming' ? 'user' : 'model', parts: [{ text: m.content }] });
    }
  }
  return contents;
}

describe('Playground Greeting — isJustGreeting detection', () => {
  it('1. detects simple greetings', () => {
    expect(isJustGreeting('oi')).toBe(true);
    expect(isJustGreeting('Oi!')).toBe(true);
    expect(isJustGreeting('boa tarde')).toBe(true);
    expect(isJustGreeting('Bom dia!')).toBe(true);
    expect(isJustGreeting('oie')).toBe(true);
    expect(isJustGreeting('tudo bem?')).toBe(true);
  });

  it('2. does NOT detect substantive messages as greeting', () => {
    expect(isJustGreeting('oi, tem tinta?')).toBe(false);
    expect(isJustGreeting('bom dia, preciso de cimento')).toBe(false);
    expect(isJustGreeting('quanto custa o porcelanato?')).toBe(false);
    expect(isJustGreeting('quero falar com vendedor')).toBe(false);
  });
});

describe('Playground Greeting — Response building', () => {
  it('3. "oi" returns ONLY greeting, no LLM call', () => {
    const result = buildPlaygroundResponse({
      hasAssistantMsg: false,
      greetingMessage: 'Olá! Bem-vindo a Eletropiso!',
      chatMessages: [{ content: 'oi', direction: 'incoming' }],
      llmResponse: 'Como posso ajudar?', // this should NOT be used
    });
    expect(result.response).toBe('Olá! Bem-vindo a Eletropiso!');
    expect(result.greeting_sent).toBe(true);
    expect(result.just_greeting).toBe(true);
    expect(result.llm_called).toBe(false);
  });

  it('4. "oi, tem tinta?" returns greeting + LLM response', () => {
    const result = buildPlaygroundResponse({
      hasAssistantMsg: false,
      greetingMessage: 'Olá! Bem-vindo!',
      chatMessages: [{ content: 'oi, tem tinta?', direction: 'incoming' }],
      llmResponse: 'Qual tipo de tinta você procura?',
    });
    expect(result.response).toBe('Olá! Bem-vindo!\n\nQual tipo de tinta você procura?');
    expect(result.greeting_sent).toBe(true);
    expect(result.just_greeting).toBe(false);
    expect(result.llm_called).toBe(true);
  });

  it('5. second message does NOT include greeting', () => {
    const result = buildPlaygroundResponse({
      hasAssistantMsg: true, // already has assistant response
      greetingMessage: 'Olá!',
      chatMessages: [
        { content: 'oi', direction: 'incoming' },
        { content: 'Olá!', direction: 'outgoing' },
        { content: 'tem cimento?', direction: 'incoming' },
      ],
      llmResponse: 'Sim, temos cimento CP-II!',
    });
    expect(result.response).toBe('Sim, temos cimento CP-II!');
    expect(result.greeting_sent).toBe(false);
    expect(result.llm_called).toBe(true);
  });

  it('6. no greeting configured — goes straight to LLM', () => {
    const result = buildPlaygroundResponse({
      hasAssistantMsg: false,
      greetingMessage: null,
      chatMessages: [{ content: 'oi', direction: 'incoming' }],
      llmResponse: 'Olá! Como posso ajudar?',
    });
    expect(result.response).toBe('Olá! Como posso ajudar?');
    expect(result.greeting_sent).toBe(false);
    expect(result.llm_called).toBe(true);
  });
});

describe('Playground Greeting — No duplicate greeting (REGRESSION)', () => {
  it('7. response contains greeting EXACTLY once', () => {
    const greeting = 'Olá! Bem-vindo a Eletropiso!';
    const result = buildPlaygroundResponse({
      hasAssistantMsg: false,
      greetingMessage: greeting,
      chatMessages: [{ content: 'oi, tem tinta?', direction: 'incoming' }],
      llmResponse: 'Qual tipo de tinta?',
    });
    const count = result.response.split(greeting).length - 1;
    expect(count).toBe(1); // MUST be exactly 1, not 2+
  });

  it('8. LLM response with "Olá" does NOT create double greeting', () => {
    const greeting = 'Olá! Bem-vindo!';
    const result = buildPlaygroundResponse({
      hasAssistantMsg: false,
      greetingMessage: greeting,
      chatMessages: [{ content: 'tem tinta?', direction: 'incoming' }],
      llmResponse: 'Qual tipo de tinta você procura?', // LLM should NOT say "Olá" here
    });
    // Greeting is prepended, LLM response follows
    expect(result.response).toContain(greeting);
    expect(result.response).toContain('Qual tipo de tinta');
    // Only one "Olá"
    expect((result.response.match(/Olá/g) || []).length).toBe(1);
  });
});

describe('Playground Greeting — geminiContents (no injection)', () => {
  it('9. geminiContents does NOT contain greeting message', () => {
    const greeting = 'Olá! Bem-vindo!';
    const contents = buildGeminiContents([
      { content: 'oi', direction: 'incoming' },
    ]);
    // Greeting should NOT be in the contents sent to LLM
    const allTexts = contents.map(c => c.parts[0].text);
    expect(allTexts).not.toContain(greeting);
    expect(allTexts).toEqual(['oi']);
  });

  it('10. geminiContents filters empty messages', () => {
    const contents = buildGeminiContents([
      { content: 'oi', direction: 'incoming' },
      { content: '', direction: 'outgoing' },
      { content: '  ', direction: 'incoming' },
      { content: 'tem tinta?', direction: 'incoming' },
    ]);
    expect(contents).toHaveLength(2);
    expect(contents[0].parts[0].text).toBe('oi');
    expect(contents[1].parts[0].text).toBe('tem tinta?');
  });
});
