---
title: Plano Fluxo Premium Eletropiso (part2)
type: plano
description: Continuação de plano-fluxo-premium-eletropiso-2026-05-28 — partição automática 2026-05-28 para respeitar hard limit 300 lin
updated: 2026-05-28
audited_at: 2026-05-28
---

> Parte 1: [[wiki/plano-fluxo-premium-eletropiso-2026-05-28]].

## Auditoria Complementar - Contrato De Estado, UI E Guardrails

### Contrato De Estado Do Agente

Estado existente:

- `conversations.status_ia` controla `ligada`, `shadow` e `desligada`.
- `conversations.lead_msg_count` conta mensagens recebidas do lead na sessao atual e e resetado no handoff.
- `conversations.tags` guarda estado operacional em formato `key:value`, incluindo `lead_score:N`, `search_fail:N`, `enrich_count:N`, `seller_handoff_pending:*`, `interesse:*`, `produto:*`.
- `conversations.shown_product_ids` evita repetir produtos ja enviados em carrossel.
- `conversations.cart_items` guarda pedido/carrinho estruturado.
- `lead_profiles.total_interactions`, `interests`, `products_seen`, `qualification_stage`, `conversation_summaries` e `memory_updated_at` alimentam memoria e retomada.
- `lead_score_history` registra eventos de score com metadata de categoria/stage/field.
- `ai_agents.service_categories` e o motor de stages definem campos, score, pergunta e `exit_action`.

Lacunas:

- Nao existe um `conversation_ai_state` ou JSONB unico com o contrato do fluxo premium.
- `lead_type` e calculado como `novo | recorrente | ativo` em `greetingPolicy.ts`, mas nao e persistido como `new | recurring`.
- `capture_name`, `use_memory` e `context_recovery` nao existem como flags persistidas; sao comportamento derivado de nome, memoria e recencia.
- `product_interest_counter` nao existe como campo unico; hoje e inferido de tags, score, stages, `search_fail`, `enrich_count` e historico.
- `catalog_result`, `physical_stock_required`, `handoff_required` e `followups_paused` nao existem como estado explicito.
- `followups_paused` e o maior risco: o cron `process-follow-ups` seleciona conversas em `status_ia = shadow`, entao `shadow` por si so NAO significa follow-up pausado.

Recomendacao:

- Criar um contrato runtime minimo em JSONB, preferencialmente `conversations.ai_state` ou `conversation_ai_state`:
  - `lead_type`
  - `capture_name`
  - `use_memory`
  - `context_recovery`
  - `product_interest_counter`
  - `qualification_score`
  - `qualification_category`
  - `catalog_result`
  - `physical_stock_required`
  - `handoff_required`
  - `followups_paused`
  - `last_product_search`
- Manter tags como compatibilidade/visibilidade, mas nao como unica fonte da verdade para fluxo premium.

### Paridade Admin

Estado existente:

- `AIAgentTab` tem aba `Qualificacao`.
- `ServiceCategoriesConfig` permite categorias, stages, fields, score e `exit_action`.
- `RulesConfig` mostra:
  - perguntas antes de buscar;
  - tentativas quando produto nao encontrado;
  - perguntas de enriquecimento apos busca vazia;
  - limiar de muitos resultados.
- `FollowUpConfig` configura follow-up automatico.
- `BrainConfig` mostra modelos `gpt-5-mini` e `gpt-5-nano`.

Lacunas:

- `validationSchemas.ts` ainda bloqueia `gpt-5-mini` e `gpt-5-nano`, embora a UI mostre esses modelos.
- `validationSchemas.ts` nao valida `max_pre_search_questions`, embora `RulesConfig` exponha o campo.
- Nao ha controle admin claro para janela de recuperacao de contexto de lead recorrente.
- Nao ha configuracao dedicada para "apos catalogo vazio, perguntar no maximo 1 ou 2 vezes e transbordar".
- Nao ha UI de templates de resumo por fluxo: produto encontrado, produto nao encontrado, venda cruzada, entrega/retirada.
- Nao ha switch explicito de "pausar follow-ups apos handoff de estoque fisico".

Recomendacao:

- Ajustar schema do admin antes de runtime premium.
- Criar bloco "Fluxo de produto nao encontrado" em Regras ou Qualificacao:
  - limite de perguntas pos-zero resultado;
  - mensagem de handoff;
  - template do resumo ao vendedor;
  - pausar follow-ups apos handoff;
  - marcar necessidade de estoque fisico.

### Paridade Helpdesk

Estado existente:

- `ContactInfoPanel` mostra "Contexto IA".
- Mostra cadeia de qualificacao do handoff quando existe `qualification_chain`.
- Mostra perfil do lead, tags e KPIs.
- Ja existe KPI "Atendido por IA" e indicador de `Shadow`.
- Ha um KPI "Em falta" baseado em `marca_indisponivel:*`.

Lacunas:

- O fluxo de catalogo vazio usa `search_fail`, `enrich_count` e `seller_handoff_pending`, mas a UI filtra esses sinais e nao mostra o estado ao vendedor.
- O painel nao mostra `catalog_result=empty`, `physical_stock_required`, `handoff_required` ou quantidade de perguntas feitas.
- O KPI "Em falta" pode induzir leitura errada para estoque fisico. Para Eletropiso, o correto e "Validar estoque" ou "Estoque fisico".
- O vendedor nao ve de forma estruturada: formato, acabamento, cor, area, origem, prioridade e necessidade de validacao.

Recomendacao:

- Trocar o conceito visual de "Em falta" para "Validar estoque".
- Exibir um bloco de "Pedido para validacao" quando `physical_stock_required=true`.
- Mostrar score/counter e campos coletados para o vendedor nao repetir perguntas.

### Response Validator E Vazamentos

Estado existente:

- `_shared/responseValidator.ts` bloqueia:
  - frases negativas: `nao temos`, `nao encontrei`, `sem estoque`, `indisponivel`, `nao trabalhamos`;
  - erro interno: `desculpe`, `houve um erro`, `falha ao`, etc.;
  - vazamento `[INTERNO]` / `[INTERNAL]`;
  - preco alucinado quando ha precos de catalogo;
  - re-cumprimento e excesso de nome como rewrite/telemetria.
- Existem testes unitarios cobrindo essas regras.
- `specialistBase.ts` aplica enforcement no router para `anti_negative_phrases`, `anti_internal_error` e `anti_internal_leak`.
- `dispatchResponse.ts` tambem remove vazamento de chamadas como `functions.handoff_to_human(...)`.

Lacunas:

- Lista de negativas ainda nao cobre todas as formas perigosas:
  - `acabou`;
  - `essas eram todas`;
  - `so temos essas`;
  - `catalogo nao retornou`;
  - `produto fora de linha`;
  - `nao achei aqui`.
- Quando o validador substitui texto nocivo por ponte segura, ele nao marca automaticamente `handoff_required`; isso pode preservar a mensagem segura, mas nao necessariamente fecha o fluxo.
- `anti_internal_error` bloqueia "desculpe/desculpa" de forma ampla. Isso evita desculpa por erro interno, mas pode tambem bloquear uma frase humana inofensiva. Para fluxo premium, melhor substituir por mensagem propositiva padrao.

Recomendacao:

- Expandir `NEGATIVE_PHRASES` com termos de "fim de catalogo".
- Adicionar regra deterministica: se a resposta violou negativa em contexto de produto, marcar `handoff_required` ou forcar `seller_handoff_pending`.
- Criar teste especifico: catalogo vazio nunca vaza "nao temos", "nao encontrei", "acabou", "essas eram todas".

Recomendacao:

- `router_model`: manter `gpt-4.1-mini` ate haver teste de JSON estrito com modelo novo.
- `specialist_model`: usar `gpt-5.4` ou a variante mini/custo-eficiente equivalente disponivel no projeto.
- `premium_model`: reservar `gpt-5.5` para canary/alto valor/casos complexos.
- `validator_model`: `gpt-4.1-nano` ou modelo nano equivalente validado.
- Evitar `gpt-5.5` em todo turno por custo/latencia.


---
> Continua em [[wiki/plano-fluxo-premium-eletropiso-2026-05-28-part3]] (Plano de Ataque + Dados de Commit + Riscos + Definição de Pronto).
