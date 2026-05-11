---
title: Histórico de Erros — 2026-05 (parte 2, R108-R114)
type: erros-historico
description: Incidentes R108 a R114 (2026-05-07): unicode normalization, fuzzy filters, qualificação context, cron 401, detectObjection
updated: 2026-05-11
---

# Histórico de Erros — Maio 2026 (parte 2: R108-R114)

> Continuação de [[wiki/erros/historico-2026-05-part1]]. Read-only.

### R108 — Search ignora acentos (unicode normalization) (2026-05-07)

**O que:** lead simulado mandou "preciso de tinta acrilica branca" (sem acento). Catálogo Eletropiso tem "Tinta Acrílica Fosco Standard 16L Branco - Coral". Search retornou ZERO produtos.

**Causa raiz:** Postgres `ILIKE %acrilica%` NÃO casa com "Acrílica" (combining diacritical mark `U+0301` no caractere `í`). Igualmente, no JS `String.includes("acrilica")` não casa "acrílica". Em catálogos com nomes ricos em acentuação (português), qualquer query ASCII falha.

**Correção (R108):** função `stripAccents(s)` aplicando `s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()` em todas comparações JS do `search_products` (linhas 1598, 1607, 1631, 1641, 1662). O ILIKE primário ainda é frouxo, mas o broad fallback retorna candidatos com pelo menos uma palavra match, e o post-filter normalizado refina pra AND completo.

**Regra 108 (preventiva):**
- (a) **Em produtos com texto em português, comparações case-sensitive ou diacritic-sensitive são bug latente.** Sempre normalizar `NFD + strip combining marks + toLowerCase` antes de comparar strings em pt-BR.
- (b) **Postgres tem `unaccent` extension** que faz isso no SQL. Pode ser uma alternativa mais elegante que aplicar JS post-filter — investigar em sessão dedicada.
- (c) **Este bug NÃO é coberto por testes unit.** Adicionar caso de teste em `search_products` com query sem acento + produto com acento.

---

### R110 — Stop-words de qualificação viravam falsos `marca_indisponivel:*` (2026-05-07)

**O que:** durante teste F1 sessão 1, lead simulado mandou "sou pintor profissional, preciso de tinta acrilica branca pra parede interna". Search retornou vazio + tag `marca_indisponivel:parede,_interna` foi adicionada. "parede" e "interna" são palavras de **ambiente** (qualification field), não marcas — falso positivo gerou ruído no painel do helpdesk.

**Causa raiz:** após search retornar 0, código detecta "termos que não aparecem em nenhum produto do catálogo" e infere que são **marcas não-vendidas**. Heurística válida pra catálogos com poucos produtos (`Suvinil` ou `Sherwin Williams` faltando = lead quer marca específica não-vendida). Mas guard era `missingTerms.length <= 2` — 2 palavras genéricas (parede + interna) também passavam. R104 já tentou mitigar com guard, mas guard sozinho não distingue palavras-de-marca de palavras-de-qualificação.

**Correção (R110):** novo arquivo `_shared/qualificationStopWords.ts` exportando `QUALIFICATION_STOP_WORDS` (Set<string>) e helper `filterNonBrandTerms(words)`. Lista contém ambientes (parede/sala/teto/...), cores (branco/preto/...), acabamentos (fosco/brilho/...), tipos (acrilica/esmalte/...) e unidades (m²/litros/...). No `search_products` (Case A linha 1651, Case B linha 1672), aplica `filterNonBrandTerms` ANTES do guard `<=2`. Marcas reais (1-2 palavras desconhecidas) ainda viram `marca_indisponivel`; palavras de qualificação não.

**Validação:** mesma query "sou pintor, preciso tinta acrilica branca pra parede interna" → search retornou 5 produtos + 0 tags falsas. R110 deployed em 2026-05-07.

**Regra 110 (preventiva):**
- (a) **Heurísticas baseadas em "termo ausente do catálogo"** precisam de **pré-filtro** com lista de palavras inequivocamente não-marca. Sem isso, geram falsos positivos toda vez que cliente escreve frase natural ("vermelha pra cozinha externa").
- (b) **Stop-words list deve viver fora do código** se possível. Se ficar muito longa (>50 termos por categoria), considerar **lista positiva de marcas** (cadastrar marcas conhecidas no catálogo + comparar com query) — mais escalável, menos manutenção.
- (c) **Smoke E2E com query natural** após qualquer ajuste em search/qualification. Sessão 1 só passou nesta detecção porque rodou cenário F1 com query rica ("pra parede interna pra obra de 200 metros") — testes unit com query "tinta acrilica" (curta) nunca pegariam o bug.

---

### R111 — Fuzzy fallback ignora filtros de price/category (2026-05-07)

**O que:** lead simulado mandou "quero tinta acrílica branca pra parede interna até 500 reais". LLM passou `max_price: 500` corretamente. Mas search retornou Tinta Eggshell R$ 792 + Cuba + Manta — produtos fora do filtro do cliente.

**Causa raiz:** quando primary search e word-by-word fallback retornam 0, código chama `search_products_fuzzy` RPC (pg_trgm word-level). RPC só recebe `agent_id`, `query`, `threshold`, `limit` — **NÃO recebe min_price / max_price / category**. Resultado fuzzy era atribuído direto a `products` sem nenhum post-filter.

**Correção (R111):** após `fuzzyProducts` retornar com resultados, aplicar JS post-filter respeitando `args.min_price`, `args.max_price` e `args.category` (este último com `stripAccents` no haystack). Se filter zera resultados, log info mas não erro (lead pode receber 0 produtos = enrichment ou handoff).

**Validação:** mesma query "tinta acrilica branca pra parede interna até 500" → carrossel com 2 produtos, ambos R$ ≤ 500 (Coral Standard R$ 427 + Esmalte Dialine R$ 51). Eggshell R$ 792 NÃO entrou.

**Regra 111 (preventiva):**
- (a) **Toda fallback chain de search precisa propagar TODOS os filtros do tool args.** RPCs no Postgres não devem ser tratadas como atalhos — se o filtro é importante (preço, categoria), aplicar JS antes de retornar.
- (b) **Auditar fallbacks após adicionar novo arg em ferramenta.** Quando `min_price` foi adicionado em `search_products`, primary e broad respeitaram, mas fuzzy ficou esquecido. Pattern: search test com filter de preço como smoke obrigatório após qualquer mudança em search.
- (c) **Falha silenciosa pior que erro.** Aqui não dava erro — só retornava produtos errados. Lead achava que loja vende produto fora do orçamento dele. Logs precisam destacar quando fuzzy é usado pra detectar este tipo de regressão.

---

### R112 — `excluded_products` fallback dinâmico com alternativas (2026-05-07, ✅ FIX shipado)

**Histórico:** versão 1 do fix (commit 97f024b) reescreveu o fallback pra evitar "não trabalhamos com" — texto ficou genérico ("Esse não é nosso foco principal! Aqui a gente trabalha com materiais de construção..."). Usuário não gostou e propôs **EXCEÇÃO da regra de ouro**: para excluded_products é OK dizer "não trabalhamos com X" porque (a) admin configurou intencionalmente, (b) fluxo é separado do LLM (vai direto via `sendTextMsg`, nunca passa pelo prompt), (c) sempre acompanha alternativas que a loja vende. Honestidade > eufemismo nesse contexto. Versão 2 (commit pendente) implementa fallback dinâmico via `suggested_categories`.

**Causa raiz original (versão 1):** Não era LLM "caindo em comportamento default" — era CÓDIGO gerando a string proibida diretamente. Função `buildFallbackMessage(matchedKeyword)` em `_shared/excludedProducts.ts:36-38` retornava literal `\`Não trabalhamos com ${matchedKeyword}, posso te ajudar com outro produto?\``. Frontend propagava: comentário + UI "preview" + hint ensinavam o admin que "está OK deixar message vazia".

**Correção final (R112 v2):**

Backend (`_shared/excludedProducts.ts`):
- (a) `buildFallbackMessage(matchedKeyword, _businessName?, suggestedCategories?)` monta dinamicamente: `"Infelizmente não trabalhamos com {keyword}, mas temos {alternatives}. Posso te ajudar em algo mais? 😊"`
- (b) `alternatives` é gerado de `item.suggested_categories`: 1 item → "X", 2 → "X e Y", 3+ → "X, Y e Z". Se vazio → "outros materiais relacionados"
- (c) `matchExcludedProduct(text, list, businessName?)` propaga `item.suggested_categories` automaticamente pra `buildFallbackMessage`

Frontend (`ExcludedProductsConfig.tsx`):
- (a) Novo campo "Categorias alternativas que você vende" (input separado por vírgula). Admin escreve ex: "acessórios para quarto, cadeiras"
- (b) Preview ao vivo da frase que IA dirá, atualiza conforme admin digita keywords + categorias
- (c) `message` voltou a ser opcional — fallback dinâmico cobre. Se admin preencher, sobrescreve
- (d) Botão "Usar mensagem padrão" gera template equivalente ao fallback runtime
- (e) `addItem()` cria item limpo (sem pré-preenchimento)

**Validação E2E:**
- Cenário 1 (com `suggested_categories: ["acessórios para quarto", "fechaduras para móveis", "cabides e ganchos"]`): query "oi vcs tem cama para vender?" → IA: *"Infelizmente não trabalhamos com cama, mas temos acessórios para quarto, fechaduras para móveis e cabides e ganchos. Posso te ajudar em algo mais? 😊"* ✅
- Cenário 2 (sem `suggested_categories`): query "vendem brinquedo de criança?" → IA: *"Infelizmente não trabalhamos com brinquedo, mas temos outros materiais relacionados. Posso te ajudar em algo mais? 😊"* ✅

**EXCEÇÃO formal da regra de ouro do AI Agent:**

A regra "NUNCA dizer 'não trabalhamos com / não temos / em falta'" do system prompt (linha 1269) tem **uma exceção contextual**:

> Para itens em `excluded_products` configurados pelo admin, o helper `buildFallbackMessage` PODE usar "Infelizmente não trabalhamos com X" PORQUE: (a) admin sinalizou EXPLICITAMENTE que não vendemos esse item; (b) frase sai de fluxo separado (`sendTextMsg` direto, não pelo LLM); (c) sempre acompanha alternativas + pergunta de follow-up; (d) honestidade direta é melhor UX que eufemismo neste contexto específico.

**Regra 112 v2 (preventiva):**
- (a) **Regra de ouro do prompt vale pro LLM** (que pode inventar "não trabalhamos com" quando search falha). Para fluxos que NUNCA passam pelo LLM (como `sendTextMsg` direto), a regra é orientativa — pode ser flexibilizada quando contexto justifica E está documentada.
- (b) **Documente toda EXCEÇÃO em wiki/erros-e-licoes** com (a) o motivo, (b) o caminho de código que aplica, (c) por que LLM e fluxo direto têm regras diferentes. Sem isso, próximo dev que ler "regra de ouro NUNCA dizer X" vai assumir absoluto e quebrar feature.
- (c) **Valide UX, não só regra.** Versão 1 (genérico "Esse não é nosso foco") era tecnicamente correta mas usuário rejeitou — não soava natural. Frase honesta com alternativa + pergunta de follow-up é melhor cross-sell que eufemismo evasivo.
- (d) **Schema com `suggested_categories` valida a abordagem.** O campo já existia há tempo (anotação no comentário: "opcional, só pra UI") mas nunca era usado em runtime. R112 ativou — cresce a importância do admin preencher categorias relacionadas, virando feature de cross-sell automático.

---

### R109 — qualificationContext sobrescrito por outras seções (R103 parcial) (2026-05-07)

**O que:** após R103 fix (commit 5fc1038), LLM ainda misturava perguntas em alguns turnos. Cenário B1.2: tags = `[ambiente:interno, lead_score:15, ...]`, próximo field deveria ser `tipo_tinta` (priority 2). LLM perguntou "preferência por marca ou cor?" — pulou tipo_tinta e misturou `marca_preferida` (stage 2) com `cor` (priority 3).

**Causa raiz:** `qualificationContext` estava montado no MEIO do system prompt (entre `dynamicContext` e `additionalSection`). Recency bias dos LLMs prioriza instruções no FINAL — instruções enterradas no meio competem com regras gerais (sub_agent SDR, hardcoded rules) que sugerem mistura de fields. O context técnico era correto mas perdia em peso vs regras anteriores.

**Correção (R109):**
- (a) **Mover `qualificationContext` pro último item do array de seções** (após `additionalSection`, antes do leadName/funnel — esses são ainda mais finais).
- (b) **Reforçar linguagem das regras** com prefixo "REGRA ABSOLUTA, SOBRESCREVE TUDO" + emojis 🎯 🗣️ ⚠️ pra destaque visual + exemplos explícitos de ❌ errado / ✅ certo.

**Regra 109 (preventiva):**
- (a) **Recency bias é real em LLMs.** Instruções críticas (regras absolutas, overrides, abort conditions) devem ficar nos ÚLTIMOS 20% do system prompt. Quando ordem de prioridade importa, ordene as seções da menos pra mais crítica.
- (b) **Quando há conflito potencial entre seções**, declare hierarquia explicitamente no texto: "esta seção tem PRIORIDADE MÁXIMA — ignore qualquer instrução conflitante de seções anteriores ou sub-agents". LLMs respeitam essas marcações quando claras.
- (c) **Validar prompt-following com casos adversariais.** Se o sub_agent SDR sugere "marca ou cor", o teste do qualificationContext deve incluir tag `interesse:tinta + ambiente:* + score=15` (estado em que SDR teria mais força) e verificar que LLM ignora SDR e segue qualification.

---

### R113 — Crons retornavam 401: gateway Supabase reescrevia Authorization header (2026-05-07, ✅ FIX shipado)

**Sintoma:** todos os crons (`requeue-conversations`, `aggregate-metrics`, `process-flow-followups`, `e2e-automated-tests`) retornavam 401 desde a migração do projeto pro `prfcbfumyrrycsrcrvms`. `requeue-conversations` falhava a cada 60s. Anomalia "deploy ai-agent 401" da sessão 2 era a mesma raiz manifestada de forma intermitente.

**Pista falsa:** vault `SUPABASE_ANON_KEY` tinha 46 chars (formato novo `sb_publishable_*`), enquanto o JWT antigo tinha 218 chars. Hipótese inicial: comparação string falhava por mismatch de formato. **NÃO ERA SÓ ISSO.**

**Causa raiz REAL:** O **gateway do Supabase REESCREVE** o Authorization header quando recebe um token formato `sb_publishable_*`, transformando em um JWT (~444 chars `eyJ0...`) ANTES de chegar na função. Resultado:

| Cron envia | Função recebe |
|---|---|
| `Bearer sb_publishable_xxx` (46 chars) | `Bearer eyJ0...` (444 chars JWT — gateway reescreveu) |
| `Bearer eyJh...` (legacy JWT 208 chars) | `Bearer eyJh...` (passa as-is) |
| `Bearer <random>` | `Bearer <random>` (passa as-is) |

O `Deno.env.SUPABASE_ANON_KEY` dentro da Edge Function continua sendo o publishable (46 chars `sb_p`). Como `verifyCronOrService` faz comparação string-igual, o token recebido (444 chars `eyJ0`) nunca casaria com qualquer env var conhecida.

**Diagnóstico:** deploy de uma `env-diag` function que dumpa env vars + token recebido revelou:
```
SUPABASE_ANON_KEY        46 chars sb_p  (publishable)
SUPABASE_SERVICE_ROLE_KEY 41 chars sb_s  (secret novo)
INTERNAL_FUNCTION_KEY    64 chars c22c  (token neutro, NÃO reescrito pelo gateway)
received_token (após sb_publishable) 444 chars eyJ0  (gateway reescreveu)
received_token (após JWT legacy)     208 chars eyJh  (passa as-is)
```

**Correção (R113):**
- (a) **Pattern novo:** crons usam `vault.CRON_AUTH_KEY` cujo valor bate exatamente com `Deno.env.INTERNAL_FUNCTION_KEY`. Esse formato é neutro — gateway não reescreve.
- (b) **Bootstrap manual one-shot:** edge function diagnóstica leu `INTERNAL_FUNCTION_KEY` da env e gravou em tabela temp; SQL moveu pra `vault.create_secret('CRON_AUTH_KEY', ...)`; tabela temp dropada. Não é versionável puro-SQL porque depende de secret de runtime.
- (c) **Migration `20260507000001_recreate_handoff_queue_cron.sql`** — recria 5 crons usando `vault.CRON_AUTH_KEY`. Header documenta o pré-requisito do bootstrap.
- (d) **Patch defensivo `_shared/auth.ts`** — `verifyCronOrService` aceita 5 formatos de token (JWT, service, publishable, secret, internal). Não resolveu o caso do gateway-rewrite mas dá margem pra futuros formatos.

**Regra 113 (preventiva):**
- (a) **Gateway pode reescrever Authorization.** Tokens em formatos conhecidos pelo Supabase (`sb_publishable_*`, `sb_secret_*`, JWT) podem ser reescritos pelo gateway antes de chegar na função. Comparação string vs `Deno.env.SUPABASE_*_KEY` é frágil. Use tokens neutros (random 64-char) pra cron→edge auth.
- (b) **Funções `verify_jwt=false` chamadas por cron devem usar `INTERNAL_FUNCTION_KEY`** (ou outro secret neutro de mesma classe) pra auth interno, NÃO `SUPABASE_ANON_KEY`.
- (c) **Versionar crons sempre.** Migration `20260504000008` original hardcodava URL do projeto velho — pós-migração ficou órfão e alguém recriou no Studio UI sem versionar. Toda migration de cron deve ser idempotente (`unschedule` antes de `schedule`).
- (d) **Diagnostique env vars antes de assumir.** Quando 401 acontece em loop e config.toml diz `verify_jwt=false`, deploy uma função diagnóstica que dumpa env vars + token recebido — vai revelar o gateway-rewrite na hora.

---

### R113.2 — debounce → ai-agent retornava 401 (auth inline ignorando verifyCronOrService) (2026-05-07, ✅ FIX shipado)

**Sintoma:** Após R113 (que consertou só os crons), msgs WhatsApp pararam de gerar resposta da IA. `ai-agent-debounce` retornava 200, depois `ai-agent` retornava 401 sistematicamente. Sandbox testing impossível.

**Causa raiz REAL:** Diferente de outras 13 edge functions, `ai-agent/index.ts` linhas 70-73 tinha **auth INLINE próprio** que NÃO usava `verifyCronOrService`:

```ts
const token = authHeader?.replace('Bearer ', '')
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
if (!token || token !== anonKey) {
  return unauthorizedResponse(corsHeaders)
}
```

Como `Deno.env.SUPABASE_ANON_KEY` é o `sb_publishable_*` (formato novo), e o gateway reescrevia esse token em JWT 444-char antes de chegar na função, a comparação string sempre falhava. **O patch defensivo em `verifyCronOrService` (R113) não tinha efeito** porque ai-agent não usava a função.

**Diagnóstico:** deploy de `env-diag` que probava ai-agent com cada token disponível (INTERNAL/ANON/SERVICE). Todos retornaram 401 mesmo o `INTERNAL_FUNCTION_KEY` (que tem formato neutro e gateway não reescreve). Isso confirmou que o problema NÃO era só gateway-rewrite — era código inline rejeitando.

**Correção (R113.2):**
- (a) **debounce → INTERNAL_FUNCTION_KEY**: `ai-agent-debounce/index.ts` agora usa `Deno.env.INTERNAL_FUNCTION_KEY` (com fallback pra `SUPABASE_ANON_KEY`) ao chamar ai-agent. Token neutro 64-char não é reescrito pelo gateway.
- (b) **ai-agent usa verifyCronOrService**: `ai-agent/index.ts` linhas 70-73 substituídas por `if (!verifyCronOrService(req)) return unauthorizedResponse(corsHeaders)`. Aceita ANON/SERVICE/PUBLISHABLE/SECRET/INTERNAL.
- (c) **Diagnóstico via `verifyCronOrServiceDiag`**: helper novo em `_shared/auth.ts` que retorna detalhes do mismatch (tokens prefixos/sufixos, candidates env disponíveis). Útil pra debugging futuro sem precisar redeployar com prints.

**Validação E2E:** msg "oi, tem tinta acrílica branca?" enviada via UAZAPI Sandbox → IA respondeu em 25s (10s debounce + 15s LLM). Auth fix confirmado em produção.

**Bug bonus:** R113.1 (sale-closed detection) tinha `incomingText` usado antes da declaração no escopo (linha 232 vs 314). Bloco movido pra depois das empty-text guards (linha 332+).

**Regra 113.2 (preventiva):**
- (a) **Toda chamada interna entre edge functions deve usar `INTERNAL_FUNCTION_KEY`**, não `SUPABASE_ANON_KEY`. Auditoria recomendada: grep `'SUPABASE_ANON_KEY'` em chamadas `fetch` pra outras edge functions.
- (b) **Não duplique auth inline.** Se uma função tem `verifyCronOrService`, USE essa função. Auth inline divergente é dívida técnica que quebra silencioso.
- (c) **Teste E2E real após mudanças de auth.** TypeCheck + tests unitários NÃO pegam regressões de auth — só smoke teste com chamada real (curl ou msg via UAZAPI) confirma.

---

### R114 — `detectObjection` atrás do gate de handoff + LLM sobrescrevia subtipo (2026-05-07, ✅ FIX shipado)

**Sintoma:** Sandbox sessão 4 — frase "Achei mais barato em outra loja por R$ 80" deveria gerar tag `objecao:concorrencia` (regex casa em `objectionDetection.ts` por "outra loja" + "achei...barato em"). Mas o LLM tageou `objecao:preco` via `set_tags`, **sem disparar handoff**.

**Causa raiz:** Diferente do `detectSaleClosed` (linha 315 do `ai-agent/index.ts`, roda em **toda msg inbound** antes de qualquer guard), o `detectObjection` é chamado **apenas dentro do flow de handoff** (linhas 544 e 3140). Quando o LLM identifica objeção mas decide não fazer handoff (ex: tenta negociar com "parcelar 12x"), o regex determinístico **nunca executa**. O LLM tagueia via `set_tags`, mas erra subtipo em frases com 2 dimensões (preço + concorrência).

**Evidência E2E (sandbox sessão 4):**
- G2 "Vou pensar e te respondo depois" → ✅ LLM acertou `objecao:indecisao` (frase unívoca)
- G3 "Achei mais barato em outra loja por R$ 80" → 🟡 LLM tageou `objecao:preco` (devia ser `concorrencia`)

**Correção shipada em 3 partes:**

**Parte 1 (R114 v1)** — detectObjection roda em toda msg inbound (mirror do detectSaleClosed). Adicionado novo bloco em `ai-agent/index.ts` ~linha 331, idempotente via `!hasObjecaoTag`. Reteste #1 mostrou que apenas isso NÃO basta: LLM ainda chamava `set_tags(["objecao:preco"])` depois e mergeTags substituía.

**Parte 2 (R114 v2)** — guard no handler `set_tags`: se conversa já tem `objecao:*`, rejeita tags novas com mesma key. Adicionado em `ai-agent/index.ts` linha ~2363 logo após VALID_OBJECOES check. Também sincronizado VALID_OBJECOES com helper: `'concorrencia'` (com -encia) adicionado, `'concorrente'` mantido por compat.

**Parte 3 (CHECK constraint fix)** — investigando ausência de `event='objection_detected'` nos logs descobri 2 CHECK constraints em `ai_agent_logs`:
- `ai_agent_logs_event_check` (atualizado em migration `20260507143000_r114_ai_agent_logs_event_check`)
- `chk_ai_agent_logs_event` (legacy duplicado, NÃO foi atualizado — bloqueava insert silenciosamente)

Insert do Supabase JS client retorna `{ data, error }` e não joga em check violation, por isso falhava silencioso. **Bug herdado de R113.1** (`sale_closed_detected` também nunca era logado). Drop do legacy em migration `20260507144700_r114_drop_legacy_chk_event`.

**Validação E2E (sandbox sessão 4 reteste #4):**
- Frase: "Achei mais barato em outra loja por R$ 80"
- Tag final: `objecao:concorrencia` ✅ (regex)
- Log: `event=objection_detected, detection_type=concorrencia` ✅ (observabilidade)
- LLM tentou `set_tags(["objecao:preco"])` mas foi rejeitado pelo guard

**Regra 114 (preventiva):**
- Detecção determinística por regex roda **antes E protegida do LLM** quando categoria é enumerada (objecao:*, venda:*).
- LLM tagging via `set_tags` é OK pra dimensões abstratas (sentimento, urgência), ruim pra subtipos fixos.
- **CHECK constraints duplicados** em DB são bug latente — auditar via `SELECT conname FROM pg_constraint WHERE conrelid = 'tabela'::regclass AND contype = 'c'` periodicamente.
- **Insert silenciosamente falhando**: Supabase JS `await insert(...)` não joga em error de constraint — sempre checar `.error` em INSERTs críticos OU testar manualmente após mudança de schema.
