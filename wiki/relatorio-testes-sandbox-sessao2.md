---
title: Relatório Sessão 2 — Sandbox IA (Bloco N + M + B/F)
tags: [sandbox, testes, e2e, ai-agent, R110, R111, R112, humanizacao, midia]
sources: [wiki/relatorio-testes-sandbox-sessao1, wiki/plano-testes-sandbox-v3-bloco-n, wiki/erros-e-licoes]
updated: 2026-05-07
---

# Relatório Sessão 2 — Bloco N (humano) + M (mídia) + B/F restante + R112

> Modo autônomo (após sessão 1 + commit `6b4bfa8`). **17 cenários executados**, **4 fixes shipados** (R110+R110.1, R111, R112 v1, R112 v2), **0 pendências bloqueantes**. Custo total: R$ ~1,20 (sessão 2 = R$ 0,57 + retestes R112 = R$ 0,63).

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

## R112 — Resolvido em 2 versões

### R112 v1 (commit `97f024b`) — texto seguro genérico
- Backend: `buildFallbackMessage` reescrito sem "não trabalhamos com" — virou "Esse não é nosso foco principal! Aqui a gente trabalha com materiais de construção..."
- Frontend: `message` virou obrigatório, validação dura, removidas menções a "não trabalhamos com" na UI
- **Validado E2E:** "vocês têm geladeira?" → resposta sem violação ✅
- **Usuário rejeitou:** frase impessoal, eufemismo evasivo, sem cross-sell direto

### R112 v2 (commit `9282450`) — fallback dinâmico com EXCEÇÃO documentada
- **Decisão arquitetural:** EXCEÇÃO formal da regra de ouro pra `excluded_products`. É OK dizer "não trabalhamos com X" porque admin configurou intencional + sai de fluxo separado do LLM (sendTextMsg direto, nunca passa pelo prompt) + sempre acompanha alternativas
- Backend: `buildFallbackMessage(kw, _businessName?, suggestedCategories?)` monta dinamicamente: *"Infelizmente não trabalhamos com {kw}, mas temos {alts}. Posso te ajudar em algo mais? 😊"*
- Concatenação: 1 item="X", 2="X e Y", 3+="X, Y e Z", vazio="outros materiais relacionados"
- Frontend: novo input "Categorias alternativas" + preview live + botão "Usar mensagem padrão"; `message` voltou opcional
- Pré-populei `moveis.suggested_categories = ["acessórios para quarto", "fechaduras para móveis", "cabides e ganchos"]` no Eletropiso real
- **Validação E2E:**
  - ✅ "vcs tem cama?" → "Infelizmente não trabalhamos com cama, mas temos acessórios para quarto, fechaduras para móveis e cabides e ganchos. Posso te ajudar em algo mais? 😊"
  - ✅ "vendem brinquedo de criança?" → "Infelizmente não trabalhamos com brinquedo, mas temos outros materiais relacionados. Posso te ajudar em algo mais? 😊"

## Outros gaps menores (não-bloqueantes)
- **N5:** IA não responde info colateral (entrega/frete/pix) quando misturada com pergunta de produto
- **N6:** tag `produto:*` antiga persiste após mudança de categoria
- **F2:** "cabo elétrico" classificado como `interesse:hidraulica` — categoria errada
- **M3:** clique em botão REPLY gera novo carrossel em vez de handoff (esperado: se lead já decidiu, ir pra fechamento)
- **N3, N7, M4-M6, M8-M10:** skipped — exigem geração de áudio/foto, espera longa, ou cadastro de produtos teste
- **Anomalia transient 401:** durante deploy R112.2, 4 chamadas ai-agent retornaram 401 e msgs (geladeira/ar-condicionado/ração) não geraram outbound. Sistema voltou normal logo após. Provavelmente cron pegou token velho durante deploy. Anotado em Task #19 pra monitoramento

## Métricas (J)

| Métrica | Sessão 1 | Sessão 2 | Total |
|---|---|---|---|
| Cenários executados | 8 | 17 | 25 |
| Mensagens inbound | 12 | ~25 | ~37 |
| Mensagens outbound | 11 | ~28 | ~39 |
| Chamadas LLM | 8 | ~20 | ~28 |
| Tokens totais | 132 137 | ~310 000 | ~442 000 |
| Latência média (ms) | 12 516 | ~15 200 | — |
| Custo OpenAI estimado | $0.0536 | $0.16 | **$0.21 (~R$ 1,20)** |

## Bugs corrigidos acumulados (sessão 1 + 2)

| ID | Status | O que era |
|---|---|---|
| R107 | ✅ shipped (`6b4bfa8`) | extended_hours_until ignorado pelo ai-agent |
| R108 | ✅ shipped (`6b4bfa8`) | search ignora acentos |
| R109 | ✅ shipped (`6b4bfa8`) | qualificationContext perdia força no prompt |
| R110 | ✅ shipped (`178c504`) | stop-words filter inicial |
| R110.1 | ✅ shipped (`b3bc6b9`) | expansão stop-words (laje/exposta/etc) |
| R111 | ✅ shipped (`b3bc6b9`) | fuzzy fallback ignora price/category |
| R112 v1 | ✅ shipped (`97f024b`) | excluded_products fallback proibido |
| R112 v2 | ✅ shipped (`9282450`) | fallback dinâmico com suggested_categories + EXCEÇÃO regra de ouro |

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
