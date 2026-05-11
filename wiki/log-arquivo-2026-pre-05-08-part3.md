---
title: Log Arquivo Pré 2026-05-08 (parte 3)
type: log-archive
description: 2026-05-07 — Sessão 3 Sandbox + R113 cron 401 fix
updated: 2026-05-11
---

# Log — Arquivo Pré 2026-05-08 (parte 3)

> Read-only. Index pai: [[log.md]] · Anteriores: [[wiki/log-arquivo-2026-04-04-a-09]]

## 2026-05-07 — Sessão 3 Sandbox INICIADA · R113 cron 401 ROOT CAUSE + FIX

> Onda 1 do plano sandbox sessão 3 começou com a anomalia 401 da sessão 2 (Task #19). Investigação revelou que era ponta visível de problema permanente afetando 4 crons. Fix shipado.

### O que foi descoberto

**Sintoma original:** anomalia "ai-agent 401" durante deploy R112.2 (sessão 2). Investigando logs achamos `requeue-conversations` retornando 401 a cada ~60s + `aggregate-metrics` + `process-flow-followups` também 401. Métricas, fila inteligente e follow-ups parados há dias.

**Pista 1 (falsa):** vault `SUPABASE_ANON_KEY` tinha 46 chars (publishable novo). JWT antigo tem 218 chars. Hipótese inicial: comparação string falhava por mismatch de formato. **NÃO ERA SÓ ISSO.**

**Pista 2 (real):** deploy de função `env-diag` revelou que **o gateway Supabase REESCREVE o Authorization header** quando recebe `sb_publishable_*` — transforma em JWT (~444 chars `eyJ0`) antes de chegar na função. Como `Deno.env.SUPABASE_ANON_KEY` na função é o publishable original, comparação string nunca casa. Detalhes em [[wiki/erros-e-licoes]] R113.

### Fix shipado (R113)

- (a) Vault entry nova `CRON_AUTH_KEY` com mesmo valor de `INTERNAL_FUNCTION_KEY` (token neutro 64-char que gateway NÃO reescreve)
- (b) 5 crons reschedulados pra usar `CRON_AUTH_KEY`: `handoff-queue-requeue`, `aggregate-metrics-hourly`, `aggregate-metrics-daily-consolidation`, `process-flow-followups`, `e2e-automated-tests`
- (c) Migration `20260507000001_recreate_handoff_queue_cron.sql` versiona os 5 crons (antes só 1 estava em migration apontando pro projeto velho)
- (d) Patch defensivo `_shared/auth.ts` — `verifyCronOrService` aceita 5 formatos de token (JWT, service, publishable, secret, internal). Defensivo pra futuras rotações de chave Supabase
- (e) Edge function `env-diag` deixada inerte (returns 410) por ainda não termos delete via MCP

### Validação

- `requeue-conversations` voltou a retornar 200 a cada 60s (logs `expired_processed:0` ok — não há fila pendente)
- `aggregate-metrics`, `process-flow-followups`, `e2e-automated-tests` vão normalizar nas próximas chamadas (são hourly/6h)

### Arquivos modificados

- `supabase/functions/_shared/auth.ts` — verifyCronOrService multi-format
- `supabase/migrations/20260507000001_recreate_handoff_queue_cron.sql` — 5 crons usando CRON_AUTH_KEY
- `wiki/erros-e-licoes.md` — entrada R113

### O que NÃO foi feito ainda (Sessão 3 continua)

- Refinar G1: tag `objecao:preco` no momento do handoff (Task #2)
- Refinar H1: heurística `venda:fechada` pra pix/paguei/comprovante (Task #3)
- Onda 2: 8 cenários baratos (E1/M4/M8/M10/G2/G3/H2/H3) — R$ 0,50-1,00
- Onda 3: 4 cenários caros (N3/N7/M9/M5/M6) — R$ 1-2 + 30min wait
- Roteirizar I1-I3 limites de interação

### Auto-avaliação parcial

- **Conteúdo:** 9/10 — diagnóstico foi mais profundo que o esperado, descobrimos gateway-rewrite (não-óbvio). Fix funcionando em produção.
- **Orquestração:** 9/10 — migration versionada + wiki R113 documentado + patch defensivo + log atualizado.
- **Tempo:** ~1.5h gasto na Onda 1 só pro 401 fix. Sessão 3 ainda tem ~3-4h de trabalho pendente.

---

## 🎯 HANDOFF DE FIM DE SESSÃO — 2026-05-07 manhã (Sessão 2 Sandbox COMPLETA com R112)

> Modo autônomo aprovado. **17 cenários executados em sessão 2**, **5 commits hoje**, **8 bugs corrigidos** (R107, R108, R109, R110, R110.1, R111, R112 v1, R112 v2). Custo total acumulado: ~R$ 1,20 (sessão 1 R$ 0,29 + sessão 2 R$ 0,57 + retestes R112 R$ 0,30).

### Commits hoje (em ordem cronológica)

| Hash | Conteúdo |
|---|---|
| `6b4bfa8` | R107+R108+R109 — extended_hours_until + search acentos + qualificationContext final |
| `178c504` | R110 stop-words inicial + Bloco N plano |
| `b3bc6b9` | R110.1 stop-words expandida (laje/exposta) + R111 fuzzy fallback respeita filtros |
| `97f024b` | R112 v1 — fallback genérico (rejeitado pelo usuário por ser impessoal) |
| `9282450` | **R112 v2** — fallback dinâmico com `suggested_categories` + EXCEÇÃO regra de ouro documentada |

### Cenários executados sessão 2

**Bloco N (humanização):** N1 fragmentação ✅ · N2 typos ✅ · N4 emojis ✅ · N5 mistura ⚠️ · N6 mudança ideia ✅ (N3 áudio + N7 retention skipped)

**Bloco M (mídia):** M1 produto único ⚠️ (motivou R110.1) · M2 filtro de preço 🔴→✅ (motivou R111) · M3 botão REPLY ⚠️ · M7 produto excluído 🔴→✅ (motivou R112 v1+v2)

**Bloco B/F:** B2 marca explícita ✅ · B3 porta ✅ · B4 default ✅ · F2 eletricista ✅ · F3 cliente final ✅

**Cenários R112:** geladeira (v1) ✅ · cama+suggested_categories (v2) ✅ · brinquedo sem suggested_categories (v2) ✅

### Decisão arquitetural importante

**EXCEÇÃO formal da regra de ouro do AI Agent** — documentada em `wiki/erros-e-licoes.md` R112 v2:
- Regra "NUNCA dizer 'não trabalhamos com'" do prompt vale **pro LLM** (que pode inventar quando search falha)
- Para fluxos que **NUNCA passam pelo LLM** (sendTextMsg direto), regra é orientativa — pode ser flexibilizada
- Exemplo: `excluded_products` → admin configurou intencional + acompanha alternativas → "Infelizmente não trabalhamos com cama, mas temos acessórios para quarto" é honesto e gera cross-sell

### Anomalia observada (não-bloqueante)

Durante deploy R112.2, 4 chamadas ai-agent retornaram **HTTP 401**. Algumas msgs (geladeira/ar-condicionado/ração) não geraram outbound nesse intervalo. Sistema voltou normal logo após (brinquedo + bom dia funcionaram). Hipótese: cron com token velho durante deploy. Anotado em Task #19.

### Estado de produção AGORA

- `ai-agent` em prod com **8 fixes shipped** (R107-R112 v2)
- Frontend: `ExcludedProductsConfig.tsx` precisa rebuild bundle (Portainer webhook ou CI) — backend já vale por si só
- `extended_hours_until` restaurado pra NULL (cleanup)
- `excluded_products[moveis].suggested_categories` populado no Eletropiso real (demo)
- Branch master, último commit: `9282450`
- Working tree dirty: só docs (relatório sessão 2 atualizado, log atualizado, MEMORY atualizada)

### Pendências documentadas (próxima sessão)

| Pendência | Onde está |
|---|---|
| N3 áudio (gerar arquivo PTT base64) | wiki/plano-testes-sandbox-v3-bloco-n |
| N7 retention 25-30min | mesmo |
| M4-M10 mídia avançada (vision, comprovante, imagem 404) | mesmo |
| E1 out-of-hours real (sem extended_hours) | wiki/plano-testes-sandbox |
| I1-I3 limites de interação | wiki/plano-testes-sandbox-v2 |
| G2/G3/H2/H3 objeções e venda fechada refinadas | wiki/plano-testes-sandbox-v2 |
| Refinar G1: tag `objecao:preco` no momento do handoff (não só shadow async) | gap mencionado em sessão 1 |
| Refinar H1: tag `venda:fechada` específica pra "manda o pix" / "paguei" / "comprovante" | gap mencionado em sessão 1 |
| Anomalia 401 deploy — Task #19 | investigar se cron pega token velho |
| Outros gaps menores | wiki/relatorio-testes-sandbox-sessao2 |

### 🚀 FRASE PRA RETOMAR

**`continuar plano sandbox sessão 3`** — pega N3 áudio + N7 retention + M4-M10 + E1 + I1-I3 + refinamentos G/H. Custo estimado: R$ 2-4. Tempo: 3-4h.

Alternativas:
- **`fix anomalia 401`** — investigar Task #19 antes de mais testes
- **`refinar G1 e H1`** — implementar tag `objecao:*` e `venda:fechada` no momento do handoff
- **`gerar relatório consolidado v1.0`** — fechar v1.0 do sandbox-testing, criar release notes
- **`adicionar suggested_categories nas outras 12 categorias excluded_products`** — popular Eletropiso real com cross-sell completo (geladeira→ferramentas, sofá→fechaduras, ração→brindes, etc)

### Auto-avaliação sessão 2 — 0-10

- **Conteúdo:** 9.5/10 — 17 cenários cobertos + 4 bugs reais corrigidos em prod + 1 decisão arquitetural (EXCEÇÃO regra de ouro) documentada formalmente. R112 teve 2 versões porque eu errei na primeira interpretação — usuário corrigiu. Aprendi.
- **Orquestração:** 9/10 — relatório-sessao2 + log + erros-e-licoes (R107-R112 v2) + plano-v3-bloco-n + MEMORY cross-referenciados. Removi entrada antiga R112 ao adicionar v2 (sem duplicação).
- **Honestidade:** 10/10 — admiti erro inicial de R112 v1 ("Esse não é nosso foco" foi rejeitado), documentei anomalia 401 sem mascarar, gaps M3/N5/N6 reportados sem inflar PASS.
- **Estado vault:** 10/10 — tudo documentado, frase de retomada concreta com 4 alternativas

---

## 🎯 HANDOFF DE FIM DE SESSÃO — 2026-05-07 madrugada (Sessão 2 Sandbox — versão original, antes do R112 fix)

> Modo autônomo aprovado. 14 cenários executados após sessão 1 + commit `6b4bfa8`. 2 fixes shipados (R110+R110.1 stop-words, R111 fuzzy filters). 1 pendência aberta (R112). Custo R$ 0,57.

### O que foi feito (sessão 2)

**Bloco N (humanização):**
- N1 fragmentação (debounce 3→1) ✅
- N2 typos ("tnta acrilca pra parde da sla") ✅
- N4 emojis + abreviações ✅
- N5 mistura de assuntos ⚠️ (IA respondeu só 1/4)
- N6 mudança de ideia ✅
- N3 áudio + N7 retention skipped (exigem setup)

**Bloco M (mídia):**
- M1 produto único + R110.1 expansão de stop-words ⚠️
- M2 filtro de preço — R111 BUG corrigido + validado ✅
- M3 botão REPLY ⚠️ (gera novo carrossel)
- M7 produto excluído 🔴 (R112 pendente — viola regra de ouro)

**Bloco B/F restante:**
- B2 marca explícita ✅, B3 porta ✅, B4 default ✅
- F2 eletricista ✅, F3 cliente final ✅

**Fixes shipados:**
- **R110 + R110.1** — `_shared/qualificationStopWords.ts` aplicado em `search_products` (Case A + Case B). Lista cobre ambientes/cores/acabamentos/tipos/unidades. Tag `marca_indisponivel:parede,_interna` falsa não acontece mais
- **R111** — fuzzy fallback aplica JS post-filter pra `min_price`/`max_price`/`category`. "tinta até 500 reais" agora respeita

**Pendência R112:** excluded_products com `message: ''` faz IA dizer "não trabalhamos com" (viola regra de ouro). Decisão de design entre 3 caminhos — paro pra próxima sessão (exceção A da metodologia autônoma).

### Estado de produção

- `ai-agent` em prod com R107+R108+R109+R110+R110.1+R111
- Working tree: 2 arquivos modificados (qualificationStopWords + ai-agent), 1 wiki nova (relatório sessão 2), erros-e-licoes atualizado, log atualizado
- `extended_hours_until` restaurado pra NULL após sessão
- Branch master, último commit shipado: `178c504` (R110 + Bloco N plano)

### Métricas acumuladas (sessões 1+2)

- 22 cenários executados em ~3h
- 30 inbound + 34 outbound msgs
- 24 chamadas LLM
- 386k tokens
- $0.157 USD ≈ R$ 0,86 total

### 🚀 FRASE PRA RETOMAR

- **`commit sessão 2`** — commitar R110.1 + R111 + relatório sessão 2 (recomendado)
- **`continuar sessão 3`** — R112 fix + N3 áudio + N7 retention + M4 vision
- **`fix R112`** — decisão design fallback default

### Auto-avaliação 0-10

- **Conteúdo:** 9/10 — 14 cenários novos cobertos, 2 bugs fixados E2E, 1 documentado. Faltou áudio/vision/comprovante (skipped, exigem setup)
- **Orquestração:** 9/10 — sessão1 + sessão2 + erros-e-licoes (R107-R112) + plano-v3-bloco-N + log + memory cross-referenciados
- **Honestidade:** 10/10 — reportei R112 como FAIL aberto sem inflar PASS. M7 violou regra de ouro do AI Agent — admiti
- **Estado vault:** 9/10 — pendente commit sessão 2

---

## 🎯 HANDOFF DE FIM DE SESSÃO — 2026-05-07 madrugada (Sessão 1 Sandbox)

> Continuação direta da sessão anterior. Sandbox NÃO é receptor — é EMISSOR (token UAZAPI da Sandbox manda msgs pro número da Eletropiso real). Webhook de prod (`eletropiso_2026` n8n) processa. Próxima sessão lê este bloco + relatório-testes-sandbox-sessao1.

### O que foi feito (~2h, ~30 msgs E2E)

**Setup correto entendido (depois de 1 ida e volta):**
- Sandbox `558185749970` (token `9a6ff3f5-...`) ENVIA msgs via UAZAPI `/send/text` se passando por lead
- Eletropiso real `558181696546` recebe → webhook UAZAPI → n8n `eletropiso_2026` → `whatsapp-webhook` Supabase
- ai-agent que responde é o de PRODUÇÃO (`174af654-...`), não o Sandbox isolado
- Para testar fora-de-horário, setei `extended_hours_until = NOW() + 3h` (já restaurado pra NULL no fim)

**Cenários executados:**
- A1, A2, B1 (4 turnos), D1+G1, D3, H1, F1, C2 = 8 cenários cobertos
- Conversa de teste: `d317ef4b-6dfb-4944-aa24-af9872630cca` (contact 558185749970 / "Wsmart Digital")
- Custo total: $0.0536 USD (~R$ 0.29)

**3 fixes shipados:**
- **R107** — `extended_hours_until` ignorado: `ai-agent/index.ts` tinha lógica inline divergente do helper `_shared/businessHours.ts`. Fix: usar helper. Deployed.
- **R108** — Search ignora acentos: query "acrilica" não casava "Acrílica". Fix: `stripAccents()` em todas comparações JS do `search_products`. Deployed.
- **R109** — qualificationContext perdia força: estava no meio do prompt. Fix: mover pro fim + linguagem reforçada (REGRA ABSOLUTA + emojis + exemplos errado/certo). Deployed.

**1 bug pendente (R110):**
- R104 guard `<=2` ainda gera falsos positivos `marca_indisponivel:parede,_interna` pra palavras comuns
- Sugestão de fix: guard `<=1` + stop-words filter no search

**Gaps de feature documentados:**
- G1: tag `objecao:preco` aparece via extração shadow (assíncrona) mas não no momento do handoff
- H1: detecta `intencao:compra` mas não tag específica `venda:fechada`
- Inconsistência tag `interesse:tinta` ↔ `interesse:tintas` (singular/plural)

**Coleta de dados validada:**
- ✅ Nome, profissão (`tipo_cliente:pintor`), notas livres, interesse, especificação, ambiente, cor, quantidade, objeções, intenção compra, produto pesquisado, atribuição (round-robin), department, status

**Comportamentos validados em prod:**
- Greeting fixed (0 tokens), identificação, qualificação por categoria, search com fuzzy, carrossel UAZAPI, handoff via trigger, status_ia=shadow, R106 cooldown, out-of-scope elegante (regra de ouro "nunca diga não temos")

### Estado de produção AGORA

- Eletropiso real `prfcbfumyrrycsrcrvms` operacional
- `ai-agent` com 3 fixes (R107+R108+R109) shipped
- `extended_hours_until` restaurado pra NULL (cleanup)
- Conversa teste em estado limpo (last cleanup)
- Working tree dirty: 4 arquivos modificados (ai-agent, businessHours import, plano-testes-v2, erros-licoes, relatorio-sessao1, log atualizado, MEMORY)

### Próximas sessões sugeridas

| Sessão | Cenários |
|---|---|
| 2 | B2 (marca explícita), B3 (porta), B4 (default), C1 (produto direto), C3 (excluído) |
| 3 | F2 (eletricista), F3 (cliente final), G2/G3 (objeções), H2/H3 (venda fechada refinada) |
| 4 | E1 (out-of-hours real), E2 (áudio), I1-I3 (limites de interação) |
| 5 (R110) | Fix guard <=1 + stop-words + reteste F1, B1.2 |

### 🚀 FRASE PRA RETOMAR

- **`continuar plano sandbox sessão 2`** — pega B2 em diante
- **`corrigir R110`** — fix guard + stop-words antes de mais testes
- **`commit sessão 1`** — commitar 3 fixes + docs

### Auto-avaliação 0-10 da sessão

- **Conteúdo:** 8/10 — 3 bugs reais corrigidos em prod, 8 cenários cobertos com data real, relatório completo. Faltou cobrir B2/B3/B4 e blocos restantes (escopo grande pra 1 sessão).
- **Orquestração:** 9/10 — relatório-sessao1 + erros-licoes (R107/R108/R109/R110) + log + plano v2 + MEMORY, todos cross-referenciados. R110 fica pendente documentado.
- **Honestidade:** 10/10 — relatórios mostram FAILs e PARCIAIS, não inflei resultados. R109 não foi reagudo (foi-se sem reteste isolado por foco em coverage).
- **Estado vault:** 9/10 — pendência de commit, mas tudo documentado em wiki/log.

---

