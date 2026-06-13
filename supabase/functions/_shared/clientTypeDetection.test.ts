import { describe, it, expect } from 'vitest'
import { detectClientType } from './clientTypeDetection.ts'

describe('clientTypeDetection', () => {
  it('detectClientType — auto-identificação direta', () => {
    expect(detectClientType('sou pintor')).toEqual('pintor')
    expect(detectClientType('Sou eletricista')).toEqual('eletricista')
    expect(detectClientType('sou um arquiteto')).toEqual('arquiteto')
    expect(detectClientType('sou pedreiro mesmo')).toEqual('pedreiro')
  })

  it('detectClientType — variações verbais', () => {
    expect(detectClientType('trabalho como pintor')).toEqual('pintor')
    expect(detectClientType('tô de eletricista numa obra')).toEqual('eletricista')
    expect(detectClientType('me chamo João e sou marceneiro')).toEqual('marceneiro')
    // Nota: "tenho empresa de pintura" não é capturado pelo regex (pintura ≠ pintor).
    // LLM via set_tags pode capturar como fallback.
  })

  it('detectClientType — multi-word professions', () => {
    expect(detectClientType('sou mestre de obras')).toEqual('mestre_de_obras')
    expect(detectClientType('trabalho como designer de interiores')).toEqual('designer')
    expect(detectClientType('sou engenheiro civil')).toEqual('engenheiro')
  })

  it('detectClientType — short standalone reply (single-word answer)', () => {
    // Lead respondendo "qual sua profissao?" com 1 palavra
    expect(detectClientType('Pintor')).toEqual('pintor')
    expect(detectClientType('eletricista')).toEqual('eletricista')
    expect(detectClientType('arquiteto')).toEqual('arquiteto')
  })

  it('detectClientType — IGNORA menção sem identificação', () => {
    // Lead falando sobre profissional, não identificando-se
    expect(detectClientType('preciso de um pintor pra obra')).toEqual(null)
    expect(detectClientType('o eletricista da minha casa pediu')).toEqual(null)
    expect(detectClientType('o arquiteto que está cuidando da reforma')).toEqual(null)
  })

  it('detectClientType — diferentes profissões', () => {
    expect(detectClientType('sou decorador')).toEqual('decorador')
    expect(detectClientType('sou marceneira')).toEqual('marceneiro')
    expect(detectClientType('trabalho como encanador')).toEqual('encanador')
    expect(detectClientType('sou gesseiro')).toEqual('gesseiro')
    expect(detectClientType('sou empreiteira')).toEqual('empreiteiro')
    expect(detectClientType('sou projetista')).toEqual('projetista')
  })

  it('detectClientType — null em texto sem profissão', () => {
    expect(detectClientType('oi tudo bem')).toEqual(null)
    expect(detectClientType('quero tinta acrílica branca')).toEqual(null)
    expect(detectClientType('')).toEqual(null)
  })
})
