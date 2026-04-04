/**
 * Roadmap configuration data.
 *
 * This file serves as the DEFAULT/FALLBACK data for the Roadmap page.
 * The live data is stored in system_settings (key: 'roadmap_config')
 * and updated automatically when features are implemented.
 *
 * To update: change this file AND run the seed function, or update
 * directly in the DB via system_settings.
 */

// Icon names (resolved to lucide-react components in RoadmapTab)
export interface ModuleData {
  id: string;
  name: string;
  icon: string; // lucide-react icon name
  color: string;
  tasks: { id: string; description: string; status: 'done' | 'progress' | 'planned' }[];
}

export interface RoadmapItemData {
  id: string;
  feature: string;
  description: string;
  priority: 'alta' | 'media' | 'baixa';
  module: string;
  done?: boolean;
}

export interface ChangelogEntryData {
  version: string;
  date: string;
  title: string;
  changes: string[];
}

export interface InsightData {
  type: 'performance' | 'security' | 'ux' | 'feature';
  title: string;
  description: string;
  impact: 'alto' | 'medio' | 'baixo';
}

export interface RoadmapConfig {
  modules: ModuleData[];
  roadmapItems: RoadmapItemData[];
  changelog: ChangelogEntryData[];
  insights: InsightData[];
  infra: { tables: number; edgeFunctions: number; storageBuckets: number };
  version: string;
  updatedAt: string;
}

export const DEFAULT_ROADMAP_CONFIG: RoadmapConfig = {
  version: '6.2.0',
  updatedAt: '2026-04-04',
  infra: { tables: 44, edgeFunctions: 26, storageBuckets: 3 },
  modules: [
    { id: 'M1', name: 'WhatsApp', icon: 'MonitorSmartphone', color: 'text-emerald-500', tasks: [
      { id: 'T1.1', description: 'Instâncias (QR, status, sync, disconnect)', status: 'done' },
      { id: 'T1.2', description: 'Grupos (listar, enviar msg/mídia/carrossel)', status: 'done' },
      { id: 'T1.3', description: 'Histórico de conexão + controle de acesso', status: 'done' },
    ]},
    { id: 'M2', name: 'Helpdesk', icon: 'Headphones', color: 'text-blue-500', tasks: [
      { id: 'T2.1', description: 'Chat real-time (webhook, broadcast, mensagens)', status: 'done' },
      { id: 'T2.2', description: 'Filtros (status, prioridade, labels, departamentos)', status: 'done' },
      { id: 'T2.3', description: 'Notas privadas, resumo IA, transcrição áudio', status: 'done' },
      { id: 'T2.4', description: 'UX (drag-drop, som, avatar, divider, mobile)', status: 'done' },
    ]},
    { id: 'M3', name: 'Broadcast', icon: 'Send', color: 'text-violet-500', tasks: [
      { id: 'T3.1', description: 'Envio para grupos e leads (texto/mídia/carrossel)', status: 'done' },
      { id: 'T3.2', description: 'Base de leads, templates, verificação, limites', status: 'done' },
    ]},
    { id: 'M4', name: 'CRM Kanban', icon: 'Kanban', color: 'text-orange-500', tasks: [
      { id: 'T4.1', description: 'Boards, colunas drag-drop, cards, campos custom', status: 'done' },
      { id: 'T4.2', description: 'Membros, filtros, automação, integração leads', status: 'done' },
    ]},
    { id: 'M5', name: 'Admin', icon: 'ShieldCheck', color: 'text-cyan-500', tasks: [
      { id: 'T5.1', description: 'Usuários, inboxes, departamentos, secrets, docs', status: 'done' },
      { id: 'T5.2', description: 'Backup, endpoint, equipe unificada', status: 'done' },
    ]},
    { id: 'M6', name: 'Inteligência', icon: 'BrainCircuit', color: 'text-pink-500', tasks: [
      { id: 'T6.1', description: 'KPIs, gráficos, top motivos IA, heatmap', status: 'done' },
    ]},
    { id: 'M7', name: 'Turnos', icon: 'FileText', color: 'text-amber-500', tasks: [
      { id: 'T7.1', description: 'Config, envio automático, conteúdo IA', status: 'done' },
    ]},
    { id: 'M8', name: 'Agendamentos', icon: 'Clock', color: 'text-teal-500', tasks: [
      { id: 'T8.1', description: 'Única/recorrente, templates, logs', status: 'done' },
    ]},
    { id: 'M9', name: 'Backup', icon: 'Database', color: 'text-slate-400', tasks: [
      { id: 'T9.1', description: 'SQL/CSV export, env vars, cleanup mídia', status: 'done' },
    ]},
    { id: 'M10', name: 'Agente de IA', icon: 'BrainCircuit', color: 'text-rose-500', tasks: [
      { id: 'S1', description: 'MVP: Gemini 2.5 Flash, debounce 10s, webhook', status: 'done' },
      { id: 'S2', description: 'Catálogo: produtos, search, carousel, media, qualificação', status: 'done' },
      { id: 'S3', description: 'Handoff: labels, tags, kanban, shadow, extração', status: 'done' },
      { id: 'S4', description: 'Voz/Métricas: TTS Gemini, playground, sub-agentes', status: 'done' },
      { id: 'S5', description: 'Contexto: persistente, leads page, cartão, CRM', status: 'done' },
      { id: 'S6', description: 'Importação Rápida: URL → scrape → título/preço/fotos/categoria', status: 'done' },
      { id: 'S5.5', description: 'Duplicar config de agente entre instâncias', status: 'planned' },
    ]},
    { id: 'M11', name: 'Leads', icon: 'Contact2', color: 'text-indigo-500', tasks: [
      { id: 'L1', description: 'Página dedicada com filtro instância, busca, tabela', status: 'done' },
      { id: 'L2', description: 'Cartão do lead (6 seções, edição inline, timeline)', status: 'done' },
      { id: 'L3', description: 'Block IA, clear context, conversation modal', status: 'done' },
    ]},
    { id: 'M12', name: 'Escalabilidade', icon: 'Gauge', color: 'text-red-500', tasks: [
      { id: 'SC1', description: 'Indexes compostos + RLS otimizado (can_view_conversation)', status: 'done' },
      { id: 'SC2', description: 'Circuit breaker + backoff exponencial + tools paralelos', status: 'done' },
      { id: 'SC3', description: 'Webhook parallel I/O + lead upsert atômico + broadcast timeout', status: 'done' },
      { id: 'SC4', description: 'verify_jwt + WEBHOOK_SECRET obrigatório + audit log', status: 'done' },
      { id: 'SC5', description: 'memo() + lazy imgs + Promise.all leads + staleTime tuning', status: 'done' },
      { id: 'SC6', description: 'Paginação mensagens + archiving + cleanup triggers', status: 'done' },
      { id: 'SC7', description: 'Singleton client + materialized view inbox roles', status: 'done' },
      { id: 'SC8', description: 'Structured logger + health check endpoint', status: 'done' },
      { id: 'SC9', description: 'Job queue persistente (SKIP LOCKED) + processor', status: 'done' },
    ]},
  ],
  roadmapItems: [
    { id: 'S6.3', feature: 'M2-F3: Barra de Evolução do Agente', description: 'Score composto 0-100 (E2E 40%+Validator 30%+Tools 20%+Latência 10%) com tendência no header do Playground', priority: 'alta', module: 'M10', done: true },
    { id: 'S6.2', feature: 'M2-F2: Fluxo de Aprovação Admin', description: 'ApprovalQueue + ReviewDrawer + badge âmbar de pendentes + optimistic approve/reject', priority: 'alta', module: 'M10', done: true },
    { id: 'S6.1', feature: 'M2-F1: Histórico Persistente de Batches', description: 'BatchHistoryTab + useE2eBatchHistory hooks + e2e_test_batches table', priority: 'alta', module: 'M10', done: true },
    { id: 'R2', feature: 'Métricas por agente (tempo resposta, CSAT)', description: 'Dashboard individual de performance com ranking e filtros', priority: 'alta', module: 'M6' },
    { id: 'R3', feature: 'Webhook signature validation (HMAC)', description: 'WEBHOOK_SECRET obrigatório (fail closed) implementado v4.0', priority: 'alta', module: 'Infra', done: true },
    { id: 'R4', feature: 'Rate limiting atômico via RPC', description: 'check_rate_limit() transactional + global limit, sem race condition', priority: 'alta', module: 'Infra', done: true },
    { id: 'R5', feature: 'Deploy automatizado (Vercel/Netlify)', description: 'CI/CD com preview deploys, rollback e notificação', priority: 'media', module: 'Infra' },
    { id: 'R6', feature: 'Notificações push/desktop', description: 'Web Push API para novas mensagens e menções', priority: 'media', module: 'M2' },
    { id: 'R7', feature: 'Integração CRM externo (HubSpot, Pipedrive)', description: 'Sync bidirecional de contatos e deals', priority: 'media', module: 'M4' },
    { id: 'R8', feature: 'Relatórios exportáveis (PDF/Excel)', description: 'Templates com logo, agendamento automático', priority: 'media', module: 'M6' },
    { id: 'R9', feature: 'Multi-idioma (i18n)', description: 'pt-BR, en-US, es-ES com formatos localizados', priority: 'baixa', module: 'Global' },
    { id: 'R11', feature: 'Quick reply templates no chat', description: 'Atalhos "/" com variáveis dinâmicas', priority: 'alta', module: 'M2' },
    { id: 'R12', feature: 'Busca global cross-inbox', description: 'Pesquisa unificada por nome, número, conteúdo', priority: 'alta', module: 'M2' },
    { id: 'R13', feature: 'Ações em massa no helpdesk', description: 'Seleção múltipla para atribuir, status, labels em lote', priority: 'alta', module: 'M2' },
    { id: 'R37', feature: 'Gerador de links UTM com métricas', description: 'Links rastreáveis por instância para tracking de origem', priority: 'media', module: 'M11' },
  ],
  changelog: [
    { version: 'v6.2.0', date: '2026-04-04', title: 'M2-F3: Barra de Evolução do Agente (Score Composto)',
      changes: ['agentScoring.ts: fórmula E2E 40% + Validator 30% + Tools 20% + Latência 10%', 'useAgentScore: 2 queries TanStack, memoização, staleTime 5min', 'AgentScoreBar: barra colorida + tooltip breakdown + seta de tendência no header do Playground', 'Score composto 0-100 visível em tempo real'] },
    { version: 'v6.1.0', date: '2026-04-04', title: 'M2-F2: Fluxo de Aprovação Admin',
      changes: ['useE2eApproval: hook TanStack Query com optimistic updates (approve/reject)', 'ApprovalQueue: fila de runs com approval=null ou failed, filtros e ações rápidas', 'ReviewDrawer: sheet com steps detalhados, tools usados e notas do revisor', 'Badge âmbar no header do Playground com contagem de pendentes', 'Aprovar → human_approved / Rejeitar → human_rejected'] },
    { version: 'v6.0.0', date: '2026-04-04', title: 'M2-F1: Histórico Persistente de Batches + Pré-requisitos',
      changes: ['Fix bug activeSubAgents→activeSub em ai-agent (sub-agentes injetavam prompts errados)', 'Tabela e2e_test_batches com FK para ai_agent_test_suites', 'useE2eBatchHistory/Runs/CreateBatch/CompleteBatch hooks', 'BatchHistoryTab: 5ª aba no Playground com lista expansível e score bar', 'runAllE2e integrado: cria batch → executa → finaliza com métricas'] },
    { version: 'v4.6.0', date: '2026-03-27', title: 'Sprint E Completo: Agent Performance + Bulk Actions',
      changes: ['AgentPerformanceCard: ranking de agentes por conversas, resolução, response time', 'Bulk actions: seleção múltipla + marcar lidas/resolver/arquivar', 'Selection auto-clear ao trocar inbox ou status', 'Weighted resolution rate (não média simples)', 'Double-click guard no handleBulkAction'] },
    { version: 'v4.5.0', date: '2026-03-27', title: 'Sprint E: New Features',
      changes: ['Typing indicator entre agentes (Realtime broadcast, 3s throttle, self-exclusion)', 'Quick reply templates (/) no ChatInput com keyboard navigation', 'Self-typing exclusion + typingAgent reset ao trocar conversa', 'Enter com template sem match não envia /xyz'] },
    { version: 'v4.4.0', date: '2026-03-27', title: 'Sprint D: UX Polish',
      changes: ['Timezone-aware date dividers (America/Sao_Paulo)', 'loadMore debounce (500ms cooldown ref)', 'Bug fix: labels/notes merge em vez de replace no loadMore', 'Draft persistence já implementado', 'Broadcast error toasts já completos'] },
    { version: 'v4.3.0', date: '2026-03-27', title: 'Sprint C: Data Integrity',
      changes: ['Phone validation (>= 10 chars) antes de lead upsert', 'Instance validation no ai-agent (cross-instance prevention)', 'Optimistic update rollback targeted por conversa', 'Sale value: MAX R$ 999.999,99 + Number.isFinite check', 'STATUS_IA constants em 14 arquivos (elimina magic strings)', 'Auditoria: 4 test scenarios + 4 fixes pós-audit'] },
    { version: 'v4.2.0', date: '2026-03-27', title: 'OpenAI + Sprint A+B Fixes + Auditoria',
      changes: ['OpenAI gpt-4.1-mini como LLM primário (Gemini fallback)', 'Sprint A: 5 fixes críticos (realtime, handoff, tools, contacts)', 'Sprint B: circuit breaker, smart scroll, memo props, playground callLLM', 'Realtime: canal corrigido (helpdesk-realtime)', 'Handoff: status_ia=desligada preservado', 'Contact names atualizam com pushname'] },
    { version: 'v4.1.0', date: '2026-03-27', title: 'Playground IA v2 + Finalizar Atendimento',
      changes: ['Playground: 10 features (tool inspector, thumbs, overrides, buffer, guardrails, personas)', 'Finalizar Atendimento: drawer com 4 categorias + Kanban + tags', 'Dashboard: queries paralelas + limits', 'Fix: Kanban CRM directMemberRole + tabs overflow + MetricsConfig redesign', 'Tabelas: playground_evaluations + playground_test_suites'] },
    { version: 'v4.0.0', date: '2026-03-26', title: 'Auditoria de Escalabilidade — 10 Sprints',
      changes: ['S1: 5 indexes compostos + RLS unificado (can_view_conversation)', 'S2: Circuit breaker Gemini/Groq + tool calls paralelos + rate limit atômico', 'S3: Webhook parallel I/O (50% menos latência) + lead upsert atômico', 'S4: verify_jwt em 20 functions + audit log + WEBHOOK_SECRET obrigatório', 'S5: memo() + lazy imgs + Promise.all Leads + staleTime 1min', 'S6: Paginação mensagens (50/page) + archiving 90d + cleanup triggers', 'S7: Singleton Supabase client + materialized view inbox roles', 'S8: Structured logger JSON + health-check endpoint', 'S9: Job queue persistente (SKIP LOCKED) + process-jobs worker', '8 migrations + 4 novos arquivos + 15 modificados + 0 erros novos'] },
    { version: 'v3.0.0', date: '2026-03-23', title: 'Auditoria Completa + Importação Rápida',
      changes: ['Importação Rápida: URL → scrape → auto-fill catálogo', '30 correções de segurança, DB, código, UX e performance', 'Rate limiting + fetch timeouts (55+ calls)', '10 indexes + 7 FKs + constraints', 'Breadcrumbs, skeletons, forgot password', 'KanbanBoard refatorado (-35%)', '22 edge functions'] },
    { version: 'v2.8.0', date: '2026-03-22', title: 'Integração Lead ↔ CRM Kanban',
      changes: ['kanban_cards.contact_id FK', 'move_kanban auto-cria card', 'Estágio na tabela de leads', 'Lead info nos cards Kanban'] },
    { version: 'v2.7.0', date: '2026-03-22', title: 'Cartão do Lead Completo',
      changes: ['6 seções Accordion', 'ExtractionConfig 3 seções', 'Edição inline', 'Timeline de ações'] },
    { version: 'v2.6.0', date: '2026-03-22', title: 'Módulo M11 Leads',
      changes: ['Página /dashboard/leads', 'Block IA global', 'Clear context', 'ConversationModal'] },
    { version: 'v2.5.0', date: '2026-03-22', title: 'Contexto Longo Persistente',
      changes: ['conversation_summaries JSONB', 'Auto-append resumo', 'Últimas 5 no prompt'] },
    { version: 'v2.4.0', date: '2026-03-22', title: 'Sprint 4: Áudio, Métricas, Sub-agentes',
      changes: ['TTS Gemini → PTT', 'MetricsConfig', 'SubAgentsConfig 5 modos'] },
    { version: 'v2.1.0', date: '2026-03-22', title: 'M10 AI Agent + Admin',
      changes: ['Gemini 2.5 Flash', 'Debounce 10s', 'Admin sub-rotas', '20 edge functions'] },
    { version: 'v1.9.0', date: '2026-03-21', title: 'Auditoria + UX Helpdesk',
      changes: ['Foto perfil UAZAPI', 'Som notificação', 'Drag-drop', '30+ fixes'] },
    { version: 'v1.2.0', date: '2026-03-21', title: 'Tema + PRD',
      changes: ['Tema claro/escuro', 'PRD.md + skill /prd'] },
    { version: 'v1.0.0', date: '2026-03-20', title: 'Release Inicial',
      changes: ['9 módulos', '20 edge functions', '38 tabelas', 'Multi-tenant'] },
  ],
  insights: [
    { type: 'performance', title: 'React Query otimizado', impact: 'alto',
      description: '✅ staleTime 1min (helpdesk responsivo) + refetchOnWindowFocus + memo() em 3 componentes.' },
    { type: 'security', title: 'Rate limiting atômico + JWT verificado', impact: 'alto',
      description: '✅ RPC transactional + global limit + verify_jwt em 20/23 functions + audit log admin.' },
    { type: 'performance', title: 'Webhook throughput 3x', impact: 'alto',
      description: '✅ Parallel I/O (media+dedup+contact), singleton client, broadcast 3s timeout. ~8-15 msg/s.' },
    { type: 'performance', title: 'Circuit breaker + backoff', impact: 'alto',
      description: '✅ Gemini/Groq/Mistral breakers (CLOSED→OPEN→HALF_OPEN), retry exponencial 1.5s→3s→6s.' },
    { type: 'performance', title: 'Paginação de mensagens', impact: 'alto',
      description: '✅ ChatPanel: últimas 50 msgs + "Carregar anteriores" + Realtime append (sem refetch total).' },
    { type: 'performance', title: 'DB maintenance automático', impact: 'medio',
      description: '✅ Archiving 90d, prune logs, cleanup rate_limit_log (trigger probabilístico).' },
    { type: 'feature', title: 'Job queue persistente', impact: 'alto',
      description: '✅ SKIP LOCKED + claim_jobs RPC + process-jobs worker para lead_auto_add e profile_pic.' },
    { type: 'feature', title: 'Health check endpoint', impact: 'medio',
      description: '✅ /functions/v1/health-check: DB + materialized view + env vars → 200/503.' },
    { type: 'feature', title: 'Observabilidade estruturada', impact: 'medio',
      description: '✅ Logger JSON {level,fn,req,msg,ts} + request_id no webhook para rastreabilidade.' },
  ],
};
