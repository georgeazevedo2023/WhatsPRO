import { describe, it, expect } from 'vitest'
import { detectSaleClosed, detectVendorSaleClosed, hasSaleVerdict, shouldPromoteVendorStatusToSale } from './saleClosedDetection.ts'

describe('saleClosedDetection', () => {
  it('detectSaleClosed — comprovante', () => {
    expect(detectSaleClosed('Segue o comprovante')).toEqual('comprovante')
    expect(detectSaleClosed('Comprovante do pix')).toEqual('comprovante')
    expect(detectSaleClosed('Anexei o comprovante')).toEqual('comprovante')
    expect(detectSaleClosed('Comprovante anexo')).toEqual('comprovante')
  })

  it('detectSaleClosed — pago', () => {
    expect(detectSaleClosed('Já paguei')).toEqual('pago')
    expect(detectSaleClosed('Fiz o pix')).toEqual('pago')
    expect(detectSaleClosed('Transferi agora')).toEqual('pago')
    expect(detectSaleClosed('Pagamento efetuado')).toEqual('pago')
    expect(detectSaleClosed('Efetuei o pagamento')).toEqual('pago')
  })

  it('detectSaleClosed — pix_solicitado', () => {
    expect(detectSaleClosed('Pode mandar o pix')).toEqual('pix_solicitado')
    expect(detectSaleClosed('Me passa o pix')).toEqual('pix_solicitado')
    expect(detectSaleClosed('Manda o pix por favor')).toEqual('pix_solicitado')
    expect(detectSaleClosed('Qual a chave do pix?')).toEqual('pix_solicitado')
  })

  it('detectSaleClosed — fechado', () => {
    expect(detectSaleClosed('Fechei!')).toEqual('fechado')
    expect(detectSaleClosed('Combinado')).toEqual('fechado')
    expect(detectSaleClosed('Tá fechado pra mim')).toEqual('fechado')
    expect(detectSaleClosed('Bora fechar')).toEqual('fechado')
  })

  it('detectSaleClosed — no match', () => {
    expect(detectSaleClosed('')).toEqual(null)
    expect(detectSaleClosed('Quanto custa?')).toEqual(null)
    expect(detectSaleClosed('Tem desconto?')).toEqual(null)
    expect(detectSaleClosed('Vou pensar')).toEqual(null)
    expect(detectSaleClosed('Aceita pix?')).toEqual(null)
  })

  it('Melhoria #1 — "certo"/"finalizado" SOLTOS não são venda (97/99 falso-positivos medidos em prod)', () => {
    expect(detectSaleClosed('Tá certo')).toEqual(null)
    expect(detectSaleClosed('Certo')).toEqual(null)
    expect(detectSaleClosed('Certo, obrigada!')).toEqual(null)
    expect(detectSaleClosed('Tudo certo então, te aviso amanhã')).toEqual(null)
    expect(detectSaleClosed('Finalizado o cadastro')).toEqual(null)
    // com o complemento obrigatório, continua casando
    expect(detectSaleClosed('Tá certo pra mim')).toEqual('fechado')
    expect(detectSaleClosed('Finalizado pra mim então')).toEqual('fechado')
  })

  it('R128 — detectSaleClosed NÃO dispara em intenção de compra inicial', () => {
    // Repro: "quero comprar um material" no início da conversa
    // (Maria sandbox 2026-05-21) — antes do fix, disparava 'fechado' silenciosamente
    // e mandava conv pra shadow + venda:fechada + handoff implícito.
    expect(detectSaleClosed('Quero comprar um material')).toEqual(null)
    expect(detectSaleClosed('quero comprar uma porta')).toEqual(null)
    expect(detectSaleClosed('Quero levar uma tinta')).toEqual(null)
    expect(detectSaleClosed('Eu queria fechar uma compra')).toEqual(null)  // contém "fechar" como verbo de intenção
    expect(detectSaleClosed('Bora comprar uma janela')).toEqual(null)
  })

  it('detectSaleClosed — first match wins (comprovante before pago)', () => {
    // "segue o comprovante, paguei" — comprovante checked first per object order
    expect(detectSaleClosed('Segue o comprovante, paguei agora')).toEqual('comprovante')
  })

  // ── Melhoria #1 (v7.84.0) — vendor-side detection ──────────────────────────

  it('detectVendorSaleClosed — pix_enviado', () => {
    expect(detectVendorSaleClosed('Segue a chave pix')).toEqual('pix_enviado')
    expect(detectVendorSaleClosed('Segue o pix: 8199...')).toEqual('pix_enviado')
    expect(detectVendorSaleClosed('Te passo o pix agora')).toEqual('pix_enviado')
    expect(detectVendorSaleClosed('Chave pix: loja@eletropiso.com')).toEqual('pix_enviado')
    expect(detectVendorSaleClosed('Anota a chave: 558781592373')).toEqual('pix_enviado')
  })

  it('detectVendorSaleClosed — pagamento_confirmado', () => {
    expect(detectVendorSaleClosed('Comprovante recebido!')).toEqual('pagamento_confirmado')
    expect(detectVendorSaleClosed('Recebi o pagamento, obrigado')).toEqual('pagamento_confirmado')
    expect(detectVendorSaleClosed('Pagamento confirmado')).toEqual('pagamento_confirmado')
    expect(detectVendorSaleClosed('O pix caiu aqui')).toEqual('pagamento_confirmado')
    expect(detectVendorSaleClosed('Recebemos o pix')).toEqual('pagamento_confirmado')
  })

  it('detectVendorSaleClosed — pedido_confirmado', () => {
    expect(detectVendorSaleClosed('Pedido confirmado, sai amanhã')).toEqual('pedido_confirmado')
    expect(detectVendorSaleClosed('Pedido faturado')).toEqual('pedido_confirmado')
    expect(detectVendorSaleClosed('Negócio fechado então')).toEqual('pedido_confirmado')
    expect(detectVendorSaleClosed('Vou emitir a nota')).toEqual('pedido_confirmado')
    expect(detectVendorSaleClosed('Nota fiscal emitida')).toEqual('pedido_confirmado')
  })

  it('detectVendorSaleClosed — entrega_agendada', () => {
    expect(detectVendorSaleClosed('Entrega agendada pra sexta')).toEqual('entrega_agendada')
    expect(detectVendorSaleClosed('Saiu pra entrega')).toEqual('entrega_agendada')
  })

  it('detectVendorSaleClosed — agradecimento_compra', () => {
    expect(detectVendorSaleClosed('Obrigado pela compra!')).toEqual('agradecimento_compra')
    expect(detectVendorSaleClosed('Obrigada pela compra, qualquer coisa chama')).toEqual('agradecimento_compra')
  })

  it('detectVendorSaleClosed — fallback pros padrões de lead (comportamento pré-existente)', () => {
    // Vendedor dizendo "fechado/combinado" já casava os padrões de lead antes
    expect(detectVendorSaleClosed('Fechado!')).toEqual('fechado')
    expect(detectVendorSaleClosed('Combinado, te espero')).toEqual('fechado')
  })

  it('detectVendorSaleClosed — negociação NÃO é fechamento', () => {
    expect(detectVendorSaleClosed('')).toEqual(null)
    expect(detectVendorSaleClosed('Aceita pix?')).toEqual(null)
    expect(detectVendorSaleClosed('Parcela no cartão em até 10x')).toEqual(null)
    expect(detectVendorSaleClosed('O valor fica 250 reais')).toEqual(null)
    // "obrigado pela preferência" é dito até em negociação PERDIDA — não conta
    expect(detectVendorSaleClosed('Obrigado pela preferência!')).toEqual(null)
    // "anotei seu pedido" é coleta de pedido (msg de handoff), não venda
    expect(detectVendorSaleClosed('Anotei seu pedido de 3 lâmpadas')).toEqual(null)
    expect(detectVendorSaleClosed('Posso fazer um orçamento pra você')).toEqual(null)
  })

  it('hasSaleVerdict — venda:* ou resultado:* contam como veredito', () => {
    expect(hasSaleVerdict(['venda:fechada'])).toEqual(true)
    expect(hasSaleVerdict(['resultado:venda'])).toEqual(true)
    expect(hasSaleVerdict(['resultado:perdido'])).toEqual(true)
    expect(hasSaleVerdict(['venda_status:fechada'])).toEqual(false) // venda_status NÃO é veredito
    expect(hasSaleVerdict(['interesse:tintas', 'lead_score:60'])).toEqual(false)
    expect(hasSaleVerdict([])).toEqual(false)
    expect(hasSaleVerdict(null)).toEqual(false)
    expect(hasSaleVerdict(undefined)).toEqual(false)
  })

  it('shouldPromoteVendorStatusToSale — promove só venda_status:fechada sem veredito prévio', () => {
    expect(shouldPromoteVendorStatusToSale(['venda_status:fechada'], [])).toEqual(true)
    expect(shouldPromoteVendorStatusToSale(['venda_status:fechada'], ['interesse:tintas'])).toEqual(true)
    // normalização: espaço após ':' e maiúsculas (variações reais do LLM)
    expect(shouldPromoteVendorStatusToSale(['venda_status: fechada'], [])).toEqual(true)
    expect(shouldPromoteVendorStatusToSale(['Venda_Status:Fechada'], [])).toEqual(true)
    // não promove: status diferente
    expect(shouldPromoteVendorStatusToSale(['venda_status:fechando'], [])).toEqual(false)
    expect(shouldPromoteVendorStatusToSale(['venda_status:negociando'], [])).toEqual(false)
    expect(shouldPromoteVendorStatusToSale([], [])).toEqual(false)
    // não promove: veredito já existe (IA ou humano vencem o LLM)
    expect(shouldPromoteVendorStatusToSale(['venda_status:fechada'], ['venda:fechada'])).toEqual(false)
    expect(shouldPromoteVendorStatusToSale(['venda_status:fechada'], ['resultado:perdido'])).toEqual(false)
    expect(shouldPromoteVendorStatusToSale(['venda_status:fechada'], ['resultado:venda'])).toEqual(false)
  })
})
