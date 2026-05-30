// Verificação do roteamento da nova categoria "motores" (2026-05-30).
// Usa as funções REAIS (buildInteresseRegex + matchCategoryBySearchText) com um
// recorte do config real das instâncias Eletropiso. Prova: motor → motores,
// sem colisão com portas/tintas/fechaduras.
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { matchCategoryBySearchText } from './serviceCategories.ts'

// Ordem espelha o array real (tintas antes de portas; motores no fim).
const cfg = {
  categories: [
    { id: 'tintas', interesse_match: 'tinta|esmalte|verniz', stages: [] },
    { id: 'portas', interesse_match: 'porta|portas', stages: [] },
    { id: 'fechaduras', interesse_match: 'fechadura|fechaduras|trinco|trincos|cadeado|cadeados', stages: [] },
    { id: 'motores', interesse_match: 'motor|motorizado|automatizador|automatizadores|automatizar', stages: [] },
    // deno-lint-ignore no-explicit-any
  ] as any,
}
// deno-lint-ignore no-explicit-any
const cat = (t: string) => matchCategoryBySearchText(t, cfg as any)?.id ?? null

Deno.test('motor → motores (caso Cleber)', () => {
  assertEquals(cat('motor para portão'), 'motores')
  assertEquals(cat('motor de portão'), 'motores')
  assertEquals(cat('vocês tem motor de portao?'), 'motores')
  assertEquals(cat('quero automatizar meu portão'), 'motores')
  assertEquals(cat('preciso de um automatizador'), 'motores')
})

Deno.test('motor NÃO rouba porta de alumínio (porta ≠ portão)', () => {
  assertEquals(cat('tem porta de alumínio?'), 'portas')
})

Deno.test('motor não cria falso-positivo (motorista/motora)', () => {
  // "motor" é palavra inteira; não casa dentro de "motorista"
  assertEquals(cat('sou motorista, queria uma porta'), 'portas')
})

Deno.test('tinta para porta segue indo pra tintas (ordem preservada)', () => {
  assertEquals(cat('tinta para porta'), 'tintas')
  assertEquals(cat('verniz para porta'), 'tintas')
})
