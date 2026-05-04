---
title: Integração de Funis — Onde Ver no Painel Admin (M15)
tags: [funis, integracao, painel, admin, ui, campanhas, bio-link, formularios, m15]
sources: [CLAUDE.md, PRD.md, M15]
updated: 2026-05-04
---

# Integração de Funis — Painel Admin

> Mapa completo de onde encontrar cada parte da integração no painel do WhatsPRO. Cobre Campanhas, Bio Link, Formulários, Lead (jornada) e AI Agent.

---

## 3. Onde Ver Tudo no Painel Admin

### 3.1. Campanha — Painel completo

**Sidebar → Campanhas → Todas**

| O que vê | Onde |
|----------|------|
| Lista de campanhas com métricas | Tabela principal |
| Criar nova campanha | Botão "Nova campanha" |
| Link rastreável + QR Code | Dentro da campanha (detalhe) |
| Visitas recentes com conversão | Dentro da campanha (detalhe) |
| **Leads convertidos** | Seção "Leads desta campanha" (M15) |
| Métricas: visitas, conversão, taxa | Cards no topo do detalhe |

**Para criar uma campanha com formulário:**
1. Clique "Nova campanha"
2. Preencha nome, instância, tipo (venda, suporte, etc.)
3. Em "Modo da landing page", escolha **Formulário**
4. Selecione o formulário no dropdown
5. Configure instrução para o AI Agent (opcional)
6. Salve → copie o link ou QR Code para divulgar

### 3.2. Bio Link — Painel completo

**Sidebar → Bio Link → Todas as páginas**

| O que vê | Onde |
|----------|------|
| Lista de páginas Bio | Aba "Páginas" |
| Criar nova página | Botão "Nova página Bio" |
| Views, cliques, leads, CTR | Aba "Analytics" |
| Editar botões, aparência, captação | Sheet lateral (clique no card) |

**Para criar uma página Bio com captação de leads:**
1. Clique "Nova página Bio"
2. Preencha título, slug, descrição, avatar
3. Escolha template (simples, shopping, negócio)
4. Adicione botões (WhatsApp, URL, Formulário, Catálogo, Social)
5. Na aba Aparência → "Captação de Leads" → ative e escolha campos (nome/telefone/email)
6. Na aba Aparência → "Contexto AI Agent" → ative e escreva template
7. Salve → link público: `/bio/seu-slug`

### 3.3. Formulários — Painel completo

**Sidebar → Formulários**

| O que vê | Onde |
|----------|------|
| Lista de formulários por agente | Grid de cards |
| **"Usado em" (campanhas/bios)** | Badges no card de cada form (M15) |
| Criar form do zero ou de template | Botão "Novo formulário" ou galeria |
| Editar campos, validações | FormBuilder (clique no card) |
| Submissões recebidas | Botão de tabela no card |

**Para criar um formulário:**
1. Selecione o Agente IA no topo
2. Clique "Novo formulário" → escolha template ou form vazio
3. Adicione campos (texto, email, CPF, select, etc.)
4. Configure validações e mensagens de erro
5. Salve → trigger no WhatsApp: `FORM:slug-do-formulario`

### 3.4. Lead — Jornada completa

**Sidebar → CRM → Leads → clique no lead**

| O que vê | Onde |
|----------|------|
| **Badge de origem** (Bio/Campanha/Form) | Seção "Origem do Lead" com badge colorido (M15) |
| **Timeline de jornada** | Card "Jornada do Lead" com touchpoints cronológicos (M15) |
| Formulários respondidos | Card "Formulários respondidos" |
| Histórico de conversas | Card "Histórico" |
| Eventos do AI Agent | Card "Timeline" |
| Posição no CRM Kanban | Card com etapa + "Ver no CRM" |
| Dados extraídos pelo AI | Campos editáveis (nome, cidade, etc.) |
| Arquivos/mídia trocados | Card "Arquivos" |

### 3.5. AI Agent — Como recebe os dados

**Sidebar → Agente IA → Configuração**

O AI Agent **automaticamente** recebe contexto de todos os sistemas. Não precisa configurar nada — basta que as tags existam na conversa. O agente:

1. Detecta `campanha:X` → carrega dados da campanha → injeta `<campaign_context>`
2. Detecta `formulario:X` → carrega submission → injeta `<form_data>`
3. Detecta `bio_page:X` → carrega página bio → injeta `<bio_context>`
4. Usa `lead_profiles` → personaliza com nome, cidade, interesses

---

## Links Relacionados

- [[wiki/integracao-funis]] — Índice da integração de funis
- [[wiki/integracao-funis-arquitetura]] — Arquitetura, leadHelper, tags, contexto AI
- [[wiki/integracao-funis-jornadas]] — 5 exemplos de jornada completa
- [[wiki/ai-agent]] — Detalhes do AI Agent
- [[wiki/modulos]] — Lista de módulos
