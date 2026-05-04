---
title: Visao Geral — Projeto (O Que E, Para Quem, Diferenciais)
tags: [visao, projeto, posicionamento, competitivo, papeis]
sources: [wiki/visao-produto.md, wiki/visao-geral-completa.md]
updated: 2026-05-04
---

# WhatsPRO — Visao do Projeto

> Quem somos, que problema resolvemos, para quem servimos, papeis de usuario e como nos posicionamos no mercado. Sub-wiki de [[wiki/visao-geral-completa]].

---

## 1. O Que E o WhatsPRO

O WhatsPRO e uma **plataforma completa de atendimento e vendas via WhatsApp**. Imagine juntar o WhatsApp Web, um CRM de vendas, uma inteligencia artificial vendedora, um sistema de campanhas de marketing, e um construtor de funis — tudo num so lugar, acessivel pelo navegador em `crm.wsmart.com.br`.

A empresa conecta seus numeros de WhatsApp ao sistema, e a plataforma cuida de tudo: **atende clientes automaticamente com IA** (24h por dia, 7 dias por semana), qualifica leads, busca produtos no catalogo, envia fotos e carrosseis, transfere para humanos quando precisa, e organiza todo o pipeline de vendas num quadro visual.

**Multi-tenant** significa que varias empresas podem usar a mesma plataforma, cada uma com seus proprios dados, numeros e configuracoes — completamente isoladas entre si.

---

## 2. Que Problema Resolve

| Problema | Sem WhatsPRO | Com WhatsPRO |
|----------|-------------|-------------|
| Lead manda mensagem as 22h | Ninguem responde ate segunda-feira. Lead comprou no concorrente. | IA responde em 3 segundos, qualifica e envia produto. |
| 5 atendentes, 3 numeros WhatsApp | 5 celulares abertos, sem controle de quem respondeu quem | Todos no computador, com fila, atribuicao e historico |
| "De onde veio esse lead?" | Nao sabe se veio do Instagram, Google ou indicacao | Link rastreavel + badge de origem (Bio=verde, Campanha=azul) |
| "Quantos leads estao em negociacao?" | Planilha desatualizada | Kanban visual em tempo real com metricas |
| Vendedor esquece de fazer follow-up | Lead esfria e some | Motor de automacao envia mensagem automatica |
| "Como esta a satisfacao dos clientes?" | Ninguem pergunta | NPS automatico pos-atendimento + alerta se nota ruim |
| "Quero lancar campanha de sorteio" | Configurar link + formulario + planilha + WhatsApp manual | Wizard cria TUDO em 1 clique: link + formulario + bio + kanban |

---

## 3. Para Quem Serve

**Perfil ideal:** Empresas de 1 a 50 funcionarios que atendem clientes pelo WhatsApp e querem escalar sem contratar mais gente.

**Exemplos reais de uso:**
- **Loja de materiais de construcao** — IA vende tintas, ferramentas, eletrica pelo WhatsApp. Corrige erros de digitacao ("cooral fosco" → "Coral Fosco"). Envia carrossel com fotos e precos.
- **Clinica medica** — Formulario de anamnese no WhatsApp. Agendamento de consultas. NPS pos-atendimento.
- **Campanha politica** — Bio Link com links para redes sociais. Formulario de cadastro de apoiadores. Broadcast segmentado por cidade/bairro. IA responde sobre propostas do candidato.
- **Processo seletivo (RH)** — Funil de vaga: formulario de candidatura → IA faz triagem → kanban com colunas Candidato→Entrevista→Avaliacao→Aprovado.
- **E-commerce** — Catalogo importado por URL (scraping). IA busca produtos, envia fotos, responde precos. Carrinho via carrossel.

---

## 4. Os 3 Papeis de Usuario (Roles)

| Papel | Quem e | O que pode fazer |
|-------|--------|-----------------|
| **Super Admin** | Dono da plataforma / TI | TUDO — criar instancias, inboxes, usuarios, configurar IA, funis, automacoes, deploy |
| **Gerente** | Gerente de equipe | Gerenciar equipe nos inboxes atribuidos, ver CRM, leads, dashboard, campanhas |
| **Atendente (user)** | Quem responde no chat | Atender conversas nos inboxes atribuidos, usar templates, criar notas |

---

## 5. Analise Competitiva — WhatsPRO vs Mercado

### Concorrentes Diretos (WhatsApp-first)

| Plataforma | Preco | IA | Kanban CRM | Funis | Enquetes nativas | Perfis IA |
|------------|-------|-----|-----------|-------|-----------------|-----------|
| **WhatsPRO** | A definir | Agent 9 tools + SDR | Drag&drop | Wizard 7 tipos | WhatsApp polls | Reutilizaveis |
| WATI | $59-349/mo | Chatbot regras | nao | nao | nao | nao |
| Respond.io | $79-199/mo | Chatbot + assistente | nao | nao | nao | nao |
| Kommo | $15-45/user | Add-on pago | Basico | nao | nao | nao |
| SleekFlow | Free-$399/mo | Multi-agente | nao | nao | nao | nao |
| Manychat | $15-435/mo | Intent + AI Steps | nao | nao | nao | nao |
| Chatwoot | Free (self-host) | Sugestoes | nao | nao | nao | nao |
| Intercom | $29-139/seat + $0.99/res | Fin (gold standard) | nao | nao | nao | nao |

### 6 Diferenciais Unicos do WhatsPRO

1. **AI Agent com 9 tools callaveis** — Nao e chatbot. O agente busca produtos (fuzzy 4 camadas), move cards no Kanban, aplica tags, envia enquetes. Concorrentes tem chatbots ou intent-matching basico.

2. **Fluxo SDR completo** — Qualificacao automatica → pitch com carrossel → handoff inteligente. Nenhum concorrente tem isso nativo e integrado.

3. **Wizard de funis (7 tipos)** — 1 clique cria campanha + landing + formulario + bio link + kanban + automacao + perfil IA. Concorrentes exigem configurar cada peca separadamente em ferramentas diferentes.

4. **Enquetes nativas + NPS automatico** — Polls do WhatsApp com rastreamento de votos, auto-tags, e NPS pos-atendimento com alerta de nota ruim. Nenhum concorrente tem.

5. **Agent Profiles** — Perfis reutilizaveis de comportamento da IA por contexto (vendedor animado vs suporte calmo vs RH formal). Inspirado no Intercom Fin mas a fracao do custo.

6. **Tudo-em-um por preco SMB** — CRM + Helpdesk + IA + Campanhas + Funis + Forms + Bio Link + Catalogo + Automacao + Enquetes/NPS numa so plataforma. Concorrentes precisam de 3-4 ferramentas para igualar.

### Posicionamento

> WhatsPRO e a primeira plataforma WhatsApp-nativa que combina AI Agent com tool-calling real, CRM Kanban, e automacao completa de funis num unico produto multi-tenant — substituindo 3-4 ferramentas separadas a uma fracao do custo.

**Mercado alvo primario:** PMEs brasileiras com 1-50 atendentes que usam WhatsApp como canal principal.
**Mercado secundario:** Agencias e revendedores (multi-tenant e raro entre concorrentes).

---

## Links Relacionados

- [[wiki/visao-geral-completa]] — Indice da visao geral
- [[wiki/visao-geral-modulos]] — Os 19 modulos
- [[wiki/visao-geral-arquitetura]] — Stack, banco e fluxo de dados
- [[wiki/visao-geral-jornadas-numeros]] — Jornada do lead, numeros e roadmap
- [[wiki/visao-produto]] — Visao resumida do produto

---

*Documentado em: 2026-05-04 — Particionado de visao-geral-completa.md (regra 14 max 200 linhas)*
