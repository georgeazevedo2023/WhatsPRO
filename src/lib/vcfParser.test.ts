import { describe, it, expect } from 'vitest';
import { parseVcards } from './vcfParser';

describe('parseVcards', () => {
  it('lê um cartão simples (FN + TEL)', () => {
    const vcf = `BEGIN:VCARD
VERSION:3.0
FN:João Silva
TEL;TYPE=CELL:+55 81 99999-8888
END:VCARD`;
    expect(parseVcards(vcf)).toEqual([{ name: 'João Silva', phone: '+55 81 99999-8888' }]);
  });

  it('lê múltiplos cartões num arquivo só', () => {
    const vcf = `BEGIN:VCARD
FN:Ana
TEL:5581911112222
END:VCARD
BEGIN:VCARD
FN:Bruno
TEL:5581933334444
END:VCARD`;
    expect(parseVcards(vcf)).toEqual([
      { name: 'Ana', phone: '5581911112222' },
      { name: 'Bruno', phone: '5581933334444' },
    ]);
  });

  it('gera uma entrada por telefone quando o cartão tem vários TEL', () => {
    const vcf = `BEGIN:VCARD
FN:Carla
TEL;TYPE=CELL:5581900000001
TEL;TYPE=HOME:5581900000002
END:VCARD`;
    expect(parseVcards(vcf)).toEqual([
      { name: 'Carla', phone: '5581900000001' },
      { name: 'Carla', phone: '5581900000002' },
    ]);
  });

  it('usa N (estruturado) como fallback quando não há FN', () => {
    const vcf = `BEGIN:VCARD
N:Souza;Pedro;;;
TEL:5581955556666
END:VCARD`;
    expect(parseVcards(vcf)).toEqual([{ name: 'Pedro Souza', phone: '5581955556666' }]);
  });

  it('prefere FN sobre N mesmo se N vier antes', () => {
    const vcf = `BEGIN:VCARD
N:Souza;Pedro;;;
FN:Pedrinho
TEL:5581955556666
END:VCARD`;
    expect(parseVcards(vcf)).toEqual([{ name: 'Pedrinho', phone: '5581955556666' }]);
  });

  it('lê propriedades com prefixo de grupo (item1.TEL)', () => {
    const vcf = `BEGIN:VCARD
FN:Diego
item1.TEL:5581977778888
item1.X-ABLabel:Celular
END:VCARD`;
    expect(parseVcards(vcf)).toEqual([{ name: 'Diego', phone: '5581977778888' }]);
  });

  it('desfaz line folding (linha continuada — concatena sem espaço, RFC 6350)', () => {
    // "558190000" + dobra (CRLF + espaço de continuação) + "1111" → "5581900001111"
    const vcf = `BEGIN:VCARD
FN:Fulano
TEL:558190000\n 1111
END:VCARD`;
    expect(parseVcards(vcf)).toEqual([{ name: 'Fulano', phone: '5581900001111' }]);
  });

  it('lida com CRLF', () => {
    const vcf = 'BEGIN:VCARD\r\nFN:Elena\r\nTEL:5581922223333\r\nEND:VCARD\r\n';
    expect(parseVcards(vcf)).toEqual([{ name: 'Elena', phone: '5581922223333' }]);
  });

  it('omite o nome quando não há FN nem N', () => {
    const vcf = `BEGIN:VCARD
TEL:5581944445555
END:VCARD`;
    expect(parseVcards(vcf)).toEqual([{ phone: '5581944445555' }]);
  });

  it('ignora cartão sem telefone', () => {
    const vcf = `BEGIN:VCARD
FN:Sem Telefone
EMAIL:a@b.com
END:VCARD`;
    expect(parseVcards(vcf)).toEqual([]);
  });

  it('ignora conteúdo malformado / vazio', () => {
    expect(parseVcards('')).toEqual([]);
    expect(parseVcards('lixo qualquer sem vcard')).toEqual([]);
    // BEGIN sem END não casa → ignora
    expect(parseVcards('BEGIN:VCARD\nFN:X\nTEL:5581900000000')).toEqual([]);
  });
});
