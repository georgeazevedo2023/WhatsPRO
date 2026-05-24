#!/usr/bin/env node
/**
 * Sender UAZAPI UTF-8-safe (Windows-safe). Lê o texto de um arquivo pra não
 * depender do encoding do shell. Uso:
 *   node scripts/uaz-send.mjs <number> <textFilePath>
 * Env: UAZ_TOKEN (token da instância emissora), UAZ_SERVER (default wsmart).
 */
import { readFile } from 'node:fs/promises'

const SERVER = (process.env.UAZ_SERVER || 'https://wsmart.uazapi.com').replace(/\/$/, '')
const TOKEN = process.env.UAZ_TOKEN
const number = process.argv[2]
const textFile = process.argv[3]

if (!TOKEN || !number || !textFile) {
  console.error('uso: UAZ_TOKEN=... node scripts/uaz-send.mjs <number> <textFile>')
  process.exit(2)
}

const text = await readFile(textFile, 'utf8')
const res = await fetch(`${SERVER}/send/text`, {
  method: 'POST',
  headers: { token: TOKEN, 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ number, text }),
})
const body = await res.text()
if (!res.ok) {
  console.error(`UAZAPI ${res.status}: ${body}`)
  process.exit(1)
}
console.log(`sent ok -> ${number}`)
