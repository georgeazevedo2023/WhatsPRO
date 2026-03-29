import { describe, it, expect } from 'vitest';
import { brainSchema, rulesSchema, guardrailsSchema, voiceSchema } from '../ai-agent/validationSchemas';

describe('brainSchema', () => {
  it('accepts valid complete input', () => {
    const result = brainSchema.safeParse({ temperature: 0.5, max_tokens: 4096, model: 'gpt-4.1-mini' });
    expect(result.success).toBe(true);
  });

  it('rejects temperature above max (1)', () => {
    const result = brainSchema.safeParse({ temperature: 1.5 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].path).toContain('temperature');
    }
  });

  it('rejects max_tokens below min (100)', () => {
    const result = brainSchema.safeParse({ max_tokens: 50 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].path).toContain('max_tokens');
    }
  });

  it('rejects invalid model', () => {
    const result = brainSchema.safeParse({ model: 'gpt-99-invalid' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toBe('Modelo invalido');
    }
  });

  it('accepts partial input (.partial() works)', () => {
    const result = brainSchema.safeParse({ temperature: 0.5 });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (.partial())', () => {
    const result = brainSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('rulesSchema', () => {
  it('accepts valid input', () => {
    const result = rulesSchema.safeParse({ handoff_cooldown_minutes: 30, max_lead_messages: 10 });
    expect(result.success).toBe(true);
  });

  it('rejects handoff_cooldown below min (5)', () => {
    const result = rulesSchema.safeParse({ handoff_cooldown_minutes: 3 });
    expect(result.success).toBe(false);
  });

  it('rejects max_lead_messages above max (50)', () => {
    const result = rulesSchema.safeParse({ max_lead_messages: 100 });
    expect(result.success).toBe(false);
  });
});

describe('guardrailsSchema', () => {
  it('accepts valid input', () => {
    const result = guardrailsSchema.safeParse({ max_discount_percent: 50 });
    expect(result.success).toBe(true);
  });

  it('rejects above 100', () => {
    const result = guardrailsSchema.safeParse({ max_discount_percent: 150 });
    expect(result.success).toBe(false);
  });

  it('accepts null (nullable field)', () => {
    const result = guardrailsSchema.safeParse({ max_discount_percent: null });
    expect(result.success).toBe(true);
  });
});

describe('voiceSchema', () => {
  it('accepts valid input', () => {
    const result = voiceSchema.safeParse({ voice_max_text_length: 100 });
    expect(result.success).toBe(true);
  });

  it('rejects below min (10)', () => {
    const result = voiceSchema.safeParse({ voice_max_text_length: 5 });
    expect(result.success).toBe(false);
  });

  it('rejects above max (500)', () => {
    const result = voiceSchema.safeParse({ voice_max_text_length: 600 });
    expect(result.success).toBe(false);
  });
});
