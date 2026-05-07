import { assertEquals } from 'https://deno.land/std@0.190.0/testing/asserts.ts'
import { detectObjection } from './objectionDetection.ts'

Deno.test('detectObjection — preco variations', () => {
  assertEquals(detectObjection('Achei muito caro'), 'preco')
  assertEquals(detectObjection('Tá caro demais'), 'preco')
  assertEquals(detectObjection('Não tenho como pagar isso agora'), 'preco')
  assertEquals(detectObjection('Tô sem grana'), 'preco')
  assertEquals(detectObjection('O preço ficou alto'), 'preco')
  assertEquals(detectObjection('Saiu caro pra mim'), 'preco')
})

Deno.test('detectObjection — prazo', () => {
  assertEquals(detectObjection('Tá muito demorado'), 'prazo')
  assertEquals(detectObjection('Preciso urgente, é pra hoje'), 'prazo')
  assertEquals(detectObjection('A entrega é muito demorada?'), 'prazo')
})

Deno.test('detectObjection — frete', () => {
  assertEquals(detectObjection('O frete tá muito caro'), 'frete')
  assertEquals(detectObjection('Entrega muito cara'), 'frete')
})

Deno.test('detectObjection — concorrencia', () => {
  assertEquals(detectObjection('Vi mais barato em outra loja'), 'concorrencia')
  assertEquals(detectObjection('Achei mais barato no concorrente'), 'concorrencia')
  assertEquals(detectObjection('Tô vendo em outro lugar'), 'concorrencia')
})

Deno.test('detectObjection — indecisao', () => {
  assertEquals(detectObjection('Vou pensar'), 'indecisao')
  assertEquals(detectObjection('Te respondo depois'), 'indecisao')
  assertEquals(detectObjection('Preciso conversar com minha esposa'), 'indecisao')
  assertEquals(detectObjection('Deixa eu pensar'), 'indecisao')
})

Deno.test('detectObjection — qualidade', () => {
  assertEquals(detectObjection('Qualidade ruim'), 'qualidade')
  assertEquals(detectObjection('Não confio nessa marca'), 'qualidade')
  assertEquals(detectObjection('Isso é original?'), 'qualidade')
})

Deno.test('detectObjection — no match returns null', () => {
  assertEquals(detectObjection('Olá, quero comprar'), null)
  assertEquals(detectObjection(''), null)
  assertEquals(detectObjection('Tem tinta acrílica?'), null)
  assertEquals(detectObjection('Só uma curiosidade'), null)
})

Deno.test('detectObjection — preco wins over indecisao when both present (first match)', () => {
  // "achei caro vou pensar" — preco aparece primeiro na ordem do objeto
  assertEquals(detectObjection('Achei caro, vou pensar'), 'preco')
})
