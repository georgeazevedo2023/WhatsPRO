---
title: Fluxos — Detector Unificado de Intents (13 intents + 3 camadas + normalizacao)
tags: [detector, intents, nlp, fuzzy, normalizacao, keywords, seguranca, orquestrador]
sources: [discussao-chat-2026-04-11]
updated: 2026-04-11
---

# Detector Unificado de Intents

> NAO sao 2 sistemas (keyword + intent). E 1 detector unificado com 3 camadas progressivas.
> Roda no Orquestrador ANTES da rota de fluxo. Prioridade sobre qualquer gatilho configurado.
> Docs relacionados: [[wiki/fluxos-visao-arquitetura]], [[wiki/fluxos-servicos]], [[wiki/fluxos-params-entrada]]

---

## Pipeline no Orquestrador

```
Mensagem → Audio.STT → Memory.load → Reconhecimento
  → DETECTOR DE INTENT (3 camadas) ← AQUI
  → Rota (fluxo ou bypass)
  → Subagente → Validator → Audio.TTS → Envio
```

---

## 13 Intents (por prioridade)

| # | Intent | Exemplo | Bypass | Destino | Score |
|---|---|---|---|---|---|
| 10 | Cancelamento/Opt-out | "Para de mandar msg" | Tudo | Acao imediata (LGPD) | -10 |
| 1 | Pessoa | "Quero falar com Mayara" | Tudo | Handoff atendente | 0 |
| 3 | Suporte/Problema | "Meu pedido veio errado" | Greet+Qualif | Subagente Suporte | +5 |
| 11 | Reclamacao forte | "PESSIMO atendimento" | Tudo | Handoff urgente | -20 |
| 2 | Produto especifico | "Tem Coral XYZ2099?" | Greet+Qualif | Busca catalogo | +15 |
| 5 | Orcamento | "Quero um orcamento" | Greet+Qualif | Handoff vendedor | +25 |
| 4 | Status/Rastreio | "Cade meu pedido?" | Tudo | Consulta sistema | +5 |
| 6 | Agendamento | "Quero agendar visita" | Greet+Qualif | Subagente Agenda | +10 |
| 7 | FAQ | "Que horas vocês fecham?" | Tudo | Knowledge base | +3 |
| 8 | Promocao | "Tem promocao?" | Greeting | Busca ofertas | +10 |
| 9 | B2B/Parceiro | "Sou fornecedor" | Tudo | Rota B2B | 0 |
| 12 | Continuacao | "Sobre ontem..." | Greeting | Memoria→Retoma | +15 |
| 0 | Generico | "Oi" | Nenhum | Fluxo normal | +5 |

---

## 3 Camadas do Detector

### Camada 1 — Normalizacao (~5ms, R$0, sem IA)

Limpa o texto antes de qualquer matching:

- **Abreviacoes WhatsApp (50+ mapeamentos):** vc→voce, qro→quero, tb→tambem, pq→porque, qnt→quanto, blz→beleza, pfv→por favor, hj→hoje, amnh→amanha, mt/mto→muito, msm→mesmo, dps→depois, ngm→ninguem
- **Remocao de acentos:** orcamento=orçamento, promocao=promoção
- **Dedup letras:** oiii→oi, siiiim→sim, socorrooo→socorro
- **Emojis como sinal:** 😡→negativo, 😊→positivo, 🛒→compra, 📦→entrega

### Camada 2 — Fuzzy Match (~10ms, R$0, sem IA)

Encontra palavras mesmo com erro de digitacao:

- **Levenshtein distance:** "orcamnto"→"orcamento" (dist 2 = MATCH), "pizo"→"piso" (dist 1 = MATCH), "suviniu"→"suvinil" (dist 1 = MATCH)
- **Threshold:** dist ≤ 2 para palavras ≥ 5 letras, dist ≤ 1 para < 5 letras
- **Soundex portugues:** coral=coraw=corau, ceramica=seramica, porcelanato=porselanato
- **Dicionario de sinonimos por intent:** Cada intent tem 10-20 sinonimos. Ex: ORCAMENTO = ["orcamento", "orca", "quanto fica", "me faz um preco", "bota na ponta do lapis", "quanto sai", "levanta o custo"]

### Camada 3 — Semantico (~200ms, ~R$0,001, LLM leve)

So roda quando camadas 1+2 nao resolveram (~20% das msgs):
- Nenhum intent detectado (expressao idiomatica)
- Empate entre 2+ intents (ambiguidade)
- Confianca baixa (< 50%)

Prompt curto (~100 tokens): classifica em 1 das 13 categorias + confianca 0-100.

### Performance

| Metrica | Valor |
|---|---|
| Custo medio/msg | ~R$0,0002 |
| 80% resolve em | Camada 1+2 (R$0, ~15ms) |
| 20% precisa de | Camada 3 (R$0,001, ~200ms) |

---

## Intent Direto — Pessoa (detalhado)

### 5 tipos de pedido
1. Pessoa especifica: "Quero falar com Mayara"
2. Departamento: "Me passa pro vendas"
3. Funcao: "Quero o gerente"
4. Humano generico: "Quero falar com alguem de verdade"
5. Ultimo atendente: "Quem me atendeu ontem"

### Disponibilidade
- **Online + disponivel:** handoff direto com briefing
- **Online + ocupado:** fila de espera + estimativa tempo
- **Offline (horario):** oferece alternativas ou agendar
- **Offline (fora horario):** registra + notifica quando voltar

### Preferencia persistente
Lead pediu mesma pessoa 2+ vezes → salva preferred_agent → rota automatica proxima vez

### Lead irritado
CAPS LOCK + "NAO QUERO ROBO" → handoff IMEDIATO sem perguntas, sem sugestoes

### 6 sub-parametros
enabled, detection_phrases, on_unavailable(offer_alternatives/queue/schedule/message), preferred_agent(after:2, auto_route:true), angry_detection(true), briefing(minimal/standard/full)

---

## Intent Direto — Produto (detalhado)

### 6 tipos de busca
1. Produto exato: "Tem Coral XYZ2099?" → busca + foto + preco
2. Produto + preco: "Quanto custa Portobello 60x60?"
3. Produto + estoque: "Tem disponivel?"
4. Produto + comparacao: "Coral ou Suvinil?"
5. Produto + quantidade: "30m² de Portobello" → calcula total + caixas + perda
6. Recompra: "Mais daquela tinta" → memoria longa

### Bypass inteligente
Produto direto PULA greeting e qualificacao. Qualificacao acontece NATURALMENTE durante a venda.
Sem intent: 8 trocas ate ver produto. Com intent: 2 trocas.

### 7 sub-parametros
enabled, auto_calculate(true), loss_percentage(10%), show_similar_on_miss(true), recompra_enabled(true), comparison_enabled(true), bypass_qualification(true)

---

## Intents Especiais

### Cancelamento/Opt-out (LGPD)
Acao IMEDIATA sem questionamento. Remove de broadcasts, follow-ups, fluxos. Nunca mais inicia contato. Lead precisa voltar por conta propria.

### B2B/Parceiro
Rota completamente diferente. Nao e lead comprador. Tag "b2b" + departamento comercial.

### Status/Rastreio
Consulta banco → resposta direta com numero rastreio. Sem LLM pesado.

---

## Impacto nos Parametros

Parametro 6 (Gatilhos) muda de "keyword match" para "intent match":

```
trigger_config: {
  intents: ["produto", "orcamento"],
  keywords: ["reforma", "piso"],  // boost de confianca
  min_confidence: 70
}
```

Keywords viram BOOST — match exato = confianca 100%. Mas intent detecta mesmo sem keyword exata.

---

## Ambiguidade (2+ intents na mesma msg)

"Quanto custa a Coral XYZ e voces entregam?"
→ Intent PRODUTO (90%) + Intent FAQ (85%)
→ Responde AMBOS na mesma mensagem

Regra de prioridade quando conflitam:
Cancelamento > Pessoa > Suporte > Reclamacao > Produto > Orcamento > Status > Agendamento > FAQ > Promocao > B2B > Continuacao > Generico
