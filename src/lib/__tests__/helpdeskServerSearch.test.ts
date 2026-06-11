import { describe, it, expect } from 'vitest';
import { sanitizeSearchTerm, extractDigits, mergeServerMatches } from '../helpdeskServerSearch';

describe('sanitizeSearchTerm', () => {
  it('remove separadores do or() do PostgREST e wildcards do LIKE', () => {
    expect(sanitizeSearchTerm('Van, (teste) 100%_ok')).toBe('Van teste 100 ok');
  });
  it('normaliza espaços', () => {
    expect(sanitizeSearchTerm('  Van   Silva  ')).toBe('Van Silva');
  });
});

describe('extractDigits', () => {
  it('telefone formatado vira só dígitos (caso real do dono)', () => {
    expect(extractDigits('+55 81 9697-0061')).toBe('558196970061');
    expect(extractDigits('558196970061')).toBe('558196970061');
  });
  it('texto sem dígito vira vazio', () => {
    expect(extractDigits('Van')).toBe('');
  });
});

describe('mergeServerMatches', () => {
  const a = { id: 'a' }, b = { id: 'b' }, c = { id: 'c' };
  it('acrescenta só os que não estão na lista', () => {
    expect(mergeServerMatches([a, b], [b, c])).toEqual([a, b, c]);
  });
  it('sem matches novos retorna a MESMA referência (não quebra memo)', () => {
    const loaded = [a, b];
    expect(mergeServerMatches(loaded, [a])).toBe(loaded);
    expect(mergeServerMatches(loaded, [])).toBe(loaded);
  });
});
