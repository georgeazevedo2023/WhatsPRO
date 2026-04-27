---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

## 2026-04-27 (M19-S10 v2 — Stages + Score)

### Razão da evolução

v1 (mesma data, schema plano com `qualification_fields[]` + boolean `ask_pre_search`) foi superseded antes da UI integrar ao admin. Motivos:
- **Admin não-técnico** — UI binária (`ask_pre_search: true|false`) era ruim de explicar; funil visual com stages comunica intenção de negócio.
- **Conexão com `lead_score_history`** (M19 S2) — v1 não capitalizava na tabela existente; v2 persiste score progressivo em tempo real, alimentando o Dashboard do Gestor.

### 7 sub-decisões (D26.1 a D26.7)

| # | Sub-decisão | Justificativa |
|---|-------------|---------------|
| D26.1 | Score persistente em tag `lead_score:N` + `lead_score_history` | Conecta com M19 S2/S3 sem retrabalho |
| D26.2 | Score reseta apenas em `ia_cleared:` | Consistente com clear context |
| D26.3 | 1 categoria primária por conversa via tag `interesse:` | Evita múltiplos funis competindo |
| D26.4 | Score NUNCA visível ao lead | Métrica interna gestor |
| D26.5 | Nova tab "Qualificação" (9ª) | Stages complexos justificam tab dedicada |
| D26.6 | `exit_action`: `search_products` \| `enrichment` \| `handoff` \| `continue` | Stage decide comportamento ao atingir teto |
| D26.7 | `score_value` por field, total 100 por categoria | Alinhado com NPS-like scoring |

### 5 fases (1 a mais que v1)

- **F1.5** — Backend Isolado v2 (Agente A): migration `20260427000002_ai_agent_service_categories_v2_stages.sql`, helper `_shared/serviceCategories.ts` reescrito (tipos `Stage`, `ExitAction`; funções `getCurrentStage`, `getNextField`, `getScoreFromTags`, `calculateScoreDelta`), RPC `add_lead_score_event`, 40+ testes vitest.
- **F2 v2** — Admin UI v2 (Agente B): `src/types/serviceCategories.ts` reescrito (tipos v2 + EXIT_ACTION_OPTIONS + DEFAULT_SERVICE_CATEGORIES_V2), `src/components/admin/ai-agent/ServiceCategoriesConfig.tsx` reescrito com UI 3 níveis (drag-drop em stages e fields, slider de score, preview de funil horizontal).
- **F3 v2** — Substituição em `ai-agent/index.ts` (HIGH RISK, manual com aprovação): `buildEnrichmentInstructions` lê `getCurrentStage`; handler de `set_tags` com hook que chama `calculateScoreDelta` + atualiza tag `lead_score:N` + persiste em `lead_score_history`. Regras de prompt 1167+1171 atualizadas para stages.
- **F4 v2** — Doc + Seed (Agente C — este agente): `src/data/nicheTemplates.ts` (templates "Home Center" e "Personalizado") + 6 wikis + PRD changelog + log.
- **F5** — Nova tab "Qualificação" (manual): 9ª tab no admin do agente — `src/components/admin/AIAgentTab.tsx`.

### 3 agentes em paralelo (escopos isolados)

- **Agente A v2** — F1.5 (migration v2 + helper reescrito + testes)
- **Agente B v2** — F2 v2 (tipos v2 + ServiceCategoriesConfig.tsx reescrito)
- **Agente C v2 (este agente)** — F4 v2 (seed + 6 wikis + PRD + log)

F3 v2 e F5 ficam sequenciais com aprovação explícita.

### Arquivos modificados pelo agente C v2

- `src/data/nicheTemplates.ts` — templates "Home Center" e "Personalizado" reescritos com schema v2 (stages + score). Mantido import existente `ServiceCategoriesConfig` (agente B já atualizou os tipos).
- `wiki/ai-agent.md` — seção "Service Categories" substituída por v2: hierarquia Categoria→Stage→Field, comportamento em runtime (7 passos), score visibilidade, backward compat v1→v2.
- `wiki/casos-de-uso/ai-agent-detalhado.md` — seção SDR atualizada: 4 cenários multi-tenant com stages explícitos (Home Center 3 stages, clínica 2 stages, imobiliária 3 stages, lead frio default), cenário Home Center com score acumulando (15→30→search_products), camada técnica detalhada (helpers v2 + RPC `add_lead_score_event` + tab dedicada + R79).
- `wiki/decisoes-chave.md` — D26 v2 substitui D26 v1 com 7 sub-decisões em tabela. Tag `service-categories-v2` adicionada ao frontmatter.
- `wiki/erros-e-licoes.md` — R79 adicionada após R78 (score reseta apenas em `ia_cleared:`, NUNCA expor ao lead).
- `wiki/melhorias-modulos-inteligencia.md` — item #10 atualizado para "shipped v1+v2", referência D26 v2.
- `PRD.md` — header com "M19 S10 v2 Service Categories Stages+Score". Entrada v7.14.0 (mesma versão) reescrita com schema v2, F1.5/F2 v2/F3 v2/F4 v2/F5, decisão D26 v2, regras R78+R79.
- `log.md` — esta entrada (sub-bloco v2 acima da v1).

### Notas finais (regra 13 do CLAUDE.md)

- (a) Conteúdo: **9.5/10** — schema v2 documentado em todos os 4 níveis (D26 v2 com 7 sub-decisões em tabela, R79 escrita objetivamente, 4 cenários multi-tenant com stages explícitos no ai-agent-detalhado, cenário Home Center com score progressivo concreto). `npx tsc --noEmit` em `src/data/nicheTemplates.ts` = 0 erros (sincroniza com tipos v2 do agente B).
- (b) Orquestração: **10/10** — D26 v2 ↔ R79 ↔ R78 (preserva) ↔ melhoria #10 ↔ PLAN ↔ PRD changelog ↔ log totalmente cruzados; ai-agent.md menciona `getCurrentStage`/`getNextField` (consistente com helper do agente A); ai-agent-detalhado.md menciona `ServiceCategoriesConfig.tsx` da tab "Qualificação" (consistente com agente B); todos wikilinks resolvem.
- (c) Vault: **9/10** — log.md, ai-agent.md, decisoes-chave.md, melhorias, erros-e-licoes todos sob 200 linhas. Frontmatter `updated: 2026-04-27` em todos. PRD entrada v7.14.0 (não nova versão — mesma sessão). Único débito persistente: `wiki/casos-de-uso/ai-agent-detalhado.md` em ~485 linhas (já estava 483 pré-edição) — particionamento fora do escopo F4 v2, sugerido para auditoria de fase.

### F3 v2 + F5 + Migration v2 + Types ✅ SHIPPED (mesma sessão)

**F3 v2 — Edits em `ai-agent/index.ts` (HIGH RISK, 4 edits cirúrgicos):**
1. Import expandido: 4 funções v2 (`getCurrentStage`, `getScoreFromTags`, `calculateScoreDelta`, `getExitAction`) + as legadas
2. `VALID_KEYS` expandido com `lead_score`, `qualif_stage`, `ambiente`, `cor`, `especificacao`
3. `buildEnrichmentInstructions` reescrita: usa `getCurrentStage(score, category, fallback)` + `currentStage.fields` ordenados por priority + `currentStage.phrasing` template + contexto de stage no [INTERNO] (`Stage atual: "X" (score N/M, exit_action=Y)`)
4. Hook de score em `set_tags` handler: calcula `scoreDelta`, injeta `lead_score:N` no merge, persiste em `lead_score_history` via RPC `add_lead_score_event` (fire-and-forget) quando `leadProfile?.id`. Try/catch isolado — score nunca bloqueia set_tags

**F5 — Nova tab "Qualificação" em `AIAgentTab.tsx` (4 edits):**
1. Import `ListTree` icon adicionado em lucide-react
2. Import `ServiceCategoriesConfig` ao lado de ProfilesConfig
3. 9ª tab "Qualificacao" no array TABS (posição 4, entre Inteligencia e Catalogo)
4. Render condicional `activeTab === 'qualification'` + remoção do TODO comentado

**Migration v2 aplicada via `mcp__supabase__apply_migration`:**
- Validação SQL: 1 agente em prod migrado v1→v2 (3 stages na categoria "tintas")
- 0 agentes ainda em formato v1
- Função `add_lead_score_event(_lead_id, _agent_id, _score_delta, _category_id?, _stage_id?, _field_key?, _conversation_id?)` criada
- **Bugs corrigidos antes de aplicar:** R34 violado na migration original (`FROM public.leads`); corrigido para ler `conversations.tags` (TEXT[]) via `_conversation_id` parâmetro — score vive em conversations, não em lead_profiles (que tem tags JSONB)

**Types regenerados (item 2 SYNC RULE):**
- Diff cirúrgico: +12 linhas (declaração da função `add_lead_score_event` no Functions block); 0 deleções

**Validação final pós-shipping:**
- `npx tsc --noEmit` → 0 erros
- `npx vitest run` → **526 passed**, 5 falhas pré-existentes (FormBuilder/useForms — sem relação)
- 0 regressões

### Status final M19-S10 v2

✅ **Todas as 5 fases shipped.** Service Categories com Stages + Score progressivo em produção.

**O admin agora acessa em:** `/dashboard/ai-agent` → seleciona agente → tab **"Qualificacao"** (4ª tab, ícone ListTree).

### Pendências operacionais (não-bloqueantes)

- Rodar Agent QA Framework batch (M2 F4) com cenários de score progressivo (lead atinge 30→search, atinge 70→enrichment, atinge 100→handoff) — threshold ≥80% antes de deploy de produção
- Smoke E2E manual: lead "tinta" → agente pergunta "ambiente?" → responde → tag `ambiente:externo` + `lead_score:15` → continuar até score 30 → search_products dispara
- Particionar `wiki/casos-de-uso/ai-agent-detalhado.md` (492 linhas, débito pré-existente fora do escopo)
- Refatorar linha 1612 do ai-agent/index.ts (PATH C fallback) usando o helper para consistência total — sessão futura

---

## 2026-04-27 (M19-S10 Service Categories)

### Objetivo da fase

Substituir 4 regras hardcoded de qualificação no AI Agent ("QUALIFICAÇÃO DE TINTAS", "fosco ou brilho", `if (interesse.includes('tinta'))` em `buildEnrichmentInstructions`, system_prompt do template Home Center) por schema único editável `ai_agents.service_categories JSONB`. Habilita multi-tenant real (clínica, e-commerce, política) sem editar código por nicho. Resolve item #10 das melhorias do AI Agent.

### 3 agentes em paralelo (escopos isolados)

- **Agente A — F1 Backend** — migration `20260427000001_ai_agent_service_categories.sql` + helper `_shared/serviceCategories.ts` (tipos + `matchCategory`, `getQualificationFields`, `formatPhrasing`, `getCategoriesOrDefault`) + testes unit (14 casos).
- **Agente B — F2 Admin UI** — `src/types/serviceCategories.ts` (tipos compartilhados) + `src/components/admin/ai-agent/ServiceCategoriesConfig.tsx` (editor visual com drag-drop, validação regex, preview) + ALLOWED_FIELDS em `AIAgentTab.tsx`.
- **Agente C — F4 Doc + Seed (este agente)** — `src/data/nicheTemplates.ts` + 7 wikis + log + PRD changelog.

F3 (substituição em `ai-agent/index.ts` — HIGH RISK) fica para aprovação separada.

### Arquivos modificados pelo agente C

- `src/data/nicheTemplates.ts` — import `ServiceCategoriesConfig`, adicionado campo `service_categories` ao tipo `NicheTemplate.config`. Template "Home Center" populado com 2 categorias (tintas, impermeabilizantes) + default. Template "Personalizado" populado só com default. Removida linha hardcoded "acabamento preferido" do system_prompt do Home Center, substituída por instrução genérica que aponta para service_categories.
- `wiki/ai-agent.md` — adicionada seção "Service Categories (M19-S10)" entre "Fluxo SDR" e "Handoff" com schema, flag `ask_pre_search`, priority, phrasing templates, default não-removível, backward compat.
- `wiki/casos-de-uso/ai-agent-detalhado.md` — frontmatter `updated: 2026-04-27` + tag `service-categories`. Substituída "Regra especial para tintas" por explicação multi-tenant de service_categories com 4 cenários (Home Center, clínica médica, e-commerce, agência marketing). Camada técnica atualizada (helper + matchCategory + buildEnrichmentInstructions dinâmico).
- `wiki/decisoes-chave.md` — frontmatter + tag `service-categories`. **D26 adicionada** (após D25): contexto + decisão + backward compat + hierarquia + não unifica.
- `wiki/melhorias-modulos-inteligencia.md` — item #10 do AI Agent marcado como **✅ shipped (M19-S10, 2026-04-27)** com link para D26 e PLAN.
- `wiki/erros-e-licoes.md` — **R78 adicionada** (após R77, na tabela superior): hardcoded por nicho não escala em multi-tenant; pergunta-chave antes de codar regra.
- `PRD.md` — header atualizado v7.13.0 → v7.14.0, data 2026-04-25 → 2026-04-27, status incluindo "M19 S10 Service Categories". **Entrada v7.14.0 no Changelog** (topo, antes de v7.13.0) com backend + frontend + seed + decisão D26 + regra R78 + backward compat 100%.
- `log.md` — esta entrada.

### Notas finais (após escopo C)

- (a) Conteúdo: 9.5/10 — schema completo, exemplos multi-tenant didáticos (4 nichos: home center, clínica, e-commerce, agência), backward compat documentada, links cruzados (D26 ↔ R78 ↔ #10 ↔ PLAN). `npx tsc --noEmit` = 0 erros.
- (b) Orquestração: 10/10 — D26 ↔ R78 ↔ melhoria #10 ↔ PRD changelog ↔ log totalmente cruzados; ai-agent.md referencia `src/types/serviceCategories.ts` (consistente com agente B); ai-agent-detalhado.md menciona `_shared/serviceCategories.ts` (consistente com agente A); todos os 7 wikilinks resolvem.
- (c) Vault: 9/10 — log.md, ai-agent.md, decisoes-chave.md, melhorias, erros-e-licoes todos sob 200 (após arquivamento). Frontmatter `updated: 2026-04-27` em todos. Único débito: `wiki/casos-de-uso/ai-agent-detalhado.md` em 483 linhas (já estava 476 pré-edição) — particionamento fora do escopo F4, sugerido para auditoria de fase ou sessão dedicada.

### F3 — Substituição em ai-agent/index.ts ✅ SHIPPED (mesma sessão, com aprovação explícita)

**Diff:** 5 edits cirúrgicos no único arquivo HIGH RISK tocado (`ai-agent/index.ts`). 43 inserções, 23 deleções, 1 file changed.

1. **Import** do helper `_shared/serviceCategories.ts` (5 funções: `getCategoriesOrDefault`, `matchCategory`, `getQualificationFields`, `formatPhrasing`, `extractInteresseFromTags`)
2. **`buildEnrichmentInstructions`** reescrita (linhas 1336-1368 → função dinâmica). Recebe novo parâmetro `agentCfg`, lê `agent.service_categories` via helper, gera sugestões + exemplo de frase dinâmico baseado em `phrasing_enrichment` da categoria + lista `set_tags` keys reais. Removida cadeia `if (interesse.includes('tinta'))` em favor do `matchCategory` regex.
3. **Chamada** atualizada (linha 1567) — agora passa `agent` como 5º arg.
4. **Linha 1167** — regra "QUALIFICAÇÃO DE TINTAS" substituída por "QUALIFICAÇÃO POR CATEGORIA: as categorias configuradas pelo admin (service_categories) determinam que dados perguntar..."
5. **Linha 1171** — regra "ENRIQUECIMENTO PÓS-BUSCA" com "fosco ou brilho" hardcoded substituída por "siga as instruções exatas do [INTERNO] — faça a pergunta sugerida (formato configurado em phrasing_enrichment da categoria)..."

**Backward compat 100%:** `getCategoriesOrDefault(null|undefined)` retorna seed default que reproduz comportamento hardcoded original. Agentes existentes sem `service_categories` no banco mantêm comportamento idêntico.

**Achado adicional não-tocado:** linha 1612 (PATH C — fallback "not well qualified") tem `'AÇÃO: faça UMA pergunta para refinar — cor, acabamento, marca alternativa ou tamanho.'` — hardcode menor de fallback genérico. Decisão: deixar intacto (escopo separado, fallback degradado, baixo impacto). Anotado em melhorias futuras.

### Validação F3

| Check | Resultado |
|-------|-----------|
| `npx tsc --noEmit` (toda a base) | **0 erros** ✅ |
| `npx vitest run` helper tests | **34/34 passam** ✅ |
| `npx vitest run` base completa | **470 passed** (mesmas 5 falhas pré-existentes em FormBuilder/useForms — sem relação com M19-S10) ✅ zero regressão |
| HIGH RISK: somente `ai-agent/index.ts` modificado | ✅ |
| HIGH RISK: `ai-agent-playground/index.ts` intacto | ✅ |
| HIGH RISK: `e2e-test/index.ts` intacto | ✅ |
| HIGH RISK: `src/integrations/supabase/types.ts` intacto | ✅ |

### Status final M19-S10 — TODAS AS 4 FASES COMPLETAS

- ✅ F1 (Backend isolado): migration + helper + 34 testes
- ✅ F2 (Admin UI): tipos + ServiceCategoriesConfig + ALLOWED_FIELDS
- ✅ F3 (substituição em ai-agent/index.ts): 5 edits, backward compat 100%, 0 regressões
- ✅ F4 (Doc + seed): nicheTemplates + 7 wikis + PRD + log

### Pendências operacionais — atualizadas após shipping

- ~~Aplicar migration via `mcp__supabase__apply_migration` no projeto `wspro_v2`~~ ✅ aplicada (versão `20260427000001` registrada em produção). Validação SQL: `col_exists=1`, `agents_with_seed=1/1`, `num_categories_first_agent=2`, `settings_seed_exists=1`.
- ~~`npx supabase gen types` para sincronizar item 2 da SYNC RULE~~ ✅ types regenerados via `mcp__supabase__generate_typescript_types` + `JSON.parse` aninhado. Diff cirúrgico: 4 linhas adicionadas (`service_categories: Json` em Row/Insert/Update de `ai_agents` + RPC `dispatch_backup_cleanup` que estava out-of-date desde S8.1). 0 deleções. `npx tsc --noEmit` → 0 erros.
- Decidir UX da integração de `ServiceCategoriesConfig` no admin (nova tab "Qualificação" vs. seção em "Inteligência" existente)
- Rodar Agent QA Framework batch (cenários M2 F4) para validar threshold ≥80% antes do deploy de produção
- Em sessão futura: refatorar linha 1612 (PATH C fallback) usando o mesmo helper para consistência total

### Notas finais (regra 13 do CLAUDE.md)

- (a) Conteúdo: **9.5/10** — schema unificado resolve 4 hardcodes; backward compat documentada; tipos consistentes em A/B; testes do helper cobrem 34 casos; achado linha 1612 reportado como pendência.
- (b) Orquestração: **10/10** — D26 ↔ R78 ↔ melhoria #10 ↔ PLAN ↔ RESEARCH ↔ PRD changelog ↔ log totalmente cruzados; helper compartilhado entre runtime (ai-agent) e seed (nicheTemplates).
- (c) Vault: **9/10** — todos os MDs editados sob 200 linhas; PLAN.md status `in_progress` → `completed`; débito pré-existente: `ai-agent-detalhado.md` 483 linhas (não escopo).

---

> Sessão 2026-04-27 manhã (Auditoria geral + 210 melhorias documentadas) e 2026-04-26 (Refactor do Orquestrador CLAUDE.md/RULES.md) arquivadas em:
> - [[wiki/log-arquivo-2026-04-27-auditoria-geral]]
>
> Sessão maratona 2026-04-25 (Helpdesk inbox permissions + M19 S8 + S8.1 — 9 commits, 3 features, 6 migrations, 2 edge functions, 4 cron jobs DB) arquivada em:
> - [[wiki/log-arquivo-2026-04-25-s8-helpdesk]]
>
> Entrada de 2026-04-14 (Auditoria Helpdesk — 10 fixes + Storage + Playwright) arquivada em:
> - `wiki/log-arquivo-2026-04-14-helpdesk-audit.md`
>
> Entradas de M19 S3-S5 (2026-04-13) arquivadas em:
> - `wiki/log-arquivo-2026-04-13-m19-s3s5.md`
>
> Entradas de M19 S1+S2 arquivadas em:
> - `wiki/log-arquivo-2026-04-13-m19-s1s2.md`
>
> Entradas anteriores (2026-04-11/12):
> - `wiki/log-arquivo-2026-04-12-agent-metricas.md`
> - `wiki/log-arquivo-2026-04-12-fixes-kpi-s12.md`
> - `wiki/log-arquivo-2026-04-12-fluxos-s6s11.md`
> - `wiki/log-arquivo-2026-04-11-fluxos-v3-s1s2.md`
