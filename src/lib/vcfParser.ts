/**
 * Parser de vCard (.vcf) — função pura, sem dependências.
 *
 * Lê o conteúdo de um arquivo .vcf (exportado de celular/Google Contacts, que
 * normalmente contém VÁRIOS cartões num arquivo só) e devolve uma lista de
 * { name, phone } — uma entrada por número de telefone encontrado (um contato
 * com 2 telefones gera 2 entradas com o mesmo nome).
 *
 * Não normaliza/valida o telefone aqui — devolve o valor cru. A validação fica
 * na camada de UI via `parsePhoneToJid` (mesma usada pelas abas Colar/CSV),
 * mantendo um único ponto de verdade para "o que é um telefone válido".
 */

export interface ParsedVcardContact {
  name?: string;
  phone: string;
}

/** Monta um nome a partir da propriedade estruturada N ("Sobrenome;Nome;Meio;Prefixo;Sufixo"). */
function nameFromStructured(value: string): string | undefined {
  const parts = value.split(';').map((p) => p.trim());
  const last = parts[0] || '';
  const first = parts[1] || '';
  const composed = `${first} ${last}`.trim();
  return composed || undefined;
}

export function parseVcards(text: string): ParsedVcardContact[] {
  const results: ParsedVcardContact[] = [];
  if (!text || typeof text !== 'string') return results;

  // Normaliza quebras de linha e desfaz "line folding" do vCard
  // (linhas continuadas começam com espaço ou tab — RFC 6350 §3.2).
  const unfolded = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '');

  const cardRegex = /BEGIN:VCARD([\s\S]*?)END:VCARD/gi;
  let match: RegExpExecArray | null;

  while ((match = cardRegex.exec(unfolded)) !== null) {
    const lines = match[1].split('\n').map((l) => l.trim()).filter(Boolean);

    let fn: string | undefined;
    let nFallback: string | undefined;
    const phones: string[] = [];

    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;

      const rawProp = line.slice(0, colonIdx);
      const value = line.slice(colonIdx + 1).trim();
      if (!value) continue;

      // rawProp pode trazer grupo ("item1.TEL") e parâmetros ("TEL;TYPE=CELL").
      const propName = rawProp.split(';')[0].split('.').pop()!.toUpperCase();

      if (propName === 'FN') {
        if (!fn) fn = value;
      } else if (propName === 'N') {
        if (!nFallback) nFallback = nameFromStructured(value);
      } else if (propName === 'TEL') {
        phones.push(value);
      }
    }

    const name = fn || nFallback;
    for (const phone of phones) {
      results.push(name ? { name, phone } : { phone });
    }
  }

  return results;
}
