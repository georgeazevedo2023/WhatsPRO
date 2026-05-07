/**
 * R110: stop-words pra detecção de marca em search_products.
 *
 * Quando search retorna 0 produtos e código tenta inferir "marca não está no catálogo",
 * palavras comuns de qualificação (ambiente, cor, tipo, unidade) eram falsamente tagueadas
 * como marca_indisponivel.
 *
 * Caso real: query "tinta acrilica branca parede interna" → "parede" e "interna" não
 * aparecem em nenhum produto → vira tag `marca_indisponivel:parede,_interna` (errado).
 *
 * Solução: filtrar essas palavras ANTES do guard. Mantém o guard <=2 (pra capturar
 * marcas compostas como "Sherwin Williams").
 *
 * Nota: lista é deliberadamente CURTA — palavras inequivocamente não-marca em pt-BR
 * para área de construção/material. Adicionar com critério (preferir lista positiva
 * de marcas no futuro se a lista crescer demais).
 */

export const QUALIFICATION_STOP_WORDS = new Set<string>([
  // Ambientes (sem acento — comparações sempre normalizadas via stripAccents)
  'parede', 'paredes', 'externa', 'externas', 'interna', 'internas', 'externo', 'interno',
  'sala', 'quarto', 'banheiro', 'cozinha', 'garagem', 'area', 'areas',
  'teto', 'tetos', 'piso', 'pisos', 'fachada', 'fachadas', 'muro', 'muros',
  'casa', 'apartamento', 'obra', 'obras', 'reforma', 'construcao',

  // Cores
  'branco', 'branca', 'preto', 'preta', 'cinza', 'azul', 'vermelho', 'vermelha',
  'amarelo', 'amarela', 'verde', 'rosa', 'roxo', 'roxa', 'marrom', 'bege', 'creme',
  'claro', 'clara', 'escuro', 'escura', 'neve', 'gelo', 'tubarao',

  // Acabamentos
  'fosco', 'fosca', 'brilho', 'brilhante', 'semibrilho', 'acetinado', 'acetinada',
  'eggshell', 'matte', 'opaco', 'opaca',

  // Tipos de tinta/material
  'acrilica', 'acrilico', 'esmalte', 'verniz', 'epoxi', 'latex', 'borracha',
  'sintetico', 'sintetica', 'liquida', 'liquido', 'manta', 'standard', 'premium',

  // Unidades
  'metros', 'metro', 'm2', 'm', 'litros', 'litro', 'galao', 'galoes',
  'kg', 'g', 'mm', 'cm', 'kilo', 'kilos',

  // Preposições / palavras vazias (já filtradas por length>2 mas redundância segura)
  'pra', 'para', 'com', 'sem',
])

/**
 * Filtra palavras de qualificação de uma lista de queryWords pra evitar falsos positivos
 * de marca não-encontrada.
 */
export function filterNonBrandTerms(words: string[]): string[] {
  return words.filter(w => !QUALIFICATION_STOP_WORDS.has(w))
}
