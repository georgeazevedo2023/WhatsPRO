import { describe, it, expect } from 'vitest'
import { extractLeadName, sanitizeProfileName, wasNameAsked } from './nameCapture.ts'

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
  it('rejeita ambiente/produto como nome (caso Garagem 2026-06-12)', () => {
    expect(extractLeadName('garagem')).toBeNull()
    expect(extractLeadName('Garagem')).toBeNull()
    expect(extractLeadName('cozinha')).toBeNull()
    expect(extractLeadName('porcelanato')).toBeNull()
  })
})

describe('sanitizeProfileName (caso real: LLM gravou interesse "Garagem" como nome)', () => {
  it('aceita nomes normais preservando capitalização', () => {
    expect(sanitizeProfileName('George')).toBe('George')
    expect(sanitizeProfileName('Maria da Silva')).toBe('Maria da Silva')
    expect(sanitizeProfileName('Ana Paula Souza')).toBe('Ana Paula Souza')
  })
  it('colapsa doubling do LLM sem comer nomes curtos', () => {
    expect(sanitizeProfileName('PedroPedro')).toBe('Pedro')
    expect(sanitizeProfileName('georgeGeorge')).toBe('george')
    expect(sanitizeProfileName('João')).toBe('João')
    expect(sanitizeProfileName('dudu')).toBe('dudu')
    expect(sanitizeProfileName('Ana')).toBe('Ana')
  })
  it('rejeita ambiente/cômodo/produto/papel', () => {
    expect(sanitizeProfileName('Garagem')).toBeNull()
    expect(sanitizeProfileName('garagem')).toBeNull()
    expect(sanitizeProfileName('Cozinha')).toBeNull()
    expect(sanitizeProfileName('Área Externa')).toBeNull()
    expect(sanitizeProfileName('Cliente')).toBeNull()
    expect(sanitizeProfileName('Porcelanato')).toBeNull()
    expect(sanitizeProfileName('Cerâmica')).toBeNull() // com acento
    expect(sanitizeProfileName('Ceramica')).toBeNull() // sem acento
  })
  it('rejeita estrutura implausível (dígitos, pergunta, frase longa)', () => {
    expect(sanitizeProfileName('60x60')).toBeNull()
    expect(sanitizeProfileName('qual o preço?')).toBeNull()
    expect(sanitizeProfileName('estou procurando uma porta de alumínio bem barata')).toBeNull()
    expect(sanitizeProfileName('')).toBeNull()
    expect(sanitizeProfileName(null)).toBeNull()
  })
  it('rejeita candidato contido nos interesses do lead', () => {
    expect(sanitizeProfileName('Suvinil', ['tinta suvinil 18L'])).toBeNull()
    expect(sanitizeProfileName('Brasilit', ['telha brasilit 244x110'])).toBeNull()
    // não-contido nos interesses passa normal
    expect(sanitizeProfileName('George', ['tinta suvinil 18L'])).toBe('George')
  })
  it('interesses vazios/nulos não quebram', () => {
    expect(sanitizeProfileName('George', [null, undefined, ''])).toBe('George')
  })
})
