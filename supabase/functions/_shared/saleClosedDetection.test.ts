import { assertEquals } from 'https://deno.land/std@0.190.0/testing/asserts.ts'
import { detectSaleClosed } from './saleClosedDetection.ts'

Deno.test('detectSaleClosed — comprovante', () => {
  assertEquals(detectSaleClosed('Segue o comprovante'), 'comprovante')
  assertEquals(detectSaleClosed('Comprovante do pix'), 'comprovante')
  assertEquals(detectSaleClosed('Anexei o comprovante'), 'comprovante')
  assertEquals(detectSaleClosed('Comprovante anexo'), 'comprovante')
})

Deno.test('detectSaleClosed — pago', () => {
  assertEquals(detectSaleClosed('Já paguei'), 'pago')
  assertEquals(detectSaleClosed('Fiz o pix'), 'pago')
  assertEquals(detectSaleClosed('Transferi agora'), 'pago')
  assertEquals(detectSaleClosed('Pagamento efetuado'), 'pago')
  assertEquals(detectSaleClosed('Efetuei o pagamento'), 'pago')
})

Deno.test('detectSaleClosed — pix_solicitado', () => {
  assertEquals(detectSaleClosed('Pode mandar o pix'), 'pix_solicitado')
  assertEquals(detectSaleClosed('Me passa o pix'), 'pix_solicitado')
  assertEquals(detectSaleClosed('Manda o pix por favor'), 'pix_solicitado')
  assertEquals(detectSaleClosed('Qual a chave do pix?'), 'pix_solicitado')
})

Deno.test('detectSaleClosed — fechado', () => {
  assertEquals(detectSaleClosed('Fechei!'), 'fechado')
  assertEquals(detectSaleClosed('Combinado'), 'fechado')
  assertEquals(detectSaleClosed('Tá fechado pra mim'), 'fechado')
  assertEquals(detectSaleClosed('Bora fechar'), 'fechado')
})

Deno.test('detectSaleClosed — no match', () => {
  assertEquals(detectSaleClosed(''), null)
  assertEquals(detectSaleClosed('Quanto custa?'), null)
  assertEquals(detectSaleClosed('Tem desconto?'), null)
  assertEquals(detectSaleClosed('Vou pensar'), null)
  assertEquals(detectSaleClosed('Aceita pix?'), null)
})

Deno.test('R128 — detectSaleClosed NÃO dispara em intenção de compra inicial', () => {
  // Repro: "quero comprar um material" no início da conversa
  // (Maria sandbox 2026-05-21) — antes do fix, disparava 'fechado' silenciosamente
  // e mandava conv pra shadow + venda:fechada + handoff implícito.
  assertEquals(detectSaleClosed('Quero comprar um material'), null)
  assertEquals(detectSaleClosed('quero comprar uma porta'), null)
  assertEquals(detectSaleClosed('Quero levar uma tinta'), null)
  assertEquals(detectSaleClosed('Eu queria fechar uma compra'), null)  // contém "fechar" como verbo de intenção
  assertEquals(detectSaleClosed('Bora comprar uma janela'), null)
})

Deno.test('detectSaleClosed — first match wins (comprovante before pago)', () => {
  // "segue o comprovante, paguei" — comprovante checked first per object order
  assertEquals(detectSaleClosed('Segue o comprovante, paguei agora'), 'comprovante')
})
