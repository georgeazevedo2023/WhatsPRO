#!/usr/bin/env node
/**
 * Envia uma sequência de turnos (1 por linha de um arquivo) pra um número via
 * UAZAPI, com pausa entre turnos pra respeitar o debounce + processamento do
 * ai-agent. Usado nos E2E multi-turn de cenário completo.
 *
 *   UAZ_TOKEN=<token da instância LEAD> \
 *   node scripts/e2e-send-turns.mjs <number> <turnsFile> [waitMs=34000]
 *
 * turnsFile: UTF-8, um turno por linha (linhas vazias ignoradas).
 */
import { readFile } from 'node:fs/promises'

const SERVER = (process.env.UAZ_SERVER || 'https://wsmart.uazapi.com').replace(/\/$/, '')
const TOKEN = process.env.UAZ_TOKEN
const number = process.argv[2]
const turnsFile = process.argv[3]
const waitMs = Number(process.argv[4] || 34000)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

if (!TOKEN || !number || !turnsFile) {
  console.error('uso: UAZ_TOKEN=... node scripts/e2e-send-turns.mjs <number> <turnsFile> [waitMs]')
  process.exit(2)
}

const turns = (await readFile(turnsFile, 'utf8')).split('\n').map((s) => s.trim()).filter(Boolean)
for (const [i, text] of turns.entries()) {
  const res = await fetch(`${SERVER}/send/text`, {
    method: 'POST',
    headers: { token: TOKEN, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ number, text }),
  })
  console.log(`[${new Date().toISOString()}] turn ${i + 1}/${turns.length} -> ${res.status}: "${text}"`)
  if (!res.ok) { console.error(await res.text()); process.exit(1) }
  if (i < turns.length - 1) await sleep(waitMs)
}
console.log('done all turns')
