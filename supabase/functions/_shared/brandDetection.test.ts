import { assertEquals } from 'https://deno.land/std@0.190.0/testing/asserts.ts'
import { detectBrand } from './brandDetection.ts'

Deno.test('detectBrand — match exato simples', () => {
  assertEquals(detectBrand('quero tinta Coral branca'), 'coral')
  assertEquals(detectBrand('tem da Suvinil?'), 'suvinil')
  assertEquals(detectBrand('Tigre tem em estoque?'), 'tigre')
  assertEquals(detectBrand('manta da quartzolit'), 'quartzolit')
})

Deno.test('detectBrand — case-insensitive', () => {
  assertEquals(detectBrand('CORAL'), 'coral')
  assertEquals(detectBrand('cORaL'), 'coral')
})

Deno.test('detectBrand — accent insensitive', () => {
  assertEquals(detectBrand('aliança ferro'), 'alianca')
  assertEquals(detectBrand('Aliança Ferro'), 'alianca')
})

Deno.test('detectBrand — multi-word brands', () => {
  assertEquals(detectBrand('quero da Sherwin Williams'), 'sherwin_williams')
  assertEquals(detectBrand('La Fonte fechadura'), 'la_fonte')
  assertEquals(detectBrand('otto baumgart impermeabilizante'), 'otto_baumgart')
})

Deno.test('detectBrand — não casa substring de outra palavra', () => {
  // "coralina" não deve virar "coral"
  assertEquals(detectBrand('quero tinta coralina'), null)
  // "tigrebr" não deve casar tigre
  assertEquals(detectBrand('marca tigrebr'), null)
})

Deno.test('detectBrand — null em texto sem marca', () => {
  assertEquals(detectBrand('oi tudo bem'), null)
  assertEquals(detectBrand('tem tinta acrílica branca?'), null)
  assertEquals(detectBrand(''), null)
})

Deno.test('detectBrand — lista customizada (agent.known_brands)', () => {
  const customBrands = ['Acme Tintas', 'Globex']
  assertEquals(detectBrand('quero da acme tintas', customBrands), 'acme_tintas')
  assertEquals(detectBrand('Globex disponível?', customBrands), 'globex')
  // Coral não está na lista custom
  assertEquals(detectBrand('coral', customBrands), null)
})

Deno.test('detectBrand — primeira marca encontrada vence', () => {
  // Texto com 2 marcas — retorna a primeira na ordem da lista
  // Coral aparece antes de Suvinil em DEFAULT_BRANDS
  assertEquals(detectBrand('comparando Suvinil com Coral'), 'coral')
})
