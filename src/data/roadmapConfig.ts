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
  version: '3.0.0',
  updatedAt: '2026-03-23',
  infra: { tables: 39, edgeFunctions: 22, storageBuckets: 3 },
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
  ],
  roadmapItems: [
    { id: 'R2', feature: 'Métricas por agente (tempo resposta, CSAT)', description: 'Dashboard individual de performance com ranking e filtros', priority: 'alta', module: 'M6' },
    { id: 'R3', feature: 'Webhook signature validation (HMAC)', description: 'Validação criptográfica dos webhooks com HMAC-SHA256', priority: 'alta', module: 'Infra' },
    { id: 'R4', feature: 'Rate limiting nas edge functions', description: 'Implementado v2.9.0: transcribe (20/min), summarize (10/min), analyze (5/min)', priority: 'alta', module: 'Infra', done: true },
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
    { type: 'performance', title: 'Cache global React Query', impact: 'medio',
      description: '✅ staleTime 5min + gcTime 10min configurado globalmente.' },
    { type: 'security', title: 'Rate limiting em endpoints caros', impact: 'alto',
      description: '✅ transcribe-audio (20/min), summarize (10/min), analyze (5/min).' },
    { type: 'security', title: 'RLS em lead_profiles', impact: 'alto',
      description: 'Verificar se lead_profiles tem RLS habilitado para acesso frontend.' },
    { type: 'ux', title: 'Paginação server-side nos Leads', impact: 'medio',
      description: 'Com 5000+ contatos, implementar cursor pagination no Supabase.' },
    { type: 'ux', title: 'Skeleton loading', impact: 'baixo',
      description: '✅ TableSkeleton.tsx + Breadcrumbs + EmptyState com CTAs.' },
    { type: 'feature', title: 'Webhook de eventos do agente IA', impact: 'medio',
      description: 'Disparar webhook para n8n/Zapier quando IA faz handoff ou qualifica lead.' },
    { type: 'feature', title: 'Dashboard do agente IA em tempo real', impact: 'medio',
      description: 'Painel com conversas ativas, tokens consumidos hoje, alertas de erros.' },
    { type: 'performance', title: 'Índice GIN em conversation_messages.content', impact: 'medio',
      description: 'Full-text search para busca global (R12). Criar índice GIN com pg_trgm.' },
    { type: 'feature', title: 'Cooldown automático com pg_cron', impact: 'alto',
      description: 'Cron job que reseta status_ia após X minutos de handoff cooldown.' },
  ],
};
