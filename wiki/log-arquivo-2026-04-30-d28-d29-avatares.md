---
title: Log Arquivado — 2026-04-30 (D28 + D29 + Avatares)
tags: [log, archive, d28, d29, excluded-products, valid-keys-dinamico, avatares-storage, r85, r86, r87, r88]
sources: [log.md]
updated: 2026-05-04
---

# Log Arquivado — 2026-04-30

> Entradas movidas de `log.md` durante rotação (regra 16 — log.md max 200 linhas) em 2026-05-04.

## 2026-04-30 (D28 Excluded Products + R85/R86/R87/R88 + bug fixes UI + validação prod + D29 VALID_KEYS dinâmico)

### Goal & contexto

Sessão começou com auditoria do vault (5 fixes documentais — log rotation, roadmap, index, planning files), evoluiu pra investigação dos 3 handoffs duplicados na conversa Josafa (R85+R86), e terminou shipando feature D28 completa (Excluded Products) — UI editável pelo admin pra cadastrar produtos que a tenant não vende. Validada em prod com lead George ("tem caixa de correio?" → fallback automático sem transbordo).

### Conversa Josafa — diagnóstico forense (R85+R86)

User reportou conversa com 3 handoffs duplicados em prod. Investigação:
1. Helpdesk mostrou IA mandando "Vou te encaminhar..." 3x consecutivos (16:48, 16:50, 16:51) — frase do `ai-agent/index.ts:538` (auto-handoff por message limit), NÃO do tool handler `handoff_to_human` (frase diferente)
2. SQL: `lead_msg_count = 9` na conversa, MAX_LEAD_MESSAGES default = 8 → counter já estourado
3. Causa raiz: linha 521 incrementa counter ANTES da checagem de shadow (linha 727). Conversa em SHADOW recebia novo counter increment a cada msg → sempre re-disparava auto-handoff

**Fixes aplicados (edge function v170):**
- **R85** — guard `&& conversation.status_ia !== STATUS_IA.SHADOW` na linha 536
- **R86** — `lead_msg_count: 0` reset em **5 paths** que transitam pra SHADOW: auto-handoff por message limit (l. 547), handoff_to_human tool (l. 2400), handoff trigger por texto (l. 476), validator BLOCK (l. 2724), implicit text-handoff (l. 2792), deferred handoff trigger (l. 2962)

### Feature D28 — Excluded Products

User pediu UI no admin pra cadastrar lista de produtos que a tenant não vende. Hoje a IA caía em default category → handoff genérico → vendedor respondia "não temos" manualmente. Solução: schema `ai_agents.excluded_products JSONB` editável.

**Implementação completa (4 commits, edge function v171→v172):**

1. **Migration**: `ai_agents.excluded_products JSONB DEFAULT '[]'` aplicada via Supabase MCP
2. **Helper** `_shared/excludedProducts.ts`:
   - `matchExcludedProduct(text, excluded)` — regex `\b...\b` case-insensitive + remove acentos via NFD normalize
   - `buildFallbackMessage(kw)` — `"Não trabalhamos com {kw}, posso te ajudar com outro produto?"`
   - `validateExcludedProducts(items)` — schema validation
3. **Edge function**: check em `ai-agent/index.ts:504` ANTES do counter increment, ANTES dos handoff triggers, ANTES de qualquer LLM. Match → enviar mensagem, log `excluded_product_match`, **NÃO incrementa counter**, early return. Skip se SHADOW.
4. **UI** `ExcludedProductsConfig.tsx` — subseção da tab Qualificação. Cards com keywords CSV + mensagem opcional + slugify automático no ID + validação inline.
5. **types.ts** patcheado (Row+Insert+Update) com `excluded_products: Json | null`
6. **ALLOWED_FIELDS** em `AIAgentTab.tsx` expandido

**Schema:**
```json
[
  {
    "id": "caixa_correio",
    "keywords": ["caixa de correio", "correio", "caixa correio", "mailbox"],
    "message": "",  // opcional — vazio usa fallback
    "suggested_categories": ["fechaduras"]
  }
]
```

### Bug fix #1 — espaço nas keywords (UI)

User reportou: digitando "caixa de correio" só salvava "caixadecorreio". Causa: `setKeywords` fazia `.trim()` em onChange, removendo espaço imediato após digitação. Display controlado por `value={keywords.join(', ')}` reescrevia o input a cada keystroke.

**Fix:** sub-componente `KeywordsInput` com `useState` local pra texto raw. Parse de array só dispara onChange (sem afetar text input). Sincronização com prop externa via `useEffect` watching `itemId` (não `initialValue`) — sync só quando trocar de item, não a cada update.

### Bug fix #2 — message obrigatória (UX)

User pediu fallback automático: "em resposta da ia ao quando o lead perguntar coloque sempre 'Não trabalhamos com [item], posso te ajudar com outro produto?'"

**Fix:**
- `message` agora é opcional no schema
- Helper `matchExcludedProduct` retorna `{product, matchedKeyword, message}` em vez de só product. Se `item.message` vazio, gera fallback usando `matchedKeyword` original (preserva case/acento do que admin cadastrou)
- UI removeu validação "Mensagem obrigatória"; placeholder mostra preview do fallback dinamicamente

### Validação prod — teste real (lead George)

User testou via WhatsApp Eletropiso. Sequência (confirmada via SQL):

| Hora | Quem | Mensagem | Counter | Status |
|---|---|---|---|---|
| 07:47 | Lead | "Bom dia" | 1 | greeting |
| 07:51 | Lead | "George" | 2 | LLM responde |
| 07:51 | Lead | "Tem caixa de correio?" | **2** ← não subiu! | excluded match |
| 07:52 | IA | "Não trabalhamos com caixa de correio, posso te ajudar com outro produto?" | — | ✅ |

Validações: ✅ resposta exata · ✅ counter não subiu · ✅ status_ia=ligada · ✅ tags limpas · ✅ sem handoff.

### R88 — CHECK constraint silent fail

Após teste real, descoberto que log `excluded_product_match` NÃO aparecia em `ai_agent_logs`. Causa: `chk_ai_agent_logs_event` tinha whitelist com 11 valores fixos. INSERT com event novo violava constraint, mas Supabase JS retorna `{error}` em vez de throw → swallowed silenciosamente.

**Fix:** migration `20260430000001_excluded_product_match_event.sql` adiciona `excluded_product_match` à whitelist. Aplicada direto em prod via REST API + comitada para histórico.

**Lição R88 candidata:** SEMPRE conferir CHECK constraints da tabela ANTES de adicionar event type novo no código. Em Supabase JS, INSERT errors NÃO throw — retornam `{error}` que precisa ser checado. Adicionar try/catch e log.error em todos os INSERTs de telemetria.

### Audit vault — 5 fixes documentais

1. `log.md` rotacionado (570→200 linhas) — entradas 2026-04-27/28 → archive
2. `wiki/roadmap.md` atualizada com S10 v1+v2+v3 + Sprint Eletropiso
3. `index.md` referências atualizadas + frontmatter `updated: 2026-04-29`
4. `.planning/STATE.md` e `ROADMAP.md` marcados como deprecated (workflow GSD inativo desde M2)
5. R80-R84 promovidas de "candidatas" para tabela canônica em erros-e-licoes.md

### Versões deployadas em prod

| Componente | De → Para |
|---|---|
| Edge function ai-agent | v169 → v170 (R85/R86) → v171 (D28) → **v172 (UI fixes)** |
| Bundle frontend | `index-0egZ2ilZ.js` → `index-C0Dpxdhg.js` → **`index-CFmkOcne.js`** |
| Migrations aplicadas | `excluded_products` JSONB column + `chk_ai_agent_logs_event` whitelist update |

### Testes

- **27 unit tests** em `excludedProducts.test.ts` (matcher, validator, fallback, case/acento, word boundary)
- **20 integrated runtime tests** em `scripts/test-excluded-products-runtime.mjs` (DB real → matcher idêntico ao deployed)
- **47/47 passam**, 0 regressões em base existente (559 passed total)

### Notas finais (regra 13)

- (a) **Conteúdo: 9.5/10** — diagnóstico forense da Josafa em camadas, feature D28 completa (schema+helper+UI+integração+docs+tests+migration), 2 sub-fixes encontrados via teste real (espaço + message opcional), R88 (CHECK constraint silent fail) descoberta via validação real em prod
- (b) **Orquestração: 9.5/10** — D28 ↔ R85 ↔ R86 ↔ R87 ↔ R88 ↔ PRD changelog ↔ ai-agent.md ↔ ExcludedProductsConfig.tsx todos cruzados; SYNC RULE auditada item-a-item; helper duplicado em 2 arquivos com comentário explícito (edge function vs runtime test)
- (c) **Vault: 9.5/10** — log.md rotacionado novamente (entrada 2026-04-29 → archive); migration registrada com comentário detalhado; commits com mensagens descritivas (feat/fix/test/docs)

### D29 — VALID_KEYS dinâmico (R84 resolvido)

User pediu para encerrar a dívida R84 (acoplamento manual entre `service_categories` JSONB e Set hardcoded de ~80 keys em `ai-agent/index.ts:2143`). Validação via SQL no Eletropiso revelou bug ATIVO: `tipo_tinta` cadastrado nas categorias mas ausente do hardcoded → tag rejeitada silenciosa em prod (score nunca subia em conversas sobre tinta).

**Implementação (3 arquivos):**

1. **`_shared/serviceCategories.ts`** — adicionado `BASE_VALID_TAG_KEYS` (Set readonly, ~30 keys de sistema) + função `buildValidTagKeys(config)` que combina base com `field.key` de todas as `stages.fields[]` da config (categories + default). Defesa em profundidade: aceita config null/undefined/malformada → cai em `DEFAULT_SERVICE_CATEGORIES_V2`.

2. **`ai-agent/index.ts`** — substituído `new Set([...80 strings])` por `buildValidTagKeys(aliasConfig)` (linha 2156). `aliasConfig` é calculado um pouco antes; reordenei para que `aliasConfig` venha primeiro. Comentário antigo (#25) renomeado para "#25 + R84 (2026-04-30)".

3. **`_shared/serviceCategories.test.ts`** — 9 testes novos para `buildValidTagKeys` cobrindo: base sempre presente, dynamic keys de categoria, default keys, custom config substitui categorias, null/undefined fallback, config malformada, dedup, key vazia ignorada, Eletropiso-like (regressão `tipo_tinta`).

**Nova decisão D29:** documentada com rationale completa (por que manter base em código, por que reutilizar service_categories, comportamento depois do fix, cruza com R82/R84). Wiki erros-e-licoes R84 marcada como **RESOLVIDO** (riscado + nota com data).

**Impacto em prod (após deploy do edge function):**
- Eletropiso: `tipo_tinta` passa a validar — bug R84 ativo é resolvido
- Tenants futuros: zero acoplamento manual; admin adiciona categoria nova e funciona sozinho

### Auditoria

- **Tipos:** `deno check` — 3 erros pré-existentes (nullability em outras linhas), 0 novos
- **Tests:** vitest run — 595 passed (+9 novos), 5 failed (FormBuilder pré-existente, não relacionado)
- **Grep regressão:** único match de `'motivo','interesse'` é a própria base que escrevi
- **SQL Eletropiso:** confirmado que as 52 keys dinâmicas batem com o hardcoded antigo + 1 nova (`tipo_tinta`) que estava bugada

### Pendências operacionais

- ✅ **Deploy ai-agent v173 SHIPADO** via Supabase CLI (`SUPABASE_ACCESS_TOKEN=... supabase functions deploy ai-agent --project-ref euljumeflwtljegknawy`). MCP estava offline mas CLI funcionou. R84 agora resolvido EM PROD — `tipo_tinta` no Eletropiso passa a validar.
- ✏️ User pode testar mais cenários (geladeira, freezer, microondas, airfryer) — sinônimos cobertos
- 📊 Próxima vez que excluded match disparar, verificar `ai_agent_logs WHERE event = 'excluded_product_match'` (R88 corrigido — vai aparecer)
- 🐌 Latência ~22s entre msg do lead e resposta — provavelmente debounce 10s + processamento. Investigar se virar incômodo
- 📝 Adicionar `wiki/casos-de-uso/excluded-products-detalhado.md` (padrão dual didático+técnico) — ✅ FEITO
- 🟡 Migrar 13 INSERTs em `ai_agent_logs` para `insertLogSafe` — defensivo, baixo risco
- 🟡 Particionar `decisoes-chave.md` (D7-D20 antigos têm arquivo pra mover) ou `leads-detalhado.md` (374 linhas)

### v7.18.0 — Avatares em Storage (resolve 403 do CDN do WhatsApp)

User reportou no console da página `/dashboard/leads`: 10+ erros `GET pps.whatsapp.net/... 403 Forbidden`. Diagnóstico: WhatsApp CDN devolve URLs assinadas que expiram em ~24h, e o webhook gravava esse URL temporário direto em `contacts.profile_pic_url`. Quando renderizava depois, navegador disparava 403 antes do fallback de iniciais.

Consultei a doc UAZAPI: endpoint `GET /contact/getProfilePic` existe mas devolve outra URL `pps.whatsapp.net` — também temporária. Não há endpoint de binário. **Refresh on-demand não resolve permanentemente**.

**Solução implementada:** baixar foto + armazenar em Supabase Storage (bucket público `contact-avatars`), apontar `profile_pic_url` para nosso domínio.

**Componentes:**
- Migration `20260430000002` aplicada via MCP — colunas `profile_pic_storage_path` + `profile_pic_synced_at` + bucket público + policy
- Helper `_shared/avatarStorage.ts` — pipeline UAZAPI → fetch (5s, max 1 MB) → magic-byte detection → upload (cache 7d) → UPDATE
- Edge function `refresh-avatar` — invocada pelo frontend (lazy rehydrate `onError`), throttle 5min
- `whatsapp-webhook` — substitui grava-URL-direto por `syncContactAvatar()` async; não impacta latência
- `sync-conversations` — usa o mesmo helper no bulk import
- `ContactAvatar` — prop `contactId` opcional + filtro `pps.whatsapp.net` embutido + cache `Set<contactId>` para não loopar

**Auditoria:** TS frontend 0 erros · `deno check` 4 erros pré-existentes 0 novos · vitest 624 passed (+29) 5 falhas FormBuilder pré-existentes · build `index-BciGHYho.js` ok.

**Pendência operacional:** deploy de `refresh-avatar`, `whatsapp-webhook`, `sync-conversations` + bundle frontend. Aguardando confirmação do user antes de shipar (mexe em prod).

**Notas (regra 13):**
- (a) **Conteúdo: 9/10** — pesquisei doc UAZAPI antes de decidir, comparei 4 opções (filtro frontend, refresh on-demand, baixar+storage, proxy live) com tabela de trade-offs, helper testável (10 funções puras), throttle defensivo
- (b) **Orquestração: 9/10** — PRD changelog v7.18.0 + log.md + memória conceitual. SYNC RULE NÃO se aplica (não toca AI Agent). Falta wiki/casos-de-uso/avatares-detalhado e atualizar wiki/banco-de-dados.md (decidi adiar para próxima sessão para deploy primeiro)
- (c) **Vault: 9/10** — versão bumpada no header, changelog completo, pendência operacional clara
