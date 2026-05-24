import { describe, it, expect } from 'vitest'
import { extractLeadName, wasNameAsked } from './nameCapture.ts'

describe('wasNameAsked', () => {
  it('detecta o pedido de nome do greeting', () => {
    expect(wasNameAsked('Olá! Bem-vindo a Eletropiso, com quem eu falo?')).toBe(true)
    expect(wasNameAsked('Qual o seu nome?')).toBe(true)
    expect(wasNameAsked('😊 Com quem eu falo?')).toBe(true)
  })
  it('NÃO confunde com pergunta de qualificação', () => {
    expect(wasNameAsked('Qual ambiente? (interno ou externo)')).toBe(false)
    expect(wasNameAsked('Qual acabamento você prefere?')).toBe(false)
    expect(wasNameAsked(null)).toBe(false)
  })
})

describe('extractLeadName', () => {
  it('nome puro', () => {
    expect(extractLeadName('George')).toBe('George')
    expect(extractLeadName('george')).toBe('George')
    expect(extractLeadName('Maria Silva')).toBe('Maria Silva')
  })
  it('nome bundled com pergunta de produto (caso George real)', () => {
    expect(extractLeadName('George\nQual preço de telha brasilit 244x110')).toBe('George')
  })
  it('padrões explícitos', () => {
    expect(extractLeadName('meu nome é Carlos')).toBe('Carlos')
    expect(extractLeadName('me chamo Ana Paula')).toBe('Ana Paula')
    expect(extractLeadName('sou o João')).toBe('João')
    expect(extractLeadName('pode me chamar de Zé')).toBe('Zé')
  })
  it('rejeita não-nomes', () => {
    expect(extractLeadName('Qual preço de telha brasilit 244x110')).toBeNull()
    expect(extractLeadName('oi')).toBeNull()
    expect(extractLeadName('bom dia')).toBeNull()
    expect(extractLeadName('quero tinta')).toBeNull()
    expect(extractLeadName('60x60')).toBeNull()
    expect(extractLeadName('')).toBeNull()
  })
  it('rejeita frases longas (não é nome)', () => {
    expect(extractLeadName('estou procurando uma porta de alumínio')).toBeNull()
  })
})
