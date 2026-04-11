---
title: Fluxos — Parametro 9 Bio Link Detalhado (15 sub-parametros)
tags: [parametros, bio-link, midia, nano-banana, templates, catalogo, embeds]
sources: [discussao-chat-2026-04-11, 10-modelos-link-bio]
updated: 2026-04-11
---

# Parametro 9 — Bio Link (15 sub-parametros)

> Micro landing page profissional gerada pelo fluxo. Evolucao de "Linktree basico" para pagina completa com dados reais do sistema.
> Inspirado em 10 modelos profissionais (corretor, advogada, personal, fotografo, nutricionista, dentista, confeiteira, designer, psiquiatra, professor).
> Docs relacionados: [[wiki/fluxos-visao-arquitetura]], [[wiki/fluxos-params-entrada]]

---

## Avaliacao da Evolucao

| Versao | Nota | Descricao |
|---|---|---|
| Antes (so botoes) | 7.0 | Logo + botoes, sem secoes, sem prova social |
| +10 modelos | 9.0 | +12 templates, secoes, galeria, FAQ, depoimentos |
| +Sugestoes proprias | 9.5 | +NPS real, contador dinamico, preview WhatsApp, lead magnet |

---

## 15 Sub-parametros Organizados por Grupo

### ESTRUTURA (6)

| # | Sub-param | Tipo | Default |
|---|---|---|---|
| 1 | auto_create | boolean | true (fluxo cria bio junto) |
| 2 | template | enum | 12+ modelos: 3 genericos (minimal/standard/rich) + 9 por segmento (real_estate, legal, fitness, photographer, health, clinic, food, creative, therapy, education) + custom |
| 3 | buttons | array(max 8) | 6 tipos: whatsapp(keyword), link, form, catalog, schedule, call. 1 bio pode disparar N fluxos diferentes via keywords distintas nos botoes |
| 4 | branding | object | logo(upload/empresa), banner(upload/generate/url), colors(primary/bg/text/accent), title, subtitle |
| 5 | tracking | object | auto_utm(true — UTM por botao: utm_content=button_label), analytics(true — cliques, conversoes, origem, horario, dispositivo) |
| 6 | slug | string | Auto: bio.wsmart.com.br/{empresa}-{flow_slug}. Customizavel |

### SECOES (2 — dos 10 modelos)

| # | Sub-param | Tipo | Default |
|---|---|---|---|
| 7 | sections | array de blocos | Blocos disponiveis (13): stats, services, testimonials, gallery, plans, faq, before_after, map, reviews, delivery_areas, lead_magnet, team, video. Admin ordena por drag&drop |
| 8 | profile_extras | object | credential_badge(CRECI/OAB/CRM), stats([{label,value}]), specialties(tags), availability_status(integra business_hours: online/offline), verified_badge |

### SOCIAL PROOF (2 — sugestoes proprias)

| # | Sub-param | Tipo | Default |
|---|---|---|---|
| 9 | social_proof | object | show_nps(true — NPS REAL do sistema), show_counter(true — "127 orcamentos este mes"), show_last_activity(false — "Ultimo atendimento: 3min"), show_reviews(false — Google Reviews) |
| 10 | whatsapp_preview | object | enabled(true), show_response_time("30s"), show_satisfaction("9.2/10"), description("Nossa IA vai te ajudar a encontrar o produto ideal") |

### VISUAL (1 — dos 10 modelos)

| # | Sub-param | Tipo | Default |
|---|---|---|---|
| 11 | animations | object | entrance(none/fade/slide/scale), avatar_effect(none/ring/glow/hexagonal), button_hover(lift/glow/fill) |

### MIDIA (4)

| # | Sub-param | Tipo | Default |
|---|---|---|---|
| 12 | upload | object | Tipos: jpg/png/webp/svg(5MB), mp4(30MB), pdf. Otimizacao auto: compressao, WebP, resize por contexto. Storage: Supabase |
| 13 | catalog_select | object | Modos: featured/category/auto. Sincroniza preco catalogo→bio |
| 14 | embeds | object | YouTube, Google Maps(+horario), Instagram(6 posts), TikTok, Spotify |
| 15 | nano_banana | object | Banner, produto melhorado, promo, avatar, capa. Max 5/bio |

### FORMULARIO ABSORVIDO (2 — absorveu P12 Forms, D16)

| # | Sub-param | Tipo | Default |
|---|---|---|---|
| 16 | lead_magnet | object | form_fields(16 tipos), post_submit(message/redirect/webhook/trigger_flow/auto_whatsapp), template(contact/lead_capture/event/quote/feedback) |
| 17 | standalone_form | boolean | false. true=form publico SEM WhatsApp (inscricao evento, newsletter). URL: forms.wsmart.com.br/{slug} |

### BIBLIOTECA (cross-sistema)

**media_library:** Biblioteca unica compartilhada entre bio, carrossel, campanha, form. Fontes: uploads admin + fotos catalogo + geradas Nano Banana + midias WhatsApp + assets campanhas. Organizada em pastas automaticas. Busca por nome/tag/data. Reutilizacao sem re-upload.

---

## Templates por Segmento (dos 10 modelos)

| Template | Estilo | Cores | Elementos-chave |
|---|---|---|---|
| real_estate | Dark luxo dourado | Preto + ouro | Imoveis destaque, stats, CRECI, mapa |
| legal | Editorial cream | Creme + navy + ouro | Depoimentos, badge OAB, areas atuacao |
| fitness | Neon cyberpunk | Neon green + dark | Avatar hexagonal, planos, skill bars |
| photographer | Cinematic dark | Dark + beige | Hero image, galeria grid, hover labels |
| health | Organico natural | Verde + cream | Servicos scroll, folhas animadas, CRM |
| clinic | Clean clinico | Azul + branco | Card flutuante, antes/depois, Google Reviews |
| food | Rose artesanal | Rosa + cream | Produtos scroll, areas entrega, portfolio |
| creative | Brutalista | Amarelo + preto | Grid borders, skill bars, ticker |
| therapy | Indigo calmo | Indigo + sky blue | FAQ accordion, badge verificado, card aviso |
| education | Cosmico escuro | Roxo + pink + lime | Cards idioma, planos "Popular", aura glow |

---

## Decisoes

- Bio Link = micro landing page (nao Linktree basico)
- 12+ templates por segmento com estilos visuais distintos
- Dados reais do sistema (NPS, contador leads, status online)
- Catalogo sincronizado (preco muda → bio atualiza)
- Nano Banana unico gerador (max 5/bio)
- media_library compartilhada cross-sistema
- 1 bio → N botoes → N fluxos diferentes
- Preview WhatsApp antes do clique (tempo resposta + satisfacao)
