import { assertEquals } from 'https://deno.land/std@0.190.0/testing/asserts.ts'
import { detectPayment } from './paymentDetection.ts'

Deno.test('detectPayment — pix intent', () => {
  assertEquals(detectPayment('pode mandar o pix'), 'pix')
  assertEquals(detectPayment('me passa o pix'), 'pix')
  assertEquals(detectPayment('vou pagar de pix'), 'pix')
  assertEquals(detectPayment('prefiro com pix'), 'pix')
  assertEquals(detectPayment('quero a chave pix'), 'pix')
  assertEquals(detectPayment('passa o pix'), 'pix')
  assertEquals(detectPayment('pix entao'), 'pix')
  assertEquals(detectPayment('pix então'), 'pix')
  assertEquals(detectPayment('Será no pix'), 'pix')
})

Deno.test('detectPayment — cartao intent', () => {
  assertEquals(detectPayment('vou pagar de cartão'), 'cartao')
  assertEquals(detectPayment('prefiro cartão de crédito'), 'cartao')
  assertEquals(detectPayment('vai ser no cartão'), 'cartao')
  assertEquals(detectPayment('cartão de débito'), 'cartao')
  assertEquals(detectPayment('débito então'), 'cartao')
})

Deno.test('detectPayment — parcelado prevalece', () => {
  assertEquals(detectPayment('em 12x no cartão'), 'parcelado')
  assertEquals(detectPayment('parcelado em 6 vezes'), 'parcelado')
  assertEquals(detectPayment('quero dividir em 3x'), 'parcelado')
  assertEquals(detectPayment('em 5 parcelas'), 'parcelado')
})

Deno.test('detectPayment — boleto intent', () => {
  assertEquals(detectPayment('vou pagar de boleto'), 'boleto')
  assertEquals(detectPayment('me manda o boleto'), 'boleto')
  assertEquals(detectPayment('gera o boleto pra mim'), 'boleto')
  assertEquals(detectPayment('boleto por favor'), 'boleto')
})

Deno.test('detectPayment — dinheiro/à vista', () => {
  assertEquals(detectPayment('vou pagar à vista'), 'dinheiro')
  assertEquals(detectPayment('à vista em dinheiro'), 'dinheiro')
  assertEquals(detectPayment('vou pagar em dinheiro'), 'dinheiro')
  assertEquals(detectPayment('dinheiro vivo'), 'dinheiro')
})

Deno.test('detectPayment — IGNORA consultas', () => {
  // Cliente perguntando, não escolhendo. Não deve tagear.
  assertEquals(detectPayment('aceita pix?'), null)
  assertEquals(detectPayment('vocês aceitam cartão?'), null)
  assertEquals(detectPayment('qual a forma de pagamento?'), null)
  assertEquals(detectPayment('quais formas vocês têm?'), null)
  assertEquals(detectPayment('como eu pago?'), null)
  assertEquals(detectPayment('aceitam boleto?'), null)
})

Deno.test('detectPayment — null em texto sem pagamento', () => {
  assertEquals(detectPayment('oi tudo bem'), null)
  assertEquals(detectPayment('quero tinta acrílica branca'), null)
  assertEquals(detectPayment(''), null)
})
