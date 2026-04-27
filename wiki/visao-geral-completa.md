---
title: Visao Geral Completa — WhatsPRO
tags: [visao, projeto, modulos, jornada, numeros, stack, documentacao]
sources: [wiki/visao-produto.md, wiki/roadmap.md, wiki/modulos.md, ARCHITECTURE.md]
updated: 2026-04-27
---

# WhatsPRO — Visao Geral Completa do Projeto

> Documento consolidado com a visao completa do WhatsPRO para onboarding de novos membros, investidores, ou sessoes de contexto. Escrito para leigos com blocos tecnicos para devs.

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

## 5. Os 19 Modulos — O Que a Plataforma Faz

### 🗣️ Comunicacao (como a empresa fala com o lead)

**Helpdesk (25 sub-funcionalidades)** — A central de atendimento. Tela parecida com WhatsApp Web, mas profissional: lista de conversas a esquerda, chat no centro, perfil do lead a direita. Suporta etiquetas coloridas, notas privadas (so equipe ve), toggle IA liga/desliga, respostas rapidas com "/", acoes em massa (resolver 50 conversas de uma vez), transcricao automatica de audio, resumo IA de conversas longas, indicador de digitacao, busca global Ctrl+K, rascunhos automaticos, e finalizacao com categorizacao (venda/perdido/suporte/spam) + NPS.
→ [[wiki/casos-de-uso/helpdesk-detalhado]]

**Broadcast (12 sub-funcionalidades)** — Disparador de mensagens em massa. 4 tipos de conteudo (texto, midia, carrossel, enquete nativa). Pode enviar para grupos WhatsApp ou lista de leads individual. Importador de contatos (colar numeros, CSV, extrair de grupos, manual). Delay aleatorio anti-ban (5-10s ou 10-20s entre envios). Agendamento de envio. Progresso em tempo real com pause/resume. Templates reutilizaveis. Historico completo com filtros e reenvio.
→ [[wiki/casos-de-uso/broadcast-detalhado]]

**Formularios WhatsApp (13 sub-funcionalidades)** — Questionarios interativos DENTRO do chat. O bot faz uma pergunta, o lead responde, o bot valida e faz a proxima. 16 tipos de campo (texto, numero, email, CPF com checksum, CEP, telefone, selecao, sim/nao, escala, data, hora, arquivo, assinatura, enquete nativa). 12 templates prontos (NPS, sorteio, cadastro, orcamento, vaga, etc.). Maximo 3 tentativas por campo. Webhook externo ao completar. Lead criado automaticamente com os dados coletados.
→ [[wiki/casos-de-uso/formularios-detalhado]]

---

### 🧠 Inteligencia (como o sistema pensa e decide)

**AI Agent (15 sub-funcionalidades)** — O vendedor robo. Usa OpenAI gpt-4.1-mini como cerebro (com fallback para Gemini → Mistral → templates estaticos se cair). 9 ferramentas: buscar produto, enviar carrossel, enviar foto, transferir para humano, aplicar etiqueta, aplicar tags, mover card no Kanban, atualizar perfil do lead, enviar enquete. Fluxo SDR inteligente: termos genericos → qualifica primeiro, termos especificos → busca imediata. Modo Sombra: apos transferir para humano, IA continua "ouvindo" e extraindo dados automaticamente. Validator Agent: supervisor de qualidade que audita cada resposta (score 0-10). TTS: resposta por voz (6 vozes). Prompt Studio: admin customiza comportamento em 9 secoes. Perfis de Atendimento: pacotes reutilizaveis de comportamento por contexto.
→ [[wiki/casos-de-uso/ai-agent-detalhado]]

**Motor de Automacao (9 sub-funcionalidades)** — Regras "SE acontecer X → ENTAO fazer Y" sem IA, pura logica. 7 gatilhos (formulario concluido, enquete respondida, card movido, lead criado, conversa resolvida, tag adicionada, etiqueta aplicada). 4 condicoes (sempre, tag contem, horario comercial, funil e). 6 acoes (enviar mensagem, mover card, adicionar tag, ativar IA, transferir, enviar enquete). Regras executam em ordem, erros isolados (uma nao quebra outra).
→ [[wiki/casos-de-uso/motor-automacao-detalhado]]

**Enquetes e NPS (10 sub-funcionalidades)** — Votacoes nativas WhatsApp (botoes clicaveis, nao "1, 2, 3"). 4 canais de envio (broadcast, IA, formulario, automacao). NPS automatico pos-atendimento com delay configuravel. Guard: nao envia se lead saiu irritado. Nota ruim notifica gerentes automaticamente. Dashboard com metricas (taxa de resposta, NPS medio, distribuicao).
→ [[wiki/casos-de-uso/enquetes-nps-detalhado]]

**Agent QA Framework (8 sub-funcionalidades)** — Testes automatizados do agente IA. 30+ cenarios de teste que enviam mensagens REAIS pelo WhatsApp e verificam se a IA respondeu certo. Score composto de 4 fatores (taxa E2E 40% + Validator 30% + ferramentas 20% + latencia 10%). Fila de aprovacao humana (falso positivo vs regressao real). Deteccao automatica de regressao. Ciclo agendado (a cada 6h por padrao).
→ [[wiki/casos-de-uso/agent-qa-detalhado]]

---

### 📊 CRM & Leads (como a empresa gerencia clientes)

**Leads Database (12 sub-funcionalidades)** — Cadastro inteligente com 25+ campos. Perfil completo: nome, cidade, email, interesses, ticket medio, objecoes — a maioria preenchida automaticamente pela IA. Badge de origem colorido (verde=Bio, azul=Campanha, roxo=Formulario, laranja=Funil). Timeline de jornada visual (clique no bio → formulario → conversa → kanban). Toggle IA por lead. Clear Context (reset total). Importacao CSV. Formularios respondidos. Card do funil ativo.
→ [[wiki/casos-de-uso/leads-detalhado]]

**CRM Kanban (11 sub-funcionalidades)** — Quadro visual de vendas com colunas personalizaveis. Drag & drop para mover cards entre etapas. 5 tipos de campo customizavel (texto, moeda R$, data, selecao, entidade). Entidades reutilizaveis (tabelas de valores compartilhadas). Controle de acesso (compartilhado/privado, editor/visualizador). A IA move cards automaticamente (tool move_kanban). Finalizacao de ticket move card para coluna correspondente.
→ [[wiki/casos-de-uso/crm-kanban-detalhado]]

**Catalogo de Produtos (10 sub-funcionalidades)** — Estoque digital do agente IA. Importacao rapida por URL (cola link de qualquer loja → nome, preco, descricao, fotos preenchidos automaticamente). Importacao CSV (ate 5.000 produtos). Importacao em lote (cola URL de pagina de categoria → varre todos os produtos). Busca fuzzy que corrige erros de digitacao ("cooral" → "Coral", 78% semelhanca). Descricao gerada por IA.
→ [[wiki/casos-de-uso/catalogo-detalhado]]

---

### 📢 Campanhas & Funis (como a empresa atrai e converte leads)

**Campanhas UTM (12 sub-funcionalidades)** — Links rastreaveis + QR Code. Landing page com countdown 3s ou formulario. 6 tipos (venda, suporte, promocao, evento, reativacao, fidelizacao). Metricas: visitas, conversoes, taxa, abandono de formulario. Atribuicao automatica (conversa tagueada com campanha:NOME). Guards de seguranca (campanha inativa/expirada nao tagueia). IA recebe contexto da campanha no prompt. Clone de campanha em 1 clique.
→ [[wiki/casos-de-uso/campanhas-detalhado]]

**Bio Link (10 sub-funcionalidades)** — Pagina de links estilo Linktree integrada ao CRM. 3 templates visuais (simples/shopping/negocio). 5 tipos de botao (URL, WhatsApp, formulario, rede social, produto do catalogo). Agendamento de botoes (starts_at/ends_at). Captacao de leads com formulario inline. Analytics (views, clicks, leads, CTR). Contexto injetado na IA.
→ [[wiki/casos-de-uso/bio-link-detalhado]]

**Funis (13 sub-funcionalidades)** — O maestro que orquestra tudo. Wizard de 4 passos que cria em 1 clique: campanha + bio link + formulario + kanban. 7 tipos de funil (sorteio, captacao, venda, vaga, lancamento, evento, atendimento). Motor de automacao integrado. Instrucoes IA por funil. Perfis de atendimento reutilizaveis. Metricas de conversao. Tag funil:SLUG propagada automaticamente por 3 edge functions.
→ [[wiki/casos-de-uso/funis-detalhado]]

---

### ⚙️ Infraestrutura (como o sistema funciona por tras)

**Dashboard e Intelligence (8 sub-funcionalidades)** — Painel de KPIs: instancias online, leads hoje, funis ativos, NPS. Graficos de conversao, performance de atendentes (ranking + tempo de resposta). Intelligence: IA analisa conversas e gera insights (top motivos, produtos, objecoes, sentimento).
→ [[wiki/casos-de-uso/dashboard-detalhado]]

**Agendamentos (6 sub-funcionalidades)** — Mensagens programadas unicas ou recorrentes (diario, semanal, mensal) com delay anti-ban. Gestao: pausar, retomar, cancelar. Edge function com pg_cron.
→ [[wiki/casos-de-uso/agendamentos-detalhado]]

**Instancias WhatsApp (7 sub-funcionalidades)** — Gestao de numeros: conectar via QR Code, monitoramento de status a cada 30s, controle de acesso por usuario, detalhes com 4 abas (geral, stats, grupos, historico), delete soft/hard.
→ [[wiki/casos-de-uso/instancias-detalhado]]

**Deploy e Infraestrutura (6 sub-funcionalidades)** — Docker multi-stage (Node → nginx), CI/CD GitHub Actions (push master → build → ghcr.io), servidor Hetzner CX42 com Docker Swarm + Traefik + SSL, Portainer para gerenciamento visual. Health check endpoint. Checklist obrigatorio pre/pos deploy.
→ [[wiki/casos-de-uso/deploy-detalhado]]

---

## 6. A Jornada Completa de um Lead (Exemplo Real)

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

## 7. Numeros do Projeto

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

## 8. Stack Tecnica

```
FRONTEND
├── React 18 + TypeScript + Vite
├── Tailwind CSS + shadcn/ui (componentes)
├── TanStack React Query 5 (data fetching)
├── Recharts (graficos)
├── @dnd-kit (drag & drop Kanban)
└── react-day-picker, qrcode, sonner (utilitarios)

BACKEND
├── Supabase
│   ├── PostgreSQL (banco + RLS + pg_trgm fuzzy search)
│   ├── Auth (JWT + roles)
│   ├── Storage (arquivos, midias, fotos de produto)
│   ├── Realtime (WebSocket para chat ao vivo)
│   └── Edge Functions (31 funcoes Deno)
└── UAZAPI (API WhatsApp — proxied via Edge Functions)

INTELIGENCIA ARTIFICIAL
├── OpenAI gpt-4.1-mini (agente principal — function calling nativo)
├── Gemini 2.5 Flash (fallback LLM + TTS voz + descricao produtos)
├── Mistral Small (fallback LLM + carousel copy)
├── Groq (Whisper transcricao + Llama sumarizacao)
├── Cartesia / Murf / Speechify (fallback TTS)
└── Circuit Breaker (3 falhas → OPEN 30s → fallback automatico)

INFRAESTRUTURA
├── Docker Swarm + Traefik (proxy reverso + SSL Let's Encrypt)
├── Hetzner CX42 (servidor dedicado)
├── Portainer (gerenciamento visual de containers)
├── GitHub Actions (CI/CD — push master → build → ghcr.io)
└── Health Check (DB + MV + env → 200/503)
```

> **Tecnico:** 31 edge functions em Deno runtime. verify_jwt=false para: whatsapp-webhook, fire-outgoing-webhook, go, health-check, form-public, bio-public, ai-agent, ai-agent-debounce, transcribe-audio. CORS: `getDynamicCorsHeaders(req)` obrigatorio para browser-facing. Secret `ALLOWED_ORIGIN=https://crm.wsmart.com.br` obrigatorio. 17 shared modules em `supabase/functions/_shared/`. Rate limit: RPC atomico `check_rate_limit()`. Job queue: `claim_jobs()` FOR UPDATE SKIP LOCKED.

---

## 9. Arquitetura de Documentacao

O projeto usa 4 camadas de documentacao que se complementam:

| Camada | Arquivo | Tamanho | Quando carregar |
|--------|---------|---------|-----------------|
| **Orquestrador** | CLAUDE.md | 109 linhas (4KB) | Automatico — toda sessao |
| **Regras** | RULES.md | 189 linhas (8KB) | Antes de implementar |
| **Referencia** | ARCHITECTURE.md | 100 linhas (5KB) | Quando precisa entender stack |
| **Padroes** | PATTERNS.md | 150 linhas (9KB) | Antes de codificar |

Mais **17 wikis detalhadas** no vault Obsidian com padrao dual (didatico para leigos + blocos tecnicos para devs). Total: **187 sub-funcionalidades** documentadas.

**Fluxo de carregamento:**
```
Sessao inicia → CLAUDE.md (automatico, 4KB)
  → Protocolo: index + roadmap + erros + log + decisoes
  → Tarefa do usuario
    → Implementar? → PATTERNS.md + wiki detalhada
    → Verificar regra? → RULES.md
    → Entender stack? → ARCHITECTURE.md
```

Ver detalhes: [[wiki/arquitetura-docs]]

---

## 10. Roadmap e Status

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

## 11. Links Importantes

### Documentacao
- [[wiki/visao-produto]] — Visao resumida do produto
- [[wiki/roadmap]] — Status de todos os milestones
- [[wiki/modulos]] — Todos os 17 modulos com status
- [[wiki/arquitetura]] — Stack tecnica detalhada
- [[wiki/erros-e-licoes]] — Bugs e regras preventivas
- [[wiki/decisoes-chave]] — 10 decisoes arquiteturais
- [[wiki/arquitetura-docs]] — Como a documentacao se organiza

### Funcionalidades Detalhadas (17 wikis)
- [[wiki/casos-de-uso/helpdesk-detalhado]] (25) | [[wiki/casos-de-uso/ai-agent-detalhado]] (15) | [[wiki/casos-de-uso/leads-detalhado]] (12)
- [[wiki/casos-de-uso/crm-kanban-detalhado]] (11) | [[wiki/casos-de-uso/catalogo-detalhado]] (10) | [[wiki/casos-de-uso/broadcast-detalhado]] (12)
- [[wiki/casos-de-uso/campanhas-detalhado]] (12) | [[wiki/casos-de-uso/formularios-detalhado]] (13) | [[wiki/casos-de-uso/bio-link-detalhado]] (10)
- [[wiki/casos-de-uso/funis-detalhado]] (13) | [[wiki/casos-de-uso/motor-automacao-detalhado]] (9) | [[wiki/casos-de-uso/enquetes-nps-detalhado]] (10)
- [[wiki/casos-de-uso/agendamentos-detalhado]] (6) | [[wiki/casos-de-uso/dashboard-detalhado]] (8) | [[wiki/casos-de-uso/agent-qa-detalhado]] (8)
- [[wiki/casos-de-uso/instancias-detalhado]] (7) | [[wiki/casos-de-uso/deploy-detalhado]] (6)

### Casos de Uso
- [[wiki/casos-de-uso/guia-funcionalidades-completo]] — Guia rapido + 10 jornadas
- [[wiki/casos-de-uso/campanha-deputado-anderson]] — Case campanha politica

### Producao
- **URL:** https://crm.wsmart.com.br
- **Servidor:** Hetzner CX42 (65.108.51.109)
- **Docker:** ghcr.io/georgeazevedo2023/whatspro:latest
- **Supabase:** euljumeflwtljegknawy

---

## 12. Analise Competitiva — WhatsPRO vs Mercado

### Concorrentes Diretos (WhatsApp-first)

| Plataforma | Preco | IA | Kanban CRM | Funis | Enquetes nativas | Perfis IA |
|------------|-------|-----|-----------|-------|-----------------|-----------|
| **WhatsPRO** | A definir | ✅ Agent 9 tools + SDR | ✅ Drag&drop | ✅ Wizard 7 tipos | ✅ WhatsApp polls | ✅ Reutilizaveis |
| WATI | $59-349/mo | Chatbot regras | ❌ | ❌ | ❌ | ❌ |
| Respond.io | $79-199/mo | Chatbot + assistente | ❌ | ❌ | ❌ | ❌ |
| Kommo | $15-45/user | Add-on pago | ✅ Basico | ❌ | ❌ | ❌ |
| SleekFlow | Free-$399/mo | Multi-agente | ❌ | ❌ | ❌ | ❌ |
| Manychat | $15-435/mo | Intent + AI Steps | ❌ | ❌ | ❌ | ❌ |
| Chatwoot | Free (self-host) | Sugestoes | ❌ | ❌ | ❌ | ❌ |
| Intercom | $29-139/seat + $0.99/res | Fin (gold standard) | ❌ | ❌ | ❌ | ❌ |

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

## 13. Banco de Dados — 59 Tabelas

O sistema usa **59 tabelas** no PostgreSQL (Supabase) organizadas em 9 dominios:

### Comunicacao (8 tabelas)
| Tabela | O que guarda |
|--------|--------------|
| `instances` | Numeros WhatsApp conectados (id TEXT PK, name, token, status) |
| `contacts` | Contatos WhatsApp (phone, jid, name, profile_pic_url) |
| `conversations` | Conversas (inbox_id, contact_id, status, priority, tags[], status_ia) |
| `conversation_messages` | Mensagens individuais (direction, content, media_type, transcription) |
| `conversation_labels` | Etiquetas nas conversas (N:N) |
| `labels` | Definicao de etiquetas (name, color, inbox_id) |
| `inboxes` | Caixas de entrada (instance_id, name) |
| `message_templates` | Templates de resposta rapida ("/" commands) |

### Equipe (5 tabelas)
| Tabela | O que guarda |
|--------|--------------|
| `user_profiles` | Perfis de usuario (full_name, email, avatar_url) |
| `user_roles` | Papeis (super_admin, gerente, user) |
| `inbox_users` | Membros das inboxes (role, is_available) |
| `departments` | Departamentos dentro das inboxes |
| `department_members` | Membros dos departamentos |

### Leads & CRM (8 tabelas)
| Tabela | O que guarda |
|--------|--------------|
| `lead_profiles` | Perfil enriquecido do lead (25+ campos, contact_id FK UNIQUE) |
| `lead_databases` | Listas salvas de leads para broadcast |
| `lead_database_entries` | Contatos dentro das listas |
| `kanban_boards` | Quadros visuais (visibility, inbox_id) |
| `kanban_columns` | Colunas/etapas (name, color, position, automation) |
| `kanban_cards` | Cards (title, assigned_to, tags[], contact_id FK) |
| `kanban_card_data` | Valores dos campos customizados |
| `kanban_fields` | Definicao dos campos (type, is_primary, show_on_card) |

### Kanban Extras (2 tabelas)
| Tabela | O que guarda |
|--------|--------------|
| `kanban_entities` | Tabelas de valores reutilizaveis |
| `kanban_entity_values` | Valores dentro das entidades |
| `kanban_board_members` | Acesso direto ao board (editor/viewer) |

### AI Agent (8 tabelas)
| Tabela | O que guarda |
|--------|--------------|
| `ai_agents` | Configuracao do agente (model, tools, prompt_sections, NPS, 50+ campos) |
| `ai_agent_products` | Catalogo de produtos (title, price, images[], pg_trgm index) |
| `ai_agent_knowledge` | Base de conhecimento FAQ |
| `ai_agent_logs` | Logs de acoes da IA (event, metadata, latency_ms) |
| `ai_agent_media` | Biblioteca de midia do agente |
| `ai_debounce_queue` | Fila de agrupamento de mensagens |
| `agent_profiles` | Perfis reutilizaveis de comportamento (prompt + handoff rules) |
| `ai_agent_validations` | Scores do Validator (0-10, PASS/REWRITE/BLOCK) |

### Campanhas & Funis (8 tabelas)
| Tabela | O que guarda |
|--------|--------------|
| `utm_campaigns` | Campanhas rastreaveis (slug, status, landing_mode, ai_template) |
| `utm_visits` | Visitas rastreadas (ref_code, visitor_ip, status, metadata) |
| `bio_pages` | Paginas Bio Link (template, cores, captacao, analytics) |
| `bio_buttons` | Botoes das paginas (5 tipos, scheduling, click_count) |
| `bio_lead_captures` | Leads captados pelo Bio Link |
| `funnels` | Funis orquestradores (7 tipos, FKs para campaign/bio/form/kanban) |
| `automation_rules` | Regras gatilho→condicao→acao (7+4+6 combinacoes) |
| `follow_up_executions` | Follow-ups automaticos |

### Formularios (4 tabelas)
| Tabela | O que guarda |
|--------|--------------|
| `whatsapp_forms` | Definicao do formulario (slug, template_type, webhook_url) |
| `form_fields` | Campos do formulario (16 tipos, validacao, position) |
| `form_sessions` | Sessoes em andamento (current_field, collected_data, retries) |
| `form_submissions` | Respostas completas (data JSONB) |

### Enquetes & NPS (3 tabelas)
| Tabela | O que guarda |
|--------|--------------|
| `poll_messages` | Enquetes enviadas (question, options[], auto_tags, is_nps) |
| `poll_responses` | Votos (voter_jid, selected_options[], voted_at) |
| `notifications` | Alertas para gerentes (NPS ruim, etc.) |

### Infraestrutura (8 tabelas)
| Tabela | O que guarda |
|--------|--------------|
| `user_instance_access` | Controle de acesso a instancias |
| `instance_connection_logs` | Historico de conexao |
| `scheduled_messages` | Mensagens agendadas (unico + recorrente) |
| `scheduled_message_logs` | Historico de execucao |
| `broadcast_logs` | Historico de broadcasts |
| `shift_report_configs` + `_logs` | Config e logs de relatorios |
| `system_settings` | Configuracoes globais (API keys, schedules) |
| `rate_limit_log` | Rate limiting |
| `scrape_jobs` | Jobs de scraping de produtos |

---

## 14. Fluxo de Dados — Como Tudo se Conecta

```
LEAD CHEGA (Instagram, Google, QR Code, Bio Link)
  │
  ├─ Via Link UTM ──→ go (edge fn) ──→ utm_visits ──→ CampaignRedirect ──→ WhatsApp
  ├─ Via Bio Link ──→ bio-public ──→ bio_lead_captures ──→ WhatsApp  
  └─ Via Formulario ─→ form-public ──→ form_submissions + lead_profiles ──→ WhatsApp
  │
  │  (em TODOS os caminhos: contact + lead_profile criados, tags aplicadas)
  │
  ▼
MENSAGEM CHEGA NO WHATSAPP
  │
  ├─ UAZAPI recebe ──→ whatsapp-webhook (edge fn)
  │   ├─ Salva conversation_messages
  │   ├─ Broadcast helpdesk-realtime (WebSocket)
  │   ├─ Match UTM ref_code → vincula campanha
  │   ├─ Detecta FORM:slug → redireciona para form-bot
  │   └─ Se IA ligada → ai-agent-debounce (10s agrupamento)
  │       └─ ai-agent (cerebro IA)
  │           ├─ Carrega contexto: lead + campanha + formulario + funil + perfil
  │           ├─ Gemini function calling → decide tools
  │           ├─ search_products → catalogo (pg_trgm fuzzy)
  │           ├─ send_carousel → UAZAPI /send/carousel
  │           ├─ set_tags → conversations.tags
  │           ├─ move_kanban → kanban_cards
  │           ├─ handoff → status_ia='shadow' + handoff_message
  │           ├─ send_poll → UAZAPI /send/menu
  │           └─ Validator audita resposta (PASS/REWRITE/BLOCK)
  │
  ▼
HELPDESK (atendente humano)
  │
  ├─ Ve conversa em tempo real (Supabase Realtime)
  ├─ Aplica etiquetas, muda status, atribui agente
  ├─ Envia mensagem → uazapi-proxy → UAZAPI /send/text
  ├─ Notas privadas (direction='private_note')
  └─ Finalizar → TicketResolutionDrawer
      ├─ Categoriza: Venda/Perdido/Suporte/Spam
      ├─ Move card no Kanban
      ├─ Aplica tags resultado
      └─ Agenda NPS (se habilitado)
          └─ triggerNpsIfEnabled → delay → poll NPS
  │
  ▼
METRICAS & ANALYTICS
  ├─ Dashboard KPIs (instancias, leads, funis, NPS)
  ├─ AgentPerformance (ranking, tempo resposta)
  ├─ FunnelConversionChart (visitas→leads→conversoes)
  ├─ PollMetrics + NPS distribuicao
  └─ Intelligence (analise IA de conversas → insights)
```

---

## 15. Possibilidades Futuras (Ideias para Proximo Roadmap)

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

*Documentado em: 2026-04-10 — Visao geral consolidada do projeto WhatsPRO*
*187 sub-funcionalidades em 17 modulos, 59 tabelas, 7 milestones, versao 7.9.0*
*Expandido: analise competitiva (8 concorrentes), banco de dados (59 tabelas), fluxo de dados (diagrama completo), possibilidades futuras (15 ideias)*
