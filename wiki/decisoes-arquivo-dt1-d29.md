---
title: Decisoes Arquivo — DT1 + D27-D29 (abril 2026)
type: decisoes-arquivo
tags: [decisoes, arquivo, abril-2026, eletropiso, excluded-products, valid-keys]
updated: 2026-05-19
---

# Decisoes Arquivo — DT1 + D27 + D28 + D29

> Decisoes registradas em abril 2026, arquivadas em 2026-05-19 pra manter `decisoes-chave.md` ativo abaixo de 300 linhas. Continuam em vigor a menos que substituidas por decisao posterior.

---


## DT1 — custom_fields Location (2026-04-11)

- `lead_profiles.custom_fields JSONB` (coluna já existe). Dado de negócio, não memória IA. Sobrevive reset de contexto.

> Decisões D21 (Helpdesk Permissões), D22-D25 (DB Monitoring), D26 v2 (Service Categories Stages+Score) e Auditoria Helpdesk 2026-04-14 arquivadas em: [[wiki/decisoes-arquivo-d21-d26]]

## D27 — Eletropiso: estratégia handoff-first em catálogo embrionário (2026-04-29)

**Contexto:** agente Eletropiso (instância única de prod) tem catálogo com 7 produtos cadastrados, mas vai atender vários nichos (porta, fechadura, escada, cano, cabo, furadeira, churrasqueira, janela, pia, cerâmica). Não dá pra esperar catálogo crescer pra começar a usar IA — usuário quer começar agora.

**Decisão:** configurar 10 categorias novas com `exit_action: handoff` direto (pula search_products) — IA qualifica (1-3 perguntas por categoria) e passa pra vendedor humano com contexto completo. Conforme catálogo crescer, mudar `exit_action: handoff → search_products` por categoria (1 SQL update, ~30s). **Tintas e impermeabilizantes preservadas** — essas têm catálogo e mantêm `search_products` no Stage 1.

**Por que não cadastrar catálogo primeiro:** sprint do user precisa entregar valor agora; catálogo cresce em paralelo; estrutura preparada destrava migração 1-a-1.

**Por que não usar `default` (qualificação básica) pra todas:** default tem só 1 stage genérico (especificacao + marca + quantidade). Categorias específicas (`material_porta`, `tipo_fechadura`, `bitola`) capturam dado de qualidade muito superior pra vendedor.

**Convenções derivadas:**
- **Sufixo de categoria nas keys** (ex: `material_porta`, `material_pia`, `material_janela`) — evita conflito de tag entre múltiplas categorias na mesma conversa
- **Phrasing literal** sem placeholders é válido (ex: churrasqueiras: "Temos churrasqueira pré-moldada e de alumínio. Qual delas te interessa?")
- **`exit_action: handoff` não impede `search_products`** — LLM ainda chama busca quando lead menciona produto específico (regra hardcoded BUSCA OBRIGATÓRIA, `index.ts:1180`); mecanismo aditivo

**SYNC RULE auditada:**
- Item 1 (banco): UPDATE service_categories ✅
- Itens 2-7: não se aplicam (Set VALID_KEYS é interno ao edge function; tipos não expostos)
- Item 8 (docs): cumprido aqui

**Rollback:** trivial via `BACKUP.json` em `.planning/phases/eletropiso-categories-2026-04-29/` — 1 UPDATE com JSON antigo restaura estado pré-sprint.

**Cruza com R81 candidata** (VALID_KEYS whitelist é silent reject) e **R8** (NUNCA dizer "não temos" — handoff resolve com contexto pro vendedor).

## D28 — Excluded Products: lista de produtos NÃO vendidos editável pelo admin (2026-04-30)

**Contexto:** Antes desta feature, a IA só sabia distinguir 2 estados: produto VENDE (casou em service_categories → qualifica e busca) ou NÃO-CADASTRADO (cai em default → handoff genérico). Quando lead pergunta sobre produto que a tenant simplesmente não trabalha (ex: caixa de correio em home center, ar-condicionado em loja de tinta), o vendedor recebia handoffs vazios e respondia "não temos" manualmente. Desperdício de atenção humana.

**Decisão:** adicionar coluna `ai_agents.excluded_products JSONB` editável via UI no admin (subseção da tab Qualificação). Schema:

```json
[
  {
    "id": "caixa_correio",
    "keywords": ["caixa de correio", "correio"],
    "message": "Não trabalhamos com caixa de correio. Posso te ajudar com cofres ou fechaduras?",
    "suggested_categories": ["fechaduras"]
  }
]
```

**Comportamento em runtime:**
1. Lead manda mensagem → ai-agent verifica `matchExcludedProduct(text, agent.excluded_products)` ANTES de incrementar counter, ANTES de checar handoff triggers, ANTES de carregar contexto LLM
2. Se matched → envia `item.message` direto, log `event: 'excluded_product_match'`, **NÃO incrementa lead_msg_count**, **NÃO faz handoff**, early return
3. Se lead em SHADOW → skip (não responde nada)

**Por que não reaproveitar `blocked_topics`:** semanticamente diferente. blocked_topics são temas tabu (concorrentes, política) — IA nunca discute. excluded_products são produtos que simplesmente não estão no portfólio — IA discute educadamente e sugere alternativas.

**Por que não usar `service_categories` com flag `excluded: true`:** mistura listas (categorias que vende vs categorias que não vende) e o schema de service_categories tem stages+score para qualificação progressiva — não faz sentido para "não vendemos".

**Convenções:**
- Match por palavra-inteira (regex `\b...\b`) — "correio" não casa "correios"
- Case-insensitive + remove acentos via `normalize('NFD')`
- Primeiro match na ordem da lista vence
- Mensagem polida e termina sugerindo categoria alternativa quando possível

**SYNC RULE auditada:**
- Item 1 (banco): migration `ai_agents_excluded_products` ✅
- Item 2 (types.ts): patch surgical (Row+Insert+Update) ✅
- Item 3 (Admin UI): `ExcludedProductsConfig.tsx` na tab Qualificação ✅
- Item 4 (ALLOWED_FIELDS): `'excluded_products'` adicionado ✅
- Item 5 (backend): `_shared/excludedProducts.ts` + check em `index.ts` linha 504 ✅
- Itens 6+7 (prompt + system_settings): N/A (não envolve LLM nem default global)
- Item 8 (docs): D28 + R87 + log ✅

**Cruza com R85** (skip auto-handoff em shadow) e **R86** (reset counter em shadow) — feature funciona em sinergia: excluded_product responde sem incrementar counter, evitando que múltiplas perguntas sobre produtos não vendidos estourem o limit e disparem auto-handoff.

## D29 — VALID_KEYS dinâmico no handler set_tags (R84 resolvido, 2026-04-30)

**Contexto:** O handler `set_tags` em `ai-agent/index.ts` valida que cada tag `"key:value"` pertence a uma whitelist (`VALID_KEYS`). Antes desta decisão, a whitelist era um `new Set([...80 strings...])` hardcoded — toda vez que admin adicionava categoria nova ao `service_categories` JSONB com fields novos (ex: `tipo_tinta`, `material_porta`), era preciso lembrar de expandir o Set + redeploy do edge function. Acoplamento manual entre dado (JSONB no banco) e código (whitelist em TS) — quebra o princípio de "config é dado, não código" (R78).

**Sintoma do bug ativo (descoberto em 2026-04-30 via SQL):** o agente Eletropiso tinha `tipo_tinta` em uma das 23 categorias do `service_categories`, mas `tipo_tinta` NÃO estava no Set hardcoded → toda vez que LLM tentava setar `tipo_tinta:fosco` a tag era rejeitada silenciosamente, score nunca subia, IA entrava em loop de enrichment.

**Decisão:** extrair `VALID_KEYS` para função `buildValidTagKeys(config)` em `_shared/serviceCategories.ts` que combina:

1. **`BASE_VALID_TAG_KEYS`** — keys de SISTEMA (não vêm de service_categories): identidade do lead, controle de fluxo, telemetria, vendas, shadow do vendedor (~30 keys constantes)
2. **Keys dinâmicas** — `field.key` de todas as `config.categories[].stages[].fields[]` + `config.default.stages[].fields[]`

```ts
const VALID_KEYS = buildValidTagKeys(aliasConfig)  // antes: new Set([...80 strings])
```

**Por que híbrido (base fixa + dinâmico):** keys de sistema (motivo, lead_score, qualif_stage, ia_cleared, vendedor_*) são taxonomia interna protegida em código — sobrevive a admin sobrescrever JSONB. Keys dinâmicas já estão em `service_categories.stages.fields[].key` por necessidade do score — reutilizar é grátis. Listar tudo no banco como "tag schema" separado é complexidade desnecessária.

**Comportamento depois do fix:** adicionar/remover categoria valida automaticamente; agente sem `service_categories` cai em `DEFAULT_SERVICE_CATEGORIES_V2` + base.

**Cruza com R82** (aliasing de keys genéricas) — o aliasing acontece ANTES da validação contra VALID_KEYS, então `material:` → `material_porta` continua funcionando. Cruza com R84 — agora resolvido.

**Validação:** 9 testes novos em `serviceCategories.test.ts` (99 total, 100%); audit do schema do Eletropiso confirmou que todas as 52 keys dinâmicas são geradas corretamente, incluindo `tipo_tinta` que estava bugado em prod.
