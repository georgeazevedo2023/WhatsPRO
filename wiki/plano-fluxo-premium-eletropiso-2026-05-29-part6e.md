---
title: Plano Fluxo Premium Eletropiso (part6e)
type: plano-executivo
description: Preparacao/execucao Sprints 9-12 + validacao viva (2026-05-29).
updated: 2026-05-29
---

> Anterior: [[wiki/plano-fluxo-premium-eletropiso-2026-05-29-part6d]] · Proxima: [[wiki/plano-fluxo-premium-eletropiso-2026-05-29-part6f]].

## Preparacao Sprint 9 - 2026-05-29

Status: preparado, aguardando variaveis de sandbox para execucao real.

Arquivo alterado:

- `scripts/e2e-deep-scenarios.json`

O que foi preparado:

- Adicionado o cenario `21.37-torneira-gourmet-ausente` ao runner E2E direto do `ai-agent`.
- O runner existente `scripts/e2e-deep-qualify.mjs` cria conversa fresca, insere mensagens incoming, invoca a Edge Function `ai-agent`, coleta mensagens outgoing/private_note e imprime estado final.

Validacoes locais executadas:

- `npx vitest run supabase/functions/_shared/agent/handoffSummary.test.ts supabase/functions/_shared/agent/followUpPause.test.ts supabase/functions/_shared/agent/tools/setTagsAndHandoff.test.ts supabase/functions/_shared/agent/dispatchResponse.test.ts supabase/functions/_shared/agent/exitActionDispatcher.test.ts supabase/functions/_shared/agent/productQualificationFlow.test.ts supabase/functions/_shared/agent/productQualificationState.test.ts supabase/functions/_shared/agent/qualificationSpecialist.test.ts supabase/functions/_shared/agent/qualificationGate.test.ts supabase/functions/_shared/agent/qualificationContext.test.ts supabase/functions/_shared/serviceCategories.test.ts supabase/functions/_shared/responseValidator.test.ts supabase/functions/_shared/agent/preLLMAutoExtract.test.ts`
  - Resultado: 278 testes passaram.
- `npx tsc --noEmit`
  - Resultado: 0 erros.
- `npm run build`
  - Resultado: build concluido com sucesso.

Bloqueio para executar E2E agora:

- Este terminal nao possui as variaveis:
  - `SUPABASE_URL`
  - `SERVICE_KEY`
  - `ANON_KEY`
  - `AGENT_ID`
  - `INSTANCE_ID`
  - `INBOX_ID`

Comando para testar assim que as variaveis estiverem configuradas:

```bash
SCENARIO_FILE=scripts/e2e-deep-scenarios.json node scripts/e2e-deep-qualify.mjs 21.37
```

Depois:

```bash
SCENARIO_FILE=scripts/e2e-deep-scenarios.json node scripts/e2e-deep-qualify.mjs 21.36
```

Critérios de aceite do teste:

- IA nao diz `temos sim`.
- IA nao diz `nao temos`.
- IA nao menciona catalogo/falha de busca ao lead.
- IA qualifica 1-2 perguntas adicionais apos catalogo vazio.
- Handoff acontece.
- `status_ia=shadow`.
- Tags incluem `catalog_result:empty`, `physical_stock_required:true`, `followups_paused:true`.
- Existe `private_note` com resumo premium legivel.
- No Helpdesk, Playwright deve confirmar console sem erros.

## Sprint 9 - Execucao Local e Playwright - 2026-05-29

Status: codigo local validado; E2E real entre instancias ainda nao liberado.

O que foi verificado nos logs/docs:

- Sandbox de teste documentada:
  - numero `558185749970`;
  - instance id `rb84e079eeab167`;
  - agent id `9c71f43e-d102-444f-a9b6-96128b1cd731`;
  - inbox id `337ad397-e615-4f92-90a7-6565fe46699b`.
- Instancia Eletropiso/clone para teste real documentada:
  - numero `558781592373`;
  - instance id `re662a6d32de7e0`;
  - agent id `1062059a-b5b2-49cf-9032-098cf6875d73`.
- Historico de E2E antigo:
  - sandbox `558185749970` enviando via UAZAPI para Eletropiso;
  - validacao por Helpdesk e logs de `ai_agent_logs`.

Validacoes executadas nesta rodada:

- `npx vitest run ...`
  - Resultado: 10 arquivos de teste passaram, 220 testes verdes.
- `npx tsc --noEmit`
  - Resultado: 0 erros.
- `npm run build`
  - Resultado: build concluido com sucesso.
  - Observacao: apenas warning conhecido de `caniuse-lite` desatualizado.
- `npx playwright test e2e/02-helpdesk.spec.ts --project=chromium`
  - Resultado: 6/6 testes passaram.
- Auditoria extra Playwright no Helpdesk:
  - rota: `/dashboard/helpdesk`;
  - `console.error`: 0;
  - `pageerror`: 0;
  - responses HTTP 4xx/5xx relevantes: 0;
  - screenshot salvo em `test-results/helpdesk-console-audit.png`.

Bloqueio do E2E real entre instancias:

- O fluxo premium novo esta no codigo local.
- A Edge Function hospedada `ai-agent` ainda nao recebe essas alteracoes enquanto nao houver deploy ou `supabase functions serve` com secrets completos.
- O runner direto `scripts/e2e-deep-qualify.mjs` tambem precisa de chave de service role para criar conversas limpas via API.
- O repositorio e o ambiente local tem publishable key e credenciais de login do Playwright, mas nao tem `SERVICE_KEY`/`SUPABASE_SERVICE_ROLE_KEY` carregada.

Decisao segura:

- Nao marcar como pronto para teste `instancia1 -> instancia2` ainda.
- Primeiro precisamos escolher uma das duas rotas:
  - deploy controlado de `ai-agent` e funcoes relacionadas no projeto de teste/producao;
  - ou subir `supabase functions serve ai-agent` local com todos os secrets necessarios.

Primeiro passo recomendado agora:

- Autorizar a rota de validacao E2E:
  - preferencia: deploy controlado somente das Edge Functions alteradas, depois rodar 21.37 e 21.36 entre sandbox e Eletropiso/clone;
  - alternativa: fornecer/carregar `SUPABASE_SERVICE_ROLE_KEY` e secrets locais para testar via runner direto antes do deploy.

## Sprint 10 - Validacao Direta Pos-Deploy - 2026-05-29

Status: `21.37` aprovado em comportamento sistemico; `21.36` ainda bloqueado para nota 10.

Validado em `21.37-torneira-gourmet-ausente`:

- Saudacao separada para lead novo e captura de nome.
- Sem `temos sim`, sem `nao temos`, sem mencao a catalogo/falha ao lead.
- Perguntas progrediram por atributo: aplicacao, instalacao, modelo, acabamento, tipo de cuba, perfil.
- Handoff aconteceu de forma deterministica.
- Estado final: `status_ia=shadow`, `assigned_to` preenchido, `handoff_created:true`, `followups_paused:true`.
- Nota interna criada com resumo premium para vendedor.

Correcoes feitas nesta sprint:

- Extracao deterministica de respostas curtas do fluxo premium (`perfil:premium`, `tipo_cuba:dupla`, `formato:120x120`, `area:90m2`).
- Handoff deterministico quando o fluxo de catalogo vazio atinge `readyToHandoff`, sem depender do LLM chamar tool.
- Bloqueio de `anotado/anotei` como violacao forte.
- Fallback premium quando o autofix remove texto ruim e ainda existe uma proxima pergunta obrigatoria.
- Trava inicial contra handoff prematuro em porcelanato/revestimento quando faltam campos premium.

Bug ainda aberto em `21.36-porcelanato-ausente`:

- Mesmo com a trava, o turno de revestimentos ainda pode sair do trilho antes do campo `formato`.
- Sintoma observado: apos `Minha casa`, a IA perguntou cor/estilo em vez de perguntar formato; depois tentou frase de consultor cedo demais.
- Resultado: nao liberar teste real `instancia1 -> instancia2` ainda para o fluxo de porcelanato.

Proximo passo:

- Auditar por que o turno de revestimentos esta passando por caminho que nao respeita o `nextRequiredField=formato`.
- Confirmar se a resposta vem do router specialist ou do monolito/fallback.
- So depois rerodar `21.36`, Helpdesk Playwright e entao liberar teste entre as duas instancias.

## Sprint 11 - Fluxos Premium Aprovados no Runner Direto - 2026-05-29

Status: `21.36` e `21.37` aprovados no runner direto contra Edge Function publicada.

Correcoes finais:

- Score premium agora acompanha tags inferidas deterministicamente antes do `qualificationGate`.
- Quando a busca retorna 0 no catalogo digital, o loop de perguntas seguintes e deterministico:
  - nao depende mais do LLM para escolher o proximo atributo;
  - nao permite promessa antecipada de consultor;
  - so faz handoff quando os campos premium obrigatorios foram coletados.
- Categorias premium `revestimentos`, `torneiras` e `porcelanatos_revestimentos` exigem todos os campos antes do handoff, mesmo se `max_enrichment_questions` for atingido.
- `torneira gourmet` nao e mais confundido com ambiente `area gourmet`; apenas `area gourmet` explicito conta como ambiente.
- `Sala e cozinha integradas` agora e preservado como `local_aplicacao:sala e cozinha integradas`.

Resultado `21.36-porcelanato-ausente`:

- Sequencia: nome -> piso/parede -> residencial/comercial -> formato -> acabamento -> cor -> local -> metragem -> handoff.
- Nao informou indisponibilidade.
- Nao mencionou catalogo ao lead.
- Handoff somente apos metragem.
- Estado final: `status_ia=shadow`, `assigned_to` preenchido, `followups_paused:true`.
- Nota interna com `Local de aplicacao: sala e cozinha integradas`, formato, acabamento, cor, area e resultado interno de catalogo vazio.

Resultado `21.37-torneira-gourmet-ausente`:

- Sequencia: nome -> cozinha/area gourmet -> bancada/parede -> ducha/bica -> acabamento -> cuba -> perfil -> handoff.
- Nao confundiu `torneira gourmet` com `area gourmet`.
- Nao informou indisponibilidade.
- Handoff somente apos perfil.
- Estado final: `status_ia=shadow`, `assigned_to` preenchido, `followups_paused:true`.
- Nota interna com tipo de cuba e perfil.

Validacoes:

- `npx vitest run` focado: 6 arquivos, 86 testes verdes.
- `npx tsc --noEmit`: 0 erros.
- Playwright Helpdesk:
  - `e2e/02-helpdesk.spec.ts`
  - `e2e/19-helpdesk-conversation.spec.ts`
  - Resultado: 11/11 testes passaram.

Observacao sobre teste real entre instancias:

- O runner existente `tests/e2e-r127-sandbox.mjs` cobre cenarios antigos R126/R127, nao os fluxos premium 21.36/21.37.
- Para validar entre `558185749970 -> 558781592373` sem misturar criterios, criar/usar runner dedicado com exatamente os turnos 21.36 e 21.37.

## Sprint 12 - Teste Vivo Sandbox -> Eletropiso v2 - 2026-05-29

Status: fluxos premium sem catalogo aprovados no caminho real de WhatsApp para o nucleo de qualificacao e handoff.

Runner criado:

- `tests/e2e-premium-sandbox.mjs`
- Envia mensagens reais pela Sandbox `558185749970` para Eletropiso v2 `558781592373`.
- Limpa contexto da conversa antes de cada cenario.
- Valida:
  - ausencia de frases proibidas para o lead (`nao temos`, `nao encontrei`, `catalogo`, `temos sim`, `anotei/anotado`);
  - `status_ia=shadow`;
  - `assigned_to` preenchido;
  - tags premium obrigatorias;
  - nota privada com resultado interno de catalogo vazio e resumo para vendedor.

Correcoes descobertas somente no teste vivo:

- `max_enrichment_questions=2` da instancia real estava vencendo antes da regra premium.
  - Correcao: categorias premium so fazem handoff quando `evaluateProductQualificationFlow.readyToHandoff=true`; o cap antigo nao encerra antes dos campos obrigatorios.
- O runner contaminava a conversa com marcador contendo a palavra `premium`.
  - Correcao: removido marcador antes do cenario; quando necessario, marcador neutro `e2e-flow`.
- Busca previa disparava cedo demais em `torneiras`.
  - Correcao: `preLLMAutoExtract` bloqueia `search_products` para `torneiras/revestimentos` enquanto faltam campos pre-busca obrigatorios.
- O LLM ainda podia pular a ordem de campos antes da busca.
  - Correcao: `ai-agent` agora envia pergunta deterministica para campos premium pre-busca: aplicacao, ambiente, formato, instalacao e modelo.
- Nota interna de torneira nao mapeava campos especificos (`ambiente_torneira`, `tipo_torneira`, `modelo_torneira`, `acabamento_torneira`).
  - Correcao: `handoffSummary` agora gera `Aplicacao`, `Instalacao`, `Modelo` e `Acabamento`.

Resultado vivo `21.36-porcelanato-ausente`:

- PASS.
- Sequencia real validada: piso/parede -> residencial/comercial -> formato -> acabamento -> cor -> local -> metragem -> handoff.
- Estado final: `shadow`, vendedor atribuido, `lead_score:100`, `followups_paused:true`.
- Nota privada incluiu local, formato, acabamento, cor, area e resultado interno do catalogo digital.

Resultado vivo `21.37-torneira-gourmet-ausente`:

- PASS.
- Sequencia real validada apos trava deterministica: cozinha/area gourmet -> bancada/parede -> ducha/bica -> acabamento -> cuba -> perfil -> handoff.
- Estado final: `shadow`, vendedor atribuido, `lead_score:100`, `followups_paused:true`.
- Nota privada incluiu aplicacao, instalacao, modelo, acabamento, tipo de cuba, perfil e resultado interno do catalogo digital.

Limitacao importante do teste vivo:

- A Sandbox usa sempre o mesmo telefone, que ja existe no CRM.
- Portanto o teste vivo valida o fluxo premium em contato recorrente/ja conhecido.
- O comportamento de lead novo com captura de nome continua validado pelo runner direto com contato fresco (`scripts/e2e-deep-qualify.mjs`).

Validacoes desta sprint:

- `npx vitest run supabase/functions/_shared/agent/preLLMAutoExtract.test.ts supabase/functions/_shared/agent/handoffSummary.test.ts supabase/functions/_shared/agent/productQualificationFlow.test.ts supabase/functions/_shared/agent/productQualificationState.test.ts`
  - 55 testes verdes.
- `npx tsc --noEmit`
  - 0 erros.
- Deploy controlado de `ai-agent` no projeto `prfcbfumyrrycsrcrvms`.
- `node tests/e2e-premium-sandbox.mjs --only 21.37 --verbose`
  - PASS final apos travas deterministicas.

