import { describe, it, expect } from 'vitest';
import { buildPromptRulesString, buildHumanizationRules } from './promptRules';

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

describe('buildHumanizationRules (Onda 2 — fonte única nos 6 prompts)', () => {
  it('contém as regras comuns que antes viviam copiadas nos specialists', () => {
    const out = buildHumanizationRules();
    expect(out).toContain('DIRETRIZ DE HUMANIZAÇÃO');
    expect(out).toContain('Vou seguir coletando');          // clichês de IA
    expect(out).toContain('anotei');                        // anti-narração
    expect(out).toContain('parênteses estilo formulário');  // anti-formulário
    expect(out).toContain('function-calling');              // anti-vazamento de tool
    expect(out).toContain('resumo interno pro vendedor');   // anti-resumo no texto
    expect(out).toContain('PARCIMÔNIA');                    // nome do lead
    expect(out).toContain('Máximo 1 pergunta');             // 1 pergunta/msg
    expect(out).toContain('Emoji');                         // emoji no fim, máx 1
  });

  it('é um bloco enxuto (não infla o prompt dos specialists)', () => {
    const out = buildHumanizationRules();
    expect(out.length).toBeGreaterThanOrEqual(800);
    expect(out.length).toBeLessThanOrEqual(2400);
  });
});
