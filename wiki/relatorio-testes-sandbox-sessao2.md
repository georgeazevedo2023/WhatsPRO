---
title: Relatório Sessão 2 — Sandbox IA (Bloco N + M + B/F)
tags: [sandbox, testes, e2e, ai-agent, R110, R111, R112, humanizacao, midia]
sources: [wiki/relatorio-testes-sandbox-sessao1, wiki/plano-testes-sandbox-v3-bloco-n, wiki/erros-e-licoes]
updated: 2026-05-07
---

# Relatório Sessão 2 — Bloco N (humano) + M (mídia) + B/F restante

> Modo autônomo (após sessão 1 + commit `6b4bfa8`). 14 cenários executados, 2 fixes shipados (R110, R111), 1 pendência aberta (R112). Custo: R$ 0,57.

## Cenários executados (14)

| # | Cenário | Status | Observação |
|---|---|---|---|
| **N1** | 3 msgs fragmentadas (debounce) | ✅ PASS | 1 LLM call (não 3), msg consolidada |
| **N2** | Typos: "tnta acrilca pra parde da sla" | ✅ PASS | IA entendeu + carrossel |
| **N3** | Áudio | ⏭️ SKIP | exige geração de arquivo PTT |
| **N4** | Emojis + abreviações + typos | ✅ PASS | "vcs tem tnta 🙏" → carrossel |
| **N5** | Mistura de assuntos (4 perguntas) | ⚠️ PARCIAL | IA respondeu só tinta, ignorou entrega/frete/pix |
| **N6** | Mudança de ideia (tinta → fechadura) | ✅ PASS | Categoria atualizou. Gap menor: tag `produto:tinta` antiga persistiu |
| **N7** | Retention 25-30min | ⏭️ SKIP | requer espera longa, deixa pra sessão 3 |
| **M1** | 1 produto único (manta líquida) | ⚠️ PARCIAL | "laje exposta" não está em produto → search vazio. Adicionei laje/exposta às stop-words (R110.1). Reteste positivo |
| **M2** | Filtro de preço ≤ R$ 500 | 🔴→✅ FIX R111 | Antes: Eggshell R$ 792 entrou. Depois: só ≤ R$ 500 |
| **M3** | Botão REPLY do carrossel | ⚠️ PARCIAL | IA enviou novo carrossel em vez de handoff/enriquecimento |
| **M7** | Produto excluído (caixa de correio) | 🔴 FAIL | IA disse "não trabalhamos com" — violação regra de ouro. R112 pendente |
| **B2** | Marca explícita (Coral) | ✅ PASS | Pulou qualificação direto pra search |
| **B3** | Categoria sem field marca (porta) | ✅ PASS | Perguntou ambiente, sem perguntar marca |
| **B4** | Categoria default (fita isolante) | ✅ PASS | Perguntou "uso" (default field) |
| **F2** | Eletricista profissional | ✅ PASS | `tipo_cliente:eletricista` capturado. Gap: categoria errada (hidraulica em vez de elétrica) |
| **F3** | Cliente final DIY | ✅ PASS | Sem tag profissional, qualificou normal |

## Fixes shipados nesta sessão

### R110 — Stop-words filter (+ R110.1 expansão)
- **Inicial:** novo `_shared/qualificationStopWords.ts` com `QUALIFICATION_STOP_WORDS` Set + helper `filterNonBrandTerms()` aplicado em `search_products` (Case A linha 1651, Case B linha 1672) ANTES do guard `<=2`
- **Expansão (R110.1):** adicionado `laje/lajes/exposta/exposto/cobertura/coberta/caixa/caixas/porta/portas/entrada/janela/janelas` à lista após M1 falhar com "laje exposta"
- **Validação:** query "sou pintor, preciso tinta acrilica branca pra parede interna" → 5 produtos retornados, **0 tags falsas** (sessão 1 dava `marca_indisponivel:parede,_interna`)

### R111 — Fuzzy fallback respeita filtros (price/category)
- **Causa:** `search_products_fuzzy` RPC bypassa `args.min_price` / `args.max_price` / `args.category`
- **Fix:** após fuzzy retornar, aplicar JS post-filter respeitando os 3 args
- **Validação:** "tinta acrílica branca até 500 reais" → antes 5 produtos com Eggshell R$ 792. Depois: 2 produtos ambos ≤ R$ 500

## Pendências

### R112 — `excluded_products` viola regra de ouro
**Status:** PENDENTE — exige decisão de design (a) fallback default no código, (b) validação no admin, ou (c) tag silenciosa. Documentado em `erros-e-licoes.md`.

**Impacto em prod:** Eletropiso real, se cliente perguntar sobre item em `excluded_products` (geladeira, sofá, ração, caixa de correio, etc), IA dirá "não trabalhamos com…" — qualquer texto começando com isso. UX ruim mas não bloqueante.

**Recomendação:** opção (a) + (b) combinados na próxima sessão R112.

### Outros gaps menores (não-bloqueantes)
- **N5:** IA não responde info colateral (entrega/frete/pix) quando misturada com pergunta de produto
- **N6:** tag `produto:*` antiga persiste após mudança de categoria
- **F2:** "cabo elétrico" classificado como `interesse:hidraulica` — categoria errada
- **M3:** clique em botão REPLY gera novo carrossel em vez de handoff (esperado: se lead já decidiu, ir pra fechamento)
- **N3, N7, M4-M6, M8-M10:** skipped — exigem geração de áudio/foto, espera longa, ou cadastro de produtos teste

## Métricas (J)

| Métrica | Sessão 1 | Sessão 2 | Total |
|---|---|---|---|
| Cenários executados | 8 | 14 | 22 |
| Mensagens inbound | 12 | 18 | 30 |
| Mensagens outbound | 11 | 23 | 34 |
| Chamadas LLM | 8 | 16 | 24 |
| Tokens totais | 132 137 | 253 773 | 385 910 |
| Latência média (ms) | 12 516 | 15 254 | — |
| Custo OpenAI (USD) | $0.0536 | $0.1033 | $0.1569 (~R$ 0,86) |

## Bugs corrigidos acumulados (sessão 1 + 2)

| ID | Status | O que era |
|---|---|---|
| R107 | ✅ shipped | extended_hours_until ignorado pelo ai-agent |
| R108 | ✅ shipped | search ignora acentos |
| R109 | ✅ shipped | qualificationContext perdia força no prompt |
| R110 + R110.1 | ✅ shipped | stop-words filter (parede/interna/laje/exposta etc) |
| R111 | ✅ shipped | fuzzy fallback ignora price/category |
| R112 | 🟡 pending | excluded_products viola regra de ouro |

## Comportamentos validados em prod (acumulado)

✅ Greeting fixed (0 tokens) · ✅ identificação salvando nome · ✅ qualificação por categoria com fields ordenados · ✅ search com fuzzy + acentos + filtros · ✅ carrossel UAZAPI 2-5 produtos · ✅ handoff via trigger · ✅ status_ia=shadow + assigned_to · ✅ R106 cooldown (silêncio pós-handoff) · ✅ out-of-scope elegante · ✅ extended_hours override · ✅ debounce consolidando 3 msgs em 1 · ✅ tolerância a typos (4 erros numa msg) · ✅ tolerância a emojis e abreviações · ✅ mudança de assunto (categoria reset) · ✅ tipo_cliente capturado (pintor/eletricista) · ✅ marca explícita pula qualificação · ✅ category default (fita isolante)

## Próximas sessões sugeridas

| Sessão 3 (~3h) | Conteúdo |
|---|---|
| 1 | R112 fix (decisão design fallback default + validação admin) |
| 2 | N3 áudio (gerar arquivo PTT base64 ou usar URL pública) |
| 3 | N7 retention (esperar 25min ou simular via SQL) |
| 4 | M4 vision (foto de produto da concorrência) |
| 5 | M6 comprovante (foto + caption) |
| 6 | E1 out-of-hours real (sem extended_hours_until) |
| 7 | I1-I3 limites de interação (max_qualification_retries) |
| 8 | Refinar G/H — capturar `objecao:preco` no momento do handoff + `venda:fechada` específica |

## Cross-refs

- [[wiki/relatorio-testes-sandbox-sessao1]] — sessão 1
- [[wiki/plano-testes-sandbox-v3-bloco-n]] — plano executado
- [[wiki/erros-e-licoes]] — R107-R112
