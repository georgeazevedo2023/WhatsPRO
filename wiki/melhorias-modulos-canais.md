---
title: Melhorias — Campanhas, Bio Link, Funis
tags: [melhorias, campanhas, bio, funis, backlog]
sources: [auditoria 2026-04-27]
updated: 2026-04-27
---

# Melhorias — Canais de Captação

> 30 melhorias acionáveis em 3 módulos: Campanhas UTM, Bio Link, Funis. Auditoria 2026-04-27.

---

## Campanhas UTM (M7) — `src/components/campaigns/`, `supabase/functions/go/`

1. **Tracking de conversão server-side** (Meta CAPI, Google Enhanced Conversions) — hoje só visit/lead, não envia para anunciante.
2. **A/B test de landing page** — variantes em `utm_campaigns.variants JSONB` + split. Hoje 1 campanha = 1 landing.
3. **Detecção de bot/click farm** — IPs repetidos em <1s, user-agent suspeito. Filtrar em `utm_visits.is_bot`.
4. **QR code dinâmico** com short URL editável (mudar destino sem reimprimir QR).
5. **Pixel de retargeting** opcional na landing — hoje não tem.
6. **UTM auto-fill em forms** — dados do `go` injetados como hidden fields nos formulários (validar implementação parcial).
7. **Múltiplos destinos** — load balance entre números (5 instâncias). Hoje 1 campanha = 1 wa.me.
8. **Métricas em tempo real** (websocket) na CampaignDetail — hoje precisa F5.
9. **Expiração automática** (cron diário set `status='expired' WHERE expires_at < now()`) — hoje atribui só se ativa, mas flag não muda sozinha.
10. **CSV export de visits** com filtros (por dia, fonte, conversão).

---

## Bio Link (M14) — `src/components/bio/`, `src/pages/BioPage.tsx`

1. **Templates customizáveis** (cores, fontes, espaçamento) salvos como `bio_themes` reutilizáveis. Hoje 3 templates fixos.
2. **Domínio próprio** (whatspro.app/u/empresa em vez de /bio/empresa) — branding.
3. **Animações on-scroll** — botões aparecem com fade-in. Hoje estáticos.
4. **Pixel tracking** (Meta, GA4, TikTok) opcional — hoje só analytics interno.
5. **Botão tipo "produto único"** com OG image + descrição rica (link preview WhatsApp).
6. **Bio com vídeo embed** (YouTube/Vimeo) — hoje só imagem.
7. **Modo "manutenção"** — bio temporariamente off com mensagem custom.
8. **Histórico de versões** — admin troca tudo, quer voltar — hoje sem backup.
9. **Capa com vídeo loop** (mp4 short) em vez de imagem estática.
10. **`<bio_context>` mais rico** — passar full URL de origem, agente que vai atender. Hoje contexto mínimo.

---

## Funis (M16) — `src/components/funnels/`, `src/pages/dashboard/Funnel*.tsx`

1. **Wizard com preview ao vivo** dos artefatos sendo criados — hoje cria no submit final.
2. **Clone de funil completo** (campaigns + bio + forms + kanban juntos) — hoje só de campanha.
3. **Análise de gargalo** — "70% caem entre etapa 2 e 3 do kanban". Adicionar a `useFunnelMetrics`.
4. **Funil multi-canal** — IG → form → WhatsApp → kanban. Hoje só WhatsApp.
5. **Templates exportáveis/importáveis** — empresa A exporta funil de sorteio, B importa.
6. **Versionamento de funil** — alteração ativa não afeta leads em curso (segregação por `funnel_version`).
7. **A/B test de funil inteiro** — variante A vs B com mesma origem.
8. **Página pública de funil** (similar ao bio mas para campanhas grandes).
9. **Pause/resume funil** — para férias, manutenção. Hoje só ativo/inativo.
10. **Notificações de funil** — gerente recebe push quando 10º lead completa o funil hoje.

---

## Links

- [[wiki/melhorias-auditoria-2026-04-27]] — Índice geral
- [[wiki/casos-de-uso/campanhas-detalhado]]
- [[wiki/casos-de-uso/bio-link-detalhado]]
- [[wiki/casos-de-uso/funis-detalhado]]
