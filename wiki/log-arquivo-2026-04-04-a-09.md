---
title: Activity Log — Arquivo 2026-04-04 a 2026-04-09
tags: [log, arquivo, historico]
updated: 2026-04-11
---

# Activity Log — Arquivo (2026-04-04 a 2026-04-09)

> Entradas arquivadas do log.md. Periodo: sessoes de 2026-04-04 a 2026-04-09.
> Log ativo (sessao atual): [[log.md]]
> Arquivado em 2026-04-11 para manter log.md < 200 linhas.

Conteudo movido para este arquivo para manter o log principal enxuto.
Consulte este arquivo quando precisar de contexto historico das sessoes anteriores.

## 2026-04-09

### Doc: Visao Geral EXPANDIDA — Competitivo + 59 Tabelas + Fluxo de Dados + Futuro
- **Tipo:** Documentacao — expansao profunda da visao geral
- **Arquivo atualizado:** `wiki/visao-geral-completa.md` (4 novas secoes)
- **Novas secoes:**
  - **12. Analise Competitiva** — 8 concorrentes analisados (WATI, Respond.io, Kommo, SleekFlow, Manychat, Botpress, Chatwoot, Intercom). Tabela comparativa 10 features. 6 diferenciais unicos. Posicionamento e mercado alvo.
  - **13. Banco de Dados** — 59 tabelas mapeadas em 9 dominios (comunicacao, equipe, leads/CRM, kanban, AI agent, campanhas/funis, formularios, enquetes/NPS, infra). Cada tabela com proposito e colunas-chave.
  - **14. Fluxo de Dados** — Diagrama ASCII completo: lead chega (3 canais) → webhook → IA (9 tools) → helpdesk → finalizacao → NPS → metricas
  - **15. Possibilidades Futuras** — 15 ideias para proximo roadmap (integracoes ERP/e-commerce, mobile, multi-agente, vision, payments, white-label, API publica, etc.)
- **Pesquisa competitiva:** subagente pesquisou web com 18 fontes (pricing pages, reviews, comparativos 2026)
- **Schema mapping:** subagente mapeou 59 tabelas de todas as migrations

### Doc: Visao Geral Completa do Projeto — Consolidacao Final
- **Tipo:** Documentacao — wiki consolidada para onboarding e contexto completo
- **Arquivo criado:** `wiki/visao-geral-completa.md`
- **Conteudo:** 11 secoes: O que e (multi-tenant WhatsApp CRM), Que problema resolve (tabela comparativa 7 cenarios), Para quem serve (5 exemplos reais), 3 roles, 17 modulos detalhados em 5 categorias (comunicacao/inteligencia/CRM/campanhas/infra), Jornada completa de um lead (12 passos do Instagram ate NPS), Numeros do projeto (17 modulos, 187 sub-func, 31 edge functions, 7 milestones), Stack tecnica (diagrama completo frontend+backend+IA+infra com bloco tecnico), Arquitetura de documentacao (4 camadas + fluxo), Roadmap (7 milestones com datas), Links (17 wikis + producao)
- **Arquivos atualizados:** index.md (nova pagina no topo), visao-produto.md (numeros + link para visao completa), log.md

### Doc: COMPLETO — Ultimas 5 funcionalidades documentadas (Agendamentos + Dashboard + QA + Instancias + Deploy)
- **Tipo:** Documentacao — 5 wikis finais completam as 17 funcionalidades do WhatsPRO
- **Subagentes:** Onda 1 (3 explores paralelos: agendamentos+dashboard+QA ~30s). Onda 2 (2 explores paralelos: instancias+deploy ~20s). Onda 3 (5 writes sequenciais ~4min)
- **Arquivos criados:**
  - `wiki/casos-de-uso/agendamentos-detalhado.md` — 6 sub-func: unico/recorrente (daily/weekly/monthly + end conditions), delay anti-ban, tipos agendaveis (texto+midia, carrossel/enquete pendente), gestao status (pause/resume/cancel), edge function processamento (pg_cron + calculateNextRun)
  - `wiki/casos-de-uso/dashboard-detalhado.md` — 8 sub-func: KPIs principais (5 cards + realtime leads), graficos (6 tipos), AgentPerformanceCard (ranking atendentes), HelpdeskMetricsCharts (tempo resposta IA vs humano), Intelligence (analise IA com insights), filtros, shift reports, integracoes
  - `wiki/casos-de-uso/agent-qa-detalhado.md` — 8 sub-func: batches (3 tipos), 30+ cenarios (17 categorias), score composto (4 fatores ponderados), fila aprovacao (ReviewDrawer), regressao (detection + badge), ciclo automatizado (pg_cron + 6 cenarios), playground (galeria + live execution), historico batches
  - `wiki/casos-de-uso/instancias-detalhado.md` — 7 sub-func: criar/conectar QR, monitoramento 30s, controle acesso (user_instance_access), detalhes 4 abas, delete soft/hard, profile pic, sync dialog
  - `wiki/casos-de-uso/deploy-detalhado.md` — 6 sub-func: Docker multi-stage (node+nginx), CI/CD (GitHub Actions→GHCR), servidor (Hetzner+Swarm+Traefik+Portainer), edge functions (31 no Supabase Cloud), health check (DB+MV+env), checklist (pre/deploy/pos)
- **TOTAL PROJETO: 17/17 funcionalidades documentadas, 187 sub-funcionalidades**
- **index.md atualizado:** 5 novas paginas (total 17 wikis detalhadas)

### Doc: Motor Automacao + Enquetes/NPS — 19 Sub-Funcionalidades (padrao dual + subagentes)
- **Tipo:** Documentacao — 2 wikis dedicadas com detalhamento profundo
- **Subagentes:** Onda 1 (paralelo): 2 Explore deep (~35s). Onda 2 (sequencial): 2 Write (~3min)
- **Arquivos criados:**
  - `wiki/casos-de-uso/motor-automacao-detalhado.md` — 9 sub-func: 7 gatilhos detalhados (dados/edge function/cenario cada), 4 condicoes (logica/config/exemplos), 6 acoes (fluxo/API/DB cada), fluxo execucao (diagrama), editor visual, CRUD hooks (4), onde gatilhos sao chamados (tabela status), NPS via motor, tratamento erros (3 niveis + fail-open)
  - `wiki/casos-de-uso/enquetes-nps-detalhado.md` — 10 sub-func: PollEditor (campos/D7), 4 canais envio (broadcast/IA/form-bot/automacao), UAZAPI endpoint (/send/menu type=poll), rastreamento votos (webhook poll_update completo), auto-tags D2, renderizacao helpdesk, NPS automatico (5 campos+guard D6+delay), notificacao nota ruim (gerentes), dashboard (PollMetricsCard 4 KPIs + PollNpsChart distribuicao), config admin (PollConfigSection)
- **index.md atualizado:** 2 novas paginas

### Doc: Bio Link + Funis — 23 Sub-Funcionalidades (padrao dual + subagentes)
- **Tipo:** Documentacao — 2 wikis detalhadas com protocolo de subagentes
- **Subagentes:** Onda 1 (paralelo): 2 Explore (~30s). Onda 2 (sequencial): 2 Write (~2min)
- **Arquivos criados:**
  - `wiki/casos-de-uso/bio-link-detalhado.md` — 10 sub-funcionalidades: criacao + 3 templates visuais, 5 tipos botao (url/whatsapp/form/social/catalog) + agendamento, pagina publica, captacao leads inline, analytics (views/clicks/leads/CTR), contexto IA (bio_context), integracao funis/formularios/catalogo, gestao status
  - `wiki/casos-de-uso/funis-detalhado.md` — 13 sub-funcionalidades: wizard 4 passos (auto-cria board+form+bio+campanha), 7 tipos (tabela completa), pagina lista + KPIs, FunnelDetail (KPIs+kanban visual+5 tabs), tag funil:SLUG (3 edge functions), motor automacao (7 gatilhos+4 condicoes+6 acoes), funis agenticos (prompt+handoff por funil), perfis IA (profile_id FK), metricas agregadas, LeadFunnelCard, OriginBadge laranja, importar existentes, sidebar unificada
- **index.md atualizado:** 2 novas paginas

### Doc: Campanhas UTM + Formularios WhatsApp — 25 Sub-Funcionalidades (padrao dual + subagentes)
- **Tipo:** Documentacao — 2 wikis detalhadas criadas com protocolo de subagentes
- **Subagentes:** Onda 1 (paralelo): 2 Explore agents (campanhas + formularios, ~35s). Onda 2 (sequencial): 2 Write (campanhas → formularios, conflitam em index/log)
- **Arquivos criados:**
  - `wiki/casos-de-uso/campanhas-detalhado.md` — 12 sub-funcionalidades: criacao (15+ campos), link + QR code, landing page (countdown/form), fluxo redirect completo (9 passos), metricas (KPIs + grafico + abandono), atribuicao + guards, contexto IA (campaign_context), clone, visitas (metadata dispositivo), leads convertidos, 6 tipos campanha, gestao status
  - `wiki/casos-de-uso/formularios-detalhado.md` — 13 sub-funcionalidades: form builder (3 tabs), 16 tipos de campo (com validacoes), 12 templates prontos, trigger FORM:slug, form-bot (sessao/campo-por-campo/retry 3x/timeout 24h), validacoes detalhadas (CPF checksum, email, CEP, phone), webhook externo, auto-criacao lead (FIELD_MAP), contexto IA (form_data), "Usado em" (badges), form-public (landing), submissoes (tabela + export CSV), automacao (form_completed trigger)
- **index.md atualizado:** 2 novas paginas

### Doc: Broadcast Detalhado — 12 Sub-Funcionalidades (padrao dual)
- **Tipo:** Documentacao — wiki detalhada padrao dual (didatico + tecnico)
- **Arquivo criado:** `wiki/casos-de-uso/broadcast-detalhado.md`
- **Conteudo:** 12 sub-funcionalidades: 4 Tipos de Conteudo (texto 4096chars / midia 10MB / carrossel 2-10 cards / enquete 2-12 opcoes), 2 Modos Envio (grupos vs leads individuais), Importador de Leads (4 formas: colar/CSV/grupos/manual), Lead Databases (listas salvas reutilizaveis), Agendamento, Delay Aleatorio anti-ban (none/5-10s/10-20s), Progresso Tempo Real (pause/resume/cancel), Templates Reutilizaveis (4 tipos), Selecao de Instancia, Historico Completo (filtros + reenviar), Verificacao de Numeros, Construtor de Carrossel (editor visual + preview + compressao)
- **6 tabelas** do banco documentadas (broadcast_logs, lead_databases, lead_database_entries, message_templates, poll_messages, poll_responses)
- **Arvore de componentes** completa (Broadcaster + LeadsBroadcaster + BroadcastHistoryPage)
- **index.md atualizado**

### Vault: Integracao da reorganizacao CLAUDE.md no Obsidian
- **Tipo:** Vault — integracao completa no vault Obsidian
- **Arquivos atualizados:**
  - `index.md` — nova secao "Arquitetura de Documentacao" com tabela dos 4 arquivos + fluxo de carregamento + secao de docs detalhados reorganizada
  - `wiki/arquitetura-docs.md` — CRIADO — pagina wiki completa explicando a arquitetura (arvore, fluxo, metricas antes/depois, regra de manutencao)
  - `wiki/decisoes-chave.md` — nova decisao "Reorganizacao Documentacao (2026-04-10)" com tabela dos 3 arquivos + regra "nunca inflar CLAUDE.md"
- **Links cruzados adicionados:** index → arquitetura-docs, decisoes-chave → RULES/ARCHITECTURE/PATTERNS + arquitetura-docs

### Refactor: CLAUDE.md reorganizado como orquestrador + 3 arquivos de suporte
- **Tipo:** Refatoracao — reorganizacao da documentacao do projeto
- **Motivacao:** CLAUDE.md com 373 linhas / 40KB consumia tokens excessivos em toda sessao. Info duplicada com wiki/, regras misturadas com referencia
- **ANTES:** 1 arquivo (373 linhas / 40KB) com tudo misturado
- **DEPOIS:** 4 arquivos especializados:
  - `CLAUDE.md` — orquestrador enxuto (96 linhas / 4KB) — protocolos + regras de ouro + links
  - `RULES.md` — regras detalhadas (113 linhas / 6KB) — integridade, correcao erros, entrega, SYNC, CORS, AI Agent
  - `ARCHITECTURE.md` — referencia tecnica (87 linhas / 4KB) — stack, edge functions, deploy, modulos
  - `PATTERNS.md` — padroes de implementacao (150 linhas / 9KB) — 12 areas tematicas (UAZAPI, AI Agent, Catalogo, Validator, TTS, SDR, Tags, Helpdesk, Leads, Campanhas, DB, NPS)
- **Economia:** CLAUDE.md de 40KB → 4KB = **90% reducao** no carregamento automatico por sessao
- **Zero perda:** toda informacao do CLAUDE.md original esta em RULES/ARCHITECTURE/PATTERNS
- **Carregamento:** CLAUDE.md auto (toda sessao), demais sob demanda (quando precisa)

### Doc: CLAUDE.md atualizado com docs detalhados + regra CORS
- **Tipo:** Documentacao — atualizacao do CLAUDE.md principal
- **Alteracoes:**
  - Secao "Documentacao Detalhada por Funcionalidade" adicionada (5 paginas wiki com sub-funcionalidades)
  - Regra CORS adicionada em Edge Functions: `getDynamicCorsHeaders(req)` obrigatorio + `ALLOWED_ORIGIN` secret obrigatorio
  - Regra CORS adicionada em Important Patterns: primeiro item, com valor atual do secret
- **Motivacao:** CLAUDE.md nao refletia as 5 wikis detalhadas criadas nem o fix CORS critico

### Doc: Catalogo de Produtos Detalhado — 10 Sub-Funcionalidades (padrao dual)
- **Tipo:** Documentacao — wiki detalhada padrao dual (didatico + tecnico)
- **Arquivo criado:** `wiki/casos-de-uso/catalogo-detalhado.md`
- **Conteudo:** 10 sub-funcionalidades: Tabela de Produtos (grade visual + filtros + bulk actions), Formulario de Produto (campos + IA descricao), Import Rapido por URL (scrape-product edge function, JSON-LD + OG + meta), Import CSV (wizard 4 passos, auto-detect delimiter/columns, batch 50), Import Lote por URL (batch scrape, pagina categoria → ate 100 produtos, polling 3s), Gestao de Imagens (drag&drop, 5MB, featured star), Busca Inteligente (4 camadas: exact → word-by-word → fuzzy pg_trgm → post-filter AND), Categorias e Subcategorias, Integracao Bio Link (catalog_product_id FK), Descricao IA (Gemini 2.5 Flash)
- **Indices GIN pg_trgm** documentados (title, description, category)
- **Arvore de componentes** completa
- **index.md atualizado**

### Doc: CRM Kanban Detalhado — 11 Sub-Funcionalidades (padrao dual)
- **Tipo:** Documentacao — wiki detalhada padrao dual (didatico + tecnico)
- **Arquivo criado:** `wiki/casos-de-uso/crm-kanban-detalhado.md`
- **Conteudo:** 11 sub-funcionalidades: Pagina de Boards (lista + busca + duplicar), Quadro Kanban (colunas + drag&drop @dnd-kit), Cards (titulo/tags/responsavel/lead/campos), Campos Customizaveis (5 tipos: texto/moeda/data/selecao/entidade), Entidades Reutilizaveis, Gestao de Colunas (10 cores + automacao), Controle de Acesso (shared/private + 3 niveis + RLS), Filtros e Busca, Integracao IA (move_kanban tool), Integracao Finalizacao (TicketResolutionDrawer), Integracao Funis (7 templates de colunas)
- **8 tabelas** do banco documentadas
- **Arvore de componentes** completa mapeada
- **index.md atualizado**

### Fix: CORS bloqueava envio de mensagens do Helpdesk — uazapi-proxy + ALLOWED_ORIGIN
- **Tipo:** Bug fix critico — atendente nao conseguia enviar mensagens pelo Helpdesk
- **Sintoma:** Banner "Failed to fetch" no topo, console CORS error: `Access-Control-Allow-Origin` retornava URL do Supabase em vez de `crm.wsmart.com.br`
- **Causa raiz:** (1) `uazapi-proxy` usava `browserCorsHeaders` estatico em vez de `getDynamicCorsHeaders(req)` dinamico. (2) Secret `ALLOWED_ORIGIN` nunca foi criado no Supabase.
- **Correcao:** (1) `uazapi-proxy/index.ts` trocado para `getDynamicCorsHeaders(req)`, (2) Secret criado: `ALLOWED_ORIGIN=https://crm.wsmart.com.br`, (3) Deploy executado
- **Arquivos alterados:** `supabase/functions/uazapi-proxy/index.ts` (import + handler)
- **Deploy:** `npx supabase functions deploy uazapi-proxy` — sucesso
- **Teste:** Mensagem "oiee" enviada com sucesso pelo Helpdesk as 21:11
- **Wiki atualizada:** `wiki/erros-e-licoes.md` — regras R26+R27 adicionadas, historico documentado

### Doc: Leads Database Detalhado — 12 Sub-Funcionalidades (padrao dual)
- **Tipo:** Documentacao — wiki detalhada padrao dual (didatico + tecnico)
- **Arquivo criado:** `wiki/casos-de-uso/leads-detalhado.md`
- **Conteudo:** 12 sub-funcionalidades: Pagina de Leads (KPIs + 5 graficos), Card do Lead (25+ campos, auto-save 1s), Badge de Origem (5 cores automaticas), Timeline de Jornada (6 tipos de evento, 5 tabelas), Block IA por Lead (per-instance toggle), Clear Context (6 operacoes de reset, regra ia_cleared), Importacao CSV (50k linhas, auto-detect, sanitize), Auto-Criacao (3 edge functions, leadHelper.ts), Formularios Respondidos (LeadFormsSection), Card do Funil Ativo (LeadFunnelCard), Modal de Conversa, Integracao CRM Kanban (contact_id FK)
- **Arvore de componentes** completa (Leads.tsx + LeadDetail.tsx 2 colunas)
- **12 tabelas** do banco listadas com descricao
- **index.md atualizado:** nova pagina wiki adicionada

### Doc: Rev 2 — Camada tecnica adicionada em Helpdesk + AI Agent
- **Tipo:** Revisao — camada dual (didatico + tecnico) em cada secao
- **Arquivos atualizados:** `wiki/casos-de-uso/helpdesk-detalhado.md`, `wiki/casos-de-uso/ai-agent-detalhado.md`
- **Padrao:** Cada secao agora tem (1) explicacao didatica para leigos com cenarios e analogias + (2) bloco `> Tecnico:` com componentes, tabelas, queries, hooks, config fields, edge functions
- **Helpdesk:** 25 secoes com bloco tecnico (tabelas Supabase, campos, componentes React, hooks, Realtime channels, eventos broadcast)
- **AI Agent:** 15 secoes com bloco tecnico (edge functions, _shared modules, RPC calls, JSONB fields, circuit breaker, debounce atomico, prompt injection XML blocks, tool mechanics)
- **Motivacao:** George pediu documentacao que sirva tanto para ele (leigo) quanto para o Claude (contexto tecnico). Novo padrao aplicado a partir de agora.

### Doc: Revisao Qualidade — Helpdesk + AI Agent reescritos (padrao didatico)
- **Tipo:** Revisao — correcao de qualidade nos 2 documentos existentes
- **Motivacao:** Auto-avaliacao detectou nota 8/10 e 8.5/10 — termos tecnicos sem explicacao, cenarios fracos, falta de wikilinks
- **Correcoes aplicadas em ambos:**
  - Termos tecnicos traduzidos para leigos (localStorage = "memoria do navegador", debounce = "agrupamento", FK = removido)
  - Cenarios enriquecidos com historias completas em vez de bullets secos
  - Wikilinks cruzados adicionados (helpdesk↔ai-agent↔modulos↔decisoes-chave)
  - Introducao contextual com paragrafos didaticos (o que e, que problema resolve)
  - Analogias adicionadas (agente = "funcionario junior", profiles = "roteiros de ator")
  - Secao "Links Relacionados" no final de cada documento
  - Frontmatter: campo `sources` adicionado
- **Novo padrao:** a partir de agora, todos os docs no vault seguem o tom didatico do chat (paragrafos ricos, analogias, cenarios completos)

### Doc: AI Agent Detalhado — 15 Sub-Funcionalidades Documentadas
- **Tipo:** Documentacao — wiki detalhada para leigos
- **Arquivo criado:** `wiki/casos-de-uso/ai-agent-detalhado.md`
- **Conteudo:** 15 sub-funcionalidades do AI Agent documentadas com contexto, cenarios, componentes e tabelas:
  - Cerebro/LLM (fallback chain OpenAI→Gemini→Mistral→templates), 9 Tools detalhadas (search_products, send_carousel, send_media, handoff_to_human, assign_label, set_tags, move_kanban, update_lead_profile, send_poll), Fluxo SDR (qualificacao 4 etapas + ordem tintas + enriquecimento), Shadow Mode (extracao silenciosa + protecao nome), Validator Agent (score 0-10, PASS/REWRITE/BLOCK, 3 niveis rigor, safety net codigo), TTS/Voz (5 provedores chain + audio split + 6 vozes), Prompt Studio (9 secoes + template vars), Perfis de Atendimento (agent_profiles + prioridade + backward compat), NPS Automatico (5 campos + guard sentimento + notifica gerente), Knowledge Base, Circuit Breaker, Debounce (10s agrupamento), Saudacao Automatica (greeting guards + normalizacao), Memoria do Lead (context_long), Contexto de Canal (campanha/funil/formulario/bio)
- **Sequencia de correcao de erros** documentada (4 niveis obrigatorios)
- **20 componentes admin + 8 tabs + 17 modulos compartilhados** listados
- **index.md atualizado:** nova pagina wiki adicionada ao indice

### Doc: Helpdesk Detalhado — 25 Sub-Funcionalidades Documentadas
- **Tipo:** Documentacao — wiki detalhada para leigos
- **Arquivo criado:** `wiki/casos-de-uso/helpdesk-detalhado.md`
- **Conteudo:** 25 sub-funcionalidades do Helpdesk documentadas com contexto, cenarios, componentes e tabelas:
  - Layout 3 paineis, Etiquetas (12 cores, CRUD, filtro), Tags (chave:valor automaticas), Notas Privadas (direction=private_note, painel lateral), Toggle IA (ligada/desligada/shadow), Status (aberta/pendente/resolvida), Prioridade (alta/media/baixa), Atribuicao de Agente (auto-assign, broadcast), Departamentos, Bulk Actions (4 acoes), Respostas Rapidas ("/"), 10 tipos de midia, Transcricao de Audio, Resumo IA, Typing Indicator, Tempo de Espera, Rascunhos, TicketResolutionDrawer (4 categorias + NPS), Historico Passado, Contexto Lead, Busca Global Ctrl+K, Filtros/Ordenacao, Notificacao Sonora + Realtime, Emoji, Reply
- **Arvore de componentes completa** mapeada (HelpDesk→ConversationList→ChatPanel→ContactInfoPanel)
- **index.md atualizado:** nova pagina wiki adicionada ao indice

### Fix: UAZAPI Poll Endpoint `/send/poll` → `/send/menu`
- **Tipo:** Bug fix — endpoint UAZAPI incorreto em 6 locais
- **Causa:** Endpoint `POST /send/poll` não existe no UAZAPI. O endpoint correto é `POST /send/menu` com `type: 'poll'`. Campos renomeados: `question`→`text`, `options`→`choices`.
- **Diagnóstico:** `send/text` retorna 200 OK, `send/poll` retorna 405 Method Not Allowed (`Allow: OPTIONS, GET`). UAZAPI é cloud — o fix é 100% no nosso código.
- **Correção (6 edits em 4 arquivos):**
  - `supabase/functions/uazapi-proxy/index.ts` — pollBody + endpoint
  - `supabase/functions/ai-agent/index.ts` — tool send_poll
  - `supabase/functions/_shared/automationEngine.ts` — ação send_poll + NPS trigger
  - `supabase/functions/form-bot/index.ts` — primeiro campo poll + campos subsequentes
- **Teste ao vivo:** Poll enviada com sucesso via `/send/menu` → `messageType: "PollCreationMessage"`, 5 opções renderizadas corretamente
- **Verificação:** tsc=0 erros, vitest=427 pass (5 falhas pré-existentes em Forms)
- **Wiki atualizada:** `wiki/uazapi-polls-interativos.md` — endpoint corrigido + status de implementação atualizado

### M17 F3: Agent Profiles (Perfis de Atendimento) — Unificação Sub-Agents + Funnel Prompt
- **Tipo:** Arquitetura — nova abstração que substitui 2 conceitos sobrepostos
- **Motivação:** Sub-agents (5 tipos fixos, JSONB) e funnel_prompt (texto livre por funil) faziam a mesma coisa com UI/configuração separadas. Pesquisa validou: Intercom Fin (gold standard) usa 1 agente com Roles + Procedures.
- **Pesquisa realizada:** 10 concorrentes (Chatwoot, Manychat, Botpress, Respond.io, Intercom, Zendesk, WATI, Kommo, Landbot, Typebot) + 6 frameworks (OpenAI Agents SDK, LangGraph, CrewAI, AutoGen, Google ADK, Anthropic patterns)
- **Decisão:** Opção A aprovada — Perfis de Atendimento (tabela `agent_profiles`): pacotes reutilizáveis de prompt + handoff rules. Funis apontam via `profile_id` FK. Default profile para conversas sem funil.
- **Migration:** `20260412000001_m17_agent_profiles.sql` — tabela + RLS + índices + data migration (sub_agents→profiles + funnel_prompt→profiles)
- **Novos arquivos:** `src/hooks/useAgentProfiles.ts` (CRUD), `src/components/admin/ai-agent/ProfilesConfig.tsx` (substitui SubAgentsConfig)
- **Modificações:**
  - `src/types/funnels.ts` — `profile_id` adicionado
  - `src/components/admin/AIAgentTab.tsx` — swap SubAgentsConfig→ProfilesConfig, removido 'sub_agents' de ALLOWED_FIELDS
  - `src/pages/dashboard/FunnelDetail.tsx` — seletor de perfil na tab IA (dropdown + preview)
  - `supabase/functions/ai-agent/index.ts` — ProfileRow type, carrega profile (funnel FK ou default), unifica handoff (profile>funnel>agent), `<profile_instructions>` como seção prioritária, sub-agents deprecados com guard `if (!profileData)`
- **Backward compat:** 100% — sub_agents e funnel_prompt mantidos como fallback
- **Verificação:** tsc=0 erros, vitest=427 pass (5 falhas pré-existentes em Forms)

### Pagina "Guia de Uso" — Planejado (nao executado)
- **Tipo:** Planejamento — pagina educativa no dashboard
- **Status:** Plano aprovado, execucao adiada para proxima sessao
- **Escopo:** Pagina com 3 tabs (Modulos 13 cards + Jornadas 5 fluxos + Metricas 4 secoes)
- **Caso:** Eletropiso (home center) com 3 exemplos praticos por modulo
- **Arquivos:** GuiaDeUso.tsx (novo) + App.tsx (rota) + Sidebar.tsx (menu item)
- **Plano completo:** `.claude/plans/ancient-watching-wirth.md`

### Fixes de Deploy + CI
- **fix:** Navigator LockManager timeout → `lock: no-op` no Supabase auth client (commit 264a1b6)
- **fix:** Arquivos nao commitados de sessoes anteriores (useAutomationRules.ts + 6 testes) (commit a8b82d4)
- **fix:** BioLinksPage.tsx useAuthSession import + pending changes (commit 26458ed)
- **CI:** Build passando apos 3 fixes (imagem Docker pushada ao ghcr.io)

### M17 F5: NPS + Metricas — Fase Final M17 Completa
- **Tipo:** Nova feature — NPS automatico + dashboard metricas + admin config
- **Migration:** `20260414000001_m17_f5_nps.sql` — 5 campos NPS em ai_agents, is_nps em poll_messages, tabela notifications
- **Novos arquivos:**
  - `src/hooks/usePollMetrics.ts` — hook React Query (totalPolls, totalVotes, responseRate, npsAvg, npsDistribution)
  - `src/components/admin/ai-agent/PollConfigSection.tsx` — config NPS (toggle, delay, pergunta, opcoes, notificacao)
  - `src/components/dashboard/PollMetricsCard.tsx` — 4 KPIs (enquetes, votos, taxa, NPS)
  - `src/components/dashboard/PollNpsChart.tsx` — distribuicao NPS com barras coloridas
- **Modificacoes:**
  - `AIAgentTab.tsx` — import PollConfigSection + 5 campos em ALLOWED_FIELDS + render na tab Metricas
  - `DashboardHome.tsx` — PollMetricsCard + PollNpsChart integrados com filtro de instancia e periodo
  - `TicketResolutionDrawer.tsx` — NPS trigger via job_queue (fire-and-forget apos resolver)
  - `automationEngine.ts` — triggerNpsIfEnabled() exportada (delay via setTimeout, guard sentimento:negativo)
  - `whatsapp-webhook/index.ts` — NPS bad note → notify managers (poll_update handler expandido)
- **Verificacao:** tsc=0 erros, vitest=427 pass, migration aplicada, types.ts 3935 linhas

### M17 F4: Enquetes/Polls (WhatsApp Nativo) — Feature Completa
- **Tipo:** Nova feature — 12 arquivos afetados, cross-module (8 módulos)
- **Migration:** `20260413000001_m17_f4_polls.sql` — poll_messages + poll_responses + RLS + indices
- **Novos arquivos:** `src/components/broadcast/PollEditor.tsx`
- **Backend:**
  - `uazapi-proxy/index.ts` — nova action `send-poll` (valida 2-12 opções, max 255 chars question)
  - `whatsapp-webhook/index.ts` — handler `poll_update` (upsert responses, auto-tags D2, automation trigger, AI debounce)
  - `ai-agent/index.ts` — tool `send_poll` (9a tool, sideEffectTools, broadcastEvent), toolDef com D7
  - `form-bot/index.ts` — field_type `poll` (validate + normalize + envio nativo via /send/poll + fallback texto)
  - `automationEngine.ts` — `send_poll` action implementada (substituiu placeholder), image_url D1, poll_messages persist
- **Frontend:**
  - `BroadcastMessageForm.tsx` — 4a tab "Enquete" (grid-cols-4), PollEditor, sendPoll dispatch
  - `broadcastSender.ts` — ActiveTab 'poll', sendPollToNumber (com D1 image delay)
  - `useBroadcastSend.ts` — sendPoll method com progress tracking
  - `MessageBubble.tsx` — media_type 'poll' rendering (BarChart3 icon, options cards)
  - `AutomationRuleEditor.tsx` — send_poll habilitado, campos question/options/selectable_count
- **Fix:** instances.id é TEXT (não UUID) — corrigido na migration
- **Verificação:** tsc=0 erros, vitest=427 pass, migration aplicada
- **D1:** Imagem antes da enquete = checkbox + delay 1.5s
- **D7:** NUNCA opções numeradas — clean names only

### Auditoria M17 F3: 3 agentes em paralelo
- **Backend audit:** LIMPO — profile loading, handoff unification, prompt injection, sub-agent guard — todos corretos
- **Frontend audit:** 1 bug encontrado — FunnelDetail.tsx faltava useEffect para sync estado local quando funil muda (corrigido)
- **Data audit:** 4 perfis migrados (1 default SDR + 3), RLS ok, 3 policies, partial unique index funcional
- **Fix:** Adicionado useEffect([funnel?.id]) para sync localProfileId/localPrompt/localHandoffRule/localHandoffMaxMsgs
- **Fix:** Removidos `as any` casts do useAgentProfiles.ts (types.ts regenerado com agent_profiles)
- **Migration aplicada:** Supabase remoto, types.ts regenerado (3775 linhas)

## 2026-04-08

### M17 F1+F2 Frontend: Motor de Automação + Funis Agênticos (Agente 1)
- **Tipo:** Nova feature — frontend
- **Novos arquivos:** `src/hooks/useAutomationRules.ts`, `src/components/funnels/AutomationRuleEditor.tsx`
- **Modificações:** `src/types/funnels.ts` (M17 F2 campos), `src/pages/dashboard/FunnelDetail.tsx` (tabs Automações+IA)
- **FunnelDetail:** Agora tem 5 tabs: Canais, Formulario, Automações, Agente IA, Configuracao
- **AutomationRuleEditor:** Dialog Gatilho>Condição>Ação com sub-campos condicionais por tipo
- **useAutomationRules:** CRUD completo (list/create/update/delete) com queryKey ['automation_rules', funnelId]

### M17 F1 Backend: Migration aplicada + types.ts regenerado + form-bot integrado (Agente 2)
- **Tipo:** Backend/DB
- **Migration:** 20260411000001_m17_automation.sql aplicada no Supabase
- **types.ts:** Regenerado com novos tipos (automation_rules, funnels campos M17)
- **form-bot:** executeAutomationRules chamado após form completion (trigger: form_completed)
- **ai-agent:** F2 já implementado (funnel_prompt, handoff_rule, funnel_instructions)

### M17 F1 Auditoria + Testes (Agente 3)
- **Tipo:** Qualidade
- **automationEngine.ts:** Auditado — 7 triggers, 4 conditions, 5 actions, error handling OK
- **Testes:** `supabase/functions/_shared/automationEngine.test.ts` criado — 6 casos, 6/6 passando (vitest)
- **Integração futura F3:** form-public + whatsapp-webhook identificados como call points pendentes
- **Roadmap:** F1 e F2 atualizados de "📋 Planejado" para "🔄 Em execução"

### M17 F1+F2 Backend: Motor de Automação + Funis Agênticos (Agente 1)
- **Tipo:** Nova feature — backend puro
- **Migration criada:** `20260411000001_m17_automation.sql`
  - Tabela `automation_rules` (Gatilho > Condição > Ação): id, funnel_id FK, name, enabled, position, trigger_type, trigger_config JSONB, condition_type, condition_config JSONB, action_type, action_config JSONB
  - 3 índices: funnel_id, trigger_type, (funnel_id+enabled)
  - RLS: super_admin full access, inbox_members read via funnel→instance, service_role full
  - Trigger updated_at automático
  - Colunas M17 F2 em `funnels`: funnel_prompt TEXT, handoff_rule TEXT DEFAULT 'so_se_pedir', handoff_department_id UUID FK, handoff_max_messages INT DEFAULT 8
- **Novo arquivo:** `supabase/functions/_shared/automationEngine.ts`
  - `executeAutomationRules(funnelId, triggerType, triggerData, conversationId, supabase)` → AutomationExecutionLog[]
  - `matchesTriggerConfig()`: verifica constraints de card_moved (column_id, from_column_id), tag_added (tag, tag_prefix), label_applied, poll_answered (poll_id, option), form_completed
  - `evaluateCondition()`: always | tag_contains (partial match) | funnel_is | business_hours (customizável: start_hour, end_hour, work_days, inside)
  - `executeAction()`: send_message (UAZAPI via env + persist DB), move_card (via contact_id), add_tag (key replace semântica), activate_ai, handoff (SHADOW + dept), send_poll (placeholder F4)
- **Modificações em ai-agent/index.ts:**
  - FunnelRow type expandido com M17 F2 campos (funnel_prompt, handoff_rule, handoff_department_id, handoff_max_messages)
  - SELECT query do funil expandida para incluir os 4 campos novos
  - Lógica handoff_rule implementada: 'nunca'=Infinity, 'apos_n_msgs'=handoff_max_messages, 'so_se_pedir'=comportamento default
  - handoff_department_id do funil aplicado no update da conversa ao fazer handoff automático
  - funnel_instructions section: funnelData.funnel_prompt injetado no system prompt como `<funnel_instructions>` (prioridade máxima — appendado após o name rule)
  - funnelInstructionsSection adicionado ao systemPrompt como última seção
- **TypeScript:** npx tsc --noEmit → 0 erros
- **Migration:** Criada em supabase/migrations/, pendente aplicação via `supabase db push`
- **Arquivos:** `supabase/migrations/20260411000001_m17_automation.sql`, `supabase/functions/_shared/automationEngine.ts`, `supabase/functions/ai-agent/index.ts`

### Fix: CORS dinâmico + Dialog "Novo Membro" com vinculação
- **Tipo:** Bug fix + melhoria de UX
- **Bug:** "Failed to fetch" ao criar membro — edge functions admin-* tinham `verify_jwt=true` (gateway bloqueava sem CORS headers) e CORS estático não aceitava localhost
- **Fix CORS:** Novo `getDynamicCorsHeaders(req)` em `_shared/cors.ts` — checa Origin vs whitelist + aceita localhost automaticamente
- **Fix verify_jwt:** admin-create-user, admin-update-user, admin-delete-user agora `verify_jwt=false` (auth é feita internamente)
- **Deploy:** v10 das 3 funções admin
- **Melhoria UX:** Dialog "Novo Membro" agora inclui seleção de Instância (1), Caixa de Entrada (1, filtrada por instância), Departamentos (N, filtrados por caixa). Vinculação automática após criação.
- **Arquivos:** `_shared/cors.ts`, `admin-create-user/index.ts`, `admin-update-user/index.ts`, `admin-delete-user/index.ts`, `src/components/admin/UsersTab.tsx`, `supabase/config.toml`

### Decisão D9 — Motor + Agêntico ambos dentro do Funil
- **D9:** Opção A aprovada — Motor de Automação (reflexos) e Funis Agênticos (instintos) ficam AMBOS dentro do FunnelDetail
- **Analogia corpo humano:** Cérebro (AI Agent) = config global 1x. Esqueleto (Funil) = config por contexto Nx. Reflexos e instintos mudam por situação, não o cérebro.
- **FunnelDetail ganha 5 tabs:** Canais, Formulário, Automações (QUANDO/SE/ENTÃO), IA (roteiro + transbordo), Config
- **AI Agent page** = só config global (personalidade, catálogo, regras gerais, voz, validator)

### Reestruturação M17: 3 Sprints → 5 Fases com 4 Pilares
- **Tipo:** Reorganização de plano
- **Motivação:** Usuário identificou que M17 não é "só enquetes" — é evolução de plataforma inteira com Motor de Automação, Funis Agênticos, Tags e Enquetes
- **Nova ordem:** F1 Motor → F2 Funis Agênticos → F3 Tags & Integração → F4 Enquetes → F5 NPS + Métricas
- **Lógica:** "Constrói a estrada primeiro, depois qualquer veículo roda nela" — motor é base, enquete é só uma ação
- **Impacto:** Seção 5 do plano reescrita com 52 tasks em 5 fases, seção 8 (arquivos) atualizada (~22 novos + ~14 modificados), roadmap atualizado
- **Vantagem:** F1-F3 NÃO dependem do teste UAZAPI — pode começar imediatamente

### Decisão D8 — Motor de Automação MVP (Gatilho > Condição > Ação)
- **D8:** Opção B aprovada — motor de automação simplificado dentro dos funis
- **UI:** Tab "Automações" dentro do FunnelDetail (não é página separada no menu)
- **7 gatilhos:** card movido, enquete respondida, formulário completo, lead criado, conversa resolvida, **tag adicionada**, **etiqueta aplicada** (últimos 2 adicionados a pedido do usuário)
- **4 condições:** sempre, tag contém, funil é, horário comercial
- **5 ações:** enviar enquete, enviar mensagem, mover card, adicionar tag, ativar IA/transbordo
- **Arquitetura:** Tabela `automation_rules` + `automationEngine.ts` shared + integração em webhook/ai-agent/form-bot/kanban
- **Substituiu:** A ideia de "poll fixo por etapa do Kanban" — agora tudo é regra configurável
- **Atualizado:** plano-enquetes-polls.md (D8 + seção 2.4 reescrita + schema 4.4 + tasks 3.10-3.16), roadmap, decisoes-chave

### Decisão D7 — Campo Enquete no Formulário WhatsApp
- **D7:** Opção A aprovada — novo tipo "enquete" nos formulários pelo WhatsApp. Bot envia enquete nativa (botões clicáveis) em vez de texto.
- **Regra absoluta:** NUNCA enviar opções numeradas ("1-Casa, 2-Apto"). Sempre listar nomes limpos (Casa, Apartamento). Vale para enquete E para campos select por texto.

### Decisão D6 — NPS Automático
- **D6A:** Enviar após resolver ticket, delay configurável (5min default). NÃO envia se handoff por frustração.
- **D6B:** Escala 5 opções com estrelas (Excelente/Bom/Regular/Ruim/Péssimo)
- **D6C:** Nota ruim (1-2) = registra + notifica gerente

### Decisão D5 — Transbordo com Vendedor via Enquete
- **D5A:** Nomes vêm do departamento (Dept > Vendas > atendentes). Sem especialidade, só nome.
- **D5B:** Fallback com timeout (Opção 2) — se vendedor não responde em X min, redistribui automaticamente
- **D5C:** Opção "mais disponível" sempre presente (round-robin)
- **Regra:** Só enquete se 2+ vendedores no departamento. Se 1, handoff direto por texto.

### Plano de Implementação — Enquetes/Polls (Feature Completa) — v3 (em discussão)
- **Tipo:** Planejamento de feature + sessão de decisões com o usuário
- **Arquivo:** `wiki/plano-enquetes-polls.md` (v3 — com decisões aprovadas D1-D4)
- **Escopo expandido:** Polls + roteamento de fluxos (activateFunnel) + prompt por funil
- **4 decisões aprovadas:**
  - D1: Imagem antes da enquete = checkbox no broadcast (admin decide caso a caso)
  - D2: Tags automáticas = IA gera tag automaticamente + admin pode editar
  - D3: Roteamento de fluxos = função activateFunnel() centralizada + ActionSelector reutilizável em enquete/broadcast/bio/campanha
  - D4: Prompt por funil = admin escreve roteiro passo-a-passo no FunnelDetail, IA segue à risca com prioridade sobre prompt geral
- **Descobertas técnicas:**
  - Poll+imagem NÃO suportado (protocolo WhatsApp). Workaround: send/media + 1.5s + send/poll
  - 90% das peças de roteamento já existem (mergeTags, kanban, form-bot, funnel_context). Falta centralizar em activateFunnel()
  - Novo campo `funnel_prompt` TEXT na tabela funnels + `handoff_rule` (so_se_pedir/apos_n_msgs/nunca)
- **Status:** Em discussão — tópicos restantes: transbordo vendedor, NPS, form-bot poll, sprints ajustados

### Documentação Consolidada — Guia + Casos de Uso + index.md
- **Arquivos criados/atualizados:**
  - `wiki/casos-de-uso/guia-funcionalidades-completo.md` — 13 funcionalidades + 10 integrados + 10 jornadas
  - `wiki/casos-de-uso/campanha-deputado-anderson.md` — Case campanha política PE
  - `index.md` — 4 novas páginas wiki adicionadas

### Documentação — UAZAPI Mensagens Interativas (Poll, QuickReply, List)
- **Tipo:** Documentação de API + planejamento de feature
- **Arquivo criado:** `wiki/uazapi-polls-interativos.md`
- **Contexto:** Pesquisa de endpoint `POST /send/poll` da UAZAPI para implementação futura
- **Status:** Endpoint documentado, NÃO implementado no proxy ainda
- **Endpoints cobertos:** send/poll, send/quickreply, send/list, send/location, send/pix
- **Plano documentado:** 4 fases (migration + proxy + AI Agent tool + broadcast + dashboard)
- **Casos de uso mapeados:** qualificação por poll, pesquisa de interesse, NPS, campanha política

### Documentação — Guia Completo de Funcionalidades + Casos de Uso
- **Tipo:** Documentação consolidada de sessão
- **Arquivo criado:** `wiki/casos-de-uso/guia-funcionalidades-completo.md`
- **Conteúdo:** 13 funcionalidades documentadas, 10 exemplos integrados, 10 jornadas completas, resumo campanha política

### Consulta + Documentação — Caso de Uso: Campanha Deputado Anderson (PE)
- **Tipo:** Consulta estratégica + documentação de caso de uso
- **Arquivo criado:** `wiki/casos-de-uso/campanha-deputado-anderson.md`
- **Contexto:** Candidato a deputado estadual PE (causa animal), precisa captar eleitores via Instagram, gerir voluntários, disparos segmentados por cidade/bairro de Caruaru
- **Funcionalidades mapeadas:** Campanhas UTM, Bio Link, Funis, AI Agent (TTS+send_media), Broadcast, Leads Database, CRM Kanban, Tags, Formulários, Agendamentos
- **Funcionalidades NÃO utilizadas:** Catálogo de produtos, Quick Product Import, Fuzzy search, Agent QA Framework
- **10 cenários documentados** cobrindo jornada completa do eleitor



---

## 2026-04-07

### M16 — Funis: Fusao Total (Campanhas + Bio Link + Formularios) — Fases 1-4
- **Tipo:** Feature — novo modulo (4 fases, 15 arquivos novos/modificados)
- **TypeScript:** 0 erros | **Testes:** 421 passed (5 pre-existentes)
- **Build:** OK (6.97s)

| Fase | Arquivos | Mudancas |
|------|----------|---------|
| **F1: Fundacao** | migration, types, hooks, FunnelsPage, Sidebar, App.tsx, ai-agent VALID_KEYS | Tabela `funnels` com FK para utm_campaigns/bio_pages/whatsapp_forms/kanban_boards. Sidebar unificada (3→1 item). Tag `funil` adicionada ao VALID_KEYS. |
| **F2: Wizard** | FunnelWizard, useCreateFunnel, funnelTemplates | Wizard 4 passos (Tipo→Detalhes→Canais→Resumo) auto-cria Board+Columns+Form+Fields+BioPage+Buttons+Campaign+Funnel em 1 clique. 7 tipos com defaults. |
| **F3: AI Agent + Handoff** | ai-agent (context+handoff), form-public, bio-public, whatsapp-webhook | `<funnel_context>` injection, handoff priority funil>agente, tag `funil:SLUG` propagada por 3 edge functions, max_messages_before_handoff do funil. |
| **F4: Detail + Metricas + Origin** | FunnelDetail, useFunnelMetrics, LeadProfileSection, App.tsx | Pagina detalhe com KPIs+Kanban visual+3 tabs. Metricas agregadas (campaign+bio+form). OriginBadge suporta 'funil' (laranja). |

**Novos arquivos:**
- `supabase/migrations/20260410000001_m16_funnels.sql`
- `src/types/funnels.ts`
- `src/hooks/useFunnels.ts`
- `src/hooks/useCreateFunnel.ts`
- `src/hooks/useFunnelMetrics.ts`
- `src/data/funnelTemplates.ts`
- `src/pages/dashboard/FunnelsPage.tsx`
- `src/pages/dashboard/FunnelWizard.tsx`
- `src/pages/dashboard/FunnelDetail.tsx`

**Arquivos modificados:**
- `src/components/dashboard/Sidebar.tsx` — 3 items → 1 "Funis"
- `src/App.tsx` — 3 rotas novas + 2 lazy imports
- `supabase/functions/ai-agent/index.ts` — VALID_KEYS, early funnelData load, `<funnel_context>`, handoff priority
- `supabase/functions/form-public/index.ts` — lookup funil + tag
- `supabase/functions/bio-public/index.ts` — lookup funil + tag
- `supabase/functions/whatsapp-webhook/index.ts` — lookup funil + tag
- `src/components/leads/LeadProfileSection.tsx` — OriginBadge funil

**Fase 5 (Import + Polish):**
- `src/components/funnels/ImportExistingDialog.tsx` (NOVO) — Dialog com selects de campanhas/bios/forms/boards existentes, vincula a novo funil
- `src/pages/dashboard/FunnelsPage.tsx` — Botao "Importar existente" no header
- Rotas antigas (/dashboard/campaigns, /dashboard/bio-links, /dashboard/forms) mantidas como sub-items do menu "Funis"

**M16 completo — 5 fases entregues.** Zero regressao em todos os 5 checkpoints (TS 0 erros, 421 testes, Build OK).

**Polish (5 itens):**
- `DashboardHome.tsx` — KPI card "Funis Ativos" (5a coluna no grid) + FunnelConversionChart (barras horizontais)
- `useLeadJourney.ts` — novo tipo `funnel_entry`, detecta tag `funil:SLUG` nas conversas → busca funil
- `LeadJourneyTimeline.tsx` — evento laranja (Target icon, bg-orange-500)
- `LeadFunnelCard.tsx` (NOVO) — card que mostra funil ativo do lead + etapa kanban + dias na etapa
- `LeadDetail.tsx` — integra LeadFunnelCard antes do JourneyTimeline
- `IntelligenceFilters.tsx` — select "Funil" (opcional, props novas)
- `Intelligence.tsx` — state `selectedFunnel` + lista de funis passada pro filtro
- `FunnelConversionChart.tsx` (NOVO) — grafico agregado Visitas→Capturas→Leads→Conversoes

**M16 100% completo — 5 fases + 5 polish.** Zero regressao. TS 0 erros, 421 testes, Build OK.

---

## 2026-04-07

### M15 — Integração Bio Link + Jornada do Lead (F1+F2)
- **Tipo:** Feature — milestone completo (2 fases, 13 tasks)
- **Commit:** 1ebd77c
- **TypeScript:** 0 erros | **Testes:** 421 passed (5 pré-existentes)

| Fase | Arquivos | Mudanças |
|------|----------|---------|
| **F1: Foundation** | `leadHelper.ts` (novo), `bio-public`, `form-public`, `form-bot`, `ai-agent`, `BioPage.tsx`, `CampaignRedirect.tsx`, migration SQL | Bio Link cria leads reais (contact+lead_profile), tags `origem:bio`+`bio_page:SLUG`, `<bio_context>` no AI Agent, shared FIELD_MAP (elimina duplicação) |
| **F2: Admin UX** | `LeadProfileSection.tsx`, `LeadJourneyTimeline.tsx` (novo), `useLeadJourney.ts` (novo), `LeadDetail.tsx`, `FormsTab.tsx`, `CampaignDetail.tsx`, `useBioPages.ts` | Badge de origem colorido, timeline de jornada do lead, "Usado em" nos forms, leads convertidos no campaign detail |

**Decisões para futuro (F3-F5):**
- F3: Hub de Funis com wizard simples (4 passos)
- F4: 4 templates (Sorteio, Vaga, Lançamento, Captação)
- F5: Dashboard de conversão por etapa

---

## 2026-04-06 (sessão atual)

### M14 Fase 3 — Bio Link: captação de leads, contexto AI Agent, analytics
- **Tipo:** Feature — Fase 3 do módulo Bio Link
- **Commit:** 0b44f50
- **Deploy:** Edge function `bio-public` re-deployada (nova action 'capture')
- **TypeScript:** 0 erros | **Migration:** bio_lead_captures + 6 novos campos em bio_pages

| Arquivo | Mudanças |
|---|---|
| `supabase/migrations/*_m14_bio_fase3.sql` | Tabela `bio_lead_captures` + `capture_enabled/fields/title/button_label` + `ai_context_enabled/template` em bio_pages |
| `supabase/functions/bio-public/index.ts` | Nova action `'capture'` no POST → INSERT bio_lead_captures (backward compat com `button_id` direto) |
| `src/types/bio.ts` | Novos campos em BioPage, nova interface BioLeadCapture, CreateBioPageInput atualizado |
| `src/components/bio/BioLeadCaptureModal.tsx` | Modal Dialog com campos dinâmicos (name/phone/email), título e label configuráveis |
| `src/pages/BioPage.tsx` | Intercepta cliques (exceto social) → modal captação → POST capture → ação original; injeção de contexto AI no pre_message whatsapp/catalog |
| `src/components/bio/BioLinkEditor.tsx` | Aba Aparência: seção "Captação de Leads" (toggle + campos + título + label) + "Contexto AI Agent" (toggle + textarea template) |
| `src/hooks/useBioPages.ts` | Hooks: `useBioLeadCaptures(pageId)` + `useBioAnalytics(instanceId)` |
| `src/pages/dashboard/BioLinksPage.tsx` | Tabs "Páginas" e "Analytics" (3 KPI cards + tabela CTR por página) |
| `wiki/roadmap.md` | M14 F3 marcada como shipped |
| `PRD.md` | Versão 7.2.0 + changelog M14 F1+F2 |

**Funcionalidades entregues:**
- Formulário inline configurável: quais campos mostrar (name/phone/email), título e label do botão — tudo pelo admin
- Contexto AI Agent: template com `{page_title}` e `{button_label}` injetado no pre_message do WhatsApp
- Analytics por instância: total views + cliques + leads + CTR por página em dashboard dedicado

---

### M14 Fase 2 — Bio Link: agendamento, tipo catalog, visual (capa, fonte, espaçamento)
- **Tipo:** Feature — Fase 2 do módulo Bio Link
- **TypeScript:** 0 erros | **Testes:** 421 passed | 5 falhas pré-existentes não relacionadas

| Arquivo | Mudanças |
|---|---|
| `src/hooks/useBioPages.ts` | Hook `useCatalogProductsForBio(instanceId)` — busca produtos via ai_agents → ai_agent_products |
| `src/components/bio/BioButtonEditor.tsx` | Novo tipo `catalog` + seletor de produto + campos starts_at/ends_at (agendamento) + prop instanceId |
| `src/components/bio/BioLinkEditor.tsx` | Estados coverUrl/fontFamily/buttonSpacing + upload de capa + 3 seções visuais + passa instanceId |
| `src/pages/BioPage.tsx` | `CoverImage`, `CatalogButton`, filtro `isButtonVisible` (agendamento), FONT_FAMILY_CLASS/BUTTON_SPACING_GAP nos 3 templates |
| `src/components/bio/BioLinkPreview.tsx` | Capa no topo, font_family, button_spacing, preview catalog button |

**Funcionalidades entregues:**
- Agendamento por botão: `starts_at` / `ends_at` — botões sumem automaticamente fora do período
- Tipo `catalog`: seleciona produto do catálogo `ai_agent_products`, exibe imagem 40×40 + nome + preço, click abre WhatsApp com nome do produto pré-preenchido
- Capa/banner: imagem 3:1 exibida acima do avatar em todos os templates
- Fonte: Padrão (sans) / Serifada / Mono aplicada em todo o template
- Espaçamento entre botões: Compacto (gap-2) / Normal (gap-3) / Espaçado (gap-5)

---

## 2026-04-08

### M14 Fase 1 — Bio Link (Linktree-style) implementado
- **Tipo:** Nova feature — módulo completo
- **Commit:** 5fbf92f
- **Deploy:** Edge function `bio-public` deployada no Supabase
- **TypeScript:** 0 erros | **Testes:** 421 passed (5 pré-existentes)

| Arquivo | Descrição |
|---|---|
| `supabase/migrations/20260408000001_m14_bio_pages.sql` | Tabelas `bio_pages` + `bio_buttons`, RLS, RPCs `increment_bio_view/click` |
| `supabase/functions/bio-public/index.ts` | Edge function pública GET (slug→page+buttons) + POST (click tracking) |
| `src/types/bio.ts` | Tipos TypeScript completos: BioPage, BioButton, templates, SOCIAL_LABELS |
| `src/hooks/useBioPages.ts` | CRUD hooks: list, create, update, delete pages + buttons + reorder |
| `src/lib/uploadBioImage.ts` | Upload para bucket `bio-images` |
| `src/pages/BioPage.tsx` | Página pública `/bio/:slug` com 3 templates (simples, shopping, negocio) |
| `src/components/bio/BioLinkCard.tsx` | Card na lista admin com borda-esquerda colorida |
| `src/components/bio/BioLinkEditor.tsx` | Sheet 3 abas: Aparência / Botões / Preview |
| `src/components/bio/BioButtonEditor.tsx` | Editor de botão (4 tipos × 3 layouts + upload de imagens) |
| `src/components/bio/BioLinkPreview.tsx` | Preview ao vivo da página dentro do editor |
| `src/components/bio/TemplateSelector.tsx` | Grid de 3 templates com mini-preview visual |
| `src/pages/dashboard/BioLinksPage.tsx` | Página admin `/dashboard/bio-links` |
| `src/App.tsx` | Rotas: `/bio/:slug` (pública) + `/dashboard/bio-links` (admin) |
| `src/components/dashboard/Sidebar.tsx` | Item "Bio Link" entre Campanhas e Agente IA |

**Funcionalidades entregues:**
- 3 templates visuais: `simples` (fundo escuro, botões verdes), `shopping` (outline pill, featured 16:9, social icons — inspirado no Shopping Recife), `negocio` (gradiente, soft buttons, avatar quadrado)
- 4 tipos de botão: URL, WhatsApp (com pré-mensagem + tag de conversa), Formulário WhatsPRO, Social Icon
- 3 layouts de botão: stack (pill padrão), featured (imagem 16:9 + chin), social_icon (linha de ícones)
- Analytics: view_count por página + click_count por botão (RPCs atômicas)
- Upload de imagens: avatar, thumbnail (stack), imagem destaque (featured) — bucket `bio-images`
- Página pública sem autenticação + 404 gracioso

---

## 2026-04-06 (sessão atual)

### Fix 10 Bugs — TypeScript any, Form Sessions, Logger, Pagination, Reconnect
- **Tipo:** Bug fixes multi-área
- **Commit:** 14a2280
- **TypeScript:** 0 erros após todos os fixes
- **Testes:** 421 passed | 5 falhas pré-existentes (useForms.test + FormBuilder.test) — não relacionadas

| # | Arquivo | Fix |
|---|---------|-----|
| 1+6 | `src/hooks/useCampaigns.ts` | Remove 11 casts `(supabase as any)` + `.limit(200)` em useCampaignsList |
| 2 | `src/hooks/useSendFile.ts` | `insertedMsg?: any` → `Tables<'conversation_messages'>` |
| 3 | `src/components/leads/types.ts` | `lead_profile: any` → `Tables<'lead_profiles'> \| null`; `conversations: any[]` → `Array<{id:string}>` |
| 4 | `supabase/functions/form-bot/index.ts` | `retries: 0` no insert da sessão (causa raiz do NaN) |
| 5 | `supabase/functions/form-public/index.ts` | Phone validation: `length < 10 \|\| > 15` (E.164) |
| 7 | `supabase/functions/_shared/circuitBreaker.ts` | `console.log/warn/error` → `createLogger` estruturado |
| 7 | `supabase/functions/_shared/carousel.ts` | `console.log` → `log.info/warn` estruturado |
| 8 | `supabase/functions/form-bot/index.ts` | TTL 24h — sessões `in_progress` antigas marcadas como `abandoned` |
| 9 | `src/components/admin/forms/SubmissionsTable.tsx` + `src/hooks/useFormSubmissions.ts` | Paginação page/pageSize + botões Anterior/Próxima |
| 10 | `src/components/helpdesk/ChatPanel.tsx` | Reconnect automático 5s após disconnect + badge WifiOff |

---

## 2026-04-07 (sessão 3)

### Sprint 4 Mobile-First — Polish: Breadcrumbs, GlobalSearch, Dashboard, CampaignForm, LeadsPage
- **Tipo:** UX/UI — mobile responsiveness polish
- **Commits:** 5c32163 (Agente A), 193c888 (Agente B)
- **Agente A — 4 arquivos:**
  - `src/components/shared/Breadcrumbs.tsx` — `flex-wrap` no container + `truncate max-w-[120px] sm:max-w-none` nos labels
  - `src/components/helpdesk/GlobalSearchDialog.tsx` — `max-h-[60dvh] sm:max-h-[400px]` (era fixo em 400px)
  - `src/pages/dashboard/DashboardHome.tsx` — 3 KPI grids: `grid-cols-2 lg:grid-cols-4` → `grid-cols-2 md:grid-cols-4`
  - `src/components/campaigns/CampaignForm.tsx` — Landing mode buttons: `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`
- **Agente B — 1 arquivo:**
  - `src/pages/dashboard/Leads.tsx` — KPI grid `sm:grid-cols-3` (era só `md:`); SelectTriggers `w-full sm:w-[140px]`; input `min-w-[200px]` removido; overflow-x-auto no wrapper da tabela
- **TypeScript:** 0 erros (npx tsc --noEmit)

---

## 2026-04-07 (sessão 2)

### Sprint 2+3 Mobile-First — Dialogs + Touch Targets
- **Tipo:** UX/UI — mobile responsiveness
- **Commit:** 740ad91
- **Auditoria prévia:** FormBuilder já era mobile-first (sm:flex-row + activePanelMobile state). ChatInput menu já tinha side="top".
- **Sprint 2 — Dialogs responsivos (2 arquivos):**
  - `src/components/admin/ai-agent/CatalogProductForm.tsx` — DialogContent `max-w-2xl` → `w-[95vw] sm:max-w-2xl`; campos grid `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`
  - `src/components/admin/ai-agent/PromptStudio.tsx` — Preview dialog mesma correção; header flex-wrap; token bar `hidden sm:block` (oculta no mobile)
- **Sprint 3 — Touch targets (3 arquivos):**
  - `src/components/admin/ai-agent/KnowledgeConfig.tsx` — "Adicionar todos" h-6→h-8 (24px→32px); edit/delete icons h-7 w-7→h-8 w-8
  - `src/components/admin/ai-agent/CatalogTable.tsx` — bulk action buttons h-7→h-8 (28px→32px)
  - `src/components/helpdesk/ChatInput.tsx` — emoji picker Popover `side="right"` → `side="top"` (evita saída de tela no mobile)
- **TypeScript:** 0 erros (npx tsc --noEmit)

---

## 2026-04-07

### Sprint 1 Mobile-First — CampaignTable mobile card view
- **Tipo:** UX/UI — mobile responsiveness
- **Commit:** eb8aa62
- **Auditoria prévia:** DashboardLayout já usava Sheet drawer para Sidebar mobile (linha 40-44). HelpDesk já tinha mobileView ('list'|'chat'|'info') com back navigation (linha 420-456). Ambos corretos.
- **Fix real implementado:**
  - `src/components/campaigns/CampaignTable.tsx` — Tabela de 9 colunas sem scroll no mobile
    - Esconde tabela em xs (`hidden sm:block`) + `overflow-x-auto` na div wrapper
    - Mobile cards (`sm:hidden`): nome, slug, tipo, origem, status badge, métricas 3-grid (visitas/conversões/taxa), action dropdown
    - `active:scale-[0.99]` micro-interaction nos cards mobile
    - Desktop table intacto — sem regressão
- **TypeScript:** 0 erros (npx tsc --noEmit)
- **Resultado:** Campanhas funciona em mobile — lista de cards navegável sem overflow

---

## 2026-04-06 (sessão 2)

### Auditoria e Correção de Todos os .md — LLM desatualizado + status M2
- **Tipo:** Manutenção do vault — auditoria completa de todos os .md do projeto
- **Arquivos corrigidos (7):**
  - `PRD.md` — Tech Stack: AI row expandida (OpenAI primário + Gemini fallback + Groq). Arquitetura: OpenAI adicionado. Header: 27→30 Edge Functions, versão 7.1.0, data 2026-04-06, M13 no header.
  - `.planning/ROADMAP.md` — M2 F2-F4 de "Pending" para "Complete" com datas. M12 e M13 adicionados ao backlog e tabela de progresso.
  - `AGENTS.md` — AI stack corrigido (Gemini→OpenAI como primary). Fallback chain corrigida. Edge Functions 24→30. Arquitetura diagram atualizado.
  - `docs/CONTEXTO_PROJETO.md` — Stack: +OpenAI. Cérebro do Agent: Gemini→OpenAI gpt-4.1-mini. TTS chain atualizada. Tabelas: 38→44+. Edge Functions: 20→30. ai-agent row: Gemini→OpenAI.
  - `wiki/visao-produto.md` — M13 "Funil Conversacional" adicionado à lista de módulos.
  - `log.md` — esta entrada.
- **Arquivos auditados e OK (sem alteração necessária):**
  - `wiki/roadmap.md`, `wiki/arquitetura.md`, `wiki/ai-agent.md`, `wiki/modulos.md` — ✅ atualizados na sessão anterior (2026-04-05/06)
  - `wiki/erros-e-licoes.md`, `wiki/decisoes-chave.md`, `wiki/banco-de-dados.md`, `wiki/deploy.md`, `wiki/deploy-checklist.md` — ✅ corretos
- **Resultado:** Todos os .md principais agora refletem OpenAI gpt-4.1-mini como LLM primário do Agent, 30 Edge Functions, 44 tabelas, M2 completo, M12 e M13 shipped.

---

## 2026-04-06

### Redesign Mobile-First: Módulo Formulários WhatsApp (ui-ux-pro-max)
- **Tipo:** UX/UI Refactor (sem lógica de negócio)
- **Skill usada:** ui-ux-pro-max (Dark Mode + Soft UI Evolution + Minimalism, acento #25D366)
- **Arquivos modificados (6):**
  - `src/components/admin/forms/FormsTab.tsx` — FormCard redesign: borda-esquerda colorida por status, action row sempre visível, card clicável, micro-interaction `active:scale-[0.98]`
  - `src/components/admin/forms/FormBuilder.tsx` — FieldListItem: layout 2 seções (label wrapping + action bar condicional); tab pills com `rounded-full`; botão "Adicionar Campo" com bg-primary/5
  - `src/components/admin/forms/TemplateGallery.tsx` — BlankFormCard como primeiro item da grid, card dashed-border com PlusCircle centralizado
  - `src/components/admin/forms/SubmissionsTable.tsx` — SubmissionCard para mobile (`sm:hidden`), tabela escondida em mobile (`hidden sm:block`)
  - `src/pages/dashboard/WhatsappFormsPage.tsx` — Header icon com gradient `from-[#25D366]/20 to-[#128C7E]/10`
  - `src/components/admin/forms/FormPreview.tsx` — Animação `animate-in fade-in-0 slide-in-from-bottom-2` nas BotBubble
- **Resultado:** Touch targets ≥44px, labels visíveis em mobile, tabs pill-style, formulário visualmente moderno

### Bug Fixes (5 bugs críticos) — Formulários + Chat + Circuit Breaker
- **Tipo:** Correção de bugs

#### Bug #1 — form-bot retries NaN (bypass de validação)
- **Arquivo:** `supabase/functions/form-bot/index.ts` linha ~303
- **Causa:** `session.retries` era `undefined` (coluna sem default no insert) → `undefined + 1 = NaN` → `NaN >= 3 = false` → formulário nunca abandonado após máximo de retries
- **Correção:** `const newRetries = (session.retries ?? 0) + 1`

#### Bug #2 — setState durante render (WhatsappFormsPage)
- **Arquivo:** `src/pages/dashboard/WhatsappFormsPage.tsx`
- **Causa:** `setSelectedAgentId(agents[0].id)` chamado direto no body do componente, fora de efeito
- **Correção:** Movido para `useEffect([agents, selectedAgentId])`. Guard `if (!isSuperAdmin)` movido para DEPOIS dos hooks.

#### Bug #3+#7 — Circuit breaker getter com side effect
- **Arquivo:** `supabase/functions/_shared/circuitBreaker.ts`
- **Causa:** Getter `isOpen` fazia transição de estado OPEN→HALF_OPEN como side effect. Getters devem ser puros — múltiplos acessos causavam comportamento inconsistente.
- **Correção:** `isOpen` tornou-se getter puro (read-only). Criado `private checkState()` com a transição. `call()` usa `checkState()`.

#### Bug #5 — Race condition na criação de contato (form-public)
- **Arquivo:** `supabase/functions/form-public/index.ts`
- **Causa:** Padrão check-then-insert: dois submits simultâneos do mesmo telefone ambos encontram "não existe" e ambos tentam inserir → unique constraint violation
- **Correção:** `upsert ON CONFLICT jid` — operação atômica, o segundo submit atualiza em vez de inserir

#### Bug #6 — Array mutation no ChatPanel
- **Arquivo:** `src/components/helpdesk/ChatPanel.tsx`
- **Causa:** `.reverse()` muta o array original retornado pela query Supabase. Comportamento indefinido se a referência escapar.
- **Correção:** `.slice().reverse()` em 3 locais (carga inicial, load older, realtime new msgs)

### FieldListItem — texto truncado no mobile (FormBuilder)
- **Tipo:** Fix de layout + redesign
- **Causa:** `truncate` (overflow:hidden + text-ellipsis) em linha única com 3 botões fixos (96px) deixava ≈0px para labels longas
- **Correção:** Reestruturado para card 2-seções: (1) linha principal com label wrapping livre + delete sempre visível; (2) action bar com "Subir"/"Descer" aparece apenas quando item selecionado
- **TypeScript:** `npx tsc --noEmit` — 0 erros após todas as correções

---

## 2026-04-05

### Correção de 3 wikis desatualizadas
- **Tipo:** Manutenção do vault
- **arquitetura.md** — LLM primário do AI Agent corrigido para OpenAI gpt-4.1-mini (estava Gemini)
- **ai-agent.md** — LLM primário e fallback chain adicionados na visão geral
- **modulos.md** — M13 (Campanhas + Forms + Funil) adicionado com descrição completa

### Correção do Roadmap (wiki)
- **Tipo:** Manutenção do vault
- **O que:** wiki/roadmap.md estava desatualizado — mostrava M2 F2-F4 como pendentes quando já estavam completos
- **Corrigido:** M2 (Agent QA Framework) marcado como Shipped, F2-F4 com status ✅, M12 e M13 adicionados como shipped, módulos atualizados para M1-M13

### Criação do Vault Obsidian
- **Tipo:** Ingest inicial
- **O que:** Estruturação do projeto como vault Obsidian (método Karpathy)
- **Páginas criadas:** index.md, log.md, 10 páginas wiki compiladas
- **Fontes indexadas:** PRD.md, docs/, .planning/
- **Decisão:** Vault é camada sobre o projeto — arquivos existentes permanecem no lugar

---

## 2026-04-08 (sessão 2)

### M14 Fase 2 — Bio Link: Agendamento, Catálogo e Opções Visuais
- **Tipo:** Nova feature — expansão do módulo Bio Link
- **Commit:** 7bfc119
- **Deploy:** Edge function `bio-public` redesployada com filtros de fase 2
- **TypeScript:** 0 erros | **Testes:** 421 passed

| Arquivo | Descrição |
|---|---|
| `supabase/migrations/20260408000002_m14_bio_fase2.sql` | Novos campos: `bio_pages` (cover_url, font_family, button_spacing) + `bio_buttons` (starts_at, ends_at, catalog_product_id) + tipo 'catalog' |
| `src/types/bio.ts` | Tipos novos: BioFontFamily, BioButtonSpacing, BioCatalogProduct; BioButtonType += 'catalog'; campos Fase 2 em BioPage/BioButton/DTOs |
| `supabase/functions/bio-public/index.ts` | Filtro de agendamento (starts_at/ends_at) + JOIN batch em ai_agent_products para botões catalog |
| `src/hooks/useBioPages.ts` | Hook useCatalogProductsForBio(instanceId) — busca produtos via agent da instância |
| `src/components/bio/BioButtonEditor.tsx` | Tipo 'Produto Catálogo' com seletor + card de produto; seção de agendamento datetime-local para todos os tipos |
| `src/components/bio/BioLinkEditor.tsx` | Tab Aparência: upload de capa/banner, seletor de fonte (3 opções), seletor de espaçamento (3 opções) |
| `src/pages/BioPage.tsx` | CoverImage, CatalogButton, filtro client-side de datas, FONT_FAMILY_CLASS e BUTTON_SPACING_GAP aplicados nos 3 templates |
| `src/components/bio/BioLinkPreview.tsx` | Preview atualizado com capa, fonte e espaçamento |

**Funcionalidades entregues:**
- Agendamento de botões: starts_at/ends_at — botão desaparece automaticamente fora do período
- Botão tipo "Produto Catálogo": escolhe produto de `ai_agent_products`, exibe imagem + preço, click abre WhatsApp com produto pré-preenchido
- Capa/banner: imagem full-width exibida acima do avatar
- Fonte: padrão / serifada / mono aplicada em todo o template
- Espaçamento: compacto / normal / espaçado entre os botões
