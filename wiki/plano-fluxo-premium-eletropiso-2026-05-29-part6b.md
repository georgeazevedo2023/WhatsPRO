---
title: Plano Fluxo Premium Eletropiso (part6b)
type: plano-executivo
description: Sprints 4-10 do plano executivo + ordem real de execucao + decisao.
updated: 2026-05-29
---

> Anterior: [[wiki/plano-fluxo-premium-eletropiso-2026-05-29-part6]] · Proxima: [[wiki/plano-fluxo-premium-eletropiso-2026-05-29-part6c]].

## Sprint 4 - Fluxo Sem Catalogo Digital

Objetivo:

- Transformar catalogo vazio/categoria ausente em `qualify_then_handoff`.

Tasks:

- Quando `search_products` retorna 0:
  - marcar `catalog_result=empty`;
  - marcar `physical_stock_required=true`;
  - impedir nova busca desnecessaria;
  - continuar no motor de qualificacao.
- Quando categoria nao existe:
  - usar `fallback_produto`;
  - seguir campos minimos;
  - nao buscar se nao ha catalogo.
- Handoff apenas quando:
  - `ready_to_handoff=true`; ou
  - limite configurado atingido.

Arquivos provaveis:

- `supabase/functions/_shared/agent/tools/searchProducts.ts`
- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/_shared/agent/productQualificationFlow.ts`

Aceite:

- 21.36 passa sem dizer catalogo/indisponibilidade.
- 21.37 passa sem dizer catalogo/indisponibilidade.
- Nao ha handoff cedo antes de acabamento/cor/area ou campos equivalentes.

## Sprint 5 - Produto Encontrado, Carrossel E Cross-Sell

Objetivo:

- Fechar o 21.33 com qualidade comercial.

Tasks:

- Liberar busca apenas quando `ready_to_search=true`.
- Resultado 1 a 5:
  - enviar carrossel.
- Resultado maior que limite:
  - perguntar faceta faltante.
- Depois do carrossel:
  - perguntar se alguma opcao atende.
- Ao selecionar produto:
  - marcar `selected_product`;
  - atualizar `cart_items`;
  - iniciar cross-sell obrigatorio.
- Para tintas, sugerir complementares:
  - rolo;
  - bandeja;
  - pincel;
  - fita crepe;
  - extensor.

Arquivos provaveis:

- `supabase/functions/_shared/agent/tools/searchProducts.ts`
- `supabase/functions/_shared/agent/productSpecialist.ts`
- `supabase/functions/_shared/agent/productChoiceDetector.ts`
- `supabase/functions/_shared/agent/cart.ts`
- `supabase/functions/_shared/agent/tools/cartTools.ts`

Aceite:

- Carrossel nao aparece cedo.
- Cross-sell acontece antes do handoff.
- Carrinho final vai no resumo.

## Sprint 6 - Entrega, Retirada E Resumo Padrao

Objetivo:

- Garantir contexto comercial completo para o vendedor.

Tasks:

- Perguntar entrega/retirada quando houver pedido selecionado.
- Se entrega:
  - capturar bairro.
- Criar `handoffSummary.ts`.
- Padronizar resumo para:
  - produto encontrado;
  - produto nao encontrado;
  - categoria sem catalogo;
  - abandono com handoff pendente.

Resumo minimo:

- cliente;
- objetivo;
- categoria;
- campos coletados;
- produto escolhido, se houver;
- complementares, se houver;
- entrega/retirada;
- bairro;
- score;
- mensagens de interesse;
- evento interno;
- observacao para vendedor;
- tags;
- necessidade.

Aceite:

- Vendedor recebe resumo estruturado.
- Lead recebe apenas mensagem humanizada curta.

## Sprint 7 - Follow-Up Pause E Handoff Seguro

Objetivo:

- Fechar o gap `shadow` vs `followups_paused`.

Tasks:

- Definir estado real de pausa:
  - tag `followups_paused:true`; ou
  - campo JSONB em `ai_state`; ou
  - coluna dedicada se necessario.
- Atualizar `process-follow-ups` para respeitar a pausa.
- Garantir que handoff de produto/estoque fisico nao reative IA automaticamente.
- Confirmar `seller_notified=true` via fila/notificacao.

Arquivos provaveis:

- `supabase/functions/process-follow-ups/index.ts`
- `supabase/functions/_shared/handoffQueue.ts`
- `supabase/functions/_shared/agent/tools/setTagsAndHandoff.ts`
- `supabase/functions/_shared/agent/dispatchResponse.ts`

Aceite:

- Apos handoff premium, IA nao responde ao lead.
- Follow-up nao reativa conversa pausada.

## Sprint 8 - Guardrails De Linguagem

Objetivo:

- Impedir tanto negacao quanto afirmacao indevida de estoque.

Tasks:

- Expandir `responseValidator.ts`:
  - bloquear `temos sim` em contexto de estoque/catalogo incerto;
  - bloquear `temos em estoque`;
  - bloquear `esta disponivel`;
  - bloquear `nao temos`;
  - bloquear `nao encontrei`;
  - bloquear `sem estoque`;
  - bloquear `catalogo retornou 0`;
  - bloquear `essas eram todas`;
  - bloquear `acabou`.
- Diferenciar contexto:
  - produto encontrado no catalogo pode dizer "encontrei opcoes";
  - produto sem catalogo/resultado vazio deve usar linguagem neutra.
- Criar testes especificos dos cenarios 21.36 e 21.37.

Arquivos provaveis:

- `supabase/functions/_shared/responseValidator.ts`
- `supabase/functions/_shared/agent/specialistBase.ts`
- `supabase/functions/_shared/agent/dispatchResponse.ts`

Aceite:

- A IA nao nega nem confirma estoque quando o estado pede `neutral_only`.

## Sprint 9 - Admin E Helpdesk

Objetivo:

- Dar paridade visual/configuravel ao fluxo premium.

Tasks Admin:

- Corrigir `validationSchemas.ts`:
  - aceitar modelos exibidos na UI;
  - validar `max_pre_search_questions`;
  - configurar limites de catalogo vazio.
- Expor configuracoes:
  - perguntas maximas por fallback;
  - score ideal por categoria;
  - pausar follow-up apos handoff;
  - templates de resumo.

Tasks Helpdesk:

- Mostrar bloco "Validar estoque fisico".
- Mostrar campos coletados.
- Mostrar score/counter.
- Trocar "Em falta" por "Validar estoque".

Aceite:

- Admin configura.
- Vendedor entende sem repetir perguntas.

## Sprint 10 - Testes Playwright, Sandbox E Rollout

Objetivo:

- Validar ponta a ponta antes de producao.

Tasks:

- Unit tests focados:
  - `productQualificationFlow.test.ts`
  - `qualificationSpecialist.test.ts`
  - `searchProducts.test.ts`
  - `responseValidator.test.ts`
  - `handoffSummary.test.ts`
  - `process-follow-ups.test.ts`
- Playwright/E2E:
  - 21.33 tinta encontrada;
  - 21.36 porcelanato sem catalogo;
  - 21.37 torneira gourmet sem catalogo;
  - lead recorrente;
  - carrossel + cross-sell;
  - handoff + resumo + follow-up pausado.
- Rodar:
  - `npx tsc --noEmit`
  - `npm run build`
  - `npx vitest run <testes focados>`
  - `npx playwright test ...`
- Rollout:
  - sandbox;
  - shadow;
  - canary EletropisoV2;
  - producao.

Aceite:

- Fluxos 21.33, 21.36 e 21.37 com nota 10.
- Zero erro de console nos fluxos de UI.
- Zero vazamento de ferramenta/interno.
- Zero confirmacao/negacao indevida de estoque.

## Ordem Real De Execucao

1. Criar `productQualificationFlow.ts`.
2. Criar `productQualificationFlow.test.ts`.
3. Modelar `tintas`, `porcelanatos_revestimentos`, `torneiras_metais` e fallback.
4. Rodar testes do helper.
5. So depois integrar com `qualificationSpecialist`.
6. So depois tocar no loop de catalogo vazio em `ai-agent/index.ts`.

## Primeira Task Executavel

Task 1:

- Criar `supabase/functions/_shared/agent/productQualificationFlow.ts`.

Task 2:

- Criar `supabase/functions/_shared/agent/productQualificationFlow.test.ts`.

Task 3:

- Implementar apenas funcoes puras:
  - `resolveProductCategory`
  - `extractCollectedFields`
  - `getNextRequiredField`
  - `evaluateProductQualificationFlow`

Task 4:

- Testar primeiro 21.36 e 21.37, porque sao os fluxos mais sensiveis:
  - nao podem negar;
  - nao podem confirmar estoque;
  - nao podem transbordar cedo;
  - nao podem repetir pergunta.

Depois disso, seguir para 21.33.

## Decisao

O primeiro passo aprovado/recomendado para iniciar e:

> Implementar o helper puro `productQualificationFlow.ts` com testes unitarios dos cenarios 21.36 e 21.37, sem integrar ainda ao agente.

Essa e a fundacao do fluxo premium nota 10.

