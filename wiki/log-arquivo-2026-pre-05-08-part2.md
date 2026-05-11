---
title: Log Arquivo Pré 2026-05-08 (parte 2)
type: log-archive
description: 2026-05-07 final tarde — Sessão 4 Sandbox · Onda 2 (G/H/M/E)
updated: 2026-05-11
---

# Log — Arquivo Pré 2026-05-08 (parte 2)

> Read-only. Index pai: [[log.md]] · Anteriores: [[wiki/log-arquivo-2026-04-04-a-09]]

## 2026-05-07 (final tarde) — Sessão 4 Sandbox · Onda 2 (G/H/M/E) — 6 cenários, 1 gap R114 documentado [SUBSTITUÍDA — versão atualizada acima]

> Após sessão 3 (R113.x), executada Onda 2 do plano sandbox: cobertura helpers G/H + cenários complementares. 0 fixes shipados nesta sessão — 1 gap arquitetural identificado e documentado (R114). Custo ~R$ 0,40.

### Cenários executados

| # | Frase | Veredito | Mecanismo |
|---|---|---|---|
| H3 | "Combinado, fechei" | ✅ PASS | detectSaleClosed regex (fechado) |
| H2 | "Já efetuei o pagamento, segue o comprovante" | ✅ PASS | detectSaleClosed regex (comprovante) |
| G3 | "Achei mais barato em outra loja por R$ 80" | 🟡 PARCIAL | LLM tagged objecao:preco (devia: concorrencia) |
| G2 | "Vou pensar e te respondo depois" | ✅ PASS (semi) | LLM tagged objecao:indecisao corretamente |
| M6 | foto + "segue o comprovante" | ✅ PASS | detectSaleClosed regex em caption |
| E1 | 3 msgs fora horário em ~75s | ✅ PASS | R105+R106: 1 só out_of_hours_message |

### Cenários droppados durante auditoria do plano (decisão honrada antes de executar)

- **M8** — catálogo Eletropiso só tem 3 tintas como max categoria (carrossel ≥4 não dispara)
- **M10** — duplicação parcial de M2 + B2 já validados em sessões anteriores
- **I1-I3** — não roteirizados, ficaram pra sessão de planning separada

### Achado arquitetural — R114 (gap detectObjection atrás do gate de handoff)

`detectSaleClosed` roda em toda msg inbound (linha 315 ai-agent/index.ts). `detectObjection` só roda dentro de handoff (linhas 544/3140). Quando handoff não dispara (LLM tenta negociar antes), o regex determinístico nunca executa. LLM substitui via `set_tags` mas erra subtipo em frases ambíguas (G3 "preço" vs "concorrência"). Documentado em `wiki/erros-e-licoes.md` com correção proposta (não shipada).

### Validação comportamental

- LLM acerta subtipo em frases unívocas (G2 indecisão, H/M venda)
- LLM erra em frases multidimensionais (G3 preço+concorrência)
- Confirma hipótese: regex determinístico > LLM pra categorias enumeradas

### Cleanup aplicado

`business_hours.thu.open` setado pra false durante E1, restaurado pra true logo após validação. Estado original do Eletropiso preservado.

### Auto-avaliação sessão 4 — 0-10

- **Conteúdo:** 8/10 — 6 cenários executados, 1 gap arquitetural documentado, plano auditado antes de executar
- **Orquestração:** 9/10 — relatório criado + erros-e-licoes atualizado + log + memory + index sync
- **Honestidade:** 9/10 — droppei 3 cenários durante auditoria (M8 catálogo insuficiente, M10 duplicado, I1-I3 não roteirizados); marquei G3 como parcial em vez de espremer pra PASS
- **Tempo:** 8/10 — ~30min execução + ~15min documentação
- **Estado vault:** 9/10 — tudo sincronizado, frase de retomada concreta abaixo

### 🚀 FRASE PRA RETOMAR

**`shipar fix R114 (mover detectObjection pra rodar em toda msg inbound)`** — fix de ~10 linhas + reteste G3 deve virar PASS determinístico. Tempo: 30min, custo: R$ 0,10.

Alternativas:
- `executar Onda 3 sandbox` (N3 áudio + N7 retention + M4 vision + M5 + M9) — exige decisões de mídia primeiro (geração PTT, URL fotos)
- `roteirizar I1-I3 limites de interação` — sessão de planning, R$ 0
- `auditar auth inline em outras edge functions` (e2e-test, ai-agent-playground) — preventivo R113.2

---

## 🎯 HANDOFF DE FIM DE SESSÃO — 2026-05-07 tarde (Sessão 3 Sandbox COMPLETA com R113 + R113.1 + R113.2)

> Sessão 3 = 5 commits, 2 root causes profundas (cron 401 + ai-agent auth inline), G1+H1 validados em prod E2E.

### Commits hoje (em ordem)

| Hash | Conteúdo |
|---|---|
| `8291a3b` | R113 — vault.CRON_AUTH_KEY + 5 crons reschedulados + auth.ts patch defensivo |
| `5cbcb42` | R113.1 — G1 (objecao:* síncrono) + H1 (venda:fechada determinístico) + tests |
| `6518a8b` | R113.2 — ai-agent auth inline → verifyCronOrService + debounce INTERNAL_FUNCTION_KEY |
| `715c5a0` | docs(log): R113.2 |
| `d2efe8a` | (este — handoff sessão 3) |

### Validação E2E em produção real

**G1 (objecao síncrono):** msg "achei muito caro queria desconto" via UAZAPI Sandbox às 13:46:29 → trigger `desconto` matched, `detectObjection` retornou `preco`, IA respondeu handoff em 22s, conversation tags receberam `objecao:preco` + `ia:shadow` síncrono. ai_agent_logs metadata contém `{ trigger: "desconto", objection: "preco" }`. ✅

**H1 (venda:fechada determinístico):** msg "pode mandar o pix" às 13:47:37 (conversa em shadow) → `detectSaleClosed` retornou `pix_solicitado` → tag `venda:fechada` adicionada ANTES de qualquer guard. Em paralelo, shadow LLM extraiu `intencao:compra`. ✅

### Lições críticas

1. **Auth duplicado é bomba relógio**: ai-agent tinha auth inline divergente das outras 13 functions. Padronização não pegou esse caso. Auditoria recomendada.
2. **Gateway-rewrite invisível**: Supabase reescreve `sb_publishable_*` em JWT 444-char ANTES de chegar na função. Comparação string com env var nunca casa. Use `INTERNAL_FUNCTION_KEY` (formato neutro).
3. **Diagnóstico antes de hotfix**: rollback inicial NÃO resolveu — código era OK, ambiente era o bug. ~30min metodológicos > horas de tentativa-erro.
4. **Test environment é seguro pra investigar fundo**: usuário confirmou "ainda não temos clientes reais". Posso tomar mais tempo pra fazer certo.

### O que foi shipado em produção

- 5 crons rodando 200 (CRON_AUTH_KEY pattern)
- ai-agent v20+ aceita 5 formatos de auth
- ai-agent-debounce v3 usa INTERNAL_FUNCTION_KEY
- G1 + H1 helpers ativos (objectionDetection.ts, saleClosedDetection.ts, 14 testes Deno)
- 'venda' adicionado a BASE_VALID_TAG_KEYS + UI green badge

### O que NÃO foi feito (próxima sessão)

- **Onda 2 completa** (8 cenários: E1/M4/M8/M10/G2/G3/H2/H3) — só validei G1+H1. Custo estimado R$1, 1h.
- **Onda 3** (N3 áudio, N7 retention, M9 imagem 404, M5/M6) — R$1-2, 2h+
- **Roteirizar I1-I3** limites de interação
- **Auditar outras funções** com auth inline (e2e-test, ai-agent-playground) — preventivo

### 🚀 FRASE PRA RETOMAR

**`continuar plano sandbox sessão 4`** — pega Onda 2 completa, depois Onda 3 e I1-I3. Custo estimado total: R$3-4. Tempo: 4-5h.

Alternativas:
- `auditar auth inline em outras edge functions` — preventivo, ~30min, R$0
- `gerar relatório consolidado v1.0 sandbox testing` — fechar versão, criar release notes
- `adicionar suggested_categories nas outras 12 categorias excluded_products` — UX

### Auto-avaliação sessão 3 — 0-10

- **Conteúdo:** 9/10 — 2 root causes profundas resolvidas + 2 helpers determinísticos shipados + E2E validado em prod
- **Orquestração:** 9/10 — 5 commits atomic + wiki R113/R113.2 + log handoff + tests Deno
- **Honestidade:** 10/10 — admiti que rollback inicial estava errado, pausei pra diagnose, não escondi anomalias
- **Tempo:** 6/10 — gastei ~4h (vs 30-40min estimado pra plano "(b) diagnose"), mas custo no test env tolerável
- **Estado vault:** 9/10 — tudo documentado, frase de retomada concreta com 4 alternativas

---

## 2026-05-07 (tarde) — Sessão 3 Sandbox · R113.2 ai-agent auth inline corrigido + E2E validado

> Após R113.1 (G1+H1 helpers shipados em commit 5cbcb42), descobri que ai-agent INLINE auth (linha 70-73) ignorava verifyCronOrService — comparava direto com SUPABASE_ANON_KEY. Combinado com gateway Supabase reescrevendo sb_publishable_* em JWT 444-char, todas as chamadas debounce→ai-agent retornavam 401.

### Diagnóstico metodológico

Plano (b) executado: deploy de env-diag function que probava ai-agent com cada formato de token disponível. Todos retornavam 401 — incluindo INTERNAL_FUNCTION_KEY (token neutro). Confirmou que o fix anterior (verifyCronOrService multi-format) não tinha efeito porque ai-agent usava auth inline próprio.

### Fix shipado (commit 6518a8b)

- **ai-agent/index.ts L70-73**: substitui auth inline por `verifyCronOrService(req)`. Aceita 5 formatos.
- **ai-agent-debounce/index.ts L152**: usa `INTERNAL_FUNCTION_KEY` ao chamar ai-agent (token neutro que gateway não reescreve). Fallback pra ANON_KEY mantém compat.
- **_shared/auth.ts**: adiciona `verifyCronOrServiceDiag` helper que retorna detalhes do mismatch como JSON. Útil pra debug futuro sem redeploy.
- **R113.1 bug fix**: H1 block (detectSaleClosed) usava `incomingText` antes da declaração (linha 232 vs 314) → TDZ ReferenceError. Movido pra depois das empty-text guards.

### Validação E2E

Msg "oi, tem tinta acrílica branca?" via UAZAPI Sandbox às 13:35:35 UTC → IA respondeu em 25s (debounce 10s + LLM 15s). Auth fix confirmado em produção.

### Lições

- **Auditar auth duplicado**: 14 funções têm `verifyCronOrService` mas apenas ai-agent tinha auth inline divergente. Dívida técnica que causou R113.2.
- **Padronizar internal calls**: toda chamada function→function deve usar `INTERNAL_FUNCTION_KEY` pra evitar gateway-rewrite. R113.2 padroniza debounce. Próxima sessão: auditar outras funções (e2e-test, ai-agent-playground).
- **Diagnóstico antes de hotfix**: rollback inicial do ai-agent NÃO resolveu (problema era no env, não no código), mas tomei tempo pra analisar metodicamente e achar a raiz. ~30min bem investidos vs 401 em loop.

### Estado atual

- `master` em commit 6518a8b
- Crons: ✅ todos 200 (CRON_AUTH_KEY pattern)
- ai-agent v20+: ✅ aceita 5 formatos de auth, helpers G1+H1 ativos
- ai-agent-debounce v3: ✅ usa INTERNAL_FUNCTION_KEY
- Próxima sessão: validar G1+H1 com cenários reais + Onda 2

---

