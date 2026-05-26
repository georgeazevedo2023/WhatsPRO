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
  'laje', 'lajes', 'exposta', 'exposto', 'cobertura', 'coberta', 'caixa', 'caixas',
  'porta', 'portas', 'entrada', 'janela', 'janelas',

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

/**
 * (2026-05-26) Palavras de INTENÇÃO/filler que NUNCA aparecem num título de produto:
 * verbos de desejo/pergunta, pronomes, artigos, preposições, palavras vazias.
 *
 * DIFERENTE de QUALIFICATION_STOP_WORDS (que tem cor/material/ambiente — esses SÃO
 * termos de busca legítimos e não podem ser dropados). Usada pelo AND-fallback do
 * search_products: o fallback exige `words.every(w => produto.includes(w))`, então
 * uma única palavra de intenção que não esteja no produto zera a busca. Caso real:
 * "quero a cuba de apoio quadrada" → "quero" não está no produto → 0 resultados →
 * handoff espúrio, mesmo a cuba existindo. Dropar essas palavras antes do .every()
 * (e do OR per-termo) torna a busca tolerante a ruído de linguagem natural.
 *
 * Lista normalizada (sem acento, lowercase) — comparar sempre via stripAccents+lower.
 */
export const SEARCH_INTENT_STOP_WORDS = new Set<string>([
  // verbos de desejo
  'quero', 'queria', 'quer', 'queremos', 'gostaria', 'gostava', 'gostariamos',
  'preciso', 'precisava', 'precisamos', 'procuro', 'procurando', 'procurava', 'procuramos',
  // verbos de pergunta / pedido
  'tem', 'tinha', 'vende', 'vendem', 'vendes', 'fazem', 'faz', 'trabalham', 'trabalha',
  'mostra', 'mostrar', 'mostre', 'manda', 'mandar', 'envia', 'enviar', 'ver', 'vendo',
  'poderia', 'pode', 'podem', 'podes', 'dispoe', 'dispoem', 'disponivel', 'disponiveis',
  // pronomes / pessoas
  'vcs', 'voces', 'voce', 'vc', 'eu', 'me', 'mim', 'nos', 'eles', 'elas',
  // artigos / demonstrativos / indefinidos
  'uma', 'um', 'uns', 'umas', 'aquele', 'aquela', 'aqueles', 'aquelas',
  'esse', 'essa', 'esses', 'essas', 'este', 'esta', 'isso', 'isto',
  'algum', 'alguma', 'alguns', 'algumas',
  // interrogativos / preposições / vazias
  'qual', 'quais', 'onde', 'como', 'quanto', 'quanta', 'sobre',
  'para', 'pra', 'por', 'com', 'sem', 'dos', 'das', 'nas', 'que', 'aqui', 'tao', 'bem',
  // perguntar preço / saber (framing comum: "saber o preço de", "quanto custa")
  'saber', 'preco', 'precos', 'valor', 'valores', 'custa', 'custam', 'custo', 'sai', 'fica',
])

/**
 * Filtra palavras de intenção/filler de uma lista de termos de busca. Entrada e
 * saída na forma original; a comparação normaliza (stripAccents + lowercase).
 */
export function filterSearchIntentTerms(words: string[]): string[] {
  return words.filter((w) => {
    const norm = w.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    return !SEARCH_INTENT_STOP_WORDS.has(norm)
  })
}
