---
title: Integração de Funis — Arquitetura e Conexões (M15/M16)
tags: [funis, integracao, arquitetura, leadhelper, tags, contexto-ai, m15, m16]
sources: [CLAUDE.md, PRD.md, M15, M16]
updated: 2026-05-04
---

# Integração de Funis — Arquitetura e Conexões

> Como os 4 sistemas (Campanhas, Bio Link, Formulários, AI Agent) trabalham juntos. Fluxo de dados, módulo compartilhado `leadHelper.ts`, tags unificadas de origem e contexto injetado no AI Agent.
>
> **ATUALIZADO M16**: Tudo unificado sob "Funis". A tabela `funnels` orquestra os 3 módulos via FK. Tag `funil:SLUG` propagada automaticamente. AI Agent recebe `<funnel_context>`.

---

## 1. Visão Geral dos 4 Sistemas

| Sistema | O que faz | Onde no painel |
|---------|-----------|----------------|
| **Campanhas** | Links rastreáveis com UTM, QR Code, métricas de conversão | Sidebar → Campanhas → Todas |
| **Bio Link** | Páginas públicas tipo Linktree com botões rastreáveis | Sidebar → Bio Link → Todas as páginas |
| **Formulários** | Coletam dados via WhatsApp (chat) ou landing page (web) | Sidebar → Formulários |
| **AI Agent** | Robô de IA que atende automaticamente, usando contexto dos 3 sistemas acima | Sidebar → Agente IA → Configuração |

---

## 2. Como os Sistemas se Conectam

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   CAMPANHA   │     │   BIO LINK   │     │  FORMULÁRIO  │
│  (link UTM)  │     │  (Linktree)  │     │  (WhatsApp)  │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                     │
       │   ┌────────────────┤                     │
       │   │                │                     │
       ▼   ▼                ▼                     ▼
┌──────────────────────────────────────────────────────┐
│                    LEAD CRIADO                        │
│  contact + lead_profile + origin + tags unificadas   │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │   AI AGENT     │
              │ Recebe contexto│
              │ de TODOS os    │
              │ sistemas       │
              └────────┬───────┘
                       │
                       ▼
              ┌────────────────┐
              │  CRM KANBAN    │
              │  Lead qualifi- │
              │  cado → funil  │
              └────────────────┘
```

### Módulo compartilhado: `leadHelper.ts`

Todos os sistemas usam o mesmo módulo para criar leads:

- `upsertContactFromPhone()` — cria/atualiza contato pelo telefone
- `upsertLeadFromFormData()` — cria/atualiza lead com mapeamento padrão de campos
- `FORM_FIELD_MAP` — nome→full_name, email→email, cpf→cpf, cidade→city, etc.

### Tags unificadas de origem

| Tag | Significado | Quem seta |
|-----|-------------|-----------|
| `origem:campanha` | Lead veio de uma campanha UTM | whatsapp-webhook |
| `origem:formulario` | Lead veio de um formulário | form-bot |
| `origem:bio` | Lead veio de uma página Bio Link | bio-public / form-public |
| `campanha:NOME` | Nome da campanha específica | whatsapp-webhook / form-public |
| `formulario:SLUG` | Slug do formulário preenchido | form-bot / form-public |
| `bio_page:SLUG` | Slug da página Bio de onde veio | bio-public / form-public |

### Contexto injetado no AI Agent

O AI Agent recebe 3 blocos de contexto opcionais, baseados nas tags da conversa:

```xml
<!-- Se tem tag campanha:X -->
<campaign_context>
Este lead chegou pela campanha "Promoção Verão" (tipo: promocional).
Origem: instagram / paid
Instrução: Ofereça o desconto de 10% mencionado na campanha.
</campaign_context>

<!-- Se tem tag formulario:X -->
<form_data>
Este lead preencheu o formulário "Cadastro Sorteio":
  - nome: João Silva
  - email: joao@email.com
NÃO pergunte novamente informações que já foram coletadas acima.
</form_data>

<!-- Se tem tag bio_page:X -->
<bio_context>
Este lead chegou pela página Bio Link "Loja Virtual".
Descrição: Conheça nossos produtos e promoções.
Adapte a conversa ao contexto da página bio.
</bio_context>
```

### Prioridade de origin

Quando um lead passa por múltiplos sistemas, o campo `origin` segue esta prioridade:
1. Primeiro sistema a criar o lead → define o `origin`
2. Sistemas subsequentes **NÃO sobrescrevem** o origin já existente
3. Todas as tags são acumuladas (a conversa pode ter `campanha:X` + `bio_page:Y` + `formulario:Z` simultaneamente)

---

## Links Relacionados

- [[wiki/integracao-funis]] — Índice da integração de funis
- [[wiki/integracao-funis-painel]] — Onde ver tudo no painel admin
- [[wiki/integracao-funis-jornadas]] — 5 exemplos de jornada completa
- [[wiki/ai-agent]] — Detalhes do AI Agent
- [[wiki/modulos]] — Lista de módulos
