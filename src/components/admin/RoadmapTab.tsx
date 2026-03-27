import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  MonitorSmartphone, Headphones, Send, Kanban, ShieldCheck, BrainCircuit, FileText,
  Clock, Database, CheckCircle2, Circle, Zap, HardDrive, Lock, TrendingUp, Copy,
  CheckCheck, Server, Lightbulb, AlertTriangle, Rocket, Contact2, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useRoadmapConfig } from '@/hooks/useRoadmapConfig';
import type { ModuleData, RoadmapItemData, ChangelogEntryData, InsightData } from '@/data/roadmapConfig';

// ─── Icon Map (string name → React component) ──────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  MonitorSmartphone, Headphones, Send, Kanban, ShieldCheck, BrainCircuit,
  FileText, Clock, Database, Contact2, Server, HardDrive,
};

// ─── Types (for rendering) ──────────────────────────────────────────
interface Module extends Omit<ModuleData, 'icon'> { icon: React.ElementType; }
type RoadmapItem = RoadmapItemData;
type ChangelogEntry = ChangelogEntryData;
type Insight = InsightData;

const _LEGACY_MODULES: Module[] = [
  { id: 'M1', name: 'WhatsApp', icon: MonitorSmartphone, color: 'text-emerald-500', tasks: [
    { id: 'T1.1', description: 'Instâncias (QR, status, sync, disconnect)', status: 'done' },
    { id: 'T1.2', description: 'Grupos (listar, enviar msg/mídia/carrossel)', status: 'done' },
    { id: 'T1.3', description: 'Histórico de conexão + controle de acesso', status: 'done' },
  ]},
  { id: 'M2', name: 'Helpdesk', icon: Headphones, color: 'text-blue-500', tasks: [
    { id: 'T2.1', description: 'Chat real-time (webhook, broadcast, mensagens)', status: 'done' },
    { id: 'T2.2', description: 'Filtros (status, prioridade, labels, departamentos)', status: 'done' },
    { id: 'T2.3', description: 'Notas privadas, resumo IA, transcrição áudio', status: 'done' },
    { id: 'T2.4', description: 'UX (drag-drop, som, avatar, divider, mobile)', status: 'done' },
  ]},
  { id: 'M3', name: 'Broadcast', icon: Send, color: 'text-violet-500', tasks: [
    { id: 'T3.1', description: 'Envio para grupos e leads (texto/mídia/carrossel)', status: 'done' },
    { id: 'T3.2', description: 'Base de leads, templates, verificação, limites', status: 'done' },
  ]},
  { id: 'M4', name: 'CRM Kanban', icon: Kanban, color: 'text-orange-500', tasks: [
    { id: 'T4.1', description: 'Boards, colunas drag-drop, cards, campos custom', status: 'done' },
    { id: 'T4.2', description: 'Membros, filtros, automação, integração leads', status: 'done' },
  ]},
  { id: 'M5', name: 'Admin', icon: ShieldCheck, color: 'text-cyan-500', tasks: [
    { id: 'T5.1', description: 'Usuários, inboxes, departamentos, secrets, docs', status: 'done' },
    { id: 'T5.2', description: 'Backup, endpoint, equipe unificada', status: 'done' },
  ]},
  { id: 'M6', name: 'Inteligência', icon: BrainCircuit, color: 'text-pink-500', tasks: [
    { id: 'T6.1', description: 'KPIs, gráficos, top motivos IA, heatmap', status: 'done' },
  ]},
  { id: 'M7', name: 'Turnos', icon: FileText, color: 'text-amber-500', tasks: [
    { id: 'T7.1', description: 'Config, envio automático, conteúdo IA', status: 'done' },
  ]},
  { id: 'M8', name: 'Agendamentos', icon: Clock, color: 'text-teal-500', tasks: [
    { id: 'T8.1', description: 'Única/recorrente, templates, logs', status: 'done' },
  ]},
  { id: 'M9', name: 'Backup', icon: Database, color: 'text-slate-400', tasks: [
    { id: 'T9.1', description: 'SQL/CSV export, env vars, cleanup mídia', status: 'done' },
  ]},
  { id: 'M10', name: 'Agente de IA', icon: BrainCircuit, color: 'text-rose-500', tasks: [
    { id: 'S1', description: 'MVP: Gemini 2.5 Flash, debounce 10s, webhook', status: 'done' },
    { id: 'S2', description: 'Catálogo: produtos, search, carousel, media, qualificação', status: 'done' },
    { id: 'S3', description: 'Handoff: labels, tags, kanban, shadow, extração', status: 'done' },
    { id: 'S4', description: 'Voz/Métricas: TTS Gemini, playground, sub-agentes', status: 'done' },
    { id: 'S5', description: 'Contexto: persistente, leads page, cartão, CRM', status: 'done' },
    { id: 'S6', description: 'Importação Rápida: URL → scrape → título/preço/fotos/categoria', status: 'done' },
    { id: 'S5.5', description: 'Duplicar config de agente entre instâncias', status: 'planned' },
  ]},
  { id: 'M11', name: 'Leads', icon: Contact2, color: 'text-indigo-500', tasks: [
    { id: 'L1', description: 'Página dedicada com filtro instância, busca, tabela', status: 'done' },
    { id: 'L2', description: 'Cartão do lead (6 seções, edição inline, timeline)', status: 'done' },
    { id: 'L3', description: 'Block IA, clear context, conversation modal', status: 'done' },
  ]},
  { id: 'M12', name: 'Escalabilidade', icon: BrainCircuit, color: 'text-red-500', tasks: [
    { id: 'SC1', description: 'Indexes compostos + RLS otimizado (can_view_conversation)', status: 'done' },
    { id: 'SC2', description: 'Circuit breaker + backoff exponencial + tools paralelos', status: 'done' },
    { id: 'SC3', description: 'Webhook parallel I/O + lead upsert atômico', status: 'done' },
    { id: 'SC4', description: 'verify_jwt + WEBHOOK_SECRET obrigatório + audit log', status: 'done' },
    { id: 'SC5', description: 'memo() + lazy imgs + Promise.all + staleTime tuning', status: 'done' },
    { id: 'SC6', description: 'Paginação mensagens + archiving + cleanup triggers', status: 'done' },
    { id: 'SC7', description: 'Singleton client + materialized view inbox roles', status: 'done' },
    { id: 'SC8', description: 'Structured logger + health check endpoint', status: 'done' },
    { id: 'SC9', description: 'Job queue persistente (SKIP LOCKED) + processor', status: 'done' },
  ]},
];

const ROADMAP_ITEMS: RoadmapItem[] = [
  { id: 'R1', feature: 'Chatbot/autoresponder configurável', description: 'Fluxos condicionais por inbox com menu de opções e horário de funcionamento', priority: 'alta', module: 'M2' },
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
  { id: 'R37', feature: 'Gerador de links UTM com métricas', description: 'Links rastreáveis com QR code, métricas e AI contextual', priority: 'media', module: 'M11', done: true },
  { id: 'R38', feature: 'Carousel com copy IA por card', description: 'Cada card do carrossel tem texto de vendas gerado por IA (Groq/Gemini/Mistral)', priority: 'alta', module: 'M10', done: true },
  { id: 'R39', feature: 'LLM Fallback Chain', description: 'Groq → Gemini → Mistral → templates estáticos para resiliência', priority: 'alta', module: 'M10', done: true },
  { id: 'R40', feature: 'Deploy Docker Swarm + Traefik', description: 'CI/CD GitHub Actions → ghcr.io → Portainer em crm.wsmart.com.br', priority: 'alta', module: 'Infra', done: true },
  { id: 'R41', feature: 'Auditoria AI Agent (2 sprints)', description: 'Gemini retry, security hardening, helpers DRY, broadcast fire-and-forget', priority: 'alta', module: 'M10', done: true },
  { id: 'R42', feature: 'SDR Qualification Flow', description: 'Qualificação antes de buscar (genérico vs específico), handoff após 5 msgs', priority: 'alta', module: 'M10', done: true },
  { id: 'R43', feature: 'Shadow Mode pós-Handoff', description: 'IA escuta em shadow após transbordo, extrai tags/context para follow-up', priority: 'alta', module: 'M10', done: true },
  { id: 'R44', feature: 'Debounce Atômico', description: 'UPDATE WHERE processed=false elimina race condition de duplicatas', priority: 'alta', module: 'M10', done: true },
  { id: 'R45', feature: 'TTS Voice Configurável', description: '6 vozes Gemini (Kore, Aoede, Charon, Fenrir, Puck, Leda) no admin', priority: 'media', module: 'M10', done: true },
  { id: 'R46', feature: 'Quick IA Toggle nos Leads', description: 'Botão verde/laranja por lead na tabela para ligar/desligar IA', priority: 'media', module: 'M11', done: true },
  { id: 'R47', feature: 'Follow-up Automático (S8)', description: 'Cadência configurável (3/7/14 dias), reativa IA, templates com variáveis', priority: 'alta', module: 'M10', done: true },
  { id: 'R48', feature: 'Import CSV/Excel de Produtos (S9)', description: 'Upload planilha, auto-detect colunas, parse preço BR, dedup', priority: 'alta', module: 'M10', done: true },
  { id: 'R49', feature: 'Web Scraping em Lote (S9)', description: 'Job queue com polling, extrai produtos de sites automaticamente', priority: 'alta', module: 'M10', done: true },
  { id: 'R50', feature: 'Auditoria Completa v3', description: '24 functions, 33 tabelas, 44 rotas — 5 fixes aplicados', priority: 'alta', module: 'Infra', done: true },
];

const CHANGELOG: ChangelogEntry[] = [
  { version: 'v4.0.0', date: '2026-03-26', title: 'Auditoria de Escalabilidade — 10 Sprints',
    changes: ['S1-S2: 5 indexes + RLS otimizado + circuit breaker + tools paralelos', 'S3-S4: Webhook 3x throughput + verify_jwt 20 fns + audit log', 'S5-S6: memo/lazy/Promise.all + paginação msgs + archiving', 'S7-S9: Singleton client + MV cache + logger + job queue SKIP LOCKED', '8 migrations + 26 edge functions + 42 tabelas + health-check'] },
  { version: 'v3.3.0', date: '2026-03-25', title: 'Sprint 8+9 + Auditoria Completa Sistema',
    changes: ['Follow-up automático com cadência configurável', 'Import CSV/Excel de produtos com auto-detect', 'Web scraping em lote com job queue', 'Auditoria v3: 24 functions, 33 tabelas, 44 rotas', 'Auth no send-shift-report, CHECK utm, FKs, memory leak fix', 'Typing delay UAZAPI, nome duplicado fix, prompt handoff'] },
  { version: 'v3.2.0', date: '2026-03-25', title: 'Auditoria AI Agent + SDR + Shadow Mode + Debounce Atômico',
    changes: ['Auditoria v1+v2: 8 CRITICAL + 23 HIGH → todos corrigidos', 'SDR qualification: genérico qualifica, específico busca', 'Shadow mode após handoff (IA escuta sem responder)', 'Greeting direto + TTS + save-first lock dedup', 'Handoff: 1 msg + break (sem duplicatas)', 'Debounce atômico (UPDATE WHERE elimina race)', '6 vozes TTS configuráveis', 'Quick IA toggle nos leads', 'UI: handoff_message + business_hours + voice_name'] },
  { version: 'v3.1.0', date: '2026-03-24', title: 'Carousel AI Copy + LLM Fallback + UTM + Deploy',
    changes: ['Carousel: copy de vendas IA por card (Groq ~300ms)', 'LLM chain: Groq → Gemini → Mistral → static', 'TTS fix: Gemini Preview TTS + PCM→WAV', 'Auto-carousel em search_products', 'Handoff triggers automáticos', 'UTM Campaigns: CRUD + QR + métricas + AI contextual', 'Deploy: Docker Swarm + Traefik + SSL em crm.wsmart.com.br', 'Tag classification melhorada (compra vs dúvida)'] },
  { version: 'v3.0.0', date: '2026-03-23', title: 'Auditoria Completa + Importação Rápida',
    changes: ['Importação Rápida: URL → scrape → auto-fill catálogo (scrape-product edge function)', '30 correções de segurança, DB, código, UX e performance', 'Rate limiting em endpoints caros', 'Fetch timeouts (55+ calls)', '10 indexes + 7 FKs + constraints no banco', 'Breadcrumbs, skeletons, forgot password, touch targets', 'KanbanBoard refatorado (-35% linhas)', '22 edge functions (+ scrape-product)'] },
  { version: 'v2.8.0', date: '2026-03-22', title: 'Integração Lead ↔ CRM Kanban',
    changes: ['kanban_cards.contact_id FK', 'move_kanban auto-cria card', 'Estágio na tabela de leads', 'Lead info nos cards Kanban'] },
  { version: 'v2.7.0', date: '2026-03-22', title: 'Cartão do Lead Completo',
    changes: ['6 seções Accordion (Perfil, Endereço, Custom, Histórico, Ações, Arquivos)', 'ExtractionConfig 3 seções', 'Edição inline', 'Timeline de ações'] },
  { version: 'v2.6.0', date: '2026-03-22', title: 'Módulo M11 Leads',
    changes: ['Página /dashboard/leads', 'Block IA global', 'Clear context', 'ConversationModal read-only'] },
  { version: 'v2.5.0', date: '2026-03-22', title: 'Contexto Longo Persistente',
    changes: ['conversation_summaries JSONB', 'Auto-append resumo', 'Últimas 5 interações no prompt'] },
  { version: 'v2.4.0', date: '2026-03-22', title: 'Sprint 4: Áudio, Métricas, Sub-agentes',
    changes: ['TTS Gemini → PTT', 'MetricsConfig', 'SubAgentsConfig 5 modos', '10 tabs admin'] },
  { version: 'v2.3.0', date: '2026-03-22', title: 'Sprint 3: Labels, Tags, Shadow',
    changes: ['assign_label / set_tags', 'move_kanban', 'Shadow mode', 'ExtractionConfig', '8 tools'] },
  { version: 'v2.2.0', date: '2026-03-22', title: 'Sprint 2: Catálogo + Qualificação',
    changes: ['send_carousel / send_media', 'Qualificação 1 pergunta/msg'] },
  { version: 'v2.1.0', date: '2026-03-22', title: 'M10 AI Agent + Admin Reorganizado',
    changes: ['Gemini 2.5 Flash', 'Debounce 10s', 'Admin sub-rotas', 'Sidebar collapsibles', '20 edge functions'] },
  { version: 'v1.9.0', date: '2026-03-21', title: 'Auditoria + UX Helpdesk',
    changes: ['Foto perfil UAZAPI', 'Som notificação', 'Drag-drop arquivos', '30+ bug fixes'] },
  { version: 'v1.5.0', date: '2026-03-21', title: 'Melhorias Helpdesk',
    changes: ['Indicador conexão', 'Error retry', 'Histórico expandido'] },
  { version: 'v1.2.0', date: '2026-03-21', title: 'Tema + PRD',
    changes: ['Tema claro/escuro', 'PRD.md + skill /prd'] },
  { version: 'v1.1.0', date: '2026-03-21', title: 'Auditoria Inicial',
    changes: ['Auth edge functions', 'Vault', 'Error Boundaries', 'FK cascades'] },
];

const INSIGHTS: Insight[] = [
  { type: 'performance', title: 'Code splitting por rota', impact: 'alto',
    description: 'Leads page e KanbanBoard carregam muitos dados. Implementar virtualização (react-window) na tabela de leads para listas 1000+.' },
  { type: 'performance', title: 'Cache global React Query', impact: 'medio',
    description: '✅ Implementado v3.0.0: staleTime 5min + gcTime 10min configurado globalmente no QueryClient.' },
  { type: 'security', title: 'Rate limiting em endpoints caros', impact: 'alto',
    description: '✅ Implementado v2.9.0: transcribe-audio (20/min), summarize (10/min), analyze (5/min) com tabela rate_limit_log.' },
  { type: 'security', title: 'RLS em lead_profiles', impact: 'alto',
    description: 'Verificar se lead_profiles tem RLS habilitado. Atualmente acessado via service_role no edge function, mas frontend precisa de policies.' },
  { type: 'ux', title: 'Paginação server-side nos Leads', impact: 'medio',
    description: 'Leads.tsx carrega todas as conversas de uma vez. Com 5000+ contatos, implementar cursor pagination no Supabase.' },
  { type: 'ux', title: 'Skeleton loading nos cards', impact: 'baixo',
    description: '✅ Implementado v3.0.0: TableSkeleton.tsx componente reutilizável para tabelas. Breadcrumbs e EmptyState com CTAs.' },
  { type: 'feature', title: 'Webhook de eventos do agente IA', impact: 'medio',
    description: 'Quando IA faz handoff ou qualifica lead, disparar webhook para n8n/Zapier. Permite automações externas.' },
  { type: 'feature', title: 'Dashboard do agente IA em tempo real', impact: 'medio',
    description: 'Painel com conversas ativas do agente, tokens consumidos hoje, e alertas de erros. Supabase Realtime.' },
  { type: 'performance', title: 'Índice GIN em conversation_messages.content', impact: 'medio',
    description: 'Busca global de conversas (R12) vai precisar de full-text search. Criar índice GIN com pg_trgm.' },
  { type: 'feature', title: 'Cooldown automático com pg_cron', impact: 'alto',
    description: 'Handoff cooldown é só logado mas não enforced automaticamente. Criar cron job que reseta status_ia após X minutos.' },
];

const INFRA = { tables: 39, edgeFunctions: 22, storageBuckets: 3 };

// ─── Helpers ────────────────────────────────────────────────────────

const priorityColor = (p: string) => {
  if (p === 'alta') return 'text-red-500 bg-red-500/10 border-red-500/20';
  if (p === 'media') return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
  return 'text-muted-foreground bg-muted border-border';
};

const insightIcon = (type: string) => {
  if (type === 'performance') return <Zap className="w-4 h-4 text-yellow-500" />;
  if (type === 'security') return <Lock className="w-4 h-4 text-red-500" />;
  if (type === 'ux') return <Lightbulb className="w-4 h-4 text-blue-500" />;
  return <Rocket className="w-4 h-4 text-green-500" />;
};

const impactBadge = (impact: string) => {
  if (impact === 'alto') return <Badge className="text-[9px] bg-red-500/10 text-red-500 border-red-500/20">Alto</Badge>;
  if (impact === 'medio') return <Badge className="text-[9px] bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Médio</Badge>;
  return <Badge variant="outline" className="text-[9px]">Baixo</Badge>;
};

// ─── Component ──────────────────────────────────────────────────────

export default function RoadmapTab() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { data: config, isLoading } = useRoadmapConfig();

  // Map icon strings to React components
  const MODULES: Module[] = (config?.modules || []).map(m => ({
    ...m,
    icon: ICON_MAP[m.icon] || BrainCircuit,
  }));
  const ROADMAP_ITEMS: RoadmapItem[] = config?.roadmapItems || [];
  const CHANGELOG: ChangelogEntry[] = config?.changelog || [];
  const INSIGHTS: Insight[] = config?.insights || [];
  const INFRA = config?.infra || { tables: 0, edgeFunctions: 0, storageBuckets: 0 };

  const totalTasks = MODULES.reduce((a, m) => a + m.tasks.length, 0);
  const doneTasks = MODULES.reduce((a, m) => a + m.tasks.filter(t => t.status === 'done').length, 0);
  const pendingRoadmap = ROADMAP_ITEMS.filter(r => !r.done).length;

  const handleCopy = async (item: RoadmapItem) => {
    await navigator.clipboard.writeText(`Implemente "${item.feature}" no WhatsPRO.\n\n${item.description}`);
    setCopiedId(item.id);
    toast.success('Copiado!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Roadmap
          </h2>
          <p className="text-sm text-muted-foreground">Progresso de desenvolvimento por módulo</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs gap-1 px-2.5 py-1">
            <CheckCircle2 className="w-3 h-3 text-primary" />{doneTasks}/{totalTasks}
          </Badge>
          <Badge variant="outline" className="text-xs gap-1 px-2.5 py-1">
            <Rocket className="w-3 h-3 text-warning" />{pendingRoadmap} planejadas
          </Badge>
          <Badge className="bg-primary/15 text-primary border-primary/30 text-xs px-2.5 py-1">{CHANGELOG[0]?.version}</Badge>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="overview" className="gap-1.5 text-xs"><CheckCircle2 className="w-3.5 h-3.5" />Módulos</TabsTrigger>
          <TabsTrigger value="roadmap" className="gap-1.5 text-xs"><Rocket className="w-3.5 h-3.5" />Roadmap</TabsTrigger>
          <TabsTrigger value="changelog" className="gap-1.5 text-xs"><FileText className="w-3.5 h-3.5" />Changelog</TabsTrigger>
          <TabsTrigger value="insights" className="gap-1.5 text-xs"><Lightbulb className="w-3.5 h-3.5" />Insights</TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW TAB ── */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          {/* Module grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MODULES.map(mod => {
              const Icon = mod.icon;
              const done = mod.tasks.filter(t => t.status === 'done').length;
              const total = mod.tasks.length;
              const pct = Math.round((done / total) * 100);
              const isComplete = done === total;

              return (
                <Accordion key={mod.id} type="single" collapsible>
                  <AccordionItem value={mod.id} className="border rounded-xl overflow-hidden">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={cn('w-8 h-8 rounded-lg bg-muted flex items-center justify-center', mod.color)}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-semibold">{mod.id} — {mod.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[120px]">
                              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[10px] text-muted-foreground">{done}/{total}</span>
                          </div>
                        </div>
                        {isComplete ? (
                          <Badge className="bg-primary/15 text-primary border-primary/30 text-[9px]">Completo</Badge>
                        ) : (
                          <Badge className="bg-warning/15 text-warning border-warning/30 text-[9px]">{total - done} pend.</Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-3">
                      <div className="space-y-1 border-t pt-2">
                        {mod.tasks.map(task => (
                          <div key={task.id} className="flex items-center gap-2 py-0.5 text-xs">
                            {task.status === 'done' ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                            ) : (
                              <Circle className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                            )}
                            <span className={task.status === 'done' ? '' : 'text-muted-foreground'}>{task.description}</span>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              );
            })}
          </div>

          {/* Infra cards */}
          <div className="grid grid-cols-3 gap-3">
            <Card><CardContent className="p-3 text-center">
              <Database className="w-6 h-6 mx-auto mb-1 text-primary/60" />
              <p className="text-xl font-bold">{INFRA.tables}</p>
              <p className="text-[10px] text-muted-foreground">Tabelas</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <Zap className="w-6 h-6 mx-auto mb-1 text-primary/60" />
              <p className="text-xl font-bold">{INFRA.edgeFunctions}</p>
              <p className="text-[10px] text-muted-foreground">Edge Functions</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <HardDrive className="w-6 h-6 mx-auto mb-1 text-primary/60" />
              <p className="text-xl font-bold">{INFRA.storageBuckets}</p>
              <p className="text-[10px] text-muted-foreground">Storage Buckets</p>
            </CardContent></Card>
          </div>
        </TabsContent>

        {/* ── ROADMAP TAB ── */}
        <TabsContent value="roadmap" className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground mb-2">Funcionalidades planejadas para próximas versões. Clique no ícone para copiar o prompt.</p>

          {ROADMAP_ITEMS.map(item => (
            <Card key={item.id} className={cn('transition-all hover:border-primary/20', item.done && 'opacity-40')}>
              <CardContent className="p-3 flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-mono w-8 shrink-0">{item.id}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.feature}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
                </div>
                <Badge className={cn('text-[9px] shrink-0', priorityColor(item.priority))}>
                  {item.priority === 'alta' ? 'Alta' : item.priority === 'media' ? 'Média' : 'Baixa'}
                </Badge>
                <Badge variant="outline" className="text-[9px] shrink-0">{item.module}</Badge>
                {!item.done && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleCopy(item)}>
                    {copiedId === item.id ? <CheckCheck className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── CHANGELOG TAB ── */}
        <TabsContent value="changelog" className="mt-4">
          <Accordion type="single" collapsible defaultValue="item-0">
            {CHANGELOG.map((entry, i) => (
              <AccordionItem key={entry.version} value={`item-${i}`} className="border-border/50">
                <AccordionTrigger className="text-sm hover:no-underline py-2.5">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] font-mono">{entry.version}</Badge>
                    <span className="font-medium text-sm">{entry.title}</span>
                    <span className="text-[10px] text-muted-foreground">{entry.date}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-0.5 pl-1">
                    {entry.changes.map((change, j) => (
                      <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-3 h-3 text-primary shrink-0 mt-0.5" />{change}
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>

        {/* ── INSIGHTS TAB ── */}
        <TabsContent value="insights" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Lightbulb className="w-4 h-4 text-yellow-500" />Sugestões de Melhoria</CardTitle>
              <CardDescription className="text-xs">Insights de performance, segurança, UX e novas features baseados na análise do sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {['performance', 'security', 'ux', 'feature'].map(type => {
                const items = INSIGHTS.filter(i => i.type === type);
                const label = type === 'performance' ? 'Performance' : type === 'security' ? 'Segurança' : type === 'ux' ? 'UX / Usabilidade' : 'Novas Features';

                return (
                  <div key={type}>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-3 mb-1.5 flex items-center gap-1.5">
                      {insightIcon(type)}{label}
                    </p>
                    {items.map((insight, i) => (
                      <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg border hover:bg-accent/50 transition-colors mb-1.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{insight.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{insight.description}</p>
                        </div>
                        {impactBadge(insight.impact)}
                      </div>
                    ))}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Alta Prioridade</p>
                <p className="text-2xl font-bold text-red-500">{ROADMAP_ITEMS.filter(r => r.priority === 'alta' && !r.done).length}</p>
                <p className="text-xs text-muted-foreground">items no roadmap</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Insights Críticos</p>
                <p className="text-2xl font-bold text-yellow-500">{INSIGHTS.filter(i => i.impact === 'alto').length}</p>
                <p className="text-xs text-muted-foreground">impacto alto</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
