---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

## 2026-04-30 (D28 Excluded Products + R85/R86/R87/R88 + bug fixes UI + validação prod)

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

### Pendências operacionais

- ✏️ User pode testar mais cenários (geladeira, freezer, microondas, airfryer) — sinônimos cobertos
- 📊 Próxima vez que excluded match disparar, verificar `ai_agent_logs WHERE event = 'excluded_product_match'` (R88 corrigido — vai aparecer)
- 🐌 Latência ~22s entre msg do lead e resposta — provavelmente debounce 10s + processamento. Investigar se virar incômodo
- 📝 Adicionar `wiki/casos-de-uso/excluded-products-detalhado.md` (padrão dual didático+técnico)
- 🔄 Considerar `VALID_KEYS` dinâmico (lê do schema service_categories) — R84 candidato

---

> Sessão 2026-04-29 (Eletropiso — 23 categorias + 7 fixes ai-agent v162→v169 + BusinessHoursEditor + audit) arquivada em:
> - [[wiki/log-arquivo-2026-04-29-eletropiso]]
>
> Sessões 2026-04-27 (M19-S10 v1+v2+v3) e 2026-04-28 (Deploy 16 commits represados → prod) arquivadas em:
> - [[wiki/log-arquivo-2026-04-27-a-28-m19-s10]]
>
> Sessão 2026-04-27 manhã (Auditoria geral + 210 melhorias documentadas) e 2026-04-26 (Refactor do Orquestrador CLAUDE.md/RULES.md) arquivadas em:
> - [[wiki/log-arquivo-2026-04-27-auditoria-geral]]
>
> Sessão maratona 2026-04-25 (Helpdesk inbox permissions + M19 S8 + S8.1) arquivada em:
> - [[wiki/log-arquivo-2026-04-25-s8-helpdesk]]
>
> Entrada de 2026-04-14 (Auditoria Helpdesk — 10 fixes + Storage + Playwright):
> - `wiki/log-arquivo-2026-04-14-helpdesk-audit.md`
>
> Entradas de M19 S3-S5 (2026-04-13):
> - `wiki/log-arquivo-2026-04-13-m19-s3s5.md`
>
> Entradas de M19 S1+S2:
> - `wiki/log-arquivo-2026-04-13-m19-s1s2.md`
>
> Entradas anteriores (2026-04-11/12):
> - `wiki/log-arquivo-2026-04-12-agent-metricas.md`
> - `wiki/log-arquivo-2026-04-12-fixes-kpi-s12.md`
> - `wiki/log-arquivo-2026-04-12-fluxos-s6s11.md`
> - `wiki/log-arquivo-2026-04-11-fluxos-v3-s1s2.md`
