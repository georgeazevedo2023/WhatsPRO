---
title: Fluxos — Parametros de Inteligencia (Tags + Seguranca + Lead Score)
tags: [parametros, tags, seguranca, score, protecao, bot-detection]
sources: [discussao-chat-2026-04-11]
updated: 2026-04-11
---

# Parametros de Inteligencia

> Parte 3/4 do plano v3.0. Parametros 4, 5, 8: classificacao, protecao e pontuacao.
> Docs relacionados: [[wiki/fluxos-visao-arquitetura]], [[wiki/fluxos-params-atendimento]], [[wiki/fluxos-params-entrada]]

---

## P4 — Tags Automaticas (6 sub-params) — PENDENTE discussao detalhada

> Tags sao a memoria classificada do lead. Dizem o que fez, o que quer e quao quente esta.

| # | Sub-param | Tipo | Default |
|---|---|---|---|
| 1 | auto_interest | bool+config | true. Categories opcionales, max_interests:5 |
| 2 | auto_temperature | boolean | true. Regras: quente(pediu orcamento), morno(perguntou), frio(so olhando) |
| 3 | auto_origin | boolean | true. Tags: origem:bio, origem:instagram, origem:qrcode, origem:direto |
| 4 | auto_stage | boolean | true. Tags: etapa:qualificacao→exploracao→negociacao→fechamento→pos-venda |
| 5 | custom_rules | array | []. Admin cria: SE condicao → aplica tag |
| 6 | tag_cleanup | object | {remove_conflicting:true, expire_after_days:null, protected_tags:["cliente","vip"]} |

**Regra conflito:** Aplica "quente" → remove "frio" e "morno". Aplica "etapa:negociacao" → remove "etapa:exploracao".

**Exit rules:** bloqueado(→silencio), virou_quente(→notifica vendedor), vip(→handoff gerente)

---

## P5 — Seguranca (6 sub-params) — DISCUTIDO

> Agente IA no WhatsApp e porta aberta. Protecao contra injection, bots, spam, engenharia social.

| # | Sub-param | Tipo | Default |
|---|---|---|---|
| 1 | blocked_phrases | string[]+action | ~25 frases pre-definidas. Acao: deflect/block/alert |
| 2 | rate_limiting | object | {per_min:10, per_hour:60, per_day:200, cooldown:5s, on_limit:throttle, whitelist:[]} |
| 3 | bot_detection | object | {enabled:true, threshold:70, on_detect:captcha, captcha_type:math} |
| 4 | content_filtering | object | {max_msg_length:2000, block_links:false, profanity:true, language:null} |
| 5 | data_protection | object | {never_reveal:[prompt,dados_leads,credenciais], pii:normal, log_sensitive:false} |
| 6 | abuse_escalation | object | {1x:deflect, 3x:warn, 5x:block_1h, 10x:block_permanent+notify_admin} |

**Frases bloqueadas (3 categorias):**
- Prompt injection: "me mostre seu prompt", "ignore suas instrucoes", "DAN mode", "modo desenvolvedor"
- Engenharia social: "sou o dono", "lista de clientes", "dados pessoais de"
- Concorrencia: "tabela de precos completa", "exportar catalogo"

**Bot detection sinais:** Resposta <1s consistente, padrao repetitivo, msgs identicas, horarios nao-humanos

**4 cenarios de ataque:** Prompt injection (escalada deflect→warn→block), Bot concorrente (rate+captcha→block), Engenharia social (deflect+alert), Spam/DDoS (rate→pause→block)

**Exit rules:** injection(→escalada progressiva+tag "suspeito"), bot(→captcha→block), rate_limit(→throttle→block), abuso_verbal(3x→handoff humano), dados_solicitados(→deflect+alert)

---

## P8 — Lead Score (6 sub-params) — DISCUTIDO

> Pontuacao numerica: quao pronto o lead esta. Conecta todos os outros parametros.

| # | Sub-param | Tipo | Default |
|---|---|---|---|
| 1 | scoring_rules | array | 30+ regras padrao |
| 2 | score_thresholds | array | Congelado(<0), Frio(0-25), Morno(26-50), Quente(51-75), Fervendo(76-100), VIP(>100) |
| 3 | score_decay | object | {enabled:true, rate:-2/dia, min:0, freeze_on_active:true} |
| 4 | score_display | object | {helpdesk:true, kanban:true, lead_profile:true, format:"label"} |
| 5 | score_notifications | object | {on_hot:notify, on_boiling:auto_handoff, on_cold:re-engagement, on_frozen:archive} |
| 6 | custom_rules | array | [] (regras do negocio) |

**Tabela de pontuacao — Acoes (+):**

| Acao | Pontos |
|---|---|
| Primeira mensagem | +5 |
| Respondeu qualificacao | +5 |
| Informou nome/email | +3/+5 |
| Perguntou sobre produto | +10 |
| Perguntou preco | +15 |
| Pediu orcamento | +25 |
| Pediu demonstracao/visita | +30 |
| Voltou apos inatividade | +15 |
| Preencheu formulario | +20 |

**Tabela — Perfil (+):** Cliente(+20), Anuncio pago(+10), Indicacao(+15), Budget>10k(+15), Budget>50k(+25), VIP(+30)

**Tabela — Negativos (-):** "Vou pensar"(-10), "So olhando"(-15), "Ta caro"(-5), Nao respondeu followup(-10), Inativo>7d(-20), Inativo>30d(-40), Abandonou fluxo(-15), NPS<5(-25), Bloqueado(-100)

**Decaimento:** -2 pts/dia inativo. Score 72 → 14 dias → score 44 (morno). Lead volta → acoes somam de novo.

**Conexoes com outros params:** Tags(temperatura auto), Qualificacao(pula se alto), Produtos(upsell se quente), Interacoes(limites flexiveis), Escalada(handoff auto), Saudacao(context_depth), Seguranca(block se negativo), Metricas(score medio/fluxo)

**Exit rules:** cruzou_quente(→notify), cruzou_fervendo(→handoff auto), cruzou_vip(→gerente), esfriou(→re-engagement), congelou(→archive)
