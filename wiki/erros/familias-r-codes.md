---
title: Famílias R# — Agrupamento por Tema
type: erros-famílias
updated: 2026-05-22
audited_at: 2026-05-22
---

# Famílias R# — Agrupamento por Tema

> 140+ R# acumuladas em 6 meses. Mistura nível arquitetural com micro-implementação. Esta página agrupa por **família temática** pra navegação rápida + identificação de padrões repetidos. Tabela canônica completa: [[wiki/erros/regras-preventivas]].

## 🎯 Padrão diagnóstico

Quando um sintoma aparece, **olhe a FAMÍLIA inteira** antes de criar R# nova. Provavelmente é variação de problema já catalogado.

---

## Família 1 — Anti-eco / loop LLM

> LLM repete pergunta literal, gera duplicata, ignora regra "1 pergunta por msg".

| R# | O que cobre | Status |
|---|---|---|
| R7 | Empty LLM response = silêncio | ATIVA |
| R8 | NUNCA dizer "não temos" | ATIVA |
| R121 | "Para confirmar" — blacklist expandida + 4 camadas | ATIVA |
| R128 | Detectores semânticos precisam guard temporal | ATIVA |
| R130 | Prompt sozinho não segura LLM — override pós-LLM | ATIVA |
| R135 | Anti-repetição literal quando lead respondeu sem casar | ATIVA |
| R136 | Lista multi-item mista → qualificação horizontal | ATIVA |
| R145 v3 | Anti-dup outgoing (15s + ia_cleared + startTime) | ATIVA |
| ~~R145 v1~~ | janela 60s muito ampla | SUPERSEDIDA |
| ~~R145 v2~~ | viu próprio placeholder | SUPERSEDIDA |

**Padrão comum:** LLM tem N camadas de instrução textual mas escolhe a mais específica/visual. Defesa real = guard determinístico pós-LLM.

---

## Família 2 — Categoria / interesse detection

> Categoria não detectada, alucinada, ou ID inválido (`interesse:porta` vs `interesse:portas`).

| R# | O que cobre | Status |
|---|---|---|
| R78 | Hardcoded por nicho não escala — JSONB editável | ATIVA |
| R81 | LLM ignora schema dinâmico — auditar prompt_sections | ATIVA |
| R82 | Aliasing automático no set_tags | ATIVA |
| R122 | catalog_status='offline' pula search, vai direto pra qualif | ATIVA |
| R126 | search_products query genérica sem expectedCategory → recusar | ATIVA |
| R129 | matchCategoryBySearchText retorna 1º — variante "all" | ATIVA |
| R143 | Persiste interesse:CAT mesmo sem fields extraídos | ATIVA |
| R144 | Auto-correct fuzzy singular↔plural/regex/levenshtein | ATIVA |
| Bug 12 | LLM crava interesse:VALUE inválido | mitigado por R144 |

**Padrão comum:** LLM intuitivamente usa singular humano, schema usa plural canônico. Auto-correct + seed pré-LLM resolvem.

---

## Família 3 — Tag validation / merge

> Tags conflitantes, duplicadas, ou validadas tarde demais.

| R# | O que cobre | Status |
|---|---|---|
| R52 | Regras em `additional` são baixa prioridade — usar `tags_labels` | ATIVA |
| R57 | `tipo_cliente` rejeitado se não está no VALID_KEYS | ATIVA |
| R84 | ~~VALID_KEYS hardcoded~~ → dinâmico via buildValidTagKeys(config) | **RESOLVIDA** |
| R127 | mergeTags REPLACE-by-key silencioso — validar duplicates ANTES | ATIVA |
| R142 | buildQualificationChain enriquecida com ambiente/cor/voltagem | ATIVA |
| R144 | Auto-correct fuzzy I2 (singular→plural) | ATIVA |

**Padrão comum:** validação tardia (depois do merge) = bug silencioso. Validar input ANTES de merge.

---

## Família 4 — Realtime / Race / State stale

> Estado divergente entre componentes, queue, cron, frontend.

| R# | O que cobre | Status |
|---|---|---|
| R50 | Race debounce — backlog acumulado | ATIVA |
| R86 | Pipeline assíncrono multi-canal não confia no queue | ATIVA |
| R94 | React state stale quando cron muda DB | ATIVA |
| R96 | Chamadores externos invisíveis ao monitoring | **RESOLVIDA** |
| R115 | Realtime DEVE estar em pg_publication_tables | ATIVA |
| R116 | detectResponded filtra sender_id IS NOT NULL | ATIVA |
| R132 | Re-leitura DB antes do LLM (race áudio) | ATIVA |
| R145 v3 | startTime barrier no dedup query | ATIVA |

**Padrão comum:** queue/state assíncrono ≠ verdade. Re-ler DB direto em decisões críticas.

---

## Família 5 — Hoisting / Scope / TDZ

> JavaScript scope errors (ReferenceError, const-in-if, TDZ).

| R# | O que cobre | Status |
|---|---|---|
| R58 | const em if causa ReferenceError silencioso | ATIVA |
| R59 | Hoistar IDs antes do try block | ATIVA |
| R141 | TDZ `carouselSentInThisCall` (`let` declarado depois) | ATIVA |
| R145 v3 | startTime barrier excluindo próprio placeholder | ATIVA |

**Padrão comum:** `let`/`const` hoisting silencioso. Pattern preventivo: declarar mutable state no topo da função handler.

---

## Família 6 — DB / PostgREST / RLS

> Queries quebradas, constraints rivais, GRANTs missing.

| R# | O que cobre | Status |
|---|---|---|
| R17 | NUNCA check-then-insert em unique key — upsert ON CONFLICT | ATIVA |
| R28 | NUNCA `now()` em índice parcial — IMMUTABLE only | ATIVA |
| R31 | `.single()` crasha 0 ou >1 rows — usar `.maybeSingle()` | ATIVA |
| R34 | Verificar schema real antes de coding insert | ATIVA |
| R36 | upsert onConflict exige constraint EXATA | ATIVA |
| R39 | `UNIQUE NULLS NOT DISTINCT` exige PG15 — usar 2 índices parciais | ATIVA |
| R88 | INSERT sem check `{error}` → silent (CHECK constraints) | ATIVA |
| R90 | upsert onConflict requer UNIQUE constraint | ATIVA |
| R91 | `SELECT ... FOR UPDATE` em round-robin atômico | ATIVA |
| R93 | UPDATE com RLS restritiva retorna 200 + data=[] | ATIVA |
| R98 | GRANTs missing em migrações com skip seletivo | **RESOLVIDA** |
| R138 | cleanSearchQuery — vírgula quebra PostgREST .or() | ATIVA |
| R140 | Captura stack trace em `ai_agent_logs.error` | ATIVA |

---

## Família 7 — Cron / Edge Fn / Auth

| R# | O que cobre | Status |
|---|---|---|
| R75 | verifyCronOrService + getJwtRole padrão | ATIVA |
| R77 | pg_cron Bearer no vault | ATIVA |
| R92 | Vault rotation `sb_publishable_*` | ATIVA |
| R97 | auth.users instance_id zero UUID | **RESOLVIDA** |
| R114 | Cron com CRON_AUTH_KEY exige verify_jwt=false | ATIVA |

---

## Família 8 — UI/UX Toggle / Form / Input

| R# | O que cobre | Status |
|---|---|---|
| R61 | localStorage.setItem fora de useEffect | ATIVA |
| R62 | storage event entre abas (não na mesma janela) | ATIVA |
| R65 | useState(true) loading → trava se dep não pronta | ATIVA |
| R89 | Input controlado com value=join(',') quebra digitação | ATIVA |
| R125 | Feature toggle OFF deve cancelar estado pendente | ATIVA |

---

## Família 9 — Search / Catálogo

| R# | O que cobre | Status |
|---|---|---|
| R120 | search 0 results + outside_hours → handoff direto | ATIVA |
| R121 | "tem X?" → search_products inline (4 camadas) | ATIVA |
| R122 | catalog_status offline pula search | ATIVA |
| R126 | search_guard recusa query genérica | ATIVA |
| R137 | searchGuard wire pré-LLM (marca → search) | ATIVA |
| R138 | cleanSearchQuery sanitiza antes de .or() | ATIVA |

---

## Família 10 — Multi-tenant / Configuração

| R# | O que cobre | Status |
|---|---|---|
| R74 | retention SEMPRE checa is_table_protected | ATIVA |
| R78 | JSONB editável > hardcoded por nicho | ATIVA |
| R79 | Score em service_categories só reseta em ia_cleared | ATIVA |
| R80 | NUNCA acumular commits represados | ATIVA |

---

## 📊 Estatística de saúde

| Métrica | Valor |
|---|---|
| Total R# catalogadas | ~140 |
| **Ativas** | ~130 (93%) |
| **Resolvidas estruturalmente** | 4 (R84, R96, R97, R98) |
| **Supersedidas** | 2 (R145 v1, v2) |
| Famílias identificadas | 10 |
| Família mais densa | **#2 Categoria/interesse + #9 Search** (∩ ~20 R#) |
| Família mais crítica | **#5 Hoisting/TDZ** (3 R# mas todas com observability blind) |

## 🛠️ Próximas ações sugeridas

1. **Consolidar Família 1 (Anti-eco)** — R145 v3 + R130 + R135 viraram pattern: dedup outgoing + nudge anti-loop + override pós-LLM. Documentar como **padrão "Defense-in-depth Anti-Loop"** em wiki única.
2. **Sprint C/D vai eliminar 50% da Família 2** — quando cada specialist tem prompt curto + tools strict, hallucination de interesse desaparece.
3. **Família 5 (TDZ) precisa de lint rule** — ESLint `no-use-before-define` + custom rule pra `let` declarado depois de function decl que o referencia.
4. **Família 6 (DB) é estável** — adicionar regra nova só se for verdadeiramente nova classe de bug.

---

## 🔗 Links

- [[wiki/erros/regras-preventivas]] — Tabela canônica completa
- [[wiki/erros-e-licoes]] — Lições recentes top-of-mind
- [[wiki/erros/historico-2026-05-part1]] · [[wiki/erros/historico-2026-05-part2]] · [[wiki/erros/historico-2026-05-part3]] — Histórico detalhado
