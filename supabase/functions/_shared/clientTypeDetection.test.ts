import { assertEquals } from 'https://deno.land/std@0.190.0/testing/asserts.ts'
import { detectClientType } from './clientTypeDetection.ts'

Deno.test('detectClientType — auto-identificação direta', () => {
  assertEquals(detectClientType('sou pintor'), 'pintor')
  assertEquals(detectClientType('Sou eletricista'), 'eletricista')
  assertEquals(detectClientType('sou um arquiteto'), 'arquiteto')
  assertEquals(detectClientType('sou pedreiro mesmo'), 'pedreiro')
})

Deno.test('detectClientType — variações verbais', () => {
  assertEquals(detectClientType('trabalho como pintor'), 'pintor')
  assertEquals(detectClientType('tô de eletricista numa obra'), 'eletricista')
  assertEquals(detectClientType('me chamo João e sou marceneiro'), 'marceneiro')
  // Nota: "tenho empresa de pintura" não é capturado pelo regex (pintura ≠ pintor).
  // LLM via set_tags pode capturar como fallback.
})

Deno.test('detectClientType — multi-word professions', () => {
  assertEquals(detectClientType('sou mestre de obras'), 'mestre_de_obras')
  assertEquals(detectClientType('trabalho como designer de interiores'), 'designer')
  assertEquals(detectClientType('sou engenheiro civil'), 'engenheiro')
})

Deno.test('detectClientType — short standalone reply (single-word answer)', () => {
  // Lead respondendo "qual sua profissao?" com 1 palavra
  assertEquals(detectClientType('Pintor'), 'pintor')
  assertEquals(detectClientType('eletricista'), 'eletricista')
  assertEquals(detectClientType('arquiteto'), 'arquiteto')
})

Deno.test('detectClientType — IGNORA menção sem identificação', () => {
  // Lead falando sobre profissional, não identificando-se
  assertEquals(detectClientType('preciso de um pintor pra obra'), null)
  assertEquals(detectClientType('o eletricista da minha casa pediu'), null)
  assertEquals(detectClientType('o arquiteto que está cuidando da reforma'), null)
})

Deno.test('detectClientType — diferentes profissões', () => {
  assertEquals(detectClientType('sou decorador'), 'decorador')
  assertEquals(detectClientType('sou marceneira'), 'marceneiro')
  assertEquals(detectClientType('trabalho como encanador'), 'encanador')
  assertEquals(detectClientType('sou gesseiro'), 'gesseiro')
  assertEquals(detectClientType('sou empreiteira'), 'empreiteiro')
  assertEquals(detectClientType('sou projetista'), 'projetista')
})

Deno.test('detectClientType — null em texto sem profissão', () => {
  assertEquals(detectClientType('oi tudo bem'), null)
  assertEquals(detectClientType('quero tinta acrílica branca'), null)
  assertEquals(detectClientType(''), null)
})
