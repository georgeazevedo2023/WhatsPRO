---
title: Plano Fluxo Premium Eletropiso (part4)
type: plano
description: Continuação do plano-fluxo-premium-eletropiso-2026-05-28 (part4)
updated: 2026-05-28
---

> Partes anteriores: [[wiki/plano-fluxo-premium-eletropiso-2026-05-28]] · [[wiki/plano-fluxo-premium-eletropiso-2026-05-28-part2]] · [[wiki/plano-fluxo-premium-eletropiso-2026-05-28-part3]].

### Sprint 8 - Testes, Playwright E Rollout

Objetivo: validar sem quebrar producao.

Tasks:

- Unit tests:
  - `qualificationGate.test.ts`
  - `serviceCategories.test.ts`
  - `searchProducts.test.ts`
  - `productSpecialist.test.ts`
  - `productChoiceDetector.test.ts`
  - `cart.test.ts`
  - `dispatchResponse.test.ts`
  - `responseValidator.test.ts`
- E2E Playwright:
  - criar/estender cenarios em `e2e/03-ai-agent.spec.ts` e `e2e/08-ai-agent-deep.spec.ts`
  - validar 21.33 e 21.34
- Rodar:
  - `npx tsc --noEmit`
  - `npm run build`
  - `npx vitest run <testes focados>`
  - `npx playwright test e2e/03-ai-agent.spec.ts e2e/08-ai-agent-deep.spec.ts --project=chromium`
- Fazer rollout:
  - sandbox com `routing_mode=router`
  - shadow/canary
  - EletropisoV2
  - monitorar `ai_agent_runs`, handoff_queue, console e logs.

Aceite:

- 21.33 passa ponta a ponta.
- 21.34 passa ponta a ponta.
- Sem vazamento de tool/internal error.
- Sem "nao temos" em zero resultado.
- Sem carrossel antes de qualificacao minima.
- Handoff sempre cria fila/nota/resumo e shadow.


---
> Continua em [[wiki/plano-fluxo-premium-eletropiso-2026-05-28-part4]] (Dados de Commit + Riscos + Definição de Pronto).


## Dados De Commit E Deploy Mapeados

Estado local em 2026-05-28:

- Branch atual: `master`.
- Remote: `origin https://github.com/georgeazevedo2023/WhatsPRO.git`.
- Ultimo commit local visto: `82d77ee feat(v7.57.2): dashboard de fila do gestor mobile-first`.
- Working tree esta suja; ha alteracoes de helpdesk, automacao/webhook e este documento. Nao fazer commit/deploy sem revisar escopo.

Stack documentada:

- Producao: `crm.wsmart.com.br`.
- Frontend/app: Docker Swarm + Traefik + SSL.
- Registry: `ghcr.io/georgeazevedo2023/whatspro:latest`.
- CI/CD: GitHub Actions em push para `master`, build e push para GHCR.
- Gestao: Portainer, stack `whatspro`, servidor Hetzner CX42 `65.108.51.109`.
- Edge Functions: Supabase project ref `euljumeflwtljegknawy`.
- Deploy de Edge Function: `SUPABASE_ACCESS_TOKEN=... npx supabase functions deploy <name> --project-ref euljumeflwtljegknawy`.

Regras operacionais:

- Nao usar MCP de deploy para Edge Functions complexas com `_shared`; usar Supabase CLI.
- `ai-agent` e arquivos relacionados sao alto risco: deploy somente com aprovacao explicita e smoke imediato.
- Eu tenho o mapa de commit/deploy e os comandos; nao tenho nem devo expor secrets. O deploy so deve acontecer quando voce autorizar.

## Riscos E Mitigacoes

1. `ai-agent/index.ts` e arquivo de alto risco.
   - Mitigacao: preferir helpers novos puros e pequenas chamadas no index.

2. Regras por nicho podem virar hardcode.
   - Mitigacao: tudo configuravel via `service_categories`/JSONB/admin.

3. LLM pode ignorar prompt.
   - Mitigacao: mover regras criticas para validators/estado deterministico.

4. Modelos reasoning podem responder vazio se tokens forem baixos.
   - Mitigacao: manter branch `max_completion_tokens` e testes com `gpt-5*`.

5. Custo do modelo frontier.
   - Mitigacao: usar frontier so em canary/premium path; default em mini.

6. Catalogo parcial pode gerar frustracao.
   - Mitigacao: nunca negar; qualificar e handoff com estoque fisico.

## Definicao De Pronto

O fluxo premium sera considerado pronto quando:

- lead novo nao recebe produto antes da qualificacao minima;
- lead recorrente nao repete nome/dados ja conhecidos;
- produto encontrado gera carrossel correto e pergunta pos-carrossel;
- produto escolhido aciona cross-sell obrigatorio;
- carrinho inclui produto principal e complementares aceitos;
- entrega/retirada e bairro sao capturados;
- zero resultado vira validacao de estoque fisico com handoff;
- vendedor recebe resumo padronizado;
- IA fica em shadow apos handoff;
- testes unitarios e Playwright passam nos cenarios principais;
- PRD, CHANGELOG e log sao atualizados no ship.
