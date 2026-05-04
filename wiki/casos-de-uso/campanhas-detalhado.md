---
title: Campanhas UTM — Documentacao Detalhada (Indice)
tags: [campanhas, utm, tracking, landing, qrcode, atribuicao, detalhado, indice]
sources: [src/components/campaigns/, src/pages/dashboard/Campaigns.tsx, supabase/functions/go/]
updated: 2026-05-04
---

# Campanhas UTM — Rastreamento de Links e Landing Pages (Indice das 12 Sub-Funcionalidades)

> As Campanhas UTM sao **links rastreaveis** que voce compartilha no Instagram, Google, panfletos ou qualquer lugar. Quando alguem clica, o sistema registra de onde veio, mostra uma **landing page** com countdown (ou formulario), e redireciona para o WhatsApp. A conversa ja chega **tagueada** com o nome da campanha, e a IA sabe de qual promocao o lead veio.
>
> Pense numa campanha assim: voce posta no Instagram "Clique no link da bio!". O link leva para uma pagina bonita com logo e countdown 3 segundos, e depois abre o WhatsApp com mensagem pre-escrita. No CRM, voce sabe exatamente quantas pessoas clicaram, quantas mandaram mensagem, e quantas compraram — tudo separado por campanha.
>
> Sem campanhas UTM, todos os leads parecem iguais — voce nao sabe se vieram do Instagram, do Google, do panfleto ou de indicacao. Com campanhas, **cada canal tem seu proprio link** e voce mede o retorno de cada um.
>
> Ver tambem: [[wiki/casos-de-uso/helpdesk-detalhado]] (conversas tagueadas), [[wiki/casos-de-uso/ai-agent-detalhado]] (contexto campanha no prompt), [[wiki/casos-de-uso/formularios-detalhado]] (formularios na landing)

---

## Sub-paginas (organizadas por area)

A documentacao das 12 sub-funcionalidades foi particionada em 3 wikis tematicas (cada uma sob 200 linhas, regra 14 do CLAUDE.md). Use o indice abaixo para navegar:

| Sub-pagina | Sub-funcionalidades cobertas |
|------------|------------------------------|
| [[wiki/casos-de-uso/campanhas-criacao]] | **7.1** Criacao de Campanha, **7.2** Link Rastreavel e QR Code, **7.3** Landing Page (Countdown ou Formulario), **7.4** Fluxo de Redirect Completo, **7.11** 6 Tipos de Campanha (Templates) |
| [[wiki/casos-de-uso/campanhas-tracking]] | **7.6** Atribuicao Automatica (Tags), **7.7** Contexto IA da Campanha, **7.9** Visitas com Paginacao e Metadados |
| [[wiki/casos-de-uso/campanhas-operacao]] | **7.5** Metricas e Analytics, **7.8** Clone de Campanha, **7.10** Leads da Campanha, **7.12** Gestao de Status (+ Arvore de Componentes + Tabelas do Banco) |

---

## Como navegar pelo campanhas-detalhado

- Vai **criar uma campanha do zero** (form, link, QR, landing, fluxo do clique ate WhatsApp, templates de tipo)? → `campanhas-criacao`
- Quer entender **como o lead converte e a IA recebe contexto** (tags automaticas, prompt enriquecido, visitas com metadados)? → `campanhas-tracking`
- Esta **operando campanhas em producao** (ler metricas, clonar, ver leads, pausar/ativar)? → `campanhas-operacao`

---

## Links Relacionados

- [[wiki/casos-de-uso/formularios-detalhado]] — Formularios usados na landing page
- [[wiki/casos-de-uso/ai-agent-detalhado]] — Contexto campanha injetado no prompt
- [[wiki/casos-de-uso/leads-detalhado]] — Leads criados automaticamente
- [[wiki/casos-de-uso/helpdesk-detalhado]] — Conversas tagueadas no helpdesk
- [[wiki/modulos]] — Todos os 17 modulos
- [[wiki/decisoes-chave]] — Decisoes de produto e arquitetura

---

*Documentado em: 2026-04-10 — Padrao dual (didatico + tecnico)*
*Rev 1 (2026-05-04): Particionado em 3 sub-wikis tematicas para respeitar regra 14 (max 200 linhas/MD). Este arquivo virou indice.*
