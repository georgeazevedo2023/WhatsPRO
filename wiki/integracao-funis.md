---
title: Integração de Funis — Campanhas + Bio Link + Formulários + AI Agent
tags: [funis, campanhas, bio-link, formularios, ai-agent, integracao, jornada, m16]
sources: [CLAUDE.md, PRD.md, M15, M16]
updated: 2026-04-08
---

# Integração de Funis — Como Tudo se Conecta

> **ATUALIZADO M16**: Agora tudo esta unificado sob "Funis". O admin cria funis (nao campanhas/bios/forms separados). A tabela `funnels` orquestra os 3 modulos via FK. Tag `funil:SLUG` e propagada automaticamente. AI Agent recebe `<funnel_context>`.
>
> Guia completo de como os sistemas trabalham juntos no WhatsPRO. Inclui fluxos de dados, exemplos de jornada, e instrucoes de uso.

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

## 4. Cinco Exemplos de Jornada Completa

---

### Jornada 1: SORTEIO no Instagram

**Cenário:** Loja quer fazer sorteio de um produto. Divulga link no Instagram.

**Passo a passo do admin:**
1. Cria formulário "Sorteio Natal" com campos: nome, telefone, email, "Aceita regulamento?" (sim/não)
2. Cria campanha "Sorteio Natal" com `landing_mode=form` e liga ao formulário
3. Cria board Kanban "Sorteio" com colunas: Inscrito → Confirmado → Sorteado → Entregue
4. Posta link + QR Code nos stories do Instagram

**Jornada do lead:**
```
[1] 📱 Lead vê story no Instagram → clica no link
         ↓
[2] 🔗 Edge function "go" registra visita (utm_visits) com ref_code
         ↓
[3] 📋 Landing page mostra formulário → lead preenche nome, email, aceita regulamento
         ↓
[4] ✅ form-public cria:
         • contact (pelo telefone)
         • lead_profile (origin: "campanha", full_name, email)
         • form_submission (dados do formulário)
         • utm_visit atualizada (status: "matched")
         • kanban_card na coluna "Inscrito" (tags: campanha:Sorteio, formulario:sorteio)
         ↓
[5] 💬 Lead é redirecionado pro WhatsApp → manda mensagem
         ↓
[6] 🤖 AI Agent recebe:
         • <campaign_context> "Lead da campanha Sorteio Natal (tipo: giveaway)"
         • <form_data> "nome: Maria, email: maria@..., aceita: sim"
         • Responde: "Oi Maria! Sua inscrição no sorteio foi confirmada! 🎉"
```

**O que o admin vê no painel:**
- **Campanhas → Sorteio Natal:** 150 visitas, 89 conversões (59%), lista de leads
- **Leads → Maria:** Badge azul "Campanha: Sorteio Natal", timeline mostrando visita → form → conversa
- **CRM → Sorteio:** Card da Maria na coluna "Inscrito"
- **Formulários → Sorteio Natal:** Badge "Usado em Campanha Sorteio Natal", 89 submissões

---

### Jornada 2: VAGA DE EMPREGO via Bio Link

**Cenário:** Empresa quer receber candidaturas. Compartilha Bio Link nas redes sociais.

**Passo a passo do admin:**
1. Cria formulário "Candidatura" com campos: nome, email, telefone, cargo pretendido, experiência (select), LinkedIn (url)
2. Cria página Bio "Trabalhe Conosco" com:
   - Botão "Nossas vagas" (URL → site)
   - Botão "Candidatar-se" (tipo: formulário → "Candidatura")
   - Botão Instagram / LinkedIn (social icons)
   - Captação de leads ativada (nome + telefone + email)
   - Contexto AI: "Lead quer trabalhar na empresa. Veio da página {page_title}, clicou em {button_label}."

**Jornada do lead:**
```
[1] 📱 Lead vê link no LinkedIn → acessa /bio/trabalhe-conosco
         ↓
[2] 👁️ Bio page carrega → view_count incrementado
         ↓
[3] 📝 Lead clica "Candidatar-se" → modal pede nome/telefone/email
         ↓
[4] ✅ bio-public cria:
         • contact (pelo telefone)
         • lead_profile (origin: "bio", full_name, email)
         • bio_lead_captures (com contact_id)
         ↓
[5] 📋 Redirecionado para formulário web → preenche cargo, experiência, LinkedIn
         ↓
[6] ✅ form-public cria:
         • form_submission (dados do formulário)
         • lead_profile atualizado (custom_fields: cargo, experiência)
         • Tags: origem:bio, bio_page:trabalhe-conosco, formulario:candidatura
         ↓
[7] 💬 Lead é redirecionado pro WhatsApp → manda mensagem
         ↓
[8] 🤖 AI Agent recebe:
         • <bio_context> "Lead veio da página Bio 'Trabalhe Conosco'"
         • <form_data> "nome: Pedro, cargo: Desenvolvedor, experiência: 3-5 anos"
         • Responde: "Olá Pedro! Recebemos sua candidatura para Desenvolvedor.
           Nossa equipe de RH vai avaliar seu perfil e retornar em até 3 dias úteis."
```

**O que o admin vê no painel:**
- **Bio Link → Analytics:** Página "Trabalhe Conosco" com 200 views, 45 cliques, 32 leads
- **Leads → Pedro:** Badge verde "Bio Link: trabalhe-conosco", timeline: bio → form → conversa
- **Formulários → Candidatura:** Badge "Usado em Bio: Trabalhe Conosco", 32 submissões

---

### Jornada 3: LANÇAMENTO DE PRODUTO via Campanha + Bio

**Cenário:** Loja vai lançar produto novo. Cria campanha UTM + Bio Link para captar interessados.

**Passo a passo do admin:**
1. Cria formulário "Lista VIP" com: nome, telefone, "Quer ser avisado?" (sim/não)
2. Cria página Bio "Lançamento Tênis X" com:
   - Banner de capa (imagem do produto)
   - Botão "Entrar na lista VIP" (tipo: formulário → "Lista VIP")
   - Botão "Ver no catálogo" (tipo: catálogo → produto do ai_agent_products)
   - Contexto AI ativado: "Lead quer saber do lançamento {page_title}"
3. Cria campanha "Lançamento Tênis" com link apontando para a Bio Link
4. Configura AI Agent com instrução: "Fale sobre o Tênis X, preço R$ 399, lançamento dia 15"

**Jornada do lead:**
```
[1] 📱 Lead recebe link no grupo do WhatsApp → clica
         ↓
[2] 🔗 Campanha registra visita (utm_visits) → redireciona para /bio/lancamento-tenis
         ↓
[3] 👁️ Bio page carrega com banner do produto + 2 botões
         ↓
[4] 📝 Lead clica "Entrar na lista VIP" → modal pede nome/telefone
         ↓
[5] ✅ bio-public cria contact + lead_profile (origin: "bio")
         ↓
[6] 📋 Redirecionado pro formulário → preenche "Quer ser avisado? Sim"
         ↓
[7] ✅ form-public cria submission + tags:
         • origem:bio, bio_page:lancamento-tenis, formulario:lista-vip, campanha:Lançamento
         ↓
[8] 💬 Lead vai pro WhatsApp → pergunta "Quanto vai custar?"
         ↓
[9] 🤖 AI Agent recebe TODOS os contextos:
         • <campaign_context> "Campanha Lançamento Tênis"
         • <form_data> "nome: Ana, avisado: sim"
         • <bio_context> "Veio da página Bio 'Lançamento Tênis X'"
         • Responde: "Oi Ana! O Tênis X vai custar R$ 399,00 e lança dia 15!
           Como você entrou na lista VIP, vou te avisar assim que abrir a pré-venda. 🚀"
```

**O que o admin vê no painel:**
- **Campanhas → Lançamento Tênis:** Visitas, conversão, leads
- **Bio Link → Lançamento Tênis X:** Views, cliques no "Lista VIP" e "Ver catálogo"
- **Leads → Ana:** Badge verde "Bio Link", timeline com campanha + bio + form + conversa
- **Formulários → Lista VIP:** Badges "Usado em Campanha + Bio"

---

### Jornada 4: ATENDIMENTO via WhatsApp Form

**Cenário:** Empresa usa formulário dentro do WhatsApp para triagem antes de atender.

**Passo a passo do admin:**
1. Cria formulário "Triagem" com: nome, cidade, motivo do contato (select: compra/suporte/dúvida), produto de interesse
2. Configura AI Agent: "Ao receber primeiro contato, envie FORM:triagem"
3. Cria board Kanban "Vendas" com: Novo → Qualificado → Proposta → Fechado

**Jornada do lead:**
```
[1] 💬 Lead manda "Oi" no WhatsApp
         ↓
[2] 🤖 AI Agent envia greeting + inicia form: "FORM:triagem"
         ↓
[3] 📋 form-bot assume a conversa:
         • "Qual seu nome?" → "Carlos"
         • "Qual sua cidade?" → "São Paulo"
         • "Motivo do contato?" → "Compra"
         • "Qual produto?" → "Tinta Coral 18L"
         ↓
[4] ✅ form-bot ao completar:
         • form_submission criada
         • lead_profile: full_name: "Carlos", city: "São Paulo", origin: "formulario"
         • Tags: origem:formulario, formulario:triagem
         ↓
[5] 🤖 AI Agent retoma conversa COM contexto:
         • <form_data> "nome: Carlos, cidade: São Paulo, motivo: compra, produto: Tinta Coral 18L"
         • NÃO pergunta nome ou cidade novamente
         • Busca "Tinta Coral 18L" no catálogo → envia carrossel
         • Responde: "Carlos, encontrei a Tinta Coral 18L por R$ 289,90!
           Temos entrega pra São Paulo em 3 dias úteis."
```

**O que o admin vê no painel:**
- **Formulários → Triagem:** 45 submissões, dados preenchidos
- **Leads → Carlos:** Badge roxo "Formulário: triagem", timeline: conversa → form → AI responde
- **Helpdesk:** Conversa com Carlos mostrando perguntas do form + resposta do AI com carrossel

---

### Jornada 5: CAPTAÇÃO ORGÂNICA via Bio Link + Catálogo

**Cenário:** Loja coloca link da Bio no Instagram/TikTok. Lead acessa, navega catálogo, e entra em contato.

**Passo a passo do admin:**
1. Cria página Bio "Loja Virtual" com:
   - Botão "WhatsApp" (tipo: whatsapp → número da loja)
   - 3 botões de catálogo (tipo: catalog → produtos do ai_agent_products)
   - Botão Instagram + TikTok (social icons)
   - Captação ativada (nome + telefone)
   - Contexto AI: "Lead veio da loja virtual, interessado em {button_label}"
2. Coloca link `/bio/loja-virtual` na bio do Instagram

**Jornada do lead:**
```
[1] 📱 Lead vê "Link na bio" no Instagram → acessa /bio/loja-virtual
         ↓
[2] 👁️ Bio page carrega → view_count incrementado
         ↓
[3] 🛒 Lead vê produto "Esmalte Risqué" no catálogo → clica
         ↓
[4] 📝 Modal de captação pede nome e telefone → lead preenche
         ↓
[5] ✅ bio-public cria:
         • contact + lead_profile (origin: "bio")
         • bio_lead_captures (com page_id + button_id + contact_id)
         ↓
[6] 💬 Redirecionado pro WhatsApp com mensagem:
         "Olá! Tenho interesse no produto: Esmalte Risqué
          [bio:loja-virtual|Esmalte Risqué]"
         ↓
[7] 🤖 AI Agent recebe:
         • Detecta tag bio → seta bio_page:loja-virtual
         • <bio_context> "Lead veio da página Bio 'Loja Virtual'"
         • Já sabe que quer Esmalte Risqué (da mensagem)
         • Busca no catálogo → envia foto do produto
         • "Oi! O Esmalte Risqué está por R$ 12,90! 
           Temos 15 cores disponíveis. Qual cor você prefere?"
```

**O que o admin vê no painel:**
- **Bio Link → Analytics:** "Loja Virtual" com 500 views, 120 cliques, 85 leads, CTR 24%
- **Leads → Lead:** Badge verde "Bio Link: loja-virtual", timeline: bio capture → conversa
- **Helpdesk:** Conversa já com contexto do produto clicado

---

## 5. Tabela de Referência Rápida

### O que é criado em cada jornada

| Recurso | Campanha+Form | Bio+WhatsApp | WhatsApp Form | Campanha+Bio+Form | Bio+Catálogo |
|---------|:---:|:---:|:---:|:---:|:---:|
| utm_visits | ✅ | - | - | ✅ | - |
| contacts | ✅ | ✅ | (já existe) | ✅ | ✅ |
| lead_profiles | ✅ | ✅ | ✅ | ✅ | ✅ |
| form_submissions | ✅ | - | ✅ | ✅ | - |
| bio_lead_captures | - | ✅ | - | - | ✅ |
| kanban_cards | ✅ (se board) | - | - | ✅ (se board) | - |
| Tags campanha: | ✅ | - | - | ✅ | - |
| Tags formulario: | ✅ | - | ✅ | ✅ | - |
| Tags bio_page: | - | ✅ | - | ✅ | ✅ |
| AI <campaign_context> | ✅ | - | - | ✅ | - |
| AI <form_data> | ✅ | - | ✅ | ✅ | - |
| AI <bio_context> | - | ✅ | - | ✅ | ✅ |

### Prioridade de origin

Quando um lead passa por múltiplos sistemas, o campo `origin` segue esta prioridade:
1. Primeiro sistema a criar o lead → define o `origin`
2. Sistemas subsequentes **NÃO sobrescrevem** o origin já existente
3. Todas as tags são acumuladas (a conversa pode ter `campanha:X` + `bio_page:Y` + `formulario:Z` simultaneamente)

---

## Links

- [[wiki/modulos]] — Lista de módulos
- [[wiki/ai-agent]] — Detalhes do AI Agent
- [[wiki/roadmap]] — M15 F3-F5 no backlog (Hub de Funis, Templates, Métricas)
