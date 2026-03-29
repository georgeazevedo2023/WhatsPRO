/**
 * Tests for returning lead greeting — imports REAL resolveGreetingText.
 */
import { resolveGreetingText } from '../../../../../supabase/functions/_shared/agentHelpers.ts'

// ─── Test 1: New lead gets standard greeting ──────────────────────
describe('Returning lead greeting', () => {
  it('sends standard greeting for new lead (no prior interaction)', () => {
    const result = resolveGreetingText({
      hasInteracted: false,
      hasEverInteracted: false,
      leadFullName: null,
      greetingMessage: 'Olá! Sou o assistente da Eletropiso.',
      returningGreetingMessage: null,
    });
    expect(result.type).toBe('new');
    expect(result.text).toBe('Olá! Sou o assistente da Eletropiso.');
  });

  // ─── Test 2: Returning lead gets personalized welcome-back ──────
  it('sends personalized welcome-back for returning lead', () => {
    const result = resolveGreetingText({
      hasInteracted: false,       // NOT interacted in last 24h (new conversation)
      hasEverInteracted: true,    // HAS interacted before (1 week ago)
      leadFullName: 'Carlos',
      greetingMessage: 'Olá! Sou o assistente.',
      returningGreetingMessage: 'Olá {nome}! Que bom te ver aqui de novo 😊',
    });
    expect(result.type).toBe('returning');
    expect(result.text).toBe('Olá Carlos! Que bom te ver aqui de novo 😊');
    expect(result.text).not.toContain('{nome}');
  });

  // ─── Test 3: Uses default template when custom not configured ───
  it('uses default returning template when none configured', () => {
    const result = resolveGreetingText({
      hasInteracted: false,
      hasEverInteracted: true,
      leadFullName: 'Maria',
      greetingMessage: 'Olá!',
      returningGreetingMessage: null,
    });
    expect(result.type).toBe('returning');
    expect(result.text).toContain('Maria');
    expect(result.text).toContain('Que bom te ver aqui de novo');
  });

  // ─── Test 4: Skips greeting when lead is in active conversation ─
  it('skips greeting when lead already interacted recently (same session)', () => {
    const result = resolveGreetingText({
      hasInteracted: true,        // Already interacted in last 24h
      hasEverInteracted: true,
      leadFullName: 'Carlos',
      greetingMessage: 'Olá!',
      returningGreetingMessage: 'Olá {nome}!',
    });
    expect(result.type).toBe('skip');
    expect(result.text).toBe('');
  });

  // ─── Test 5: New lead with name gets standard greeting (first time ever) ─
  it('sends standard greeting for first-time lead even if they have a name from contact', () => {
    // Lead has name from WhatsApp profile but never interacted
    const result = resolveGreetingText({
      hasInteracted: false,
      hasEverInteracted: false,   // NEVER interacted
      leadFullName: null,         // No confirmed full_name in lead_profiles
      greetingMessage: 'Olá! Como posso ajudar?',
      returningGreetingMessage: 'Bem-vindo de volta {nome}!',
    });
    expect(result.type).toBe('new');
    expect(result.text).toBe('Olá! Como posso ajudar?');
  });

  // ─── Test 6: {nome} replacement is case-insensitive ────────────
  it('replaces {nome} case-insensitively', () => {
    const result = resolveGreetingText({
      hasInteracted: false,
      hasEverInteracted: true,
      leadFullName: 'João',
      greetingMessage: 'Olá!',
      returningGreetingMessage: 'Oi {Nome}, tudo bem? {NOME} é sempre bem-vindo!',
    });
    expect(result.text).toBe('Oi João, tudo bem? João é sempre bem-vindo!');
  });

  // ─── Test 7: Multiple {nome} replacements in same template ─────
  it('replaces multiple {nome} occurrences', () => {
    const result = resolveGreetingText({
      hasInteracted: false,
      hasEverInteracted: true,
      leadFullName: 'Ana',
      greetingMessage: 'Olá!',
      returningGreetingMessage: '{nome}, que bom! {nome}, como vai?',
    });
    expect(result.text).toBe('Ana, que bom! Ana, como vai?');
  });

  // ─── Test 8: Context cleared (hasEverInteracted resets) ─────────
  it('sends standard greeting after context cleared (hasEverInteracted reset)', () => {
    // When admin clears context, ai_agent_logs are deleted → hasEverInteracted = false
    const result = resolveGreetingText({
      hasInteracted: false,
      hasEverInteracted: false,   // Logs deleted by clear context
      leadFullName: 'Carlos',     // Name still in lead_profiles
      greetingMessage: 'Olá! Sou o assistente.',
      returningGreetingMessage: 'Bem-vindo de volta {nome}!',
    });
    // Should NOT send returning greeting because hasEverInteracted is false
    expect(result.type).toBe('new');
    expect(result.text).toBe('Olá! Sou o assistente.');
  });

  // ─── Test 9: Empty greeting message ─────────────────────────────
  it('skips when greeting_message is empty', () => {
    const result = resolveGreetingText({
      hasInteracted: false,
      hasEverInteracted: false,
      leadFullName: null,
      greetingMessage: '',
      returningGreetingMessage: null,
    });
    expect(result.type).toBe('skip');
  });

  // ─── Test 10: Long name with special characters ─────────────────
  it('handles names with special characters and accents', () => {
    const result = resolveGreetingText({
      hasInteracted: false,
      hasEverInteracted: true,
      leadFullName: 'José da Silva Júnior',
      greetingMessage: 'Olá!',
      returningGreetingMessage: 'Olá {nome}! 🎉',
    });
    expect(result.text).toBe('Olá José da Silva Júnior! 🎉');
  });
});
