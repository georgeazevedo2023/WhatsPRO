---
title: Plano Fluxo Premium Eletropiso (part5)
type: auditoria
description: Auditoria 2026-05-29 dos cenarios 21.33 e 21.36, causa raiz de repeticao de perguntas e primeiro passo tecnico.
updated: 2026-05-29
---

> Partes anteriores: [[wiki/plano-fluxo-premium-eletropiso-2026-05-28]] · [[wiki/plano-fluxo-premium-eletropiso-2026-05-28-part2]] · [[wiki/plano-fluxo-premium-eletropiso-2026-05-28-part3]] · [[wiki/plano-fluxo-premium-eletropiso-2026-05-28-part4]].

## Auditoria 2026-05-29 - Cenarios 21.33 E 21.36

Escopo desta auditoria:

- Modo leitura.
- Nenhuma alteracao de runtime.
- Objetivo: descobrir o primeiro passo para transformar os cenarios premium em fluxo nota 10.

## Problema Reportado

No teste com OpenAI:

- Handoff aconteceu.
- `status_ia=shadow` e atribuicao humana aconteceram.
- Tags ricas foram capturadas.
- A IA nao disse "nao temos".

Mas a qualidade ficou abaixo de nota 10:

- A IA afirmou disponibilidade: "Temos sim porcelanato marmorizado!".
- Repetiu a mesma pergunta.
- Gerou mensagens duplicadas/cliches.
- Fez handoff sem coletar acabamento/cor.

Hipotese do dono:

- O pre-router forca `qualification_specialist`, mas nao diz qual atributo perguntar em seguida.

## Arquivos Auditados

- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/_shared/agent/qualificationGate.ts`
- `supabase/functions/_shared/agent/qualificationContext.ts`
- `supabase/functions/_shared/agent/qualificationSpecialist.ts`
- `supabase/functions/_shared/agent/specialistBase.ts`
- `supabase/functions/_shared/agent/tools/searchProducts.ts`
- `supabase/functions/_shared/agent/tools/setTagsAndHandoff.ts`
- `supabase/functions/_shared/serviceCategories.ts`
- `supabase/functions/_shared/fieldAutoExtractor.ts`
- `supabase/functions/_shared/responseValidator.ts`

## Diagnostico

### 1. A hipotese esta correta, mas incompleta

Existe sim uma tentativa de dizer a proxima pergunta:

- `qualificationContext.ts` calcula `PROXIMA PERGUNTA OBRIGATORIA` via `getCurrentStage()` + `getNextField()`.
- `qualificationSpecialist.ts` recebe esse contexto e deve perguntar somente esse campo.
- `specialistBase.ts` injeta `preSearchContext` no final do system prompt.
- `ai-agent/index.ts` cria `noResultDirective` no loop de catalogo vazio.

O problema e que, para o fluxo premium 21.36, isso ainda nao vira um contrato deterministico completo.

### 2. O fluxo depende demais de prompt textual no catalogo vazio

No loop de produto nao encontrado, `ai-agent/index.ts` monta uma diretiva textual dizendo:

- nao confirmar/negar estoque;
- perguntar um atributo ainda nao coletado;
- ordem sugerida: aplicacao -> ambiente -> formato -> acabamento -> cor -> metragem.

Mas essa diretiva nao fornece um objeto estruturado do tipo:

```json
{
  "next_required_field": "acabamento",
  "field_key": "acabamento",
  "question": "Voce prefere um acabamento mais brilhante ou acetinado?",
  "already_collected": ["aplicacao", "ambiente", "formato"]
}
```

Resultado: o LLM precisa inferir a proxima pergunta a partir de texto livre e tags. Isso explica repeticao, pergunta errada e handoff antes de coletar campos essenciais.

### 3. Falta categoria premium de porcelanato/revestimentos no contrato default

`serviceCategories.ts` default so cobre bem:

- `tintas`
- `impermeabilizantes`
- fallback generico

Nao ha categoria default premium para:

- porcelanato;
- pisos;
- revestimentos.

Sem essa categoria, o motor pode cair no fallback ou depender de configuracao de banco/admin. O fallback nao sabe que porcelanato precisa de:

- aplicacao;
- ambiente;
- formato;
- acabamento;
- cor/tonalidade;
- local de aplicacao;
- area.

### 4. Categoria tintas tambem nao esta no nivel do cenario 21.33

O default de `tintas` pre-busca tem apenas:

- ambiente;
- cor.

O cenario 21.33 exige:

- objetivo: obra nova/reforma;
- ambiente: interno/externo;
- aplicacao: parede/teto/porta/moveis;
- tipo: acrilica/esmalte/epoxi;
- cor;
- perfil: economica/intermediaria/premium.

Portanto, mesmo o fluxo de produto encontrado ainda nao tem contrato de campos suficiente para nota 10.

### 5. O contador de enriquecimento nao representa "contexto suficiente"

Hoje ha:

- `lead_score:N`
- `search_fail:N`
- `enrich_count:N`

Mas nao ha `product_interest_counter` nem `required_fields_completed`.

No `ai-agent/index.ts`, o loop usa `max_enrichment_questions` e incrementa `enrich_count` no pre-router. Isso limita por quantidade de turnos, nao por campos obrigatorios coletados.

Para o 21.36, o correto e:

- perguntar ate os campos obrigatorios do perfil ficarem completos;
- ou parar quando atingir limite configurado;
- nunca parar apenas porque `enrich_count` chegou num numero arbitrario se ainda falta campo essencial como acabamento/cor/area.

### 6. O validador ainda nao bloqueia afirmacao de estoque

`responseValidator.ts` bloqueia negativas:

- `nao temos`
- `nao encontrei`
- `sem estoque`
- `indisponivel`

Mas nao bloqueia afirmacoes perigosas:

- `temos sim`
- `temos`
- `esta disponivel`
- `temos em estoque`

No cenario de catalogo vazio, afirmar "Temos sim porcelanato marmorizado" e tao perigoso quanto negar. A resposta correta e neutra/consultiva.

### 7. Handoff e follow-up ainda precisam de trava explicita

O fluxo premium fala:

- `agent_status = inactive`
- `followups_paused = true`

No sistema real:

- o handoff usa `status_ia = shadow`;
- `process-follow-ups` busca conversas em `shadow` para enviar follow-up e reativar IA.

Logo, `shadow` nao equivale a `followups_paused`. Para nota 10, precisa de flag/tag/estado explicito para pausar follow-up apos handoff de produto/estoque fisico.

## Primeiro Passo Recomendado

O primeiro passo nao deve ser mexer em prompt solto, modelo LLM ou handoff.

O primeiro passo deve ser criar o **Contrato Deterministico de Qualificacao Premium**.

## Regra Mae - Categoria Ausente Ou Sem Catalogo Digital

Quando faltar categoria premium especifica, ou quando a categoria/produto nao tiver catalogo digital, o sistema deve seguir a mesma regra estrutural:

1. Nunca informar indisponibilidade ao lead.
2. Nunca dizer que o produto nao existe no catalogo.
3. Nunca improvisar carrossel, produto similar ou afirmacao de estoque.
4. Tratar o caso como `qualify_then_handoff`.
5. Qualificar o interesse pelo produto ate atingir score/campos minimos para transbordo.
6. Gerar resumo completo para o vendedor.
7. Fazer handoff humanizado.
8. Pausar respostas da IA ao lead apos atribuicao humana.

Em termos de estado:

```json
{
  "catalog_status": "offline_or_missing",
  "flow_mode": "qualify_then_handoff",
  "search_enabled": false,
  "show_carousel": false,
  "physical_stock_required": true,
  "stock_language_policy": "neutral_only"
}
```

Regra de negocio:

- Se existe categoria premium: usar os campos obrigatorios da categoria.
- Se nao existe categoria premium: usar fallback de qualificacao por produto, mas ainda com ordem deterministica.
- Se o catalogo digital esta vazio/ausente: continuar qualificando normalmente, sem vazar isso para o lead.
- O transbordo so acontece quando `ready_to_handoff=true` ou quando o limite configurado de perguntas for atingido.

Fallback minimo para produto sem categoria premium:

1. produto/categoria de interesse;
2. aplicacao/uso;
3. ambiente;
4. medida/tamanho/formato quando aplicavel;
5. acabamento/cor/modelo quando aplicavel;
6. quantidade/area/metragem quando aplicavel;
7. urgencia ou entrega/retirada se util ao vendedor.

Essa regra evita dois erros graves:

- Confirmar estoque sem validacao humana.
- Transbordar cedo demais sem contexto suficiente.


---

> Continua em [[wiki/plano-fluxo-premium-eletropiso-2026-05-29-part5b]] (21.37, ordem de implementacao, decisao).
