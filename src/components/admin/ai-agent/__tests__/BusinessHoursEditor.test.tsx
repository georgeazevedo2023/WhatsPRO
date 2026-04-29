import { describe, it, expect } from 'vitest';
import { normalizeBusinessHours, PRESET_COMERCIO_PADRAO } from '../BusinessHoursEditor';

describe('normalizeBusinessHours', () => {
  it('returns null for null/undefined', () => {
    expect(normalizeBusinessHours(null)).toBeNull();
    expect(normalizeBusinessHours(undefined)).toBeNull();
  });

  it('returns null for non-object types', () => {
    expect(normalizeBusinessHours('string')).toBeNull();
    expect(normalizeBusinessHours(42)).toBeNull();
    expect(normalizeBusinessHours(true)).toBeNull();
  });

  it('returns null for empty/invalid object', () => {
    expect(normalizeBusinessHours({})).toBeNull();
    expect(normalizeBusinessHours({ random: 'thing' })).toBeNull();
  });

  it('migrates legacy {start, end} format to weekly applying same hours every day', () => {
    const legacy = { start: '09:00', end: '17:00' };
    const result = normalizeBusinessHours(legacy);
    expect(result).not.toBeNull();
    expect(result!.mon).toEqual({ open: true, start: '09:00', end: '17:00' });
    expect(result!.tue).toEqual({ open: true, start: '09:00', end: '17:00' });
    expect(result!.wed).toEqual({ open: true, start: '09:00', end: '17:00' });
    expect(result!.thu).toEqual({ open: true, start: '09:00', end: '17:00' });
    expect(result!.fri).toEqual({ open: true, start: '09:00', end: '17:00' });
    expect(result!.sat).toEqual({ open: true, start: '09:00', end: '17:00' });
    expect(result!.sun).toEqual({ open: true, start: '09:00', end: '17:00' });
  });

  it('keeps weekly format intact when already valid', () => {
    const result = normalizeBusinessHours(PRESET_COMERCIO_PADRAO);
    expect(result).toEqual(PRESET_COMERCIO_PADRAO);
  });

  it('fills missing day fields with defaults in weekly format', () => {
    const partial = {
      mon: { open: true, start: '08:00', end: '18:00' },
      tue: { open: false }, // missing start/end
      // wed-sun missing entirely
    };
    const result = normalizeBusinessHours(partial);
    expect(result).not.toBeNull();
    expect(result!.mon).toEqual({ open: true, start: '08:00', end: '18:00' });
    expect(result!.tue.open).toBe(false);
    expect(result!.tue.start).toBe('08:00'); // default
    expect(result!.tue.end).toBe('18:00'); // default
    expect(result!.wed.open).toBe(true); // default open=true
    expect(result!.sun.open).toBe(true); // default open=true
  });

  it('respects open=false explicitly', () => {
    const config = {
      mon: { open: true, start: '08:00', end: '18:00' },
      sun: { open: false, start: '00:00', end: '00:00' },
    };
    const result = normalizeBusinessHours(config);
    expect(result!.sun.open).toBe(false);
  });
});

describe('PRESET_COMERCIO_PADRAO', () => {
  it('has all 7 days defined', () => {
    expect(Object.keys(PRESET_COMERCIO_PADRAO)).toHaveLength(7);
    expect(PRESET_COMERCIO_PADRAO.mon).toBeDefined();
    expect(PRESET_COMERCIO_PADRAO.sun).toBeDefined();
  });

  it('has Mon-Fri 8-18, Sat 8-12, Sun closed', () => {
    expect(PRESET_COMERCIO_PADRAO.mon).toEqual({ open: true, start: '08:00', end: '18:00' });
    expect(PRESET_COMERCIO_PADRAO.fri).toEqual({ open: true, start: '08:00', end: '18:00' });
    expect(PRESET_COMERCIO_PADRAO.sat).toEqual({ open: true, start: '08:00', end: '12:00' });
    expect(PRESET_COMERCIO_PADRAO.sun.open).toBe(false);
  });
});
