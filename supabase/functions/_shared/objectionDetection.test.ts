import { describe, it, expect } from 'vitest'
import { detectObjection } from './objectionDetection.ts'

describe('objectionDetection', () => {
  it('detectObjection — preco variations', () => {
    expect(detectObjection('Achei muito caro')).toEqual('preco')
    expect(detectObjection('Tá caro demais')).toEqual('preco')
    expect(detectObjection('Não tenho como pagar isso agora')).toEqual('preco')
    expect(detectObjection('Tô sem grana')).toEqual('preco')
    expect(detectObjection('O preço ficou alto')).toEqual('preco')
    expect(detectObjection('Saiu caro pra mim')).toEqual('preco')
  })

  it('detectObjection — prazo', () => {
    expect(detectObjection('Tá muito demorado')).toEqual('prazo')
    expect(detectObjection('Preciso urgente, é pra hoje')).toEqual('prazo')
    expect(detectObjection('A entrega é muito demorada?')).toEqual('prazo')
  })

  it('detectObjection — frete', () => {
    expect(detectObjection('O frete tá muito caro')).toEqual('frete')
    expect(detectObjection('Entrega muito cara')).toEqual('frete')
  })

  it('detectObjection — concorrencia', () => {
    expect(detectObjection('Vi mais barato em outra loja')).toEqual('concorrencia')
    expect(detectObjection('Achei mais barato no concorrente')).toEqual('concorrencia')
    expect(detectObjection('Tô vendo em outro lugar')).toEqual('concorrencia')
  })

  it('detectObjection — indecisao', () => {
    expect(detectObjection('Vou pensar')).toEqual('indecisao')
    expect(detectObjection('Te respondo depois')).toEqual('indecisao')
    expect(detectObjection('Preciso conversar com minha esposa')).toEqual('indecisao')
    expect(detectObjection('Deixa eu pensar')).toEqual('indecisao')
  })

  it('detectObjection — qualidade', () => {
    expect(detectObjection('Qualidade ruim')).toEqual('qualidade')
    expect(detectObjection('Não confio nessa marca')).toEqual('qualidade')
    expect(detectObjection('Isso é original?')).toEqual('qualidade')
  })

  it('detectObjection — no match returns null', () => {
    expect(detectObjection('Olá, quero comprar')).toEqual(null)
    expect(detectObjection('')).toEqual(null)
    expect(detectObjection('Tem tinta acrílica?')).toEqual(null)
    expect(detectObjection('Só uma curiosidade')).toEqual(null)
  })

  it('detectObjection — preco wins over indecisao when both present (first match)', () => {
    // "achei caro vou pensar" — preco aparece primeiro na ordem do objeto
    expect(detectObjection('Achei caro, vou pensar')).toEqual('preco')
  })
})
