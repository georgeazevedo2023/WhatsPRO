---
title: Log Arquivo 2026-04-04 a 09 (parte 1)
type: log-archive
description: 2026-04-09 + 2026-04-08 (M17 F1-F5 ship: Motor + Funis Agênticos + NPS)
updated: 2026-05-11
---

# Log — Arquivo 2026-04-04 a 09 (parte 1)

> Read-only.


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

