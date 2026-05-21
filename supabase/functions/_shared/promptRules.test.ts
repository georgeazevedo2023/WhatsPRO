import { describe, it, expect } from 'vitest';
import { buildPromptRulesString } from './promptRules';

describe('buildPromptRulesString', () => {
  it('exists and returns a non-empty string', () => {
    const out = buildPromptRulesString();
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });

  it('contains the essential keywords for the 5 retained rules', () => {
    const out = buildPromptRulesString();
    expect(out).toContain('LEIA TODA');
    expect(out).toContain('NUNCA repita');
    expect(out).toContain('NUNCA ECOAR');
    expect(out).toContain('primeiro nome');
    expect(out).toContain('PROFISSÃO');
  });

  it('is concise: between 600 and 1500 chars (original hardcodedRules was 9348)', () => {
    const out = buildPromptRulesString();
    expect(out.length).toBeGreaterThanOrEqual(600);
    expect(out.length).toBeLessThanOrEqual(1500);
  });
});
