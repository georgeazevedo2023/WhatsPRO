/**
 * Testes para src/lib/phoneUtils.ts
 * Módulo puro: zero React, zero Supabase, zero side effects.
 * 15 casos cobrindo formatação, JID, alternância e parsing de números brasileiros.
 */
import { describe, it, expect } from 'vitest';
import {
  jidToDigits,
  isGroupJid,
  getAlternateBrazilianJid,
  normalizePhoneForMatch,
  formatPhone,
  formatPhoneSimple,
  formatPhoneForDisplay,
  formatPhoneDisplay,
  parsePhoneToJid,
} from '../phoneUtils';

// ─── jidToDigits ──────────────────────────────────────────────────────────────

describe('jidToDigits', () => {
  it('extrai somente dígitos de um JID completo', () => {
    expect(jidToDigits('5511999999999@s.whatsapp.net')).toBe('5511999999999');
  });

  it('retorna apenas dígitos quando não há @domain', () => {
    expect(jidToDigits('5511987654321')).toBe('5511987654321');
  });

  it('remove domínio @g.us de JID de grupo', () => {
    expect(jidToDigits('120363000000000001@g.us')).toBe('120363000000000001');
  });

  it('retorna string vazia quando JID é só domínio', () => {
    expect(jidToDigits('@s.whatsapp.net')).toBe('');
  });
});

// ─── isGroupJid ───────────────────────────────────────────────────────────────

describe('isGroupJid', () => {
  it('retorna true para JID de grupo (@g.us)', () => {
    expect(isGroupJid('120363000000000001@g.us')).toBe(true);
  });

  it('retorna false para JID individual (@s.whatsapp.net)', () => {
    expect(isGroupJid('5511999999999@s.whatsapp.net')).toBe(false);
  });

  it('retorna false para string sem domínio', () => {
    expect(isGroupJid('5511999999999')).toBe(false);
  });
});

// ─── getAlternateBrazilianJid ─────────────────────────────────────────────────

describe('getAlternateBrazilianJid', () => {
  it('converte 13 dígitos (com 9) para 12 dígitos (sem 9)', () => {
    // 5511999999999 (13d) → remove o 9 após DDD → 551199999999 (12d)
    const result = getAlternateBrazilianJid('5511999999999@s.whatsapp.net');
    expect(result).toBe('551199999999@s.whatsapp.net');
  });

  it('converte 12 dígitos (sem 9) para 13 dígitos (com 9)', () => {
    // 551199999999 (12d) → adiciona 9 após DDD → 5511999999999 (13d)
    const result = getAlternateBrazilianJid('551199999999@s.whatsapp.net');
    expect(result).toBe('5511999999999@s.whatsapp.net');
  });

  it('retorna null para número que não começa com 55', () => {
    expect(getAlternateBrazilianJid('1234567890@s.whatsapp.net')).toBeNull();
  });

  it('retorna null para número com quantidade inesperada de dígitos', () => {
    // 14 dígitos não é nem 12 nem 13
    expect(getAlternateBrazilianJid('55119999999990@s.whatsapp.net')).toBeNull();
  });
});

// ─── normalizePhoneForMatch ───────────────────────────────────────────────────

describe('normalizePhoneForMatch', () => {
  it('retorna últimos 11 dígitos quando número tem 11+', () => {
    expect(normalizePhoneForMatch('5511999999999')).toBe('11999999999');
  });

  it('retorna últimos 10 dígitos quando número tem exatamente 10', () => {
    expect(normalizePhoneForMatch('1199999999')).toBe('1199999999');
  });

  it('remove caracteres não-numéricos antes de normalizar', () => {
    expect(normalizePhoneForMatch('+55 (11) 9 9999-9999')).toBe('11999999999');
  });

  it('retorna dígitos brutos quando menor que 10 dígitos', () => {
    expect(normalizePhoneForMatch('99999')).toBe('99999');
  });
});

// ─── formatPhone ──────────────────────────────────────────────────────────────

describe('formatPhone', () => {
  it('formata JID de 13 dígitos no padrão "55 11 99999-9999"', () => {
    expect(formatPhone('5511999999999@s.whatsapp.net')).toBe('55 11 99999-9999');
  });

  it('formata JID de 12 dígitos no padrão "55 11 9999-9999"', () => {
    expect(formatPhone('551199999999@s.whatsapp.net')).toBe('55 11 9999-9999');
  });

  it('retorna string vazia para null', () => {
    expect(formatPhone(null)).toBe('');
  });
});

// ─── formatPhoneSimple ────────────────────────────────────────────────────────

describe('formatPhoneSimple', () => {
  it('retorna somente os dígitos antes do @', () => {
    expect(formatPhoneSimple('5511999999999@s.whatsapp.net')).toBe('5511999999999');
  });

  it('retorna "Desconhecido" para string vazia', () => {
    expect(formatPhoneSimple('')).toBe('Desconhecido');
  });
});

// ─── parsePhoneToJid ─────────────────────────────────────────────────────────

describe('parsePhoneToJid', () => {
  it('adiciona @s.whatsapp.net ao número limpo', () => {
    expect(parsePhoneToJid('5511999999999')).toBe('5511999999999@s.whatsapp.net');
  });

  it('adiciona prefixo 55 quando número nacional sem DDI', () => {
    // "11999999999" (11 dígitos) → não começa com 55 → "5511999999999"
    expect(parsePhoneToJid('11999999999')).toBe('5511999999999@s.whatsapp.net');
  });

  it('retorna null para número com menos de 10 dígitos', () => {
    expect(parsePhoneToJid('999')).toBeNull();
  });

  it('remove formatação antes de parsear', () => {
    expect(parsePhoneToJid('+55 (11) 99999-9999')).toBe('5511999999999@s.whatsapp.net');
  });
});
