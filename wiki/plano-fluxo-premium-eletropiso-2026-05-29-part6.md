---
title: Plano Fluxo Premium Eletropiso (part6)
type: plano-executivo
description: Plano executivo com sprints, tasks e primeiro passo para implementar os fluxos premium 21.33, 21.36 e 21.37.
updated: 2026-05-29
---

> Partes anteriores: [[wiki/plano-fluxo-premium-eletropiso-2026-05-28]] · [[wiki/plano-fluxo-premium-eletropiso-2026-05-28-part2]] · [[wiki/plano-fluxo-premium-eletropiso-2026-05-28-part3]] · [[wiki/plano-fluxo-premium-eletropiso-2026-05-28-part4]] · [[wiki/plano-fluxo-premium-eletropiso-2026-05-29-part5]].

# Plano Executivo - Fluxo Premium Nota 10

## Objetivo

Implementar o motor premium da Eletropiso para que os cenarios abaixo sejam deterministicos, testaveis e auditaveis:

- 21.33: produto encontrado no catalogo -> qualificacao -> carrossel -> cross-sell -> entrega/retirada -> handoff.
- 21.36: porcelanato nao encontrado no catalogo digital -> qualificacao inteligente -> handoff humanizado.
- 21.37: torneira gourmet nao encontrada no catalogo digital -> qualificacao inteligente -> handoff humanizado.

Regra central:

- O LLM pode humanizar a mensagem.
- O backend deve decidir estado, proximo campo, score, busca, handoff, pausa de follow-up e resumo.

## Primeiro Passo Para Comecar

Comecar pelo helper puro:

- `supabase/functions/_shared/agent/productQualificationFlow.ts`

E pelos testes:

- `supabase/functions/_shared/agent/productQualificationFlow.test.ts`

Esse primeiro passo nao deve alterar:

- `supabase/functions/ai-agent/index.ts`
- prompts principais
- deploy
- banco de producao

Motivo:

- Antes de integrar com o agente, precisamos provar que o sistema sabe dizer, sem LLM, qual e a proxima pergunta correta.
- Isso ataca a causa raiz dos erros: repeticao de pergunta, handoff cedo, "temos sim" e falta de acabamento/cor.

## Sprint 0 - Congelar Contrato Dos Fluxos

Objetivo:

- Fechar o contrato funcional dos cenarios 21.33, 21.36 e 21.37 antes de codar runtime.

Tasks:

- Consolidar campos obrigatorios por tipo de produto.
- Definir score ideal por fluxo:
  - tintas: score minimo para busca e score final para handoff;
  - porcelanatos/revestimentos: score final para handoff em catalogo vazio;
  - torneiras/metais: score final para handoff em catalogo vazio;
  - fallback generico: score minimo para handoff.
- Definir linguagem proibida:
  - negativas de estoque;
  - afirmacoes de estoque;
  - vazamento de catalogo;
  - cliches repetitivos.
- Definir estados oficiais:
  - `lead_type`
  - `product_interest_counter`
  - `qualification_score`
  - `next_required_field`
  - `catalog_result`
  - `physical_stock_required`
  - `ready_to_search`
  - `ready_to_handoff`
  - `followups_paused`

Aceite:

- Plano aprovado.
- Nenhuma alteracao de runtime.

## Sprint 1 - Motor Deterministico De Qualificacao

Objetivo:

- Criar a fonte da verdade para proxima pergunta, score e status do fluxo.

Tasks:

- Criar `productQualificationFlow.ts`.
- Criar tipos:
  - `ProductQualificationCategory`
  - `ProductQualificationField`
  - `ProductQualificationState`
  - `ProductQualificationDecision`
- Implementar categorias iniciais:
  - `tintas`
  - `porcelanatos_revestimentos`
  - `torneiras_metais`
  - `fallback_produto`
- Implementar funcao:
  - `evaluateProductQualificationFlow(input)`
- A funcao deve retornar:
  - categoria resolvida;
  - campos coletados;
  - campos faltantes;
  - proximo campo;
  - pergunta sugerida;
  - score;
  - contador;
  - pronto para busca;
  - pronto para handoff;
  - politica de linguagem de estoque.

Testes obrigatorios:

- 21.33 tinta:
  - pergunta obra/reforma;
  - pergunta interno/externo;
  - pergunta aplicacao;
  - pergunta tipo;
  - pergunta cor;
  - pergunta perfil;
  - libera busca apenas no score correto.
- 21.36 porcelanato:
  - aplicacao;
  - residencial/comercial;
  - formato;
  - acabamento;
  - cor;
  - local de aplicacao;
  - area;
  - libera handoff apenas com contexto suficiente.
- 21.37 torneira gourmet:
  - aplicacao;
  - instalacao;
  - modelo;
  - acabamento;
  - tipo de cuba;
  - perfil;
  - libera handoff com resumo completo.

Aceite:

- Testes unitarios verdes.
- Nenhum LLM necessario para saber a proxima pergunta.
- Nenhuma mudanca em `ai-agent/index.ts`.

## Sprint 2 - Estado Runtime E Compatibilidade Com Tags

Objetivo:

- Fazer o motor entender o estado atual sem quebrar o sistema existente.

Tasks:

- Criar mapper de tags existentes para `ProductQualificationState`.
- Manter compatibilidade com:
  - `lead_score:N`
  - `interesse:*`
  - `search_fail:N`
  - `enrich_count:N`
  - `seller_handoff_pending:*`
  - `cart_items`
  - `shown_product_ids`
- Definir persistencia futura:
  - opcao A: continuar em tags + logs;
  - opcao B: criar `conversations.ai_state` JSONB.
- Recomendacao tecnica: iniciar sem migration, com helper calculado a partir de tags; depois avaliar `ai_state`.

Aceite:

- Helper consegue ler conversas atuais.
- Nao quebra tags existentes.
- Estado premium pode ser exibido/logado.

## Sprint 3 - Integrar Ao Qualification Specialist

Objetivo:

- Fazer o `qualification_specialist` receber o proximo campo estruturado.

Tasks:

- Adaptar `qualificationSpecialist.ts` para receber `ProductQualificationDecision`.
- Injetar no prompt:
  - `next_required_field`
  - `next_question`
  - `valid_tag_key`
  - `already_collected`
  - `forbidden_questions`
- Garantir uma pergunta por turno.
- Bloquear repeticao do campo ja respondido.
- Manter `set_tags` como ferramenta de persistencia.

Arquivos provaveis:

- `supabase/functions/_shared/agent/qualificationSpecialist.ts`
- `supabase/functions/_shared/agent/qualificationContext.ts`
- `supabase/functions/_shared/agent/specialistBase.ts`

Aceite:

- Specialist nao decide no improviso.
- Mensagem fica humana, mas o campo vem do backend.


---

> Continua em [[wiki/plano-fluxo-premium-eletropiso-2026-05-29-part6b]] (Sprints 4-10, ordem, decisao) · [[wiki/plano-fluxo-premium-eletropiso-2026-05-29-part6c]] · [[wiki/plano-fluxo-premium-eletropiso-2026-05-29-part6d]] · [[wiki/plano-fluxo-premium-eletropiso-2026-05-29-part6e]] · [[wiki/plano-fluxo-premium-eletropiso-2026-05-29-part6f]].
