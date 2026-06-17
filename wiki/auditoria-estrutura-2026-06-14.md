---
title: Auditoria de Estruturação — WhatsPRO
type: auditoria
updated: 2026-06-14
audited_at: 2026-06-14
---

# Auditoria de Estruturação — WhatsPRO (2026-06-14)

> ✅ **STATUS 2026-06-14: os 3 maiores riscos foram RESOLVIDOS e verificados (v7.92.0).**
> (1) Gate de CI — job `quality-gate` (tsc+vitest duros, lint informativo) com `needs:` no build; bloqueio provado. (2) `escalate-stale-handoffs` — `verifyCronOrService` add (cron 200 / bogus 401). (3) SECURITY DEFINER — `REVOKE PUBLIC` cirúrgico, advisor anon **65→16**. Detalhe: memória `project_audit_3_risks_fixed_v792`. Demais itens (lint debt, schema órfão, docs stale, god files) seguem no backlog abaixo.
>
> 🔄 **STATUS 2026-06-17:** re-auditado pós-v7.94.0 — backlog atualizado e re-priorizado em [[wiki/auditoria-pendencias-2026-06-17]]. Confirmado AINDA ABERTO: lint debt (219), schema órfão Fluxos v3.0 (+ cron jobid 13 morto-vivo), docs 2º nível stale, god files, D6 monolith. NOVOS achados: S9 RLS Helpdesk (vetor multi-tenant), RLS `USING(true) TO public` (4 tabelas), bug Rules-of-Hooks em `BioLinksPage`. Doc-drift do orquestrador/roadmap/RULES.md já corrigido.

## Sumário Executivo

**Nota geral: 6.4/10** (média ponderada). Pesos: ai-agent 22%, backend 18%, database 18% (núcleo de risco — sustentam o produto e os incidentes); frontend 12%, testes 12%, qualidade 8%, docs 6%, tooling 4%. Cálculo: 7·0.22 + 7·0.18 + 6.5·0.18 + 6·0.12 + 5.5·0.12 + 6.5·0.08 + 7·0.06 + 6.5·0.04 ≈ **6.43**.

A saúde estrutural é **boa no coração e frágil nas bordas**. O subsistema do AI Agent é genuinamente bem decomposto (37 módulos + 38 testes pareados, fontes únicas de verdade como qualificationGate/responseSanitizer/greetingPolicy), o backend tem forte centralização em `_shared/`, e o vault de docs é disciplinado (300-linhas enforçado, 0 violadores). Mas a estruturação arrasta dívida concreta: o CI **não roda nenhum teste/tsc/lint antes do deploy a produção** (único gate real é md-length), a migração monolith→router está incompleta estruturalmente (monolith é DEFAULT e load-bearing, router enxertado na linha 3087), e há resíduos de descomissionamento não fechados (11 tabelas órfãs do Fluxos v3.0, validatorAgent.ts órfão referenciado por RULES.md, docs de contrato secundários materialmente stale).

**3 maiores riscos:** (1) **CI sem gate de qualidade** — push com tipo quebrado ou teste vermelho vai a `crm.wsmart.com.br` sem barreira; (2) **endpoint `escalate-stale-handoffs` sem autenticação** dispara WhatsApp a vendedores/gerentes + drift de `verify_jwt` no config.toml; (3) **65 funções SECURITY DEFINER executáveis por anon** (RPCs `dash_*` vazam métricas de negócio com a anon key), contradizendo lição própria do projeto.

## Notas por Dimensão

| Dimensão | Nota | Veredito 1-linha |
|---|---|---|
| AI Agent (core) | 7 | Mais bem decomposto do repo; migração router madura mas não concluída (monolith ainda default) |
| Backend / Edge Functions | 7 | Boa centralização; falhas de consistência (CORS, verify_jwt, dead-code com contrato vivo) |
| Database & Migrations | 6.5 | Schema coeso e indexado; RLS é o ponto fraco (anti-padrões + SECURITY DEFINER anon) |
| Documentação (Vault) | 7 | Vault disciplinado; docs de contrato 2º nível materialmente stale |
| Qualidade & Dívida | 6.5 | Caminho crítico limpo; dívida no frontend (duplicação telefone, any, dead-code) |
| Frontend (React/Vite) | 6 | Folder-by-feature coeso; camada de dados dupla + god components |
| Tooling & Higiene | 6.5 | Pontos bons (chunks, pre-commit); gate CI honra, lockfiles stale, strict off |
| Testes | 5.5 | Suíte forte no agente; CI não executa nada; edge runtime 0 testes |

## Top Ações Prioritárias (cross-cutting)

1. **[testes/tooling]** Adicionar job CI `npm ci && tsc --noEmit && lint && vitest run` como `needs:` do build em `.github/workflows/deploy.yml` — **CRITICAL**, corrigir os ~5 fails antes pra gate não nascer vermelho.
2. **[backend]** Adicionar `verifyCronOrService(req)` em `escalate-stale-handoffs/index.ts:~155` (endpoint público dispara WhatsApp sem auth).
3. **[backend]** Criar blocos explícitos `[functions.bio-public/form-public/form-bot]` com `verify_jwt=false` em `config.toml` (hoje herdam default true → 403 em página pública num redeploy).
4. **[database]** Migration: `TO service_role` nas 4 RLS policies `USING(true) TO public` (`scrape_jobs`, `ai_debounce_queue`, `ai_agent_validations`, `follow_up_executions`).
5. **[database]** Migration de saneamento `REVOKE EXECUTE FROM PUBLIC, anon` nas 65 funções SECURITY DEFINER + regra no PATTERNS.md pro boilerplate novo.
6. **[backend/aiagent/qualidade]** Deletar `validatorAgent.ts` (órfão) e reescrever RULES.md nível-2 apontando `responseSanitizer.ts` (fonte única atual) — fecha dead-code + contrato mentiroso.
7. **[database]** Migration de drop das 11 tabelas órfãs Fluxos v3.0 + coluna `instances.use_orchestrator` + `install_flow_template` (fecha v7.90.0 de verdade).
8. **[docs]** Corrigir números stale em ARCHITECTURE/AGENTS/PATTERNS (45 fns, 74 shared, ai-agent 3329 lin, 27 componentes) e remover roteamento pra Fluxos v3.0 (CLAUDE.md:93,209; README:25) — idealmente gerar contagens via script.
9. **[frontend]** Lint rule `no-restricted-imports` proibindo `supabase` client fora de `hooks/`/`lib/`; migrar incrementalmente os piores (`EditBoardDialog` 24x, `UsersTab` 11x).
10. **[aiagent]** Mover a bifurcação router pra ANTES do setup caro do monolith (após short-circuits) — desbloqueia D6 (não dá pra deletar monolith com router enxertado em 3087).
11. **[tooling]** `git rm bun.lock bun.lockb` + gitignore (stale ~3 meses, só `package-lock.json` é consumido); trocar `.gitignore` `/*.png` por `/*.{png,jpg,jpeg,webp,gif}`.
12. **[qualidade/database]** Declarar tipos das views SQL (`v_lead_metrics` etc.) em `types/views.d.ts` — elimina cluster `as any` na camada de métricas onde shape errado vira número errado silencioso.

## Por Dimensão

### AI Agent (core) — 7
Subsistema mais bem decomposto do repo; a migração monolith→router é madura no código mas não está estruturalmente concluída.

**Alta (confirmada):**
- **Router enxertado no meio do monolith** (`index.ts:3087`) — todo o setup do monolith (systemPrompt ~17KB, 9 toolDefs, `buildContextDocuments` com I/O) roda e é descartado no modo router; é um early-return a ~3000 lin de função, com coupling por ref (`geminiContents`/`toolCallsLog` mutados). Bloqueia D6. → Mover bifurcação pra antes do setup; branches paralelos. (ressalva: 4 detectores escrevem tags consumidas pelo dashboard, não são puro desperdício.)

**Média (não-verificada adversarialmente):**
- **God functions persistem** — `runRouterPipeline` 853 lin, `searchProducts` 755 lin, `setTags` 578 lin, cada uma numa única função. → Promover blocos comentados a sub-passos puros testáveis.
- **validatorAgent.ts órfão** (zero imports) com comentário em `responseSanitizer.ts:17` afirmando falsamente que está em uso. → Deletar.
- **Docs de contrato divergem** (ARCHITECTURE/RULES descrevem monolith ~2600 lin + Validator ativo). → Atualizar 2º nível (CLAUDE.md já ok).
- **Monolith ainda é DEFAULT do schema** (`routing_mode DEFAULT 'monolith'`) e load-bearing, não fallback de erro; ~50 guards `routing_mode==='router'` espalhados. → D6 deve flipar default + migrar legados + remover branch.

**Baixa:** nomenclatura sobreposta nos 5 arquivos `qualification*` (decomposição legítima, só atrito de navegação).

**Strengths:** 37 módulos + 38 testes pareados (melhor disciplina de teste do repo); contrato único `SpecialistDef`; router não depende do prompt mega do monolith (independência arquitetural atingida).

### Backend / Edge Functions — 7
Bem estruturado no geral (45 fns Deno, forte `_shared/`); fraquezas são de consistência e contrato.

**Alta (confirmada):**
- **config.toml drift de verify_jwt** — `escalate-stale-handoffs` (`config.toml:131`) tem `verify_jwt=false` mas o handler (`index.ts:152-199`) **não chama `verifyCronOrService`** → endpoint público dispara WhatsApp a vendedores/gerentes sem auth; + `bio-public`/`form-public`/`form-bot` sem bloco herdam default true. → Adicionar auth + blocos explícitos.

**Média (parte rebaixada de alta por veredito):**
- **CORS estático em ~6 fns browser-facing** viola RULES.md L93 (`scrape-product`, `transcribe-audio`, `summarize-conversation`, `sync-conversations`, `analyze-summaries`, `group-reasons`). Latente (prod usa origin único hoje). → `getDynamicCorsHeaders(req)`. (correção: `scrape-products-batch` usa `webhookCorsHeaders`, não viola.)
- **validatorAgent dead-code com RULES.md nível-2 ainda mandando usá-lo** — `validateResponse` sem chamador runtime; contrato obrigatório aponta pra código morto. → Reescrever RULES.md → `responseSanitizer.ts`.

**Média (não-verificada):**
- **Envio WhatsApp duplicado inline em 6+ fns** apesar de `sendUazapiText` existir. → Migrar call sites.
- **GOD files de fronteira sem testes** — webhook 1474 (handler único ~1311 lin), uazapi-proxy 1021 (switch 22 actions). → Extrair pra `_shared/` puro.
- **ARCHITECTURE.md stale** (36 fns→45, 17 shared→46, ai-agent ~2600→3329). → Atualizar/gerar por script.

**Baixa:** 4 lockfiles na raiz; `group-reasons` usa runtime HTTP legado `std@0.168.0`.

**Strengths:** 41 fns usam `_shared/supabaseClient` (1 só inline); `_shared/agent/` coeso por responsabilidade; crons versionados em migrations; descomissão do orchestrator limpa (só 1 comentário residual).

### Database & Migrations — 6.5
Schema coeso e bem indexado; RLS é o ponto fraco real.

**Alta (confirmada):**
- **65 funções SECURITY DEFINER executáveis por anon** (verificado live: 65 anon / 71 authenticated de 83) — RPCs `dash_*` parametrizadas só por `p_instance_id` sem `auth.uid()` vazam métricas com a anon key, contradizendo lição `project_disparador_databases_module_v769`. → REVOKE em lote + regra de boilerplate.

**Média (rebaixadas de alta por veredito):**
- **11 tabelas órfãs Fluxos v3.0** deixadas inertes (descomissão da v7.90.0 só desagendou cron, 0 DROP). → Migration de drop (já listada como pendência conhecida).
- **Anti-padrão RLS `USING(true) TO public`** em 4 tabelas (`scrape_jobs`, `ai_debounce_queue`, `ai_agent_validations`, `follow_up_executions`) — nome promete "service role" mas concede a todos. (vetor anon-REST não comprovado; falta GRANT a anon.) → `TO service_role`.

**Média (não-verificada):**
- 17 funções com `search_path` mutável (cauda do fix em lote da `20260505000003`).
- Drift `types.ts`: 2 tabelas live ausentes (`media_send_telemetry`, `e2e_control_inbox`). → CI `gen types` + diff.
- 6 tabelas RLS-on sem policy (intenção ilegível). → Policy explícita `TO service_role`.
- 48-52 FKs sem índice + 199 policies reavaliando `auth.uid()` por linha (use `(SELECT auth.uid())`).

**Baixa:** 85/125 `CREATE TABLE` sem `IF NOT EXISTS` (era Lovable).

**Strengths:** RLS habilitado em 100% das 97 tabelas; snake_case 100%; ordenação de migrations perfeita; 376 índices intencionais (parciais bem pensados).

### Documentação (Vault) — 7
Vault genuinamente bem-arquitetado; problema dominante é docs-vs-realidade nos contratos secundários.

**Média (rebaixadas de alta por veredito):**
- **'36 edge functions'** em ARCHITECTURE.md:30 / AGENTS.md:68 (real 45) — onboarding recebe inventário errado.
- **'Shared Modules (17)'** (real 74 .ts) + `automationEngine.ts` listado como edge fn (é shared, auto-contradição no mesmo arquivo).

**Baixa (rebaixada de alta por veredito):**
- Docs ensinam arquitetura ANTIGA do agente (monolith ~2600 lin, mitigado por CLAUDE.md canônico correto).

**Média (não-verificada):**
- PATTERNS.md descreve Validator LLM como ativo (aposentado v7.89.0).
- CLAUDE.md auto-contraditório (header '~88%' vs tabela '~97%').
- Fluxos v3.0 roteado como ativo (CLAUDE.md:93,209) + README:25 + ~10 wikis `fluxos-*` de código deletado.
- Duplicação de coordenadas (deploy ref, lista JWT, shared) entre 4 arquivos sem fonte única.

**Baixa:** CLAUDE.md viola própria premissa 'só ponteiros' (11 blocos históricos); MEMORY.md não referencia `project_specialist_model_v791`.

**Strengths:** 300-linhas ENFORÇADO (pre-commit + CI, 0 violadores em 418 .md); wikilinks íntegros; particionamento disciplinado; coordenadas de deploy corretas e auto-verificadas.

### Qualidade & Dívida — 6.5
Caminho crítico (AI Agent edge) disciplinado; dívida concentrada no frontend e cauda da migração.

**Média (não-verificada):**
- `validatorAgent.ts` (239 lin) sem importador real — dead code pós-migração.
- **Helper de telefone reimplementado** apesar de `phoneUtils.ts` central (formatPhone local em SlaAlertList, 26 `replace(/\D/g)` inline em 17 arquivos, cópias no edge). → Fonte única + `_shared/phoneUtils.ts`.
- **~684 `any`** (157 front + 527 edge), cluster em views SQL não-tipadas (`v_lead_metrics as any`). → Tipar views/RPCs.
- **Hard-limit 300 só governa .md**; ~15 arquivos de código >700 lin sem gate. → Teto suave no healthcheck.

**Baixa:** tratamento de erro inconsistente (handleError 55% vs catch+toast manual em 42 arquivos); comentário stale em `Leads.tsx:227` (flow_states).

**Strengths:** 'silêncio > Desculpe' com fonte única testada (`responseSanitizer`); tags com whitelist central; TODO/FIXME quase ausentes; `console.log` praticamente zerado no backend.

### Frontend (React/Vite) — 6
Folder-by-feature coeso na macro; problemas de microestrutura e disciplina.

**Alta (confirmada):**
- **Camada de dados dupla** — ~158 `supabase.from()` diretos em 47 componentes/pages (`EditBoardDialog` 24x, `UsersTab` 11x, `ChatInput` faz insert/delete direto) ao lado de React Query (46 arquivos); `useSupabaseQuery` já `@deprecated`. → Zero `supabase.from()` em components/pages + lint rule.

**Baixa (rebaixada de alta por veredito):**
- **Sessão espalhada por 15+ arquivos** com timeouts ad-hoc; núcleo real (`useForms.ts:70` getSession cru) mas a camada compartilhada já existe e é amplamente usada. → Consolidar timeouts + migrar `useForms`.

**Média (parte rebaixada de alta por veredito):**
- **God components** — `ServiceCategoriesConfig` 2170 lin (god component real, 14 sub-componentes), 35 arquivos >500 lin. → Quebrar top-7 + teto no CI. ('24 tipos inline' inflado; 16 reais.)

**Média/Baixa (não-verificadas):**
- 15/52 shadcn ui mortos + `EmptyState` duplicado com APIs divergentes.
- 4 componentes de negócio órfãos (`SubAgentsConfig` superado por `ProfilesConfig`).
- PATTERNS.md '22 componentes' vs 27 reais + seção Validator aposentada.
- Convenções inconsistentes (export default/named 127/112; 3 pastas `instance`).

**Strengths:** folder-by-feature real (21 subpastas mapeiam módulos); code-splitting exemplar (~50 lazy pages); React Query com defaults sãos; `AuthContext` único enxuto.

### Tooling & Higiene — 6.5
Base funcional com pontos bem feitos; buracos de higiene concretos.

**Alta (confirmada):**
- **CI de deploy não roda tsc/lint/test** — gate do RULES.md ('0 erros TS + 100% testes') é puramente honra manual; push com tipo quebrado vai a prod. → Job CI bloqueante.

**Baixa (rebaixada de alta por veredito):**
- 3 lockfiles JS trackados, `bun.*` stale ~3 meses (só `package-lock.json` consumido). → `git rm` bun.*.

**Média (não-verificadas):**
- strict mode TS desligado no app inteiro (`strict:false` + `strictNullChecks:false`). → Ligar gradual.
- Drift Node (Dockerfile 20 vs CI 24, sem `.nvmrc`).
- `.gitignore` cobre `/*.png` mas não jpeg/jpg (2 `.jpeg` prontos pra commit acidental).

**Baixa:** `ADMIN_PASSWORD=123456@` plaintext no `.env.local` (gitignorado, mas senha de admin de prod fraca); `.env.example` referenciado mas inexistente; `deno.lock` órfão sem `deno.json`.

**Strengths:** deps sem mortos reais (lazy verificados); pre-commit hook robusto + CI vault/schema; `manualChunks` deliberado; nenhum segredo trackado; redeploy Portainer automatizado.

### Testes — 5.5
Suíte forte no coração (AI Agent), mas depende inteiramente de execução manual local.

**Critical (confirmada):**
- **CI não executa NENHUM teste/tsc/lint antes do deploy** (`deploy.yml` só docker+Portainer; `vault-healthcheck` só md-length+schema; Dockerfile só `vite build`, que não faz typecheck). → Job bloqueante.

**Alta (confirmada):**
- **45 edge fns de runtime com 0 testes co-located** — todos os 70 testes em `_shared/`; god-files webhook/uazapi-proxy/ai-agent-index sem rede; parse `sender_pn/@lid` (bug de prod) sem teste. → Extrair pra `_shared/` puro e cobrir.

**Média (não-verificadas):**
- 4 testes `useForms` falham por mock acoplado à sequência de chamadas (vermelho tolerado mina confiança).
- Cobertura frontend simbólica (pages 2/56, components 17/291).
- Playwright (24 specs) sem script npm e fora de CI.

**Baixa:** `describe.skip` com 3 stubs vazios ('Task 2' que nunca veio); convenção de localização de testes oposta entre `src/` (`__tests__/`) e `_shared/` (co-located).

**Strengths:** AI Agent bem testado (36 files, ~9170 LOC, decisões puras); faxina deno→vitest completa (0 `Deno.test`); realismo razoável (`callLLM` mockado, 7 intents reais); resultado honesto (1900 passed / 5 failed).

## Veredito Final

WhatsPRO tem uma **arquitetura de núcleo sólida e madura** — o AI Agent, o coração do produto, é o subsistema mais bem decomposto e testado, com fontes únicas de verdade reais e migração router quase completa. O risco estrutural não está no design, está na **falta de enforcement automatizado** (CI sem gate de qualidade é a falha mais grave) e na **cauda de descomissionamentos não fechados** (schema órfão, dead-code com contrato vivo, docs de 2º nível stale). Priorizando o gate de CI, as 3 correções de segurança (escalate auth, RLS public, SECURITY DEFINER anon) e a limpeza dos resíduos da v7.90.0, o projeto passa de "forte mas frágil nas bordas" para estruturalmente robusto sem refactor grande.
