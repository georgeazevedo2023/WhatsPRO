---
title: Relatório Sessão 4 — Sandbox IA (Onda 2 — G/H/M/E)
tags: [sandbox, testes, e2e, ai-agent, R114, deteccao-deterministica, objecao, venda-fechada, out-of-hours]
sources: [wiki/relatorio-testes-sandbox-sessao3, wiki/plano-testes-sandbox-v2, wiki/plano-testes-sandbox-v3-bloco-n, wiki/erros-e-licoes]
updated: 2026-05-07
---

# Relatório Sessão 4 — Onda 2 (cobertura helpers G/H + cenários complementares) + R114 SHIPADO

> Modo autônomo após sessão 3 (R113/R113.1/R113.2). 6 cenários executados Onda 2 + R114 fix completo em 3 partes (regex always + LLM gate + CHECK constraint legacy). Custo estimado ~R$ 0,60.

## R114 fix shipado (post-Onda 2)

3 partes em commit único:

**(a)** `ai-agent/index.ts` ~linha 331 — bloco detectObjection mirrors detectSaleClosed (idempotente, em toda msg).

**(b)** `ai-agent/index.ts` ~linha 2363 — handler set_tags rejeita `objecao:*` se conversa já tem (proteção LLM). VALID_OBJECOES adicionou `concorrencia` (compat com helper).

**(c)** Migrations:
- `20260507143000_r114_ai_agent_logs_event_check.sql` — atualiza `ai_agent_logs_event_check` com `sale_closed_detected` + `objection_detected`
- `20260507144700_r114_drop_legacy_chk_event.sql` — drop legacy `chk_ai_agent_logs_event` (constraint duplicado bloqueando insert silenciosamente)

**Validação reteste #4:** Frase "Achei mais barato em outra loja por R$ 80" → tag `objecao:concorrencia` (regex venceu) + log `event=objection_detected, detection_type=concorrencia` (observabilidade restaurada). LLM tentou `set_tags(["objecao:preco"])` mas foi rejeitado pelo guard.

## Resumo executivo

| # | Cenário | Veredito | Mecanismo |
|---|---|---|---|
| H3 | "Combinado, fechei" | ✅ PASS | `detectSaleClosed` regex (type=fechado) |
| H2 | "Já efetuei o pagamento, segue o comprovante" | ✅ PASS | `detectSaleClosed` regex (type=comprovante) |
| G3 | "Achei mais barato em outra loja por R$ 80" | 🟡 PARCIAL | LLM `set_tags(objecao:preco)` — devia ser `concorrencia` |
| G2 | "Vou pensar e te respondo depois" | ✅ PASS (semi) | LLM `set_tags(objecao:indecisao)` |
| M6 | foto + caption "segue o comprovante" | ✅ PASS | `detectSaleClosed` regex em caption |
| E1 | 3 msgs fora horário em ~70s | ✅ PASS | R105+R106: 1 só out_of_hours_message |

**Cenários droppados durante auditoria do plano:**
- M8 (carrossel ≥4 produtos) — Eletropiso só tem 3 tintas como max categoria. Catálogo insuficiente.
- M10 (filtros combinados) — duplicação parcial de M2 + B2 já validados.
- I1-I3 (limites de interação) — não roteirizados, ficaram pra sessão de planning separada.

## Pré-condições aplicadas

| Setup | Antes | Durante teste | Depois |
|---|---|---|---|
| `business_hours.thu.open` | true | false (E1 setup) | true (cleanup E1) |
| `status_ia` (entre cenários) | shadow (resíduo sessão 3) | active (reset) | active |
| `tags` (entre cenários) | acumuladas | só `ia_cleared:NOW` (reset) | varia por cenário |

## Detalhe dos cenários

### H3 — "Combinado, fechei" → venda:fechada

**Disparo:** 14:12:27 UTC
**Resposta IA:** 14:12:56 UTC (29s)
**Tags finais:** `[ia_cleared, venda:fechada, motivo:compra, ia:shadow]`
**Status_ia:** shadow
**Tool calls:** 2 (handoff_to_human + set_tags)
**Latência LLM:** 12.6s, 15337 input tokens, 48 output

`detectSaleClosed` rodou na linha 315 ANTES dos guards e adicionou `venda:fechada` (type=fechado, regex `\bfechei\b` casou). LLM ainda chamou `handoff_to_human` independente. Round-robin atribuiu Djavan.

### H2 — "Já efetuei o pagamento, segue o comprovante" → venda:fechada

**Disparo:** 14:14:48 UTC (encoding shell escape virou "J�" mas regex casou em "comprovante")
**Resposta IA:** 14:15:20 UTC (32s)
**Tags finais:** `[ia_cleared, venda:fechada, ia:shadow]`
**Status_ia:** shadow

Mesmo path do H3. Type detectado: `comprovante` (vem antes de `pago` no Object.entries, regex `\b(segue)\s+(o\s+)?comprovante\b` casou).

### G3 — "Achei mais barato em outra loja por R$ 80" → 🟡 tag errada

**Disparo:** 14:16:29 UTC
**Resposta IA:** 14:16:58 UTC (29s)
**Tags finais:** `[ia_cleared, objecao:preco]` ← **devia ser `objecao:concorrencia`**
**Status_ia:** ligada (NÃO disparou handoff)
**Tool call:** `set_tags(["objecao:preco"])`
**Resposta:** "Entendo, Wsmart! Temos opções com excelente custo-benefício e você pode parcelar em até 12x no cartão. Posso ajudar a encontrar uma tinta acrílica branca dentro da sua faixa de preço? 🎨"

**Análise:** `detectObjection` regex em `objectionDetection.ts` casa `concorrencia` perfeitamente nessa frase (`/\b(outra)\s+(loja)/` + `/\b(achei)\s+(mais\s+)?barato\s+(em|na|no|por)/`). MAS o helper só roda dentro do flow de handoff (linhas 544 e 3140 do ai-agent/index.ts). Como handoff não disparou (LLM tentou negociar), o regex **nunca executou**. LLM identificou objeção semanticamente e tagueou via `set_tags`, mas escolheu `preco` (frase é ambígua: contém R$80 + "outra loja" = preço E concorrência). Documentado como **R114** em `wiki/erros-e-licoes.md`.

### G2 — "Vou pensar e te respondo depois" → objecao:indecisao

**Disparo:** 14:18:47 UTC
**Resposta IA:** 14:19:22 UTC (35s)
**Tags finais:** `[ia_cleared, objecao:indecisao]` ✅
**Status_ia:** ligada (LLM tentou follow-up, não fez handoff)
**Tool call:** `set_tags(["objecao:indecisao"])`
**Resposta:** "Entendo, Wsmart. Quando desejar, posso te apresentar opções de tintas para sua sala. Posso te ajudar a escolher a melhor para o seu ambiente? Estou à disposição."

LLM acertou subtipo desta vez porque frase é unívoca (só indecisão, sem ambiguidade). Path arquitetural ainda é o mesmo do G3 — gap R114 segue válido.

### M6 — foto picsum + caption "segue o comprovante" → venda:fechada

**Disparo:** 14:20:46 UTC (UAZAPI baixou imagem `picsum.photos/400/300` e enviou)
**Resposta IA:** 14:21:14 UTC (28s)
**Tags finais:** `[ia_cleared, venda:fechada, motivo:compra, ia:shadow]`
**Status_ia:** shadow
**Tool calls:** 2 (set_tags(motivo:compra) + handoff_to_human)
**`media_type`:** image
**`incoming_has_audio`:** false

Caption "segue o comprovante" foi extraída como `incomingText` e passou pelo `detectSaleClosed` na linha 315. Tag `venda:fechada` adicionada antes do LLM. LLM ainda chamou `handoff_to_human` com motivo "comprovação de pagamento". Provou que mídia + caption respeita o pipeline determinístico.

### E1 — 3 msgs fora de horário (R105 + R106 cooldown)

**Setup:** `UPDATE ai_agents SET business_hours.thu.open = false`
**Reset conversa:** status_ia=active, tags=[ia_cleared:NOW]

| # | Tempo (UTC) | Direção | Conteúdo |
|---|---|---|---|
| 1 | 14:24:41 | incoming | "oi" |
| 2 | 14:25:05 | **outgoing** | out_of_hours_message ✅ (24s latência) |
| 3 | 14:25:19 | incoming | "tudo bem?" — sem resposta ✅ |
| 4 | 14:25:56 | incoming | "alguem ai?" — sem resposta ✅ |

3 incomings em ~75s, **1 outgoing**. Validou:
- R105: out_of_hours_message dispara (antes era ignorado pelo extended_hours, R107 corrigiu)
- R106: cooldown 60min funciona (linhas 246-266 do ai-agent), compara content exato com `agent.out_of_hours_message`

**Cleanup aplicado:** `UPDATE ai_agents SET business_hours.thu.open = true` ANTES de qualquer outra coisa.

## Métricas (J expandido)

| Métrica | Valor |
|---|---|
| Cenários executados | 6 |
| Cenários droppados (auditoria) | 3 (M8, M10, I1-I3) |
| Resets de conversa entre cenários | 6 |
| Tempo total da sessão | ~30min |
| Latência média IA (passes) | 28s (debounce 10-15s + LLM 13-19s) |
| Tokens totais aproximados | ~80k input + ~250 output |
| Custo OpenAI estimado | ~R$ 0,40 |

## Achados arquiteturais

### R114 — `detectObjection` atrás do gate de handoff (gap)

`detectSaleClosed` roda em toda msg inbound (linha 315 do ai-agent). `detectObjection` só roda em handoff (linhas 544/3140). Resultado: LLM substitui regex em frases que não disparam handoff, e erra subtipo em casos ambíguos (G3).

**Correção proposta** (não shipada nesta sessão):
```ts
// Adicionar na linha 315-area, ao lado do detectSaleClosed:
const objectionType = detectObjection(textForDetection)
if (objectionType && !conversation.tags?.some(t => t.startsWith('objecao:'))) {
  await supabase.from('conversations').update({
    tags: mergeTags(conversation.tags || [], { objecao: objectionType })
  }).eq('id', conversation_id)
}
```

Documentado em `wiki/erros-e-licoes.md` R114.

### Validador comportamental

LLM acerta subtipo em frases unívocas (G2 indecisão, M6 venda) mas erra quando frase mistura dimensões (G3 preço+concorrência). Consistente com hipótese arquitetural: LLM como fallback semântico é OK pra dimensões abstratas (sentimento, urgência) mas ruim pra categorias enumeradas (objecao:*, venda:*) onde regex é determinístico e a lista é fixa.

## Pendências pra próximas sessões

| Sessão | Conteúdo |
|---|---|
| Sessão 5 (Onda 3) | N3 áudio (decidir geração PTT) · N7 retention (simular via SQL UPDATE last_message_at) · M4 vision (foto produto concorrente) · M5 áudio em fluxo de compra · M9 imagem 404 |
| Sessão 6 (R114 fix) | Mover `detectObjection` pra rodar em toda msg inbound + reteste G3 (deve virar PASS determinístico) |
| Sessão 7 (planning I1-I3) | Roteirizar limites de interação: max msgs/dia por lead, max msgs sem resposta humana, throttle anti-spam |

## Cross-refs

- [[wiki/relatorio-testes-sandbox-sessao1]] — A1+A2+B1+D1+G1+D3+H1+F1+C2 (R107/R108/R109)
- [[wiki/relatorio-testes-sandbox-sessao2]] — N1/N2/N4/N5/N6 + M1/M2/M3/M7 + B2/B3/B4 + F2/F3 (R110/R111/R112)
- [[wiki/relatorio-testes-sandbox-sessao3-handoff]] — R113/R113.1/R113.2 (cron 401, ai-agent auth, G1+H1 helpers)
- [[wiki/erros-e-licoes]] — R114 documentado
- [[wiki/sandbox-ia-instancia]] — refs técnicas
- [[wiki/plano-testes-sandbox-v2]], [[wiki/plano-testes-sandbox-v3-bloco-n]] — planos
