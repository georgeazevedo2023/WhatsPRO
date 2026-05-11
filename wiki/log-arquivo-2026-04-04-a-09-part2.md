---
title: Log Arquivo 2026-04-04 a 09 (parte 2)
type: log-archive
description: 2026-04-08 + 2026-04-07 + 2026-04-06 — M16 Funis shipped + M15 F1+F2 + bio link fixes
updated: 2026-05-11
---

# Log — Arquivo 2026-04-04 a 09 (parte 2)

> Read-only.

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

