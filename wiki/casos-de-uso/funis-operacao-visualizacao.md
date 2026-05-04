---
title: Funis — Operacao, Visualizacao e Cards no Lead
tags: [funis, lista, detalhe, kanban, tag, lead, badge, detalhado]
sources: [src/pages/dashboard/FunnelsPage.tsx, src/pages/dashboard/FunnelDetail.tsx, src/components/leads/LeadFunnelCard.tsx]
updated: 2026-05-04
---

# Funis — Operacao, Visualizacao e Cards no Lead (5 Sub-Funcionalidades)

> Esta sub-wiki cobre o **uso diario** dos funis: a lista de funis com KPIs, a tela de detalhe (com 5 abas e Kanban visual), a tag `funil:SLUG` que conecta tudo, e os componentes que aparecem no perfil do lead (LeadFunnelCard e OriginBadge).
>
> Ver tambem indice: [[wiki/casos-de-uso/funis-detalhado]]

---

## 10.3 Pagina de Funis (Lista + KPIs)

**O que e:** Dashboard com todos os funis, KPIs resumidos e acoes.

**KPIs no topo:**
- Funis ativos
- Total de leads (todos os funis)
- Total de funis criados

**Lista de funis:** Cards com nome, tipo (icone + cor), status (ativo/pausado), leads count, conversao %. Acoes: ver detalhes, pausar/ativar, excluir.

**Busca e filtro:** Por nome e tipo.

**Importar existente:** Dialog que permite vincular campanhas, bio links, formularios e boards ja existentes a um novo funil (sem auto-criacao).

> **Tecnico:** Pagina `FunnelsPage.tsx`. Hooks: `useFunnelsList()` (JOIN campaigns/bio/forms para nomes), `useFunnelKPIs()` (counts agregados). Dialog `ImportExistingDialog.tsx` (312 linhas — carrega resources por instancia, submit cria funnel com FKs opcionais). Toggle status: `useUpdateFunnel({ status })`. Delete: `useDeleteFunnel()`.

---

## 10.4 Detalhe do Funil (KPIs + Kanban + 5 Tabs)

**O que e:** Pagina completa de um funil com metricas, visualizacao Kanban e 5 abas de configuracao.

**KPIs (topo):**
- Leads (total no funil)
- Conversas (conversas com tag funil:SLUG)
- Visitas (campanha UTM)
- Conversao % (leads / visitas)

**Kanban Visual:** Barra horizontal mostrando distribuicao de leads por etapa (ex: 40% Novo, 30% Proposta, 20% Negociacao, 10% Fechado) com legenda colorida.

**5 abas:**

### Tab 1 — Canais
Mostra metricas de cada canal do funil:
- **Campanha UTM:** visitas, conversoes, taxa, link copiavel
- **Bio Link:** visualizacoes, cliques, leads, CTR, link copiavel
- **Formulario:** submissoes (total + hoje), trigger FORM:slug copiavel

### Tab 2 — Formulario
Submissoes do formulario com contagem (total + hoje) e trigger FORM:slug para copiar.

### Tab 3 — Automacoes (Motor M17 F1)
Lista de regras de automacao: gatilho -> condicao -> acao. CRUD visual com dialog editor. Ver [[wiki/casos-de-uso/funis-inteligencia-metricas]].

### Tab 4 — Agente IA (Funis Agenticos M17 F2+F3)
- **Perfil de atendimento:** dropdown para selecionar perfil (Agent Profile)
- **Prompt do funil:** textarea com instrucoes especificas
- **Regra de handoff:** so se pedir / apos N msgs / nunca
- **Max mensagens:** limite antes de handoff automatico
Ver [[wiki/casos-de-uso/funis-inteligencia-metricas]].

### Tab 5 — Configuracao
Metadados: tipo, status, template, configuracao de handoff.

> **Tecnico:** Pagina `FunnelDetail.tsx` (~600 linhas). Hooks: `useFunnel(id)`, `useFunnelMetrics(funnel)` (167 linhas — campaignVisits/conversions, bioViews/clicks/leads, formSubmissions, totalLeads via tag, kanbanStages distribution). KPI Kanban: barra horizontal com cores das colunas + legenda. Tab Automacoes: `useAutomationRules(funnelId)` + `AutomationRuleEditor.tsx`. Tab IA: `useAgentProfilesByInstance()` + `useUpdateFunnel()` para salvar funnel_prompt/handoff_rule/profile_id.

---

## 10.5 Tag funil:SLUG (Propagacao Automatica)

**O que e:** Quando um lead entra num funil (por qualquer canal), a conversa recebe automaticamente a tag `funil:SLUG`. Essa tag e o elo que conecta tudo.

**Onde a tag e aplicada:**
- **form-public:** lead submete formulario da campanha/bio -> tag aplicada
- **bio-public:** lead e captado pelo Bio Link -> tag aplicada
- **whatsapp-webhook:** lead chega pela campanha UTM -> tag aplicada

**Para que serve:**
- IA detecta e injeta `<funnel_context>` no prompt
- Metricas do funil contam leads pela tag
- LeadFunnelCard mostra qual funil o lead esta
- Dashboard filtra por funil

> **Tecnico:** Tag formato `funil:SLUG` em conversations.tags TEXT[]. Aplicada em 3 edge functions: form-public (via mergeTags), bio-public (action=capture, lookup funnel by bio_page_id), whatsapp-webhook (match campanha->funnel). Contagem: `useFunnelMetrics` usa `.contains('tags', ['funil:${slug}'])`. RPC `get_funnel_lead_count(slug)` conta contacts distintos.

---

## 10.10 LeadFunnelCard (Card no Perfil do Lead)

**O que e:** No perfil do lead, um card mostra em qual funil ele esta, em qual etapa, e ha quantos dias.

**Exibe:** Nome do funil, tipo (icone + cor), etapa atual no Kanban, dias na etapa. Link para o FunnelDetail.

> **Tecnico:** Componente `LeadFunnelCard.tsx` (111 linhas). Detecta tag `funil:SLUG` na conversa. Query funnels por slug. Kanban stage: query kanban_cards WHERE contact_id AND board_id. Dias: `(Date.now() - updated_at) / 86400000`.

---

## 10.11 OriginBadge Funil (Laranja)

**O que e:** No perfil do lead, badge laranja com nome do funil quando o lead veio por um funil.

> **Tecnico:** Componente `OriginBadge` em LeadProfileSection.tsx. Cor laranja para origem 'funil'. Detecta tag `funil:SLUG`.

---

## Links Relacionados

- [[wiki/casos-de-uso/funis-detalhado]] — Indice das sub-wikis de Funis
- [[wiki/casos-de-uso/funis-wizard-tipos]] — Wizard, 7 tipos, importar e sidebar
- [[wiki/casos-de-uso/funis-inteligencia-metricas]] — Automacao, IA, perfis e metricas
- [[wiki/casos-de-uso/crm-kanban-detalhado]] — Boards Kanban criados pelo funil
- [[wiki/casos-de-uso/campanhas-detalhado]] — Campanhas orquestradas pelo funil
- [[wiki/casos-de-uso/bio-link-detalhado]] — Bio Links orquestrados pelo funil
- [[wiki/casos-de-uso/formularios-detalhado]] — Formularios orquestrados pelo funil

---

*Documentado em: 2026-04-10 — Padrao dual (didatico + tecnico). Particionado em 2026-05-04.*
