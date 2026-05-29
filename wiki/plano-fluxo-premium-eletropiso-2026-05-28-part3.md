---
title: Plano Fluxo Premium Eletropiso (part3)
type: plano
description: Continuação do plano-fluxo-premium-eletropiso-2026-05-28 (part3) — partição automática 2026-05-28
updated: 2026-05-28
---

> Parte 1: [[wiki/plano-fluxo-premium-eletropiso-2026-05-28]] · Parte 2: [[wiki/plano-fluxo-premium-eletropiso-2026-05-28-part2]].

## Plano De Ataque

### Sprint 0 - Especificacao E Congelamento Do Contrato

Objetivo: deixar o escopo fechado antes de alterar runtime.

Tasks:

- Criar este documento.
- Definir nomes finais dos estados:
  - `lead_type`
  - `qualification_score`
  - `search_enabled`
  - `many_results_detected`
  - `show_carousel`
  - `selected_product`
  - `upsell_mode`
  - `delivery_mode`
  - `physical_stock_required`
  - `handoff_required`
- Definir se esses estados vivem somente em tags/conversation runtime ou tambem em JSONB dedicado.

Aceite:

- Documento aprovado.
- Nenhum codigo de runtime alterado.

### Sprint 1 - Contrato Runtime E Config Admin

Objetivo: criar base configuravel e multi-tenant sem hardcode Eletropiso.

Tasks:

- Criar helper puro `productFlowState.ts` em `_shared/agent`.
- Mapear tags existentes para estado normalizado.
- Criar config JSONB sugerida, por exemplo `product_flow_config`, com:
  - `min_scores_by_category`
  - `max_no_result_questions`
  - `mandatory_cross_sell`
  - `complements_by_category`
  - `delivery_capture_enabled`
  - `physical_stock_handoff_enabled`
- Avaliar migration para colunas de modelo:
  - `router_model`
  - `specialist_model`
  - `premium_model`
  - `reasoning_effort`
- Atualizar UI/schema para permitir modelos `gpt-5*`.

Arquivos provaveis:

- `supabase/functions/_shared/agent/productFlowState.ts`
- `supabase/migrations/*`
- `src/integrations/supabase/types.ts` somente via `npx supabase gen types`
- `src/components/admin/ai-agent/BrainConfig.tsx`
- `src/components/admin/ai-agent/validationSchemas.ts`

Aceite:

- Estado calculado por helper puro com testes.
- Admin nao bloqueia salvar modelos novos.
- Nenhum fluxo antigo muda sem feature flag/config.

### Sprint 2 - Qualificacao Premium Por Categoria

Objetivo: fazer a IA qualificar antes de buscar com campos Eletropiso.

Tasks:

- Expandir categorias:
  - tintas
  - pisos/porcelanatos
  - ferramentas
  - iluminacao
  - banheiro
  - complementares
- Para tintas, modelar campos:
  - objetivo: obra nova/reforma
  - ambiente: interno/externo
  - aplicacao: parede/teto/porta/moveis
  - tipo: acrilica/esmalte/epoxi/outro
  - cor
  - perfil: economica/intermediaria/premium
- Ajustar `qualificationGate` para traduzir score 0-100 em contador de interesse quando necessario.
- Garantir que pergunta generica nao dispara busca cedo.

Arquivos provaveis:

- `supabase/functions/_shared/serviceCategories.ts`
- `supabase/functions/_shared/agent/qualificationGate.ts`
- `supabase/functions/_shared/fieldAutoExtractor.ts`
- `src/components/admin/ai-agent/ServiceCategoriesConfig.tsx`

Aceite:

- "voces tem tinta?" pergunta qualificacao, nao busca.
- Busca so libera com score/campos minimos.
- Testes unitarios cobrem tinta generica, tinta especifica e categoria offline.

### Sprint 3 - Busca, Muitos Resultados E Carrossel

Objetivo: controlar quando e como produto aparece.

Tasks:

- Endurecer regra `1..5 => carrossel`.
- `> threshold => pergunta faceta`, sem revelar contagem.
- Garantir lote 2 se lead rejeitar o primeiro lote.
- Padronizar pergunta obrigatoria apos carrossel:
  - "Alguma dessas opcoes atende o que voce procura?"
- Evitar repeticao de nome/preco/produto depois do card.

Arquivos provaveis:

- `supabase/functions/_shared/agent/tools/searchProducts.ts`
- `supabase/functions/_shared/agent/productSpecialist.ts`
- `supabase/functions/_shared/agent/productChoiceDetector.ts`

Aceite:

- Carrossel so sai quando busca esta liberada.
- Muitos resultados pedem refinamento.
- Rejeicao de lote nao repete produtos.
- Teste garante pergunta pos-carrossel.

### Sprint 4 - Produto Selecionado, Carrinho E Cross-Sell Obrigatorio

Objetivo: transformar escolha em pedido e aumentar ticket medio.

Tasks:

- Ao detectar produto escolhido:
  - marcar `selected_product`
  - marcar `high_intent`
  - chamar `set_cart`
  - ativar `upsell_mode`
- Criar mapa de complementares por categoria.
- Para tintas, sugerir:
  - rolo
  - bandeja
  - pincel
  - fita crepe
  - extensor
- Tornar cross-sell obrigatorio uma vez por pedido, com opt-out natural.
- Se lead aceita complementares, atualizar carrinho completo.

Arquivos provaveis:

- `supabase/functions/_shared/agent/productChoiceDetector.ts`
- `supabase/functions/_shared/agent/cart.ts`
- `supabase/functions/_shared/agent/tools/cartTools.ts`
- `supabase/functions/_shared/agent/productSpecialist.ts`

Aceite:

- Produto escolhido nao vai direto para handoff sem cross-sell, salvo pedido explicito de vendedor.
- Complementares aceitos entram no `cart_items`.
- Handoff final inclui carrinho completo.

### Sprint 5 - Entrega/Retirada E Resumo Padrao Ao Vendedor

Objetivo: coletar dados comerciais antes do handoff.

Tasks:

- Inserir etapa estrutural:
  - "Voce prefere retirar na loja ou receber em casa?"
  - se entrega: "Qual bairro?"
- Salvar tags/campos:
  - `delivery_type:entrega|retirada`
  - `bairro:...`
- Criar builder de resumo interno:
  - cliente
  - objetivo
  - categoria
  - aplicacao
  - tipo
  - cor
  - perfil
  - produto escolhido
  - complementares
  - entrega
  - bairro
  - mensagens de interesse
  - score
  - origem
  - prioridade
  - necessidade
- Reusar o builder em handoff normal, handoff deferred e handoff por abandono.

Arquivos provaveis:

- `supabase/functions/_shared/agent/handoffSummary.ts`
- `supabase/functions/_shared/agent/tools/setTagsAndHandoff.ts`
- `supabase/functions/_shared/agent/dispatchResponse.ts`
- `supabase/functions/_shared/agent/abandonHandoff.ts`

Aceite:

- Vendedor recebe resumo padronizado.
- Mensagem ao lead continua curta e humana.
- IA entra em `shadow`.

### Sprint 6 - Produto Nao Encontrado / Estoque Fisico

Objetivo: blindar o fluxo mais importante para catalogo parcial.

Tasks:

- Centralizar contador de perguntas de enriquecimento no estado de fluxo.
- Separar duas contagens:
  - qualificacao normal antes da busca;
  - enriquecimento apos `catalog_result = empty`.
- Limitar enriquecimento apos catalogo vazio a 1 ou 2 perguntas no maximo, configuravel.
- Se contexto suficiente ou limite atingido:
  - marcar `catalog_result = empty`
  - marcar `physical_stock_required`
  - marcar `handoff_required`
  - fazer handoff obrigatorio
  - gerar resumo com `resultado_catalogo: nenhum item encontrado`
  - `necessita: validacao manual de estoque fisico`
- Registrar `followups_paused` explicitamente ou documentar o contrato oficial de pausa por `status_ia = shadow`.
- Garantir que `NO_DENIAL_RULE` seja enforcement, nao so prompt.
- Adicionar teste para bloqueio de frases proibidas.
- Adicionar E2E do cenario "porcelanato marmorizado 120x120 brilhante bege 80m2".

Arquivos provaveis:

- `supabase/functions/_shared/agent/tools/searchProducts.ts`
- `supabase/functions/_shared/responseValidator.ts`
- `supabase/functions/_shared/agent/specialistBase.ts`
- `supabase/functions/_shared/agent/handoffSummary.ts`

Aceite:

- Zero resultado nunca gera negacao.
- Depois de 1 ou 2 perguntas adicionais, vendedor recebe resumo.
- Lead nao fica pendurado se abandonar.
- Vendedor/fila e notificado.
- Helpdesk mostra que a demanda exige validacao de estoque fisico.

### Sprint 7 - Politica De Modelos Premium

Objetivo: melhorar qualidade sem explodir custo.

Tasks:

- Corrigir `validationSchemas.ts` para aceitar os modelos mostrados na UI.
- Adicionar controles para `router_model`, `specialist_model`, `premium_model`.
- Criar politica:
  - router barato/confiavel para JSON;
  - specialists com modelo premium de custo controlado;
  - modelo frontier somente para canary/casos complexos.
- Logar modelo por specialist em `ai_agent_runs`.
- Definir criterio de fallback quando frontier falhar.

Arquivos provaveis:

- `supabase/functions/_shared/llmProvider.ts`
- `supabase/functions/_shared/agent/router.ts`
- `supabase/functions/ai-agent/index.ts`
- `src/components/admin/ai-agent/BrainConfig.tsx`
- `src/components/admin/ai-agent/validationSchemas.ts`
- `supabase/migrations/*`

Aceite:

- Admin salva modelos novos.
- Router continua com parse estavel.
- Product specialist pode usar modelo premium por config.
- Custos aparecem no dashboard de roteamento/model usage.


---
> Continua em [[wiki/plano-fluxo-premium-eletropiso-2026-05-28-part4]] (Sprint 8 + Dados de Commit + Riscos + Definição de Pronto).
