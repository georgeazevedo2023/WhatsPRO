#!/usr/bin/env node
// Schema parity check: verifica que toda chamada `.from('X' as any).select('col1, col2')`
// em src/**/*.{ts,tsx} referencia colunas que realmente existem na view/tabela X
// segundo `src/integrations/supabase/types.ts`.
//
// Pega bugs como R117 (2026-05-19): hook selecionava `status` mas a view `v_handoff_details`
// expõe `conversation_status` — PostgREST devolvia 400 e a página ficava vazia.
//
// Uso:
//   node scripts/check-view-selects.mjs           # warning, exit 0
//   node scripts/check-view-selects.mjs --strict  # exit 1 se houver mismatch (pre-commit/CI)

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const TYPES_FILE = join(ROOT, 'src', 'integrations', 'supabase', 'types.ts');
const STRICT = process.argv.includes('--strict');

// ── 1. Parse types.ts: monta { tableOrViewName: Set<column> } ────────────
function parseTypes(content) {
  const map = new Map();
  // Captura `<name>: { Row: { ...campos... } }`
  // Aceita identifiers entre aspas duplas/simples ou sem aspas.
  const blockRe = /^(\s{6,8})(?:"([\w_]+)"|([\w_]+)):\s*\{\s*\n\s+Row:\s*\{([\s\S]*?)\n\s+\}/gm;
  let m;
  while ((m = blockRe.exec(content)) !== null) {
    const name = m[2] || m[3];
    const rowBody = m[4];
    const cols = new Set();
    const colRe = /^\s+([\w_]+)\??:/gm;
    let cm;
    while ((cm = colRe.exec(rowBody)) !== null) cols.add(cm[1]);
    if (cols.size > 0) map.set(name, cols);
  }
  return map;
}

// ── 2. Walk src/ ───────────────────────────────────────────────────────────
function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
      walk(p, files);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      files.push(p);
    }
  }
  return files;
}

// ── 3. Extract .from('NAME' [as any]).select('cols') calls ───────────────
// O `.select(...)` pode estar em outra linha encadeada — captura até o primeiro `)`.
// IMPORTANTE: o gap entre `.from(X)` e `.select(...)` NÃO pode atravessar outro
// `.from(` — senão um `.from('a').update(...)` seguido de `.from('b').select(...)`
// faz o checker atribuir as colunas de B à tabela A (falso-positivo).
function extractCalls(src) {
  const calls = [];
  const re = /\.from\(\s*['"]([\w_]+)['"]\s*(?:as\s+(?:any|unknown))?\s*\)((?:(?!\.from\()[\s\S]){0,500}?)\.select\(\s*([`'"])([^`'"]+)\3/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const name = m[1];
    const selectStr = m[4];
    // Ignora wildcard e selects com aggregations/funções (count(*), embedding, etc.)
    if (selectStr.trim() === '*') continue;
    if (/[():!]/.test(selectStr)) continue; // pula embeddings/aggregations
    const cols = selectStr.split(',').map(s => s.trim()).filter(Boolean);
    // pula colunas com alias `nome:original` (PostgREST rename) — extrai o original
    const normalized = cols.map(c => {
      const m2 = c.match(/^[\w_]+:([\w_]+)$/);
      return m2 ? m2[1] : c;
    });
    calls.push({ name, cols: normalized, raw: selectStr });
  }
  return calls;
}

// ── Main ───────────────────────────────────────────────────────────────────
const typesContent = readFileSync(TYPES_FILE, 'utf8');
const schema = parseTypes(typesContent);

if (schema.size === 0) {
  console.error('⚠️  Não foi possível parsear types.ts — schema vazio. Schema check pulado.');
  process.exit(0);
}

const files = walk(SRC);
const errors = [];
const warnings = [];

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const calls = extractCalls(src);
  for (const call of calls) {
    const cols = schema.get(call.name);
    if (!cols) {
      warnings.push({ file, call, msg: `tabela/view "${call.name}" não encontrada em types.ts (talvez seja não-tipada — rode \`npx supabase gen types\`)` });
      continue;
    }
    const missing = call.cols.filter(c => !cols.has(c));
    if (missing.length > 0) {
      errors.push({ file, call, missing, available: [...cols].sort() });
    }
  }
}

const rel = (p) => relative(ROOT, p).replace(/\\/g, '/');

if (warnings.length > 0 && !STRICT) {
  console.log(`⚠️  ${warnings.length} aviso(s):`);
  for (const w of warnings) {
    console.log(`   ${rel(w.file)} → ${w.msg}`);
  }
  console.log('');
}

if (errors.length === 0) {
  console.log(`✅ Schema parity OK — ${files.length} arquivos verificados, ${schema.size} tabelas/views conhecidas.`);
  process.exit(0);
}

console.error(`❌ ${errors.length} mismatch(es) de schema:\n`);
for (const e of errors) {
  console.error(`📄 ${rel(e.file)}`);
  console.error(`   .from('${e.call.name}').select('${e.call.raw.slice(0, 80)}${e.call.raw.length > 80 ? '...' : ''}')`);
  console.error(`   ❌ colunas inexistentes: ${e.missing.join(', ')}`);
  console.error(`   ✓  disponíveis: ${e.available.join(', ')}`);
  console.error('');
}

console.error(`Para regenerar types: npx supabase gen types typescript --project-id <ref> > src/integrations/supabase/types.ts`);
process.exit(STRICT ? 1 : 0);
