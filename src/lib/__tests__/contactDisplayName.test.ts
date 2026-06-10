import { describe, it, expect } from 'vitest';
import { leadFullName, contactDisplayName, type DisplayableContact } from '../contactDisplayName';

// Caso real 2026-06-10: pushname do WhatsApp era literalmente "oi";
// lead se apresentou como "Jessica" e a IA gravou em lead_profiles.full_name.
const jessica: DisplayableContact = {
  name: 'oi',
  phone: '558796508760',
  lead_profiles: { full_name: 'Jessica' },
};

describe('leadFullName', () => {
  it('extrai full_name do embed objeto (1:1, contact_id UNIQUE)', () => {
    expect(leadFullName(jessica)).toBe('Jessica');
  });

  it('trata embed array defensivamente', () => {
    expect(leadFullName({ ...jessica, lead_profiles: [{ full_name: 'Jessica' }] })).toBe('Jessica');
    expect(leadFullName({ ...jessica, lead_profiles: [] })).toBeUndefined();
  });

  it('full_name vazio/whitespace não conta', () => {
    expect(leadFullName({ ...jessica, lead_profiles: { full_name: '  ' } })).toBeUndefined();
    expect(leadFullName({ ...jessica, lead_profiles: { full_name: null } })).toBeUndefined();
  });

  it('sem lead_profiles → undefined', () => {
    expect(leadFullName({ name: 'Giseli Siqueira', phone: '5581999' })).toBeUndefined();
    expect(leadFullName(null)).toBeUndefined();
    expect(leadFullName(undefined)).toBeUndefined();
  });
});

describe('contactDisplayName', () => {
  it('nome informado na conversa GANHA do pushname ("oi" → "Jessica")', () => {
    expect(contactDisplayName(jessica)).toBe('Jessica');
  });

  it('sem full_name extraído, cai no pushname (caso Giseli: pushname é o nome real)', () => {
    expect(contactDisplayName({ name: 'Giseli Siqueira', phone: '5581999' })).toBe('Giseli Siqueira');
  });

  it('sem nome nenhum, cai no telefone', () => {
    expect(contactDisplayName({ name: null, phone: '558796508760' })).toBe('558796508760');
    expect(contactDisplayName({ name: '  ', phone: '558796508760' })).toBe('558796508760');
  });

  it('contato ausente → "Desconhecido"', () => {
    expect(contactDisplayName(null)).toBe('Desconhecido');
    expect(contactDisplayName({})).toBe('Desconhecido');
  });
});
