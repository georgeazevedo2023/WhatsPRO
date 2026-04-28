import { describe, it, expect } from 'vitest';
import { regexToCsv, csvToRegex, isSimpleAlternation } from '../regexCsvConvert';

describe('regexCsvConvert', () => {
  describe('regexToCsv', () => {
    it('converte alternation simples para CSV', () => {
      expect(regexToCsv('tinta|esmalte|verniz')).toBe('tinta, esmalte, verniz');
    });

    it('lida com strings vazias', () => {
      expect(regexToCsv('')).toBe('');
    });

    it('remove espaços extras', () => {
      expect(regexToCsv('tinta | esmalte | verniz')).toBe('tinta, esmalte, verniz');
    });

    it('preserva acentos', () => {
      expect(regexToCsv('acrílica|epóxi')).toBe('acrílica, epóxi');
    });
  });

  describe('csvToRegex', () => {
    it('converte CSV para alternation', () => {
      expect(csvToRegex('tinta, esmalte, verniz')).toBe('tinta|esmalte|verniz');
    });

    it('lida com vírgulas trailing', () => {
      expect(csvToRegex('tinta, esmalte,')).toBe('tinta|esmalte');
    });

    it('lida com strings vazias', () => {
      expect(csvToRegex('')).toBe('');
    });
  });

  describe('round-trip (regex → csv → regex)', () => {
    it('preserva o regex em alternations simples', () => {
      const original = 'tinta|esmalte|verniz';
      expect(csvToRegex(regexToCsv(original))).toBe(original);
    });

    it('preserva acentos no round-trip', () => {
      const original = 'acrílica|epóxi|látex';
      expect(csvToRegex(regexToCsv(original))).toBe(original);
    });
  });

  describe('isSimpleAlternation', () => {
    it('aceita alternations simples', () => {
      expect(isSimpleAlternation('tinta|esmalte|verniz')).toBe(true);
      expect(isSimpleAlternation('acrílica|epóxi')).toBe(true);
      expect(isSimpleAlternation('palavra_unica')).toBe(true);
      expect(isSimpleAlternation('')).toBe(true);
    });

    it('rejeita regex com caracteres especiais', () => {
      expect(isSimpleAlternation('tinta(s)?')).toBe(false);
      expect(isSimpleAlternation('tinta.*')).toBe(false);
      expect(isSimpleAlternation('tinta[a-z]')).toBe(false);
      expect(isSimpleAlternation('tinta+')).toBe(false);
    });
  });
});
