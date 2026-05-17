---
title: Log Arquivo 2026-05-13 — Releases v7.35.1 a v7.36.4
type: log-arquivo
---

# Log arquivado: 2026-05-12 e 2026-05-13

> Entradas movidas de `log.md` em 2026-05-17 pra manter root sub-300.

## 2026-05-13 (madrugada++) — Upsell determinístico + encoding (v7.36.4) + 4 bugs novos descobertos

### Bug 6 + Bug 7 (resolvidos, ver `CHANGELOG v7.36.4`)
Encoding do id de botão → `safeBtnId`. Handler upsell determinístico em `ai-agent/index.ts:269+` com `matchAll`. Defaults Eletropiso atualizados via SQL. Validado E2E via POST simulado (2 cliques + closing). Deploy ai-agent v32.

### Bugs 8-11 DESCOBERTOS na simulação "produto fora do catálogo" — PENDENTES
Simulei lead pedindo furadeira + chuveiro elétrico (categorias configuradas, sem produtos no catálogo). Quatro problemas:

- **Bug 8** (alto): `search_products` retorna produtos de **categoria diferente** quando não acha na específica. Lead pediu chuveiro → carrossel de tinta apareceu. Falta filtrar por `interesse:` detectado.
- **Bug 9** (alto): IA "alucinou" descrição misturando furadeira + tinta na mesma resposta. Consequência do bug 8 + LLM tentando juntar contexto.
- **Bug 10** (médio): Greeting inicial regrediu — só "Em que posso te ajudar?" sem "Olá!".
- **Bug 11** (médio): Em meio da qualificação, IA mandou resposta genérica "Para entender melhor suas necessidades..." — perdeu o fio do diálogo.

Fluxo bom (handoff_to_human disparou no final), fluxo intermediário ruim (carrosséis fora de contexto, alucinação de produtos misturados).

**Próxima sessão:** atacar bugs 8-11. Estimativa: ~45 min total (search_products filter + auto-tag validação + tests + re-simulação E2E).

**Frase de retomada:** *"fix bugs 8-11 search categoria 2026-05-14"*

---

## 2026-05-13 (madrugada+) — Bug 3 fixado de vez via `buttonOrListid` (v7.36.3)

Continuação do Bug 3 que ainda persistia depois das 8 variantes da v7.36.1. Gestor disse "audite e teste com Playwright". Eu fiz:

1. WebFetch na doc UAZAPI falhou (SPA, só title).
2. Playwright navegou em `docs.uazapi.com` → `performance.getEntriesByType('resource')` listou `/openapi-bundled.json`.
3. curl baixou; grep no schema `Message` → campo **`buttonOrListid`** (canônico UAZAPI v2). Ainda `convertOptions` (JSON com displayText).
4. Webhook ajustado pra capturar `buttonOrListid` em V0 (prioritário) + parse de `convertOptions`. Debug log removido.
5. Validação via **POST simulado direto** no webhook (sem precisar do user clicar): `content` gravou `"Eu quero! (Tinta Acrílica Eggshell Premium 18L Branco Neve Sol E Chuva - Coral)"` no first try. Mensagem-teste deletada do DB pra não poluir histórico.
6. Deploy `whatsapp-webhook` v7.

**Lição (nova entrada em [[wiki/erros-e-licoes]]):** APIs sobre Baileys normalizam pra payload flat — testar com spec oficial antes de chutar fallbacks. Web SPA → Playwright + performance.getEntriesByType pra achar JSON real.

**Próximo handoff:** "validar button reply real 2026-05-13"

---

## 2026-05-13 e 2026-05-12 — Releases v7.35.1 → v7.36.2 (arquivado)

> Movido para [[wiki/log-arquivo-2026-05-12-a-13]] em 2026-05-17 (hard limit). Inclui v7.36.2 (auto-extract Bug 4 + carrossel CSS), v7.36.1 (carrossel button-reply + anti-eco), v7.36.0 (IA 24/7), handoff 2026-05-12, v7.35.3 (fix RPC uuid), v7.35.2 (retention logs), v7.35.1 (limpar pendências).

---

## 2026-05-11 — Dashboard do Gestor 3 fases (arquivado)

> Movido para [[wiki/log-arquivo-2026-05-11-dashboard]] em 2026-05-14 (hard limit). Inclui Fase 1 (unificado), Fase 2 (métricas avançadas), Fase 3 (pivô comercial).

---

## 🎯 HANDOFF DE FIM DE SESSÃO — 2026-05-11 (arquivado)

> Movido para [[wiki/log-arquivo-2026-05-11-handoff]] em 2026-05-12 (hard limit).

---


## Sessões anteriores (arquivadas)

