import { assertEquals } from 'https://deno.land/std@0.190.0/testing/asserts.ts'
import { detectSaleClosed, detectVendorSaleClosed, hasSaleVerdict, shouldPromoteVendorStatusToSale } from './saleClosedDetection.ts'

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

Deno.test('Melhoria #1 — "certo"/"finalizado" SOLTOS não são venda (97/99 falso-positivos medidos em prod)', () => {
  assertEquals(detectSaleClosed('Tá certo'), null)
  assertEquals(detectSaleClosed('Certo'), null)
  assertEquals(detectSaleClosed('Certo, obrigada!'), null)
  assertEquals(detectSaleClosed('Tudo certo então, te aviso amanhã'), null)
  assertEquals(detectSaleClosed('Finalizado o cadastro'), null)
  // com o complemento obrigatório, continua casando
  assertEquals(detectSaleClosed('Tá certo pra mim'), 'fechado')
  assertEquals(detectSaleClosed('Finalizado pra mim então'), 'fechado')
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

// ── Melhoria #1 (v7.84.0) — vendor-side detection ──────────────────────────

Deno.test('detectVendorSaleClosed — pix_enviado', () => {
  assertEquals(detectVendorSaleClosed('Segue a chave pix'), 'pix_enviado')
  assertEquals(detectVendorSaleClosed('Segue o pix: 8199...'), 'pix_enviado')
  assertEquals(detectVendorSaleClosed('Te passo o pix agora'), 'pix_enviado')
  assertEquals(detectVendorSaleClosed('Chave pix: loja@eletropiso.com'), 'pix_enviado')
  assertEquals(detectVendorSaleClosed('Anota a chave: 558781592373'), 'pix_enviado')
})

Deno.test('detectVendorSaleClosed — pagamento_confirmado', () => {
  assertEquals(detectVendorSaleClosed('Comprovante recebido!'), 'pagamento_confirmado')
  assertEquals(detectVendorSaleClosed('Recebi o pagamento, obrigado'), 'pagamento_confirmado')
  assertEquals(detectVendorSaleClosed('Pagamento confirmado'), 'pagamento_confirmado')
  assertEquals(detectVendorSaleClosed('O pix caiu aqui'), 'pagamento_confirmado')
  assertEquals(detectVendorSaleClosed('Recebemos o pix'), 'pagamento_confirmado')
})

Deno.test('detectVendorSaleClosed — pedido_confirmado', () => {
  assertEquals(detectVendorSaleClosed('Pedido confirmado, sai amanhã'), 'pedido_confirmado')
  assertEquals(detectVendorSaleClosed('Pedido faturado'), 'pedido_confirmado')
  assertEquals(detectVendorSaleClosed('Negócio fechado então'), 'pedido_confirmado')
  assertEquals(detectVendorSaleClosed('Vou emitir a nota'), 'pedido_confirmado')
  assertEquals(detectVendorSaleClosed('Nota fiscal emitida'), 'pedido_confirmado')
})

Deno.test('detectVendorSaleClosed — entrega_agendada', () => {
  assertEquals(detectVendorSaleClosed('Entrega agendada pra sexta'), 'entrega_agendada')
  assertEquals(detectVendorSaleClosed('Saiu pra entrega'), 'entrega_agendada')
})

Deno.test('detectVendorSaleClosed — agradecimento_compra', () => {
  assertEquals(detectVendorSaleClosed('Obrigado pela compra!'), 'agradecimento_compra')
  assertEquals(detectVendorSaleClosed('Obrigada pela compra, qualquer coisa chama'), 'agradecimento_compra')
})

Deno.test('detectVendorSaleClosed — fallback pros padrões de lead (comportamento pré-existente)', () => {
  // Vendedor dizendo "fechado/combinado" já casava os padrões de lead antes
  assertEquals(detectVendorSaleClosed('Fechado!'), 'fechado')
  assertEquals(detectVendorSaleClosed('Combinado, te espero'), 'fechado')
})

Deno.test('detectVendorSaleClosed — negociação NÃO é fechamento', () => {
  assertEquals(detectVendorSaleClosed(''), null)
  assertEquals(detectVendorSaleClosed('Aceita pix?'), null)
  assertEquals(detectVendorSaleClosed('Parcela no cartão em até 10x'), null)
  assertEquals(detectVendorSaleClosed('O valor fica 250 reais'), null)
  // "obrigado pela preferência" é dito até em negociação PERDIDA — não conta
  assertEquals(detectVendorSaleClosed('Obrigado pela preferência!'), null)
  // "anotei seu pedido" é coleta de pedido (msg de handoff), não venda
  assertEquals(detectVendorSaleClosed('Anotei seu pedido de 3 lâmpadas'), null)
  assertEquals(detectVendorSaleClosed('Posso fazer um orçamento pra você'), null)
})

Deno.test('hasSaleVerdict — venda:* ou resultado:* contam como veredito', () => {
  assertEquals(hasSaleVerdict(['venda:fechada']), true)
  assertEquals(hasSaleVerdict(['resultado:venda']), true)
  assertEquals(hasSaleVerdict(['resultado:perdido']), true)
  assertEquals(hasSaleVerdict(['venda_status:fechada']), false) // venda_status NÃO é veredito
  assertEquals(hasSaleVerdict(['interesse:tintas', 'lead_score:60']), false)
  assertEquals(hasSaleVerdict([]), false)
  assertEquals(hasSaleVerdict(null), false)
  assertEquals(hasSaleVerdict(undefined), false)
})

Deno.test('shouldPromoteVendorStatusToSale — promove só venda_status:fechada sem veredito prévio', () => {
  assertEquals(shouldPromoteVendorStatusToSale(['venda_status:fechada'], []), true)
  assertEquals(shouldPromoteVendorStatusToSale(['venda_status:fechada'], ['interesse:tintas']), true)
  // normalização: espaço após ':' e maiúsculas (variações reais do LLM)
  assertEquals(shouldPromoteVendorStatusToSale(['venda_status: fechada'], []), true)
  assertEquals(shouldPromoteVendorStatusToSale(['Venda_Status:Fechada'], []), true)
  // não promove: status diferente
  assertEquals(shouldPromoteVendorStatusToSale(['venda_status:fechando'], []), false)
  assertEquals(shouldPromoteVendorStatusToSale(['venda_status:negociando'], []), false)
  assertEquals(shouldPromoteVendorStatusToSale([], []), false)
  // não promove: veredito já existe (IA ou humano vencem o LLM)
  assertEquals(shouldPromoteVendorStatusToSale(['venda_status:fechada'], ['venda:fechada']), false)
  assertEquals(shouldPromoteVendorStatusToSale(['venda_status:fechada'], ['resultado:perdido']), false)
  assertEquals(shouldPromoteVendorStatusToSale(['venda_status:fechada'], ['resultado:venda']), false)
})
