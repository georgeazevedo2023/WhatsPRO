---
title: Relatório Testes Sandbox — Sessão 1 (2026-05-07)
tags: [sandbox, testes, e2e, ai-agent, relatorio, metricas, R107, R108, R109]
sources: [wiki/plano-testes-sandbox, wiki/plano-testes-sandbox-v2, wiki/erros-e-licoes]
updated: 2026-05-07
---

# Relatório Sessão 1 — Sandbox IA → Eletropiso real

> Setup: Sandbox `558185749970` enviou mensagens via UAZAPI fingindo ser lead, Eletropiso real `558181696546` respondeu via ai-agent de produção. Conversa: `d317ef4b-6dfb-4944-aa24-af9872630cca`.

## Cenários executados (8 testes em ~30 min)

| # | Cenário | Status | Observações |
|---|---|---|---|
| A1 | Saudação `oi` | ✅ PASS após R107 | Greeting fixed, 0 tokens, 19s latência |
| A2 | Identificação "Carlos" | ✅ PASS | full_name salvo, IA usou nome, 14k tokens |
| B1.1 | "preciso de uma tinta" | ✅ PASS | IA pergunta ambiente |
| B1.2 | "parede da sala" | ❌ FAIL | IA misturou "marca ou cor?" pulando tipo_tinta (R103 parcial) |
| B1.3 | "acrilica" | ⚠️ PARCIAL | IA tagueou tipo_tinta mas search falhou (acentos) + R104 regressão |
| B1.4 | "branco" (após R108) | ✅ PASS | Search achou 2 tintas Coral, carrossel enviado |
| D1+G1 | "achei caro" | ✅ D1 PASS / ⚠️ G1 PARCIAL | Handoff disparou, mas tag objeção não veio do LLM |
| D3 | Silêncio pós-handoff | ✅ PASS | IA passiva em shadow |
| H1 | "manda o pix" | ⚠️ PARCIAL | Sistema gerou `intencao:compra` mas não tag `venda:fechada` específica |
| F1 | "sou pintor profissional…" | ⚠️ PARCIAL | `tipo_cliente:pintor` capturado, mas search/R104 falharam de novo |
| C2 | "tinta dourada glitter pra unha" | ✅ PASS | IA reconheceu fora-de-escopo elegantemente |

## Bugs descobertos e correções

### R107 — `extended_hours_until` ignorado pelo ai-agent ✅ FIX shipado
- **Causa:** `ai-agent/index.ts` tinha lógica inline de business_hours **divergente** do helper `_shared/businessHours.ts`. O helper respeitava `extended_hours_until`, a inline não.
- **Fix:** `import { isOutsideBusinessHours }` + substituição de 2 blocos inline (linhas 232 e 2517).

### R108 — Search ignora acentos (unicode normalization) ✅ FIX shipado
- **Causa:** `ILIKE %acrilica%` não casa "Acrílica". JS `.includes("acrilica")` não casa "acrílica" sem normalizar.
- **Fix:** função `stripAccents(s) = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()` aplicada em todas comparações JS do `search_products`. Postgres ILIKE primário ainda é frouxo, mas o post-filter normalizado compensa.

### R109 — qualificationContext movido pro fim do prompt ✅ FIX shipado
- **Causa:** R103 parcial — LLM ainda misturava fields ("marca ou cor?") apesar do qualificationContext.
- **Fix:** mover bloco pro final do system prompt (após `additionalSection`) + reforçar regras com "REGRA ABSOLUTA, SOBRESCREVE TUDO". Recency bias = LLM dá mais peso ao final.

### R110 — pendente (gap conhecido)
- **Causa:** R104 guard `missingTerms.length <= 2` é frouxo demais — palavras comuns como "parede"/"interna" entram em `marca_indisponivel` falsamente.
- **Fix futuro:**
  - (a) Reduzir guard pra `<=1`
  - (b) Stop-words filter no search query (remover ambiente/cor/tipo antes de buscar)
  - (c) Lista positiva de marcas conhecidas (Coral, Suvinil, Iquine) — só taggar se for marca da lista

### Gaps de feature (não bugs — features ausentes)
- **G1:** tag `objecao:preco` aparece via extração shadow (assíncrona) mas não no momento do handoff. Vendedor que pega o handoff não vê motivo no painel direito imediatamente.
- **H1:** sistema detecta `intencao:compra` mas não tag específica `venda:fechada` para palavras como "manda o pix", "paguei", "comprovante". Refinamento futuro.
- **R109 parcial:** Em F1 a categoria detectada caiu no default em vez de "tintas" porque `interesse:tinta` (singular) virou `interesse:tintas` (plural) em algum ponto — investigar consistência da tag.

## Métricas agregadas (J)

| Métrica | Valor |
|---|---|
| Mensagens inbound | 12 |
| Mensagens outbound | 11 |
| Chamadas LLM | 8 |
| Tokens totais | 132 137 (131 519 input + 618 output) |
| Latência média | 12 516 ms |
| Latência max | 19 262 ms |
| Latência min | 5 447 ms |
| Custo OpenAI | **$0.0536 USD ≈ R$ 0.29** (sessão completa) |
| Tools mais usadas | set_tags (7), search_products (3), update_lead_profile (3) |

## Coleta de dados validada

| Dimensão | Capturado? | Observação |
|---|---|---|
| Nome do lead | ✅ `Carlos` | tool `update_lead_profile` |
| Profissão | ✅ `tipo_cliente:pintor` | tag em F1 |
| Notas livres | ✅ "Obra de 200 metros, pintor profissional" | em `lead_profiles.notes` |
| Interesse (categoria) | ✅ `interesse:tinta(s)` | inconsistência singular/plural |
| Especificação produto | ✅ `tipo_tinta:acrilica`, `cor:branco` | |
| Ambiente | ✅ `ambiente:interno`, `ambiente:parede interna` | |
| Quantidade | ✅ `metragem:200` (em F1 set_tags) | |
| Objeções | ✅ `objecao:preco` | aparece async via shadow extraction |
| Intenção compra | ✅ `intencao:compra` | Em H1 |
| Produto pesquisado | ✅ `produto:tinta_acrilica_branco` | |
| Atribuição (assigned_to) | ✅ vendedor 5300bf12 | round-robin funcionou |
| Department | ✅ 1b55559f | populado no handoff |
| Status conversa | ✅ ligada → shadow | |

## Comportamento validado

- ✅ Greeting fixed (0 tokens) executa antes do LLM
- ✅ Identificação salva nome + IA usa nome só após confirmação
- ✅ Qualificação por categoria com fields ordenados (com bug parcial em alguns turnos)
- ✅ Search com fuzzy fallback + carrossel de produtos
- ✅ Carrossel UAZAPI com 2 produtos (foto + preço + 2 botões REPLY)
- ✅ Handoff via `handoff_triggers` (palavra "caro" detectada)
- ✅ status_ia → shadow após handoff
- ✅ assigned_to populado via round-robin do dept
- ✅ R106 cooldown — IA passiva pós-handoff (não respondeu "qual o preço?")
- ✅ Out-of-scope (tinta de unha) tratado elegantemente sem dizer "não temos"
- ✅ `extended_hours_until` override (após R107)
- ✅ Search com acentos (após R108)

## Próximas sessões sugeridas

| Sessão | Cenários |
|---|---|
| Sessão 2 | B2 (marca explícita), B3 (porta), B4 (categoria default), C1 (produto encontrado direto), C3 (excluído) |
| Sessão 3 | F2 (eletricista), F3 (cliente final), G2/G3 (objeções restantes), H2/H3 (venda fechada refinada) |
| Sessão 4 | E1 (out-of-hours real), E2 (áudio), I1-I3 (limites de interação) |
| Sessão 5 | R110 fix + reteste de F1 e B1.2 (R103 parcial) |

## Cross-refs

- [[wiki/plano-testes-sandbox]] — v1
- [[wiki/plano-testes-sandbox-v2]] — v2 expansão
- [[wiki/sandbox-ia-instancia]] — refs técnicas
- [[wiki/erros-e-licoes]] — R107, R108, R109, R110
