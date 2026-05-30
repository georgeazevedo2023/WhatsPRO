---
title: Plano Fluxo Premium Eletropiso (part6c)
type: plano-executivo
description: Execucao Sprints 1-4 (2026-05-29).
updated: 2026-05-29
---

> Anterior: [[wiki/plano-fluxo-premium-eletropiso-2026-05-29-part6b]] · Proxima: [[wiki/plano-fluxo-premium-eletropiso-2026-05-29-part6d]].

## Execucao Sprint 1 - 2026-05-29

Status: concluido.

Arquivos adicionados:

- `supabase/functions/_shared/agent/productQualificationFlow.ts`
- `supabase/functions/_shared/agent/productQualificationFlow.test.ts`

O que foi implementado:

- Helper puro sem IO, sem LLM, sem DB, sem WhatsApp e sem busca real de produtos.
- Resolucao deterministica de categoria por `interesse:` ou texto do lead.
- Extracao de campos ja coletados ignorando meta tags internas.
- Calculo de score por `lead_score:` ou pelos campos respondidos.
- Decisao estruturada para:
  - `nextRequiredField`
  - `readyToSearch`
  - `readyToHandoff`
  - `searchEnabled`
  - `showCarousel`
  - `physicalStockRequired`
  - `neutralStockLanguage`
- Regra de catalogo vazio/offline:
  - nunca libera busca;
  - nunca libera carrossel;
  - continua qualificando ate o limite configurado;
  - depois sinaliza handoff com contexto.

Cenarios cobertos em teste:

- 21.33 tinta com catalogo digital: qualifica antes de buscar e libera busca/carrossel so no score minimo.
- 21.36 porcelanato/revestimento com catalogo vazio: continua qualificando, nao busca, nao mostra carrossel, depois handoff.
- 21.37 torneira gourmet com catalogo vazio: pergunta acabamento depois da busca vazia e mantem validacao de estoque fisico interna.
- Categoria offline: nunca busca, mesmo com score alto.

Validacoes executadas:

- `npx vitest run supabase/functions/_shared/agent/productQualificationFlow.test.ts`
  - Resultado: 9 testes passaram.
- `npx vitest run supabase/functions/_shared/agent/productQualificationFlow.test.ts supabase/functions/_shared/agent/qualificationGate.test.ts supabase/functions/_shared/agent/qualificationContext.test.ts supabase/functions/_shared/agent/qualificationSpecialist.test.ts supabase/functions/_shared/serviceCategories.test.ts`
  - Resultado: 166 testes passaram.
- `npx tsc --noEmit`
  - Resultado: 0 erros.

Playwright:

- Nao aplicado neste sprint porque a entrega foi um helper puro sem interface e sem fluxo web executavel.
- Playwright entra nos sprints de integracao, Admin/Helpdesk e E2E dos cenarios 21.33/21.36/21.37.

Auditoria do resultado:

- Nao houve alteracao em `supabase/functions/ai-agent/index.ts`.
- Nao houve alteracao no runtime do atendimento.
- O codigo novo esta isolado e testado.
- O proximo risco real esta no Sprint 2: adaptar o estado/tags atuais para alimentar este helper sem quebrar compatibilidade.

Proximo passo:

- Sprint 2: criar a ponte de compatibilidade entre estado atual (`tags`, `lead_score`, `enrich_count`, `search_fail`) e o novo contrato premium (`catalog_result`, `questions_after_empty`, `flow_mode`, `physical_stock_required`).

## Execucao Sprint 2 - 2026-05-29

Status: concluido.

Arquivos adicionados:

- `supabase/functions/_shared/agent/productQualificationState.ts`
- `supabase/functions/_shared/agent/productQualificationState.test.ts`

O que foi implementado:

- Ponte pura de compatibilidade entre tags atuais e contrato premium.
- Leitura de tags legadas:
  - `search_fail:*` vira `catalogResult = empty`.
  - `enrich_count:N` vira `questionsAfterEmpty = N` quando ainda nao existe `questions_after_empty:N`.
- Leitura de tags premium explicitas:
  - `catalog_result`
  - `questions_after_empty`
  - `flow_mode`
  - `physical_stock_required`
  - `search_enabled`
  - `show_carousel`
  - `ready_to_handoff`
  - `handoff_created`
  - `agent_status`
  - `human_assigned`
  - `seller_notified`
  - `followups_paused`
- Geracao de tags premium a partir do verdict do helper do Sprint 1.
- Geracao padronizada das tags de handoff:
  - `handoff_created:true`
  - `agent_status:inactive`
  - `human_assigned:true`
  - `seller_notified:true`
  - `followups_paused:true`
- Merge seguro das tags de estado, preservando contexto do lead e substituindo apenas chaves de estado.

Validacoes executadas:

- `npx vitest run supabase/functions/_shared/agent/productQualificationState.test.ts`
  - Resultado: 7 testes passaram.
- `npx vitest run supabase/functions/_shared/agent/productQualificationFlow.test.ts supabase/functions/_shared/agent/productQualificationState.test.ts supabase/functions/_shared/agent/qualificationGate.test.ts supabase/functions/_shared/agent/qualificationContext.test.ts supabase/functions/_shared/agent/qualificationSpecialist.test.ts supabase/functions/_shared/serviceCategories.test.ts`
  - Resultado: 173 testes passaram.
- `npx tsc --noEmit`
  - Resultado: 0 erros.

Auditoria do resultado:

- O Sprint 2 ainda nao altera o runtime.
- A compatibilidade com estado atual foi mantida para reduzir risco de migracao.
- A regra `followups_paused:true` agora existe no contrato de estado, mas ainda precisa ser respeitada pelo worker de follow-up em sprint futuro.
- A regra de catalogo vazio agora tem um marcador explicito (`catalog_result:empty`) e tambem aceita o marcador legado (`search_fail:*`).

Playwright:

- Nao aplicado neste sprint porque ainda nao ha interface ou fluxo web alterado.
- Deve entrar quando o contrato aparecer no Admin/Helpdesk e nos E2E dos fluxos 21.33, 21.36 e 21.37.

Proximo passo:

- Sprint 3: integrar o helper ao `qualificationSpecialist`/contexto de prompt de forma controlada, ainda sem alterar o loop principal de envio de mensagem.

## Execucao Sprint 3 - 2026-05-29

Status: concluido.

Arquivos alterados:

- `supabase/functions/_shared/agent/qualificationSpecialist.ts`
- `supabase/functions/_shared/agent/qualificationSpecialist.test.ts`

O que foi implementado:

- Criado `buildPremiumQualificationContext`.
- O `qualification_specialist` agora pode receber um bloco interno com:
  - `category_id`
  - `flow_mode`
  - `qualification_score`
  - `next_required_field`
  - `search_enabled`
  - `show_carousel`
  - `physical_stock_required`
- O bloco premium reforca:
  - perguntar somente o proximo campo obrigatorio;
  - nao repetir pergunta ja respondida;
  - nunca confirmar estoque com "temos sim" ou equivalentes;
  - nunca dizer "nao temos", "nao encontrei", "sem catalogo" ou mencionar falha de busca;
  - tratar estoque fisico como informacao interna.
- O prompt base continua aceitando o `qualificationContext` antigo, preservando compatibilidade.
- O helper premium entra como reforco de maior prioridade, sem dar novas tools ao specialist.

Validacoes executadas:

- `npx vitest run supabase/functions/_shared/agent/qualificationSpecialist.test.ts`
  - Resultado: 8 testes passaram.
- `npx vitest run supabase/functions/_shared/agent/productQualificationFlow.test.ts supabase/functions/_shared/agent/productQualificationState.test.ts supabase/functions/_shared/agent/qualificationGate.test.ts supabase/functions/_shared/agent/qualificationContext.test.ts supabase/functions/_shared/agent/qualificationSpecialist.test.ts supabase/functions/_shared/serviceCategories.test.ts supabase/functions/_shared/responseValidator.test.ts`
  - Resultado: 195 testes passaram.
- `npx tsc --noEmit`
  - Resultado: 0 erros.

Auditoria do resultado:

- Ainda nao houve alteracao no loop principal do `ai-agent/index.ts`.
- O especialista de qualificacao continua sem ferramentas de busca e sem handoff, mantendo boundary seguro.
- O risco reduzido neste sprint foi o erro de "pre-router sabe que deve qualificar, mas nao diz qual atributo perguntar".
- O helper agora fornece `next_required_field` estruturado ao prompt.
- Ainda falta o runtime respeitar o verdict para decidir quando buscar, quando continuar qualificando apos catalogo vazio e quando fazer handoff.

Playwright:

- Nao aplicado neste sprint porque a mudanca e de prompt/contexto de Edge Function, sem UI ou browser flow.
- Playwright entra nos sprints de E2E/sandbox depois que o runtime estiver conectado.

Proximo passo:

- Sprint 4: conectar o contrato premium ao fluxo de catalogo vazio/offline no runtime, com mudanca pequena e guardada por testes. Esse e o primeiro sprint que encosta no comportamento real de atendimento.

## Execucao Sprint 4 - 2026-05-29

Status: concluido com patch minimo de runtime.

Arquivo alterado:

- `supabase/functions/ai-agent/index.ts`

O que foi implementado:

- O loop de catalogo vazio/offline agora le o estado premium por `readProductQualificationState`.
- O contador usado no loop passa a aceitar:
  - `questions_after_empty:N`
  - fallback legado `enrich_count:N`
- O limite de perguntas apos catalogo vazio/offline foi protegido para 1 a 2 perguntas extras.
- A diretiva interna do loop agora recebe `Proximo campo obrigatorio` calculado por `evaluateProductQualificationFlow`.
- Quando o loop continua qualificando, o sistema passa a gravar tags premium:
  - `questions_after_empty`
  - `catalog_result:empty`
  - `physical_stock_required:true`
  - `flow_mode:qualify_then_handoff`
- Quando categoria offline entra no loop, o sistema tambem grava as tags premium acima.
- Foi adicionado parse defensivo para `agent.max_enrichment_questions`, evitando `NaN`.

Impacto esperado:

- Reduz repeticao da mesma pergunta no fluxo sem resultado.
- Reduz handoff cedo demais sem acabamento/cor/perfil minimo.
- Evita que a IA dependa apenas de texto generico para saber o proximo atributo.
- Mantem informacao de catalogo vazio como estado interno, nao mensagem para o lead.

Validacoes executadas:

- `npx vitest run supabase/functions/_shared/agent/productQualificationFlow.test.ts supabase/functions/_shared/agent/productQualificationState.test.ts supabase/functions/_shared/agent/qualificationSpecialist.test.ts supabase/functions/_shared/agent/qualificationGate.test.ts supabase/functions/_shared/agent/qualificationContext.test.ts supabase/functions/_shared/serviceCategories.test.ts supabase/functions/_shared/responseValidator.test.ts`
  - Resultado: 195 testes passaram.
- `npx tsc --noEmit`
  - Resultado: 0 erros.

Auditoria do resultado:

- O patch foi pequeno e restrito ao trecho ja existente de no-result/offline.
- Nao alterou busca de produtos, carrossel, queue assignment ou dispatch de mensagens.
- Nao resolveu ainda todo o fluxo nota 10, porque ainda falta:
  - defaults premium de categorias;
  - validator bloquear confirmacao de estoque positiva;
  - resumo de handoff estruturado com os novos campos;
  - testes E2E/Playwright em ambiente rodando.
- A arvore ja continha mudancas pendentes em `ai-agent/index.ts` antes deste sprint; este patch trabalhou sobre o estado atual sem reverter nada.

Playwright:

- Ainda nao aplicado. Este sprint alterou Edge Function e contrato interno.
- Playwright deve entrar quando executarmos fluxo E2E real no app/sandbox ou quando a UI do Helpdesk/Admin refletir esses estados.

Proximo passo:

- Sprint 5: defaults premium de categorias (`tintas`, `porcelanatos_revestimentos`, `torneiras_metais` e fallback) e testes de score/campos para os cenarios 21.33, 21.36 e 21.37.

