---
title: Fluxos — Parametros de Entrada (Gatilhos + Condicoes + Bio + UTM + QR + Forms + Webhooks)
tags: [parametros, gatilhos, condicoes, bio-link, utm, qrcode, formularios, webhooks]
sources: [discussao-chat-2026-04-11]
updated: 2026-04-11
---

# Parametros de Entrada

> Parte 4/4 do plano v3.0. Parametros 6-7 (roteamento) + 9-13 (ferramentas de captacao).
> Docs relacionados: [[wiki/fluxos-visao-arquitetura]], [[wiki/fluxos-params-atendimento]], [[wiki/fluxos-params-inteligencia]]

---

## P6 — Gatilhos (6 sub-params) — DISCUTIDO

> O que faz o fluxo disparar. Primeira decisao do orquestrador.

| # | Sub-param | Tipo | Default |
|---|---|---|---|
| 1 | trigger_type | enum | 16 tipos: 5 externos + 11 internos |
| 2 | trigger_config | object | Varia por tipo |
| 3 | priority | number(1-100) | 50 |
| 4 | cooldown | object | {per_lead:60min, per_flow:24h, reset_on_complete:true} |
| 5 | activation | object | {enabled:true, date_range:null, schedule:null, max_activations:null} |
| 6 | fallback | enum | "default_agent" (default_agent/specific_flow/menu/silent) |

**Tipos externos:** bio_link, utm_campaign, qr_code, webhook, first_message
**Tipos internos:** keyword, tag_added, tag_removed, label_applied, kanban_moved, ticket_resolved, inactivity, schedule, form_completed, nps_received
**Composto:** multi (qualquer um de N gatilhos dispara o fluxo)

**Keyword config (ATUALIZADO D15):** Agora usa intent match com keywords como boost.
trigger_config: { intents: ["produto","orcamento"], keywords: ["reforma","piso"] (boost), min_confidence: 70 }
Detector unificado: [[wiki/fluxos-detector-intents]]
**Priority faixas:** 90-100 emergencia, 70-80 atendimento, 40-60 vendas, 10-30 marketing
**Activation:** date_range (promocao temporaria), schedule (so horario comercial), max_activations (500 vagas sorteio)

---

## P7 — Condicoes (4 sub-params) — PENDENTE discussao detalhada

> Filtro entre gatilho e acao. "Lead bateu com gatilho, mas se qualifica?"

| # | Sub-param | Tipo | Default |
|---|---|---|---|
| 1 | conditions | array | 11 operadores, 20+ campos |
| 2 | logic_operator | enum | "AND" (AND/OR/CUSTOM) |
| 3 | condition_on_fail | enum | "skip" (skip/redirect/queue/message) |
| 4 | re_evaluate | boolean | false (true=avalia a cada msg) |

**Operadores:** equals, not_equals, contains, not_contains, greater_than, less_than, exists, not_exists, in, not_in, between
**Campos:** lead.name/phone/email/tags/origin/message_count/last_contact_days/temperature/kanban_column/nps_score, message.text/type, time.hour/weekday/is_business_hours, flow.current_step

---

## P9 — Bio Link (15 sub-params) — DISCUTIDO

> Micro landing page profissional. Evolucao de Linktree basico para pagina completa com dados reais.
> Detalhes completos: [[wiki/fluxos-params-biolink]]

**15 sub-params em 5 grupos:** Estrutura(6: auto_create, template 12+, buttons, branding, tracking, slug) + Secoes(2: sections 13 blocos, profile_extras) + Social Proof(2: NPS real+contador, whatsapp_preview) + Visual(1: animations) + Midia(4: upload, catalog_select, embeds YouTube/Maps/IG, nano_banana max 5)
**+** media_library compartilhada cross-sistema
**Inspirado em:** 10 modelos profissionais (corretor, advogada, personal, fotografo, nutricionista, dentista, confeiteira, designer, psiquiatra, professor)

---

## P10 — Campanhas UTM (8 sub-params) — DISCUTIDO

> GPS do marketing. Rastreia exatamente de onde cada lead veio. Nasce dentro do fluxo.

| # | Sub-param | Tipo | Default |
|---|---|---|---|
| 1 | auto_create | boolean | true (fluxo gera links automaticamente) |
| 2 | utm_params | object | source(auto/canal), medium(social/cpc/email/qrcode), campaign(=flow_slug), content(A/B) |
| 3 | multi_channel | boolean | true (gera 1 link por canal: instagram, facebook, google, email, panfleto) |
| 4 | landing_page | object | type por canal: instagram→bio_link, google_ads→whatsapp_direct, email→form_public |
| 5 | short_url | boolean | true. wsm.art/ep-vitrine-ig (encurtado por canal) |
| 6 | expiration | object | date(null), redirect_after(bio principal), message_after("Promocao encerrou") |
| 7 | attribution | object | auto_tag(true), auto_origin(true), context_to_ai(true), model: first_touch/last_touch/multi_touch |
| 8 | ab_testing | object | enabled(false). 2 versoes link, trafico 50/50, resultado apos 500 cliques |

**Conversa guiada:** IA pergunta "onde vai divulgar?" e gera links por canal automaticamente. Admin nao precisa saber UTM.
**Exit rules:** link_expirado(→redirect), roi_negativo(<5% apos 1000 cliques→alerta admin)

---

## P11 — QR Code (7 sub-params) — DISCUTIDO

> Ponte mundo fisico→digital. Unico canal offline. QR branded com tracking separado.

| # | Sub-param | Tipo | Default |
|---|---|---|---|
| 1 | auto_generate | boolean | true (fluxo gera QR junto com bio+UTM) |
| 2 | style | object | format(standard/branded/colored/artistic), logo_overlay(true), colors(empresa), corner_style(rounded/square/dots) |
| 3 | destination | enum | "bio_link" (bio_link/whatsapp/form/utm_link). Restaurante: whatsapp com keyword MESA_12 |
| 4 | tracking | object | distinct_utm(true, utm_medium=qrcode), scan_counter(true), location_tag("loja-boa-viagem") |
| 5 | sizes | object | Gera todos: social(500), card(800), flyer(1200), banner(2000), print_hd(4000). Formatos: PNG+SVG+PDF |
| 6 | companion_text | object | enabled(true), text("Aponte a camera!"), position(below/above/inside) |
| 7 | multi_qr | boolean | false. true=N QRs mesmo fluxo com location_tag diferente. Dashboard comparativo |

**Caso restaurante:** 20 mesas → 20 QRs com keyword MESA_1..20 → garcom digital sabe a mesa.
**Exit rules:** fluxo_expirado(→redirect), max_scans(→"Vagas esgotadas"), horario(→msg)

---

## ~~P12 — Formularios~~ ABSORVIDO (D16, 2026-04-11)

> Forms absorvido por P1 Qualificacao (+field_types, +collect_mode, +smart_fill) e P9 Bio Link (+lead_magnet, +standalone_form). Ver [[wiki/fluxos-params-atendimento]] e [[wiki/fluxos-params-biolink]].

---

## P12 — Webhooks (5 sub-params, renumerado era P13) — DISCUTIDO

> Ponte WhatsPRO↔mundo exterior. Shopify, Hotmart, Stripe, HubSpot, Bling, custom.

| # | Sub-param | Tipo | Default |
|---|---|---|---|
| 1 | incoming | array | Fontes pre-config: shopify(order/cart/payment/refund), woocommerce, hotmart, stripe, bling, hubspot, custom. Mapping pronto por fonte. trigger_flow + score_change |
| 2 | outgoing | array | Eventos: on_flow_start/complete/handoff/score_change/qualification_complete/purchase_intent. Payload com variaveis {lead.name}, {lead.score}, {flow.answers} |
| 3 | field_mapping | object | Auto-mapping por nome similar (first_name→name 85%). Interface visual: campo externo→campo WhatsPRO |
| 4 | retry_policy | object | max_retries:3, delay:[30s,5min,1h], on_failure:alert(log/alert/pause_flow) |
| 5 | security | object | incoming_secret(HMAC auto), ip_whitelist(null), rate_limit(30/min) |

**Conversa guiada:** IA pergunta "tem Shopify?" → gera URLs + mapping pronto → admin cola no painel externo.
**Exit rules:** webhook_recebido(→trigger_flow+score), falhou_3x(→alert admin), payload_invalido(→log+descarta)

---

## Status de Discussao

| # | Param | Profundidade | Falta |
|---|---|---|---|
| 4 | Tags | DISCUTIDO | Contexto, problema, 6 sub-params, custom rules, conflitos, cleanup |
| 7 | Condicoes | Listado | Contexto, problema, combinacoes, exemplos reais |
| 9 | Bio Link | DISCUTIDO | 15 sub-params, 12+ templates, midia, Nano Banana. Wiki dedicada |
| 10 | UTM | DISCUTIDO | 8 sub-params, multi-canal, short URL, A/B testing, atribuicao |
| 11 | QR Code | DISCUTIDO | 7 sub-params, multi-QR, branded, tracking por local |
| 12 | ~~Formularios~~ | ABSORVIDO | Absorvido por P1 Qualificacao + P9 Bio Link (D16) |
| 12 | Webhooks (era P13) | DISCUTIDO | 5 sub-params, 7 fontes pre-config, mapping auto, retry, HMAC |
