---
title: Fluxos — Parametros de Atendimento (Saudacao + Qualificacao + Produtos + Interacoes)
tags: [parametros, saudacao, qualificacao, produtos, interacoes, subagentes]
sources: [discussao-chat-2026-04-11]
updated: 2026-04-11
---

# Parametros de Atendimento

> Parte 2/4 do plano v3.0. Parametros 0-3: como a IA atende o lead.
> Docs relacionados: [[wiki/fluxos-visao-arquitetura]], [[wiki/fluxos-params-inteligencia]], [[wiki/fluxos-params-entrada]]

---

## P0 — Saudacao (6 sub-params) — DISCUTIDO

> Primeiro segundo da experiencia. Depende do Reconhecimento (Etapa 0, banco SQL, ~50ms).

| # | Sub-param | Tipo | Default |
|---|---|---|---|
| 1 | greeting_new | string | "Ola! Bem-vindo(a) a {empresa}! Com quem eu falo?" |
| 2 | extract_name | boolean | true (false=captura passiva) |
| 3 | greeting_returning | string | "{horario} {nome}! Que bom te ver de volta" |
| 4 | context_depth | enum | "standard" (minimal/standard/deep) |
| 5 | re_engagement_days | number | 7 |
| 6 | greeting_active | string/null | null (retoma sem saudacao) |

**Cenarios:** A) Lead novo extract=true ("com quem falo?"), B) Lead novo extract=false ("em que posso ajudar?"), C) Retornante deep ("deu certo aquela tinta?"), D) Fluxo ativo (skip, retoma)

**LLM:** Template simples = interpolacao (R$0). Deep = LLM curta (~200 tokens, ~R$0,002).

**Exit rules:** nao_respondeu(30min→followup), pediu_humano(→handoff), irritado(→gerente)

---

## P1 — Qualificacao (7 sub-params) — DISCUTIDO

> Perguntas para entender quem e, o que precisa e urgencia — antes de qualquer acao.

| # | Sub-param | Tipo | Default |
|---|---|---|---|
| 1 | questions | string[] | [] |
| 2 | max_questions | number | 4 |
| 3 | required_count | number | 2 |
| 4 | mode | enum | "adaptive" (fixed/adaptive) |
| 5 | fallback_retries | number | 2 |
| 6 | post_action | enum | "enviar_produtos" |
| 7 | context_vars | boolean | true |

**Modo adaptativo:** IA pula perguntas ja respondidas. Lead diz "cozinha de 12m²" → pula comodo e metragem.

**Fases:** MVP (params 1-6). Fase 2: score + perguntas condicionais + tipos de resposta.

**Absorveu Forms (D16):** 3 sub-params adicionais:
| 8 | field_types | array | 16 tipos: text, number, email, phone, cpf, date, select, multiselect, checkbox, textarea, url, currency, file, location, rating, signature. Validacao: CPF checksum, email regex, CEP API |
| 9 | collect_mode | enum | "conversational" (IA natural, DEFAULT) ou "structured" (campo por campo, tipo form-bot) |
| 10 | smart_fill | boolean | true. Pula campos que IA ja coletou na conversa. "Ja sei que e cozinha 12m², so preciso do email" |

**Total:** 10 sub-params (era 7).

**Exit rules:** max_perguntas(→vendas), impaciente(→pula), score>=80(→handoff vendedor), fora_perfil(→msg+tag+encerra)

---

## P2 — Produtos (8 sub-params) — DISCUTIDO

> Momento de conversao. Produto certo, hora certa, forma certa.

| # | Sub-param | Tipo | Default |
|---|---|---|---|
| 1 | max_per_carousel | number(1-10) | 5 |
| 2 | max_sends | number(1-10) | 3 |
| 3 | send_interval | number(5-120s) | 30 |
| 4 | single_product_mode | enum | "media" (media/carousel/text) |
| 5 | search_filters | object | {category:true, brand:true, price:true, availability:false, qualification:true} |
| 6 | display_options | object | {price:true, description:true, link:false, installments:false} |
| 7 | no_results_action | enum | "suggest_alternatives" (suggest/ask_again/handoff/catalog) |
| 8 | recommendation_mode | enum | "smart" (exact/smart/upsell) |

**Segmentos:** Homecenter(5,3,30s,smart,preco), Joalheria(2,2,60s,exact,sem preco), Pizzaria(8,1,5s,cardapio)

**Fase 2:** Historico de vistos (nao repetir) + cross-sell automatico + favoritos/wishlist.

**Exit rules:** max_envios(→handoff), gostou(→detalhes+vendedor), orcamento(→handoff+briefing), sem_resultado(→config)

---

## P3 — Interacoes (8 sub-params) — DISCUTIDO

> Termometro da conversa. Limites de tempo, msgs e comportamento quando lead para.

| # | Sub-param | Tipo | Default |
|---|---|---|---|
| 1 | max_messages | number(5-100) | 20 (conta msgs da IA, nao do lead) |
| 2 | max_duration | number(5-480min) | 60 (pausa quando lead inativo) |
| 3 | inactivity_followup | object | {timeout:120min, max:2, interval:24h} |
| 4 | inactivity_close | object | {timeout:48h, tags:["abandonou"], message:null} |
| 5 | business_hours | object | {enabled:false, weekdays:"08-18", sat:"08-12", sun:null, outside:"auto_reply"} |
| 6 | escalation | object | {levels:[{after:10,suggest},{after:15,auto_handoff},{after:20,notify_manager}]} |
| 7 | concurrent_flows | enum | "single" (single/priority/multiple) |
| 8 | conversation_memory | enum | "session" (none/session/persistent) |

**Outside behavior:** "queue"(responde quando abrir), "auto_reply"(msg+para), "limited"(so FAQ), "full"(ignora horario)

**Memory persistent:** "Livia, da ultima vez voce olhava pisos Portobello. Quer continuar?"

**Fase 2:** Deteccao de sentimento em tempo real + velocidade de resposta como sinal de engajamento.

**Exit rules:** max_msgs(→handoff), max_duration(→handoff), escalation 3 niveis, fora_horario(→auto_reply), followup_esgotado(→tag+close), lead_encerrou("tchau"→NPS)

---

## Exit Rules — Padrao Universal

Todo subagente DEVE ter pelo menos 1 exit rule.

```
exit_rule: { trigger, message, action }
```

**8 destinos:** next_subagent, handoff_human, handoff_department, handoff_manager, followup, another_flow, tag_and_close, do_nothing

**final_handoff:** fallback quando fluxo termina naturalmente.
