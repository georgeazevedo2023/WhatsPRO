---
title: Plano Fluxo Premium Eletropiso (part5b)
type: auditoria
description: Continuacao do part5: exemplo de aceite 21.37, ordem de implementacao e decisao recomendada.
updated: 2026-05-29
---

> Anterior: [[wiki/plano-fluxo-premium-eletropiso-2026-05-29-part5]].

## 21.37 - Exemplo De Aceite: Torneira Gourmet Sem Catalogo Digital

Contexto:

- Lead novo.
- Produto nao localizado no catalogo digital.
- Pode existir no estoque fisico.
- IA nao informa indisponibilidade.
- IA continua qualificando.
- Transbordo com resumo completo.

Fluxo esperado:

1. Lead pergunta: "Boa tarde, voces tem torneira gourmet?"
2. IA pede nome se lead novo.
3. Lead informa nome: Carlos.
4. IA qualifica uma pergunta por vez:
   - aplicacao: cozinha ou area gourmet;
   - instalacao: bancada ou parede;
   - modelo: gourmet com ducha flexivel;
5. Busca interna retorna 0.
6. Sistema marca internamente:
   - `catalog_result = empty`
   - `physical_stock_required = true`
   - `stock_language_policy = neutral_only`
7. IA nao recebe/nao exibe a falha ao lead.
8. IA continua qualificando:
   - acabamento: cromado, preto fosco, dourado ou escovado;
   - tipo de cuba: simples ou dupla;
   - perfil: sofisticado/premium ou custo-beneficio.
9. Ao atingir score/campos minimos:
   - `handoff_created = true`
   - `status_ia = shadow` ou estado equivalente de atendimento humano
   - `human_assigned = true`
   - `seller_notified = true`
   - `followups_paused = true`

Campos esperados no resumo ao vendedor:

- Cliente: Carlos
- Categoria: Torneira Gourmet
- Aplicacao: Cozinha
- Instalacao: Bancada
- Modelo: Gourmet com ducha flexivel
- Acabamento: Preto Fosco
- Tipo de Cuba: Dupla
- Perfil: Premium
- Mensagens de Interesse: 6
- Qualification Score: 6
- Evento Interno: busca sem resultado no catalogo digital
- Observacao: verificar estoque fisico e apresentar alternativas equivalentes
- Origem: WhatsApp
- Prioridade: Alta
- Tags:
  - torneira
  - gourmet
  - bancada
  - ducha_flexivel
  - preto_fosco
  - cuba_dupla
  - premium
- Necessita: validacao humana e orcamento

Regras que este cenario valida:

- Nao dizer "nao temos".
- Nao dizer "nao encontrei".
- Nao dizer "sem estoque".
- Nao dizer "temos sim".
- Nao confirmar disponibilidade.
- Nao citar catalogo ao lead.
- Nao mostrar carrossel.
- Fazer perguntas progressivas e nao repetidas.
- Transbordar apenas depois de contexto suficiente.
- Enviar resumo completo ao vendedor.

### Entregavel do primeiro passo

Criar um helper puro em `_shared/agent`, por exemplo:

- `productQualificationFlow.ts`

Responsabilidades:

1. Resolver categoria premium:
   - tintas;
   - porcelanatos/revestimentos;
   - ferramentas;
   - iluminacao;
   - banheiro;
   - eletrica;
   - hidraulica.
2. Ler tags/estado atual.
3. Calcular:
   - `product_interest_counter`;
   - `qualification_score`;
   - `required_fields_completed`;
   - `missing_required_fields`;
   - `next_required_field`;
   - `next_question`;
   - `ready_to_search`;
   - `ready_to_handoff`;
   - `catalog_result`;
   - `physical_stock_required`;
   - `followups_paused`.
4. Retornar objeto estruturado, nao texto livre.

Exemplo alvo:

```json
{
  "category": "porcelanatos",
  "mode": "no_catalog_result_enrichment",
  "required_fields": ["aplicacao", "ambiente", "formato", "acabamento", "cor", "local_aplicacao", "area"],
  "collected_fields": {
    "aplicacao": "piso",
    "ambiente": "residencial",
    "formato": "120x120"
  },
  "next_required_field": "acabamento",
  "next_question": "Voce prefere um acabamento mais brilhante ou acetinado?",
  "qualification_score": 3,
  "product_interest_counter": 3,
  "ready_to_search": false,
  "ready_to_handoff": false,
  "stock_language_policy": "neutral_only"
}
```

### Por que esse e o primeiro passo

Sem esse contrato:

- o pre-router continua forçando specialist sem um proximo campo confiavel;
- o LLM continua livre para repetir pergunta;
- o handoff pode acontecer antes da hora;
- o validador so apaga alguns erros, mas nao conduz o fluxo;
- trocar para modelo melhor apenas mascara a falha.

Com esse contrato:

- o specialist recebe exatamente o campo e a pergunta;
- a UI pode mostrar contador/score;
- o resumo ao vendedor fica padronizado;
- Playwright consegue validar o fluxo inteiro por estado;
- os cenarios 21.33 e 21.36 viram testes determinísticos.

## Ordem De Implementacao Recomendada

1. **Sprint 1A - Helper puro e testes unitarios**
   - Criar `productQualificationFlow.ts`.
   - Modelar `tintas` e `porcelanatos` primeiro.
   - Testar cenarios 21.33 e 21.36 sem chamar LLM.

2. **Sprint 1B - Integrar ao `qualification_specialist`**
   - Injetar `next_required_field` e `next_question` estruturados no prompt.
   - Bloquear pergunta fora do campo atual.

3. **Sprint 1C - Integrar catalogo vazio**
   - Quando `search_products = 0`, marcar `catalog_result=empty`.
   - Continuar pelo mesmo helper, nao por diretiva textual.
   - Handoff apenas quando `ready_to_handoff=true` ou limite configurado atingido.

4. **Sprint 1D - Guardrails de linguagem**
   - Bloquear afirmacao e negacao de estoque em contexto de catalogo vazio.
   - Proibir `temos sim`, `temos em estoque`, `esta disponivel`, `nao temos`, `nao encontrei`.

5. **Sprint 1E - Handoff summary e follow-up pause**
   - Builder padrao de resumo.
   - `followups_paused=true` real ou tag equivalente respeitada pelo cron.

## Decisao Recomendada

Comecar por `productQualificationFlow.ts` + testes unitarios dos dois cenarios:

- 21.33 Tinta encontrada.
- 21.36 Porcelanato nao encontrado.

Somente depois integrar no `ai-agent/index.ts`.

Esse e o menor primeiro passo que reduz risco em `ai-agent/index.ts` e cria base para nota 10 sem depender de sorte do LLM.

---

> Continua em [[wiki/plano-fluxo-premium-eletropiso-2026-05-29-part6]] (Plano Executivo, Sprints, Tasks e Primeiro Passo).
