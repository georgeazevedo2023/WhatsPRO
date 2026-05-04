---
title: Visao Geral — Jornada do Lead, Numeros, Roadmap e Futuro
tags: [visao, jornada, numeros, roadmap, milestones, futuro]
sources: [wiki/roadmap.md, wiki/visao-geral-completa.md]
updated: 2026-05-04
---

# WhatsPRO — Jornada, Numeros e Roadmap

> Como um lead percorre a plataforma do primeiro toque ate a venda, numeros do projeto, milestones entregues e ideias para o proximo ciclo. Sub-wiki de [[wiki/visao-geral-completa]].

---

## 1. A Jornada Completa de um Lead (Exemplo Real)

Aqui esta o caminho completo que um lead percorre desde o primeiro contato ate a venda — passando por todos os modulos do sistema:

**Cenario: Loja de materiais de construcao, campanha no Instagram**

```
1. CAMPANHA: Gerente cria campanha "Promo Agosto" no WhatsPRO
   → Sistema gera link rastreavel + QR Code
   → Gerente posta no Instagram: "Clique no link da bio!"

2. BIO LINK: Lead clica no link da bio do Instagram
   → Pagina Bio Link abre com logo da loja + 4 botoes
   → Lead clica "Solicitar Orcamento"

3. FORMULARIO: Formulario abre na landing page
   → Lead preenche: nome "Pedro", cidade "Recife", tipo "Pintura externa"
   → Sistema cria lead automaticamente com origin='bio' + tags

4. WHATSAPP: Apos enviar, WhatsApp abre com mensagem pre-escrita
   → Lead envia: "Oi! Quero um orcamento de pintura"

5. AI AGENT: IA responde em 3 segundos
   → "Ola, Pedro! Vi que voce quer orcamento de pintura externa em Recife."
   → "Para qual tipo de area? Fachada, muro ou parede interna?"
   → Lead: "Fachada de predio comercial"
   → IA busca no catalogo → encontra 3 tintas para fachada
   → Envia carrossel com fotos, precos e botoes "Ver mais"

6. QUALIFICACAO: IA continua qualificando
   → "Qual area em m²?" → Lead: "120m²"
   → Tags aplicadas: motivo:compra, interesse:tintas, cidade:recife, quantidade:grande
   → Card movido no Kanban de "Novo" para "Qualificado"

7. HANDOFF: Lead pede desconto
   → IA: "Temos parcelamento em 3x sem juros e frete gratis acima de R$ 500"
   → Lead: "Quero falar com vendedor pra negociar"
   → IA faz handoff → envia "Um consultor vai te atender!"
   → IA entra em modo SOMBRA (continua extraindo dados sem responder)

8. HELPDESK: Vendedor Carlos assume a conversa
   → Ve no painel: nome Pedro, Recife, interesse tintas fachada, 120m², quer desconto
   → Negocia por 15 minutos → fecha venda de R$ 2.800
   → Enquanto negocia, Shadow extrai: orcamento:alto, marca_preferida:coral

9. FINALIZACAO: Carlos clica "Finalizar" → seleciona "Venda Fechada" → R$ 2.800
   → Tags: resultado:venda, valor:2800
   → Card move para "Fechado Ganho" no Kanban
   → Perfil do lead atualizado: ticket medio R$ 2.800

10. NPS: 30 minutos depois
    → Lead recebe enquete: "Como foi seu atendimento?"
    → Lead toca "Excelente" → nota registrada
    → Dashboard: gerente ve NPS 4.8/5

11. DASHBOARD: Gerente abre o dashboard
    → Campanha Agosto: 450 visitas, 120 conversoes (26.7%)
    → Funil Venda: 120 leads → 45 propostas → 28 fechados
    → Melhor vendedor: Carlos (45 conversas, 92% resolucao, 3min tempo medio)
    → Intelligence: "40% dos leads perguntam sobre frete. Sugestao: frete gratis acima de R$ 300"
```

**Tempo total:** Lead clicou no link → venda fechada em ~40 minutos.
**Sem WhatsPRO:** Mesmo processo levaria 2-3 dias (sem IA respondendo, sem lead qualificado, sem dados no perfil).

---

## 2. Numeros do Projeto

| Metrica | Valor |
|---------|-------|
| Modulos implementados | 17 |
| Sub-funcionalidades documentadas | 187 |
| Edge functions (Supabase) | 31 |
| Shared modules | 17 |
| Milestones shipped | 7 (v1.0 a M17) |
| Decisoes documentadas | 10 (D1-D10) |
| Wikis detalhadas | 17 documentos |
| Versao atual | 7.9.0 |
| URL producao | crm.wsmart.com.br |
| Servidor | Hetzner CX42 (65.108.51.109) |
| Periodo de desenvolvimento | 04/abr/2026 a 09/abr/2026 (6 dias para 7 milestones) |

---

## 3. Roadmap e Status

**Todos os 17 modulos estao implementados e em producao.**

| Milestone | Data | O que entregou |
|-----------|------|----------------|
| v1.0 Refatoracao e Blindagem | 04/abr | Circuit breaker, webhook, forms, componentes, tipagem, helpers |
| v2.0 Agent QA Framework | 05/abr | Historico batches, aprovacao, score, ciclo automatizado |
| M12 WhatsApp Forms | 05/abr | Forms por agent_id, FORM:slug, form-bot, validacoes, webhook |
| M13 Campanhas + Forms | 05/abr | Landing rica, form na landing, auto-tag, AI context |
| M14 Bio Link | 06/abr | 3 templates, 5 botoes, agendamento, captacao, analytics |
| M15-M16 Funis | 07/abr | Sidebar unificada, wizard 7 tipos, auto-criacao, metricas |
| M17 Plataforma Inteligente | 08-09/abr | Motor automacao, funis agenticos, perfis, enquetes, NPS |

**Proximo:** A definir pelo usuario. Possibilidades: multi-idioma, WhatsApp Business API (migrar de UAZAPI), mobile app, marketplace de templates, integracao com ERPs.

---

## 4. Possibilidades Futuras (Ideias para Proximo Roadmap)

| Area | Ideia | Impacto |
|------|-------|---------|
| **Integracao** | WhatsApp Business API (migrar de UAZAPI para oficial) | Escalabilidade + compliance |
| **Integracao** | ERP/Omie/Bling (sincronizar pedidos, estoque, NF) | Fluxo completo venda→entrega |
| **Integracao** | Mercado Livre / Shopify (e-commerce) | Catalogo sincronizado + pedidos |
| **Mobile** | App mobile (React Native) | Atendentes no celular |
| **IA** | Multi-agente (especialistas por area) | Respostas mais precisas |
| **IA** | Analise de sentimento em tempo real | Detectar frustracao antes do handoff |
| **IA** | Vision (ler imagens enviadas pelo lead) | Identificar produtos por foto |
| **Produto** | Templates de funil (marketplace) | Onboarding mais rapido |
| **Produto** | Multi-idioma (espanhol, ingles) | Mercado LATAM |
| **Produto** | White-label para agencias | Revenda com marca propria |
| **Produto** | Pagamentos in-chat (PIX + cartao) | Fechar venda sem sair do WhatsApp |
| **Infra** | SSO / SAML (login corporativo) | Enterprise readiness |
| **Infra** | API publica + webhooks de saida | Integracao com qualquer sistema |
| **Analytics** | Dashboard customizavel (drag&drop widgets) | Cada gerente monta seu painel |
| **QA** | Testes A/B de prompt | Otimizar conversao da IA |

---

## 5. Producao — Endpoints e Acessos

- **URL:** https://crm.wsmart.com.br
- **Servidor:** Hetzner CX42 (65.108.51.109)
- **Docker:** ghcr.io/georgeazevedo2023/whatspro:latest
- **Supabase:** euljumeflwtljegknawy

---

## Links Relacionados

- [[wiki/visao-geral-completa]] — Indice da visao geral
- [[wiki/visao-geral-projeto]] — O que e e diferenciais
- [[wiki/visao-geral-modulos]] — Os 19 modulos
- [[wiki/visao-geral-arquitetura]] — Stack, banco e fluxo de dados
- [[wiki/roadmap]] — Status detalhado por milestone
- [[wiki/casos-de-uso/guia-funcionalidades-completo]] — Guia rapido + 10 jornadas
- [[wiki/casos-de-uso/campanha-deputado-anderson]] — Case campanha politica

---

*Documentado em: 2026-05-04 — Particionado de visao-geral-completa.md (regra 14 max 200 linhas)*
