import { describe, it, expect } from 'vitest'
import { detectPayment } from './paymentDetection.ts'

describe('paymentDetection', () => {
  it('detectPayment — pix intent', () => {
    expect(detectPayment('pode mandar o pix')).toEqual('pix')
    expect(detectPayment('me passa o pix')).toEqual('pix')
    expect(detectPayment('vou pagar de pix')).toEqual('pix')
    expect(detectPayment('prefiro com pix')).toEqual('pix')
    expect(detectPayment('quero a chave pix')).toEqual('pix')
    expect(detectPayment('passa o pix')).toEqual('pix')
    expect(detectPayment('pix entao')).toEqual('pix')
    expect(detectPayment('pix então')).toEqual('pix')
    expect(detectPayment('Será no pix')).toEqual('pix')
  })

  it('detectPayment — cartao intent', () => {
    expect(detectPayment('vou pagar de cartão')).toEqual('cartao')
    expect(detectPayment('prefiro cartão de crédito')).toEqual('cartao')
    expect(detectPayment('vai ser no cartão')).toEqual('cartao')
    expect(detectPayment('cartão de débito')).toEqual('cartao')
    expect(detectPayment('débito então')).toEqual('cartao')
  })

  it('detectPayment — parcelado prevalece', () => {
    expect(detectPayment('em 12x no cartão')).toEqual('parcelado')
    expect(detectPayment('parcelado em 6 vezes')).toEqual('parcelado')
    expect(detectPayment('quero dividir em 3x')).toEqual('parcelado')
    expect(detectPayment('em 5 parcelas')).toEqual('parcelado')
  })

  it('detectPayment — boleto intent', () => {
    expect(detectPayment('vou pagar de boleto')).toEqual('boleto')
    expect(detectPayment('me manda o boleto')).toEqual('boleto')
    expect(detectPayment('gera o boleto pra mim')).toEqual('boleto')
    expect(detectPayment('boleto por favor')).toEqual('boleto')
  })

  it('detectPayment — dinheiro/à vista', () => {
    expect(detectPayment('vou pagar à vista')).toEqual('dinheiro')
    expect(detectPayment('à vista em dinheiro')).toEqual('dinheiro')
    expect(detectPayment('vou pagar em dinheiro')).toEqual('dinheiro')
    expect(detectPayment('dinheiro vivo')).toEqual('dinheiro')
  })

  it('detectPayment — IGNORA consultas', () => {
    // Cliente perguntando, não escolhendo. Não deve tagear.
    expect(detectPayment('aceita pix?')).toEqual(null)
    expect(detectPayment('vocês aceitam cartão?')).toEqual(null)
    expect(detectPayment('qual a forma de pagamento?')).toEqual(null)
    expect(detectPayment('quais formas vocês têm?')).toEqual(null)
    expect(detectPayment('como eu pago?')).toEqual(null)
    expect(detectPayment('aceitam boleto?')).toEqual(null)
  })

  it('detectPayment — null em texto sem pagamento', () => {
    expect(detectPayment('oi tudo bem')).toEqual(null)
    expect(detectPayment('quero tinta acrílica branca')).toEqual(null)
    expect(detectPayment('')).toEqual(null)
  })
})
