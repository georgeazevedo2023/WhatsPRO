# Plano de Implementacao - Fluxo Premium Eletropiso

Data: 2026-05-28

Status: planejamento/auditoria. Este documento nao implementa mudancas de runtime; ele mapeia o que ja existe, lacunas e plano de ataque para os cenarios 21.33 e 21.34.

## Objetivo

Transformar o atendimento de produto da Eletropiso em um fluxo premium consultivo:

1. Identificar lead novo/recorrente antes do fluxo.
2. Qualificar interesse antes de buscar produtos.
3. Exibir carrossel somente quando houver contexto suficiente.
4. Tratar catalogo digital como parcial; nunca negar produto por zero resultado.
5. Fazer venda cruzada obrigatoria apos produto escolhido.
6. Coletar entrega/retirada e bairro quando aplicavel.
7. Fazer handoff com resumo estruturado e IA em shadow.

## Cenarios-Alvo

### 21.33 - Produto Encontrado No Catalogo

Lead novo pergunta por tinta. A IA:

- cumprimenta e captura nome;
- qualifica reforma/obra, ambiente, aplicacao, tipo, cor e perfil;
- busca quando score minimo for atingido;
- envia ate 5 produtos em carrossel;
- confirma produto escolhido;
- oferece complementares obrigatorios;
- monta carrinho;
- coleta entrega/retirada e bairro;
- pergunta se precisa de mais algo;
- transborda com resumo para vendedor.

### 21.34 - Produto Nao Encontrado / Estoque Fisico

Quando a busca retorna 0:

- a IA nunca diz "nao temos", "nao encontrei", "sem estoque" ou equivalente;
- trata `catalog_result = empty` como estado interno, nunca como mensagem ao lead;
- continua qualificando com no maximo 1 ou 2 perguntas uteis apos o catalogo digital voltar vazio;
- marca necessidade de validacao em estoque fisico;
- monta resumo estruturado;
- faz handoff obrigatorio;
- atribui vendedor/fila;
- entra em `status_ia = shadow`.

Fluxo alvo detalhado:

1. Lead pergunta: "Vocês têm porcelanato marmorizado?"
2. Lead novo: IA pede nome e salva lead.
3. IA qualifica: aplicacao piso/parede, ambiente residencial/comercial, formato, acabamento.
4. Busca retorna 0 produtos no catalogo digital.
5. Sistema marca internamente:
   - `catalog_result = empty`
   - `physical_stock_required = true`
   - `no_denial_to_lead = true`
6. IA faz no maximo 1 ou 2 perguntas adicionais:
   - cor desejada;
   - metragem aproximada.
7. IA transborda com mensagem humana:
   - "Vou encaminhar seu atendimento para um de nossos consultores verificar as opcoes disponiveis em nosso estoque e apresentar as melhores alternativas para o seu projeto. Um instante por favor."
8. Sistema:
   - `handoff_created = true`
   - `status_ia = shadow`
   - `human_assigned = true`
   - `seller_notified = true`
   - `followups_paused = true` ou equivalente explicito.
9. Resumo enviado ao vendedor:
   - cliente;
   - categoria;
   - tipo/estilo;
   - aplicacao;
   - ambiente;
   - formato;
   - acabamento;
   - cor desejada;
   - area;
   - resultado catalogo: nenhum produto localizado;
   - observacao: possivel item apenas no estoque fisico ou alternativa similar;
   - mensagens de interesse;
   - origem;
   - prioridade;
   - tags;
   - necessidade: validacao humana de estoque e orcamento.

## Auditoria Do Que Ja Existe

### Lead Novo / Recorrente

Arquivos:

- `supabase/functions/_shared/agent/greetingPolicy.ts`
- `supabase/functions/_shared/agent/leadMemory.ts`
- `supabase/functions/_shared/agent/nameCapture.ts`
- `supabase/functions/ai-agent/index.ts`

Estado atual:

- Existe classificacao `novo | recorrente | ativo` via `classifyLeadRecency`.
- Saudacao de recorrente usa `returning_greeting_message`.
- Memoria longa injeta nome, interesses, produtos vistos, objecoes, resumo da ultima conversa e ultima visita.
- Captura de nome ja tem caminhos deterministicos.

Lacunas:

- Nao existe contrato explicito `lead_type`, `capture_name`, `use_memory`, `context_recovery`.
- Janela de recuperacao de contexto ainda nao aparece como configuracao admin clara.
- Protecao "nao perguntar cidade/dados ja conhecidos" e mais forte para nome do que para outros campos.

### Qualificacao Antes Da Busca

Arquivos:

- `supabase/functions/_shared/agent/qualificationGate.ts`
- `supabase/functions/_shared/serviceCategories.ts`
- `supabase/functions/_shared/fieldAutoExtractor.ts`
- `supabase/functions/_shared/agent/qualificationContext.ts`
- `src/components/admin/ai-agent/ServiceCategoriesConfig.tsx`

Estado atual:

- `qualificationGate` ja e a fonte unica de "buscar vs qualificar".
- `service_categories` ja suporta stages, score progressivo e `exit_action`.
- Categorias `offline`/`none` ja seguem modo `qualify_then_handoff`.
- O admin ja tem editor de categorias/estagios.

Lacunas:

- O score atual usa escala 0-100; os cenarios de negocio falam em contador 1-5.
- Categorias default ainda nao cobrem todo o universo Eletropiso: pisos/porcelanatos, ferramentas, iluminacao, banheiro, complementares.
- Campos de tinta precisam refletir o fluxo premium: objetivo, ambiente, aplicacao, tipo, cor, perfil.
- Busca antecipada em perguntas genericas precisa continuar bloqueada com testes dedicados.

### Busca, Muitos Resultados E Carrossel

Arquivos:

- `supabase/functions/_shared/agent/productSpecialist.ts`
- `supabase/functions/_shared/agent/tools/searchProducts.ts`
- `supabase/functions/_shared/agent/productChoiceDetector.ts`
- `supabase/functions/_shared/carousel.ts`

Estado atual:

- `searchProducts` envia carrossel/foto automaticamente quando encontra produtos com imagem.
- Lote por carrossel ja e limitado a 5 cards.
- `refine_results_threshold` ja evita despejar muitos resultados; quando ha muita opcao, pergunta uma faceta.
- `shown_product_ids` evita repetir produtos ja exibidos.
- Apos carrossel, o prompt orienta perguntar se alguma opcao atende.

Lacunas:

- Pergunta pos-carrossel precisa virar contrato obrigatorio, nao so prompt.
- "Alguma dessas atende?" + "precisa de mais algum produto para obra/reforma?" ainda nao e uma sequencia garantida.
- Rejeicao do lote precisa ter teste E2E para `carousel_batch_02`.

### Produto Escolhido, Carrinho E Cross-Sell

Arquivos:

- `supabase/functions/_shared/agent/cart.ts`
- `supabase/functions/_shared/agent/tools/cartTools.ts`
- `supabase/functions/_shared/agent/productSpecialist.ts`
- `supabase/functions/_shared/agent/tools/setTagsAndHandoff.ts`
- `supabase/functions/_shared/agent/dispatchResponse.ts`

Estado atual:

- Existe `set_cart`.
- `conversations.cart_items` guarda pedido estruturado.
- Handoff ja anexa resumo do carrinho.
- O prompt tem regra de montar pedido completo.
- Cross-sell existe, mas como "opcional, 1x no fechamento".

Lacunas:

- Para Eletropiso, cross-sell deve ser obrigatorio apos `selected_product`.
- Precisa de mapa de complementares por categoria, editavel por tenant.
- A deteccao de produto escolhido precisa acionar `selected_product`, `high_intent` e `upsell_mode` de forma mais deterministica.

### Entrega / Retirada

Arquivos:

- `src/components/admin/ai-agent/ExtractionConfig.tsx`
- `supabase/functions/_shared/agent/promptSections.ts`
- `supabase/functions/_shared/agent/tools/crmTools.ts`
- `supabase/functions/ai-agent/index.ts`

Estado atual:

- Admin ja lista campos como bairro.
- `business_info.delivery_info` existe para orientar respostas.
- Shadow/extracao ja menciona enderecos, preferencias de entrega e prazos.

Lacunas:

- Nao ha contrato claro de `delivery_mode`, `delivery_type`, `bairro`.
- Antes do handoff, a IA ainda nao tem uma etapa estrutural obrigatoria "retirar ou receber?".

### Produto Nao Encontrado / Catalogo Parcial

Arquivos:

- `supabase/functions/_shared/agent/tools/searchProducts.ts`
- `supabase/functions/_shared/agent/productSpecialist.ts`
- `supabase/functions/_shared/agent/abandonHandoff.ts`
- `supabase/functions/ai-agent/index.ts`

Estado atual:

- Ja existe regra forte: zero resultado nao significa indisponibilidade.
- Ha `NO_DENIAL_RULE`.
- `max_enrichment_questions` tem padrao 2, alinhado com a regra de fazer so 1 ou 2 perguntas apos o catalogo vazio.
- `search_fail:N` e `enrich_count:N` contam falhas e perguntas de enriquecimento.
- Ha `seller_handoff_pending` para forcar handoff no proximo turno.
- O monolito detecta `seller_handoff_pending:*` e forca specialist de handoff no turno seguinte.
- Ha abandono de handoff para nao deixar lead pendurado.
- A IA entra em `status_ia = shadow` apos transbordo.
- `handoffQueue` atribui fila/vendedor e dispara `notify-vendor-assignment` em fire-and-forget.

Lacunas:

- Nao existe um contrato unico de runtime com `catalog_result`, `physical_stock_required`, `handoff_required` e `followups_paused`.
- O contador de qualificacao de produto ainda esta espalhado entre `lead_score`, `search_fail`, `enrich_count`, tags e stages; falta um `product_interest_counter`/estado de fluxo unificado.
- O resumo "validar estoque fisico" precisa virar template padrao.
- `followups_paused` nao e um campo explicito; hoje o efeito depende principalmente de `status_ia = shadow`.
- Notificacao do vendedor existe, mas precisa ser validada em E2E no cenario 21.34.
- A UI admin/helpdesk ainda nao mostra claramente `catalog_result=empty`, enriquecimento pendente e "validar estoque fisico".

Nota da auditoria 21.34 hoje:

- Nucleo comportamental: 8/10.
- Experiencia premium rastreavel em UI/relatorio: 5/10.
- Motivo: a logica critica ja existe, mas o contrato de estado, o resumo padrao e a paridade visual ainda precisam ser fechados.

### Handoff, Fila E Resumo Ao Vendedor

Arquivos:

- `supabase/functions/_shared/handoffQueue.ts`
- `supabase/functions/_shared/handoffDepartment.ts`
- `supabase/functions/_shared/agent/tools/setTagsAndHandoff.ts`
- `supabase/functions/_shared/agent/dispatchResponse.ts`
- `supabase/functions/_shared/businessHours.ts`

Estado atual:

- `assignHandoff` atribui fila/vendedor.
- `personalizeHandoffMessage` humaniza mensagem ao lead.
- `status_ia = shadow` e usado para parar respostas da IA e manter extracao silenciosa.
- Nota interna com resumo ja existe em paths de handoff.

Lacunas:

- Resumo do vendedor ainda e variavel; precisa template unico por fluxo.
- Campos de entrega, bairro, score, prioridade e estoque fisico precisam entrar no resumo.

### Modelos LLM

Arquivos:

- `supabase/functions/_shared/llmProvider.ts`
- `supabase/functions/_shared/agent/router.ts`
- `supabase/functions/ai-agent/index.ts`
- `src/components/admin/ai-agent/BrainConfig.tsx`
- `src/components/admin/ai-agent/validationSchemas.ts`

Estado atual:

- OpenAI e primario; Gemini e fallback.
- `llmProvider` ja trata modelos reasoning `gpt-5*` com `max_completion_tokens`.
- UI mostra `gpt-5-mini` e `gpt-5-nano`.
- Schema `validationSchemas.ts` ainda nao permite `gpt-5-mini`/`gpt-5-nano`, criando risco de bloqueio no admin.
- Router usa `gpt-4.1-mini` por historico de parse JSON ruim com `gpt-5-nano`.
- Product specialist usa `agent.specialist_model || 'gpt-4.1'`, mas `specialist_model` nao esta completo na UI/migrations.
- Verificacao externa feita em 2026-05-28 na pagina oficial de modelos da OpenAI:
  - `https://developers.openai.com/api/docs/models`
  - `https://developers.openai.com/api/docs/models/gpt-5.5`
  - a pagina oficial contem `gpt-5.5`, `gpt-5.4` e descricao de modelo frontier;
  - a disponibilidade exata por conta/projeto ainda deve ser validada antes de ativar em producao.


---

> Continua em [[wiki/plano-fluxo-premium-eletropiso-2026-05-28-part2]] (Auditoria Complementar + Plano de Ataque + Dados de Commit + Riscos + Definição de Pronto).
