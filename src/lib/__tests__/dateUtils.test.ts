/**
 * Testes para src/lib/dateUtils.ts
 * Funções puras de formatação de data no fuso horário America/Sao_Paulo.
 * 13 casos cobrindo formatBR, timeAgoBR, smartDateBR e BRAZIL_TZ.
 */
import { describe, it, expect } from 'vitest';
import { formatBR, timeAgoBR, smartDateBR, BRAZIL_TZ } from '../dateUtils';

// ─── BRAZIL_TZ ────────────────────────────────────────────────────────────────

describe('BRAZIL_TZ', () => {
  it('é "America/Sao_Paulo"', () => {
    expect(BRAZIL_TZ).toBe('America/Sao_Paulo');
  });
});

// ─── formatBR ─────────────────────────────────────────────────────────────────

describe('formatBR', () => {
  it('formata data ISO no padrão dd/MM/yyyy', () => {
    // Data fixa em UTC que em SP também é 15/03/2024 (não há viagem de dia)
    const result = formatBR('2024-03-15T15:00:00Z', 'dd/MM/yyyy');
    expect(result).toBe('15/03/2024');
  });

  it('formata hora em HH:mm dentro do fuso SP', () => {
    // UTC-3: 2024-03-15T12:00:00Z → 09:00 em SP
    const result = formatBR('2024-03-15T12:00:00Z', 'HH:mm');
    expect(result).toBe('09:00');
  });

  it('aceita objeto Date além de string', () => {
    const date = new Date('2024-06-01T00:00:00Z');
    const result = formatBR(date, 'yyyy');
    expect(result).toBe('2024');
  });

  it('retorna mês em português quando usando formato "MMMM"', () => {
    const result = formatBR('2024-01-15T12:00:00Z', 'MMMM');
    // pt-BR: janeiro
    expect(result.toLowerCase()).toBe('janeiro');
  });

  it('formata dia da semana em português abreviado', () => {
    // 2024-07-15 é segunda-feira
    const result = formatBR('2024-07-15T12:00:00Z', 'EEE');
    expect(result.toLowerCase()).toMatch(/^seg/);
  });
});

// ─── timeAgoBR ────────────────────────────────────────────────────────────────

describe('timeAgoBR', () => {
  it('retorna string não-vazia para data recente', () => {
    const recent = new Date(Date.now() - 5 * 60 * 1000); // 5 min atrás
    const result = timeAgoBR(recent);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('aceita string ISO além de objeto Date', () => {
    const isoString = new Date(Date.now() - 3600000).toISOString();
    const result = timeAgoBR(isoString);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('retorna texto em português para data de 2 dias atrás', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600 * 1000);
    const result = timeAgoBR(twoDaysAgo);
    // pt-BR: "2 dias"
    expect(result).toMatch(/dia/i);
  });
});

// ─── smartDateBR ──────────────────────────────────────────────────────────────

describe('smartDateBR', () => {
  it('retorna "Ontem" para data de exatamente ontem', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    // Fixar no meio do dia para evitar edge case de meia-noite
    yesterday.setHours(12, 0, 0, 0);
    const result = smartDateBR(yesterday);
    expect(result).toBe('Ontem');
  });

  it('retorna formato dd/MM para datas mais antigas que ontem', () => {
    // Data com 3 dias atrás → formato "dd/MM"
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    threeDaysAgo.setHours(12, 0, 0, 0);
    const result = smartDateBR(threeDaysAgo);
    expect(result).toMatch(/^\d{2}\/\d{2}$/);
  });

  it('retorna formato HH:mm para data de hoje (hora recente)', () => {
    // 30 min atrás → mesmo dia → "HH:mm"
    const recentToday = new Date(Date.now() - 30 * 60 * 1000);
    const result = smartDateBR(recentToday);
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });

  it('aceita string ISO além de objeto Date', () => {
    const isoString = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString();
    const result = smartDateBR(isoString);
    // Mais de 1 dia atrás → "dd/MM" ou "Ontem"
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
