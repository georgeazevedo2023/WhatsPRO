---
title: Activity Log
type: log
---

# Activity Log

> Registro cronológico de ingestões, consultas e manutenções do vault. Append-only.

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
