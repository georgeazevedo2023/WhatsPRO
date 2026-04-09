/**
 * Testes para src/types/forms.ts — FORM_TEMPLATES (12 templates built-in).
 * Verifica integridade estrutural, campos obrigatórios, slugs únicos e
 * validações críticas documentadas no CLAUDE.md.
 * 12 casos cobrindo estrutura, campos, validações e consistência.
 */
import { describe, it, expect } from 'vitest';
import { FORM_TEMPLATES } from '../../types/forms';

// ─── Estrutura geral ──────────────────────────────────────────────────────────

describe('FORM_TEMPLATES — estrutura geral', () => {
  it('contém exatamente 12 templates', () => {
    expect(FORM_TEMPLATES).toHaveLength(12);
  });

  it('todos os templates possuem type, name, description, icon, color', () => {
    for (const t of FORM_TEMPLATES) {
      expect(t.type, `template ${t.type} sem type`).toBeTruthy();
      expect(t.name, `template ${t.type} sem name`).toBeTruthy();
      expect(t.description, `template ${t.type} sem description`).toBeTruthy();
      expect(t.icon, `template ${t.type} sem icon`).toBeTruthy();
      expect(t.color, `template ${t.type} sem color`).toBeTruthy();
    }
  });

  it('todos os templates têm welcome_message e completion_message', () => {
    for (const t of FORM_TEMPLATES) {
      expect(t.welcome_message.length, `${t.type} welcome_message vazio`).toBeGreaterThan(0);
      expect(t.completion_message.length, `${t.type} completion_message vazio`).toBeGreaterThan(0);
    }
  });

  it('todos os types são únicos (sem duplicata)', () => {
    const types = FORM_TEMPLATES.map(t => t.type);
    const unique = new Set(types);
    expect(unique.size).toBe(FORM_TEMPLATES.length);
  });

  it('todos os templates têm ao menos 1 campo (fields)', () => {
    for (const t of FORM_TEMPLATES) {
      expect(t.fields.length, `${t.type} sem campos`).toBeGreaterThan(0);
    }
  });
});

// ─── Campos (fields) ──────────────────────────────────────────────────────────

describe('FORM_TEMPLATES — integridade dos campos', () => {
  it('todos os campos têm field_key único dentro do template', () => {
    for (const t of FORM_TEMPLATES) {
      const keys = t.fields.map(f => f.field_key);
      const unique = new Set(keys);
      expect(unique.size, `${t.type} tem field_keys duplicados`).toBe(keys.length);
    }
  });

  it('todos os campos têm position sequencial a partir de 0', () => {
    for (const t of FORM_TEMPLATES) {
      const positions = t.fields.map(f => f.position).sort((a, b) => a - b);
      positions.forEach((pos, idx) => {
        expect(pos, `${t.type} position não sequencial`).toBe(idx);
      });
    }
  });

  it('campos field_key não contêm espaços nem caracteres especiais', () => {
    const validKey = /^[a-z0-9_]+$/;
    for (const t of FORM_TEMPLATES) {
      for (const f of t.fields) {
        expect(validKey.test(f.field_key), `${t.type}.${f.field_key} inválido`).toBe(true);
      }
    }
  });

  it('campos scale têm scale_min e scale_max nas validation_rules', () => {
    for (const t of FORM_TEMPLATES) {
      for (const f of t.fields) {
        if (f.field_type === 'scale') {
          expect(f.validation_rules?.scale_min, `${t.type}.${f.field_key} sem scale_min`).toBeDefined();
          expect(f.validation_rules?.scale_max, `${t.type}.${f.field_key} sem scale_max`).toBeDefined();
          expect(f.validation_rules!.scale_min!).toBeLessThan(f.validation_rules!.scale_max!);
        }
      }
    }
  });

  it('campos select têm options não-vazias nas validation_rules', () => {
    for (const t of FORM_TEMPLATES) {
      for (const f of t.fields) {
        if (f.field_type === 'select') {
          expect(
            Array.isArray(f.validation_rules?.options) && f.validation_rules!.options!.length > 0,
            `${t.type}.${f.field_key} select sem options`
          ).toBe(true);
        }
      }
    }
  });

  it('campos signature têm expected_value definido', () => {
    for (const t of FORM_TEMPLATES) {
      for (const f of t.fields) {
        if (f.field_type === 'signature') {
          expect(f.validation_rules?.expected_value, `${t.type}.${f.field_key} sem expected_value`).toBeTruthy();
        }
      }
    }
  });
});

// ─── Templates específicos ────────────────────────────────────────────────────

describe('FORM_TEMPLATES — templates específicos', () => {
  it('template NPS tem campo nps_score como scale 0-10', () => {
    const nps = FORM_TEMPLATES.find(t => t.type === 'nps');
    expect(nps).toBeDefined();
    const scoreField = nps!.fields.find(f => f.field_key === 'nps_score');
    expect(scoreField).toBeDefined();
    expect(scoreField!.field_type).toBe('scale');
    expect(scoreField!.validation_rules?.scale_min).toBe(0);
    expect(scoreField!.validation_rules?.scale_max).toBe(10);
  });

  it('template sorteio tem campo aceite_termos com expected_value="ACEITO"', () => {
    const sorteio = FORM_TEMPLATES.find(t => t.type === 'sorteio');
    expect(sorteio).toBeDefined();
    const aceiteField = sorteio!.fields.find(f => f.field_key === 'aceite_termos');
    expect(aceiteField).toBeDefined();
    expect(aceiteField!.field_type).toBe('signature');
    expect(aceiteField!.validation_rules?.expected_value).toBe('ACEITO');
  });

  it('template cadastro tem campo cpf do tipo cpf', () => {
    const cadastro = FORM_TEMPLATES.find(t => t.type === 'cadastro');
    expect(cadastro).toBeDefined();
    const cpfField = cadastro!.fields.find(f => f.field_key === 'cpf');
    expect(cpfField).toBeDefined();
    expect(cpfField!.field_type).toBe('cpf');
  });

  it('template feedback tem campo nota_atendente como scale 1-5', () => {
    const feedback = FORM_TEMPLATES.find(t => t.type === 'feedback');
    expect(feedback).toBeDefined();
    const notaField = feedback!.fields.find(f => f.field_key === 'nota_atendente');
    expect(notaField).toBeDefined();
    expect(notaField!.field_type).toBe('scale');
    expect(notaField!.validation_rules?.scale_min).toBe(1);
    expect(notaField!.validation_rules?.scale_max).toBe(5);
  });

  it('template vaga tem campo anos_experiencia com min=0 e max=50', () => {
    const vaga = FORM_TEMPLATES.find(t => t.type === 'vaga');
    expect(vaga).toBeDefined();
    const expField = vaga!.fields.find(f => f.field_key === 'anos_experiencia');
    expect(expField).toBeDefined();
    expect(expField!.field_type).toBe('number');
    expect(expField!.validation_rules?.min).toBe(0);
    expect(expField!.validation_rules?.max).toBe(50);
  });
});
