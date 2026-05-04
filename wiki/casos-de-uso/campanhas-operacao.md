---
title: Campanhas — Operacao, Metricas, Clone, Leads & Status
tags: [campanhas, utm, metricas, analytics, clone, leads, status, detalhado]
sources: [src/components/campaigns/, src/pages/dashboard/Campaigns.tsx]
updated: 2026-05-04
---

# Campanhas — Operacao, Metricas, Clone, Leads & Status

> Esta sub-wiki cobre o **dia-a-dia da campanha ja em producao**: como ler as metricas, clonar uma campanha de sucesso para reusar, listar leads convertidos no detalhe, e gerenciar o status (ativa/pausada/arquivada) que controla se o link funciona.
>
> Ver tambem: [[wiki/casos-de-uso/campanhas-detalhado]] (indice), [[wiki/casos-de-uso/campanhas-criacao]], [[wiki/casos-de-uso/campanhas-tracking]]

---

## 7.5 Metricas e Analytics

**O que e:** Cada campanha tem um painel de metricas mostrando desempenho em tempo real.

**KPIs (cartoes no topo):**
- **Visitas totais** — quantas vezes o link foi clicado
- **Conversoes** — quantos leads mandaram mensagem (status='matched')
- **Taxa de conversao** — visitas ÷ conversoes (%)
- **Expirados** — visitas que nao converteram

**Metricas de formulario (se landing_mode=form):**
- **Iniciaram formulario** — quantos comecaram a preencher
- **Completaram** — quantos enviaram
- **Abandonaram** — comecaram mas nao terminaram
- **Taxa de completacao** — completaram ÷ iniciaram (%)

**Grafico diario:** Grafico de area com visitas e conversoes por dia (ultimos 30 dias).

**Cenario:** Gerente abre campanha "Promo Agosto" → ve: 450 visitas, 120 conversoes (26.7%), grafico mostra pico no dia 15 (post viral). Campanha com formulario: 200 iniciaram, 150 completaram (75%), 50 abandonaram.

> **Tecnico:** Componente `CampaignMetrics.tsx`. Hook `useCampaignMetrics`. KPIs: count por status (visited, matched, expired). Abandono: `metadata.form_started === true AND status !== 'matched'`. Grafico: Recharts AreaChart, grouped by day, 30 dias. Calculo client-side a partir do array de visitas.

---

## 7.8 Clone de Campanha

**O que e:** Botao "Clonar" que cria uma copia da campanha com todos os campos preenchidos, pronta para ajustar e ativar.

**O que a copia recebe:**
- Nome: "Promo Agosto (copia)"
- Slug: novo (gerado automaticamente)
- Status: Pausada (nao ativa imediatamente)
- Datas: limpas (sem inicio nem expiracao)
- Todos os outros campos identicos ao original

**Cenario:** Campanha de agosto deu certo. Gerente clona → muda nome para "Promo Setembro" → ajusta datas → ativa. Em 2 minutos, nova campanha pronta.

> **Tecnico:** Handler em `CampaignTable.tsx`. Copia todos os campos exceto id, created_at, updated_at. Nome: `${original.name} (copia)`. Slug: auto-gerado. Status: 'paused'. starts_at/expires_at: null. Navega para edit da copia.

---

## 7.10 Leads da Campanha

**O que e:** Secao no detalhe da campanha mostrando todos os leads que converteram (mandaram mensagem), com nome, telefone, email e data de conversao.

**Exibe ate 20 leads recentes** com:
- Avatar + nome + telefone (do contato)
- Nome completo (do lead_profiles)
- Email (do lead_profiles)
- Data/hora da conversao

**Cenario:** Apos rodar campanha por 1 semana, gerente abre detalhe → ve 20 leads recentes que converteram → clica em um → vai para perfil completo do lead → analisa qualidade do publico capturado.

> **Tecnico:** Secao `CampaignLeadsSection` em `CampaignDetail.tsx`. Query: `utm_visits` WHERE status='matched' AND contact_id NOT NULL, JOIN contacts + lead_profiles. Order by matched_at DESC, limit 20.

---

## 7.12 Gestao de Status

**O que e:** Cada campanha tem um status que controla se ela esta operacional.

- **Ativa** (verde) — Link funciona, visitas sao registradas, conversas sao tagueadas
- **Pausada** (amarelo) — Link retorna erro 410 (campanha inativa), nenhuma visita registrada
- **Arquivada** — Escondida da lista, dados preservados

**Toggle rapido:** Na tabela de campanhas, menu com opcao "Pausar" / "Ativar" para alternar rapidamente.

**Cenario:** Estoque de promocao acabou — gerente pausa imediatamente → links que ainda circulam no Instagram retornam 410 (Gone) → leads nao chegam mais marcados como vindo dessa campanha → quando reabastecer, basta reativar.

> **Tecnico:** Campo `utm_campaigns.status` (active|paused|archived). Toggle: mutation `useUpdateCampaign({ id, status })`. Guard no `go`: `if (campaign.status !== 'active') return 410`. Badge de cor no `CampaignTable.tsx`.

---

## Arvore de Componentes

```
Campaigns.tsx (lista — /dashboard/campaigns)
+-- CampaignTable.tsx (tabela com metricas, acoes)
    +-- Clone, toggle status, delete, edit

CampaignCreate.tsx (criar/editar — /dashboard/campaigns/new)
+-- CampaignForm.tsx (formulario completo)
    +-- CampaignAiTemplate.tsx (tipo + instrucoes IA)

CampaignDetail.tsx (detalhe — /dashboard/campaigns/:id)
+-- CampaignMetrics.tsx (KPIs + grafico diario)
+-- CampaignQrCode.tsx (QR code + download)
+-- CampaignLinkPreview.tsx (link + copy)
+-- Tabela de visitas (paginada, 50/pagina)
+-- CampaignLeadsSection (leads convertidos)

CampaignRedirect.tsx (landing page — /r publica)
+-- RedirectView (countdown 3s → WhatsApp)
+-- FormView (LandingForm → submit → WhatsApp)
    +-- LandingForm.tsx (campos dinamicos + validacao)
```

---

## Tabelas do Banco

| Tabela | O que guarda |
|--------|--------------|
| `utm_campaigns` | Campanhas (name, slug, type, status, landing_mode, ai_template, starts_at, expires_at) |
| `utm_visits` | Visitas (ref_code, visitor_ip, user_agent, contact_id, status, metadata JSONB) |

---

## Links Relacionados

- [[wiki/casos-de-uso/campanhas-detalhado]] — Indice geral
- [[wiki/casos-de-uso/campanhas-criacao]] — Criacao, landing, redirect, templates
- [[wiki/casos-de-uso/campanhas-tracking]] — Atribuicao, contexto IA, visitas
- [[wiki/casos-de-uso/leads-detalhado]] — Leads criados automaticamente
- [[wiki/casos-de-uso/helpdesk-detalhado]] — Conversas tagueadas no helpdesk
- [[wiki/modulos]] — Todos os 17 modulos
