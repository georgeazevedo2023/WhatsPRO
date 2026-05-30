---
title: Plano Fluxo Premium Eletropiso (part6f)
type: plano-executivo
description: Sprints 13-14: 21.33 tintas, regressao 21.36, validacao premium + Playwright Helpdesk (2026-05-30).
updated: 2026-05-29
---

> Anterior: [[wiki/plano-fluxo-premium-eletropiso-2026-05-29-part6e]].

## Sprint 13 - 21.33 Tintas e Regressao 21.36 - 2026-05-30

Status: em andamento; correcoes publicadas e validadas por testes unitarios/typecheck, com pendencia de novo ciclo vivo completo.

Contexto:

- O cenario 21.33 de tinta e mais longo que 21.36/21.37: captura nome, qualifica tinta, explica tipos, busca produto, seleciona item, venda cruzada, entrega, bairro e handoff.
- O primeiro teste direto revelou handoff cedo demais apos "Gostei da Coral", antes de complementares e entrega.

Correcoes aplicadas:

- Bloqueio de handoff por gatilho "me explica/diferenca" quando o lead esta pedindo explicacao consultiva sobre tipos de tinta.
- Perguntas deterministicas para tintas antes de buscar: objetivo, ambiente, aplicacao, tipo_tinta, cor e perfil.
- Inferencia de respostas de tinta: reforma, interno/externo, parede/teto/porta/moveis, acrilica/esmalte/epoxi e perfil premium.
- Pos-carrossel de tintas:
  - selecao textual ("gostei da primeira", "Coral premium") vira `selected_product` + carrinho;
  - pergunta cross-sell obrigatoria de rolo, pincel, bandeja e fita crepe;
  - complementares entram no `cart_items`;
  - coleta retirada/entrega e bairro;
  - fechamento gera handoff com carrinho e resumo privado.
- Fechamento automatico por `sale_closed` agora tambem cria nota privada rica com tags, carrinho e entrega.
- Busca de tintas com perfil completo gera `routerProductPreSearch` deterministico para evitar pergunta vaga "quer que eu mostre?".
- Regressao encontrada no vivo 21.36: fora do horario, `search_fail` nao entrava no loop premium e "Uns 90 metros" nao virava area.
  - Correcao: `search_fail` em categoria premium tambem ativa o loop de produto sem catalogo.

Validacoes:

- `npx tsc --noEmit`: 0 erros.
- `npx vitest run` focado:
  - `productQualificationState.test.ts`
  - `preLLMAutoExtract.test.ts`
  - `serviceCategories.test.ts`
  - `cart.test.ts`
  - Resultado: ate 186 testes verdes conforme rodada.
- Deploy de `ai-agent` realizado no projeto `prfcbfumyrrycsrcrvms`.

Resultados observados:

- `scripts/e2e-deep-qualify.mjs 21.33`:
  - PASS parcial forte em fechamento: `status_ia=shadow`, `assigned_to` preenchido, carrinho com tinta + rolo + bandeja, entrega/bairro e nota privada rica.
  - Ponto ainda abaixo de nota 10 no runner direto: em algumas rodadas o carrossel nao aparece como `media_type=carousel`; a busca retorna produtos, mas a resposta textual do specialist ainda pode ficar consultiva demais. Precisa validar no caminho vivo/UAZAPI e, se persistir, forcar envio ou fallback visual.
- `tests/e2e-premium-sandbox.mjs --only 21.36 --verbose`:
  - Primeiro ciclo apos mudancas falhou por repetir metragem.
  - Correção publicada; novo ciclo teve timeout do runner no turno 2, mas os logs mostram que a resposta correta saiu depois da janela do runner. Precisa rerodar com janela maior ou ajuste de polling.

Proxima acao:

- Ajustar o runner vivo para tolerar latencia maior por turno no 21.36/21.37.
- Rerodar `21.36` e `21.37` vivos.
- Adicionar cenario vivo `21.33` ou runner dedicado para tinta.
- Depois validar Helpdesk com Playwright e console limpo.

## Sprint 14 - Validacao viva premium + Playwright Helpdesk - 2026-05-30

Status: aprovado nos cenarios vivos isolados e Playwright; batch sequencial completo tem ressalva operacional de debounce/webhook.

Correcoes adicionais aplicadas:

- `tests/e2e-premium-sandbox.mjs`
  - `OUTGOING_WAIT_SECS` configuravel para suportar latencia real da UAZAPI/webhook.
  - Reset do sandbox agora limpa `status`, `department_id`, `cart_items`, `shown_product_ids`, `ai_summary` e `last_message`.
  - Cenario vivo `21.33-tinta-completa` adicionado com asserts de tags, carrinho, carrossel e nota privada.
- `supabase/functions/ai-agent/index.ts`
  - Busca deterministica de tintas com perfil completo usa `query: "tinta"` para evitar zero resultado por frase longa.
  - Detector textual pos-carrossel deixou de tratar "quero acrilica" como produto escolhido.
  - Guarda de entrega: quando o lead responde "receber em casa" apos pergunta de mais itens/finalizacao, a IA sempre pede bairro antes do handoff.
  - Guarda de bairro: quando a ultima pergunta foi bairro para entrega, a proxima resposta salva `bairro` e pergunta se ha mais itens antes do handoff.
- `supabase/functions/_shared/agent/dispatchResponse.ts`
  - Handoff implicito agora tambem cria nota privada estruturada.
  - Recarrega `tags/cart_items` frescos do banco antes de montar nota privada.
  - Sanitiza mencoes a "catalogo/catalogo digital" em texto lead-facing.
- `supabase/functions/_shared/agent/tools/setTagsAndHandoff.ts`
  - Handoff explicito tambem recarrega `tags/cart_items` frescos antes de montar resumo.
  - Nota privada passa a anexar `Pedido (...)` com itens do carrinho quando houver tinta + complementares.

Resultados vivos nas instancias de teste:

- `node tests/e2e-premium-sandbox.mjs --only 21.36 --verbose`
  - PASS.
  - `status=shadow`, vendedor atribuido, score 100.
  - Sem vazamento de "nao temos" ou "catalogo" para o lead.
- `node tests/e2e-premium-sandbox.mjs --only 21.37 --verbose`
  - PASS.
  - `status=shadow`, vendedor atribuido, score 100.
  - Qualificacao completa antes de transbordo.
- `node tests/e2e-premium-sandbox.mjs --only 21.33 --verbose`
  - PASS final em `2026-05-30T12:14:40Z`.
  - `status=shadow`, vendedor atribuido, score 40.
  - Carrossel enviado, carrinho com tinta + rolo + bandeja, entrega em Boa Viagem e nota privada com pedido.

Ressalva observada:

- Ao rodar os 3 cenarios no mesmo batch, `21.36` e `21.37` passaram, mas `21.33` teve uma mensagem recebida sem novo log do `ai-agent` depois de "Pode me explicar a diferenca".
- O mesmo `21.33` passou isolado antes e depois da ocorrencia.
- Interpretacao atual: instabilidade operacional do caminho webhook/debounce em execucao sequencial longa, nao falha da regra conversacional. Recomendacao: investigar `ai-agent-debounce`/webhook com correlation id por mensagem antes de exigir batch 3/3 em uma unica execucao.

Validacoes locais:

- `npx tsc --noEmit`
  - 0 erros.
- `npx vitest run supabase/functions/_shared/agent/tools/setTagsAndHandoff.test.ts supabase/functions/_shared/agent/dispatchResponse.test.ts supabase/functions/_shared/agent/productQualificationFlow.test.ts`
  - 42 testes verdes.
- `npx playwright test e2e/02-helpdesk.spec.ts e2e/19-helpdesk-conversation.spec.ts --project=chromium`
  - 11/11 testes verdes.
  - Inclui validacao de Helpdesk sem console error critico.

Proxima acao recomendada:

- Antes de producao ampla: auditar `ai-agent-debounce` e `whatsapp-webhook` para entender a mensagem recebida sem execucao do agente no batch sequencial.
- Depois disso, repetir batch completo com correlation id e promover a sprint como candidata de producao.
