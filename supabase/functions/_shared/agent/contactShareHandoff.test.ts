import { describe, it, expect } from 'vitest'
import {
  INCOMING_CONTACT_MEDIA_TYPE,
  detectSharedContact,
  greetingForHour,
  buildContactShareReply,
} from './contactShareHandoff.ts'

describe('detectSharedContact', () => {
  it('detecta quando alguma mensagem é contato (vCard)', () => {
    expect(detectSharedContact([{ media_type: 'contact' }])).toBe(true)
    expect(detectSharedContact([{ media_type: 'text' }, { media_type: 'contact' }])).toBe(true)
    // decisão do dono: "sempre transbordar" — contato + texto junto ainda dispara
    expect(detectSharedContact([{ media_type: 'contact' }, { media_type: 'text' }])).toBe(true)
  })
  it('NÃO dispara sem contato', () => {
    expect(detectSharedContact([{ media_type: 'text' }])).toBe(false)
    expect(detectSharedContact([{ media_type: 'image' }, { media_type: 'audio' }])).toBe(false)
    expect(detectSharedContact([{ media_type: null }])).toBe(false)
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
