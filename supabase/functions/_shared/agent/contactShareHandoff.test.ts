import { describe, it, expect } from 'vitest'
import {
  INCOMING_CONTACT_MEDIA_TYPE,
  detectSharedContact,
  looksLikeSharedContactText,
  greetingForHour,
  buildContactShareReply,
} from './contactShareHandoff.ts'

// Formato REAL com que o contato chega (UAZAPI → n8n → webhook achata o vCard em texto).
const REAL_CONTACT_CONTENT = 'Lara Eletropiso Lucas\nPhone: +55 87 99676-2520'

describe('looksLikeSharedContactText', () => {
  it('detecta o vCard achatado pelo n8n (caso real do dono)', () => {
    expect(looksLikeSharedContactText(REAL_CONTACT_CONTENT)).toBe(true)
    expect(looksLikeSharedContactText('Fernando Amaral Caprice\nPhone: +5587999999999')).toBe(true)
    // múltiplos números
    expect(looksLikeSharedContactText('João\nPhone: +55 11 1111-1111\nPhone: +55 11 2222-2222')).toBe(true)
    // vCard cru
    expect(looksLikeSharedContactText('BEGIN:VCARD\nFN:Maria\nTEL:+5511999999999\nEND:VCARD')).toBe(true)
  })
  it('NÃO falso-positiva em mensagem humana normal', () => {
    expect(looksLikeSharedContactText('Boa tarde, quero um porcelanato')).toBe(false)
    expect(looksLikeSharedContactText('meu telefone é 87 99676-2520')).toBe(false)
    expect(looksLikeSharedContactText('qual o preço? me liga no 999999999')).toBe(false)
    expect(looksLikeSharedContactText('')).toBe(false)
    expect(looksLikeSharedContactText(null)).toBe(false)
    expect(looksLikeSharedContactText(undefined)).toBe(false)
  })
})

describe('detectSharedContact', () => {
  it('detecta vCard nativo (media_type=contact)', () => {
    expect(detectSharedContact([{ media_type: 'contact' }])).toBe(true)
    expect(detectSharedContact([{ media_type: 'text' }, { media_type: 'contact' }])).toBe(true)
    expect(detectSharedContact([{ media_type: 'contact' }, { media_type: 'text' }])).toBe(true)
  })
  it('detecta o caso REAL: media_type=text com o vCard achatado no content', () => {
    expect(detectSharedContact([{ media_type: 'text', content: REAL_CONTACT_CONTENT }])).toBe(true)
    // decisão do dono "sempre transbordar": contato + texto junto na mesma janela
    expect(detectSharedContact([
      { media_type: 'text', content: 'Boa tarde' },
      { media_type: 'text', content: REAL_CONTACT_CONTENT },
    ])).toBe(true)
  })
  it('NÃO dispara sem contato', () => {
    expect(detectSharedContact([{ media_type: 'text', content: 'oi, tudo bem?' }])).toBe(false)
    expect(detectSharedContact([{ media_type: 'image' }, { media_type: 'audio' }])).toBe(false)
    expect(detectSharedContact([{ media_type: null, content: null }])).toBe(false)
    expect(detectSharedContact([{}])).toBe(false)
  })
  it('é robusto a entradas inválidas', () => {
    expect(detectSharedContact([])).toBe(false)
    expect(detectSharedContact(null)).toBe(false)
    expect(detectSharedContact(undefined)).toBe(false)
  })
  it('a constante bate com o que o webhook grava', () => {
    expect(INCOMING_CONTACT_MEDIA_TYPE).toBe('contact')
  })
})

describe('greetingForHour', () => {
  it('Bom dia das 5h às 11h', () => {
    expect(greetingForHour(5)).toBe('Bom dia')
    expect(greetingForHour(9)).toBe('Bom dia')
    expect(greetingForHour(11)).toBe('Bom dia')
  })
  it('Boa tarde das 12h às 17h', () => {
    expect(greetingForHour(12)).toBe('Boa tarde')
    expect(greetingForHour(15)).toBe('Boa tarde')
    expect(greetingForHour(17)).toBe('Boa tarde')
  })
  it('Boa noite das 18h às 4h', () => {
    expect(greetingForHour(18)).toBe('Boa noite')
    expect(greetingForHour(23)).toBe('Boa noite')
    expect(greetingForHour(0)).toBe('Boa noite')
    expect(greetingForHour(4)).toBe('Boa noite')
  })
  it('normaliza horas fora do range e inválidas', () => {
    expect(greetingForHour(27)).toBe('Boa noite') // 27 % 24 = 3h → Boa noite
    expect(greetingForHour(-1)).toBe('Boa noite') // -1 → 23h → Boa noite
    expect(greetingForHour(NaN)).toBe('Boa tarde') // fallback 12h → Boa tarde
  })
})

describe('buildContactShareReply', () => {
  it('sem nome: saudação + agradecimento + transbordo', () => {
    const msg = buildContactShareReply({ greeting: 'Bom dia' })
    expect(msg).toContain('Bom dia!')
    expect(msg).toContain('Obrigado pelo contato')
    expect(msg).toContain('encaminhando para um de nossos atendentes')
  })
  it('com nome: cita só o primeiro nome', () => {
    const msg = buildContactShareReply({ greeting: 'Boa tarde', leadName: 'George Azevedo' })
    expect(msg).toContain('Boa tarde, George!')
    expect(msg).not.toContain('Azevedo')
  })
  it('nome vazio/espaços vira sem nome', () => {
    expect(buildContactShareReply({ greeting: 'Boa noite', leadName: '   ' })).toContain('Boa noite!')
  })
})
