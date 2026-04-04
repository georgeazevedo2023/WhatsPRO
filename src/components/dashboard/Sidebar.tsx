import { Link, useLocation, useParams } from 'react-router-dom';
import type { Instance } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { handleError } from '@/lib/errorUtils';
import {
  MessageSquareMore,
  Search,
  LayoutDashboard,
  MonitorSmartphone,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ChevronDown,
  Clock,
  Send,
  Headphones,
  Inbox,
  BrainCircuit,
  Kanban,
  Building2,
  Bot,
  Package,
  BookOpen,
  Play,
  Users,
  Briefcase,
  KeyRound,
  FileText,
  Map,
  Shield,
  Contact2,
  Megaphone,
  Plus,
  BookMarked,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';


interface DepartmentItem {
  id: string;
  name: string;
  is_default: boolean;
}

interface InboxItem {
  id: string;
  name: string;
  instance_id: string;
  departments: DepartmentItem[];
}

interface InstanceWithInboxes extends Instance {
  inboxes: InboxItem[];
}

interface SidebarProps {
  isMobile?: boolean;
  onNavigate?: () => void;
  onOpenSearch?: () => void;
}

const Sidebar = ({ isMobile = false, onNavigate, onOpenSearch }: SidebarProps) => {
  const location = useLocation();
  const { id: instanceId } = useParams<{ id: string }>();
  const { profile, isSuperAdmin, isGerente, signOut, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [instancesOpen, setInstancesOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [helpdeskOpen, setHelpdeskOpen] = useState(false);
  const [campanhasOpen, setCampanhasOpen] = useState(false);
  const [aiAgentOpen, setAiAgentOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [instancesWithInboxes, setInstancesWithInboxes] = useState<InstanceWithInboxes[]>([]);

  // No mobile, nunca está colapsado
  const isCollapsed = isMobile ? false : collapsed;

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Clock, label: 'Agendamentos', path: '/dashboard/scheduled' },
    { icon: FileText, label: 'Formulários', path: '/dashboard/forms' },
  ];

  const isActive = (path: string) => location.pathname === path;
  const isPathActive = (prefix: string) => location.pathname.startsWith(prefix);
  const isInstancesActive = location.pathname.startsWith('/dashboard/instances');
  const isBroadcastActive = location.pathname.startsWith('/dashboard/broadcast');
  const isHelpdeskActive = location.pathname.startsWith('/dashboard/helpdesk');
  const isCampanhasActive = location.pathname.startsWith('/dashboard/campaigns');
  const isAiAgentActive = location.pathname.startsWith('/dashboard/ai-agent');
  const isAdminActive = location.pathname.startsWith('/dashboard/admin');
  const isDocsActive = ['/dashboard/docs', '/dashboard/roadmap', '/dashboard/backup'].some(p => location.pathname.startsWith(p));

  // Auto-open collapsibles based on current path
  useEffect(() => {
    if (isCampanhasActive) setCampanhasOpen(true);
    if (isAiAgentActive) setAiAgentOpen(true);
    if (isAdminActive) setAdminOpen(true);
    if (isDocsActive) setDocsOpen(true);
    if (isHelpdeskActive) setHelpdeskOpen(true);
    if (isBroadcastActive) setBroadcastOpen(true);
    if (isInstancesActive) setInstancesOpen(true);
  }, [location.pathname]);

  const fetchInstances = async () => {
    try {
      if (isSuperAdmin) {
        const [instancesRes, inboxesRes, deptsRes] = await Promise.all([
          supabase.from('instances').select('id, name, status').eq('disabled', false).order('name'),
          supabase.from('inboxes').select('id, name, instance_id').order('name'),
          supabase.from('departments').select('id, name, inbox_id, is_default').order('name'),
        ]);

        if (instancesRes.error) throw instancesRes.error;
        const allInstances = instancesRes.data || [];
        setInstances(allInstances);

        const allDepts = deptsRes.data || [];
        const allInboxes: InboxItem[] = (inboxesRes.data || []).map(ib => ({
          ...ib,
          departments: allDepts.filter(d => d.inbox_id === ib.id),
        }));
        const grouped: InstanceWithInboxes[] = allInstances
          .map(inst => ({
            ...inst,
            inboxes: allInboxes.filter(ib => ib.instance_id === inst.id),
          }))
          .filter(inst => inst.inboxes.length > 0);
        setInstancesWithInboxes(grouped);
      } else {
        // Non-admin: fetch only inboxes user has access to
        const [userInboxesRes, deptsRes2] = await Promise.all([
          supabase.from('inbox_users').select('inboxes(id, name, instance_id)').eq('user_id', user!.id),
          supabase.from('departments').select('id, name, inbox_id, is_default').order('name'),
        ]);

        const allDepts2 = deptsRes2.data || [];
        const rawInboxes = (userInboxesRes.data || [])
          .map((d: { inboxes: { id: string; name: string; instance_id: string } | null }) => d.inboxes)
          .filter(Boolean) as { id: string; name: string; instance_id: string }[];
        const inboxList: InboxItem[] = rawInboxes.map((ib) => ({
          ...ib,
          departments: allDepts2.filter(d => d.inbox_id === ib.id),
        }));

        // Get unique instance IDs from user's inboxes
        const instanceIds = [...new Set(inboxList.map(ib => ib.instance_id))];
        if (instanceIds.length > 0) {
          const { data: instData } = await supabase
            .from('instances')
            .select('id, name, status')
            .in('id', instanceIds)
            .order('name');

          const instList = instData || [];
          setInstances(instList);
          const grouped: InstanceWithInboxes[] = instList
            .map(inst => ({
              ...inst,
              inboxes: inboxList.filter(ib => ib.instance_id === inst.id),
            }))
            .filter(inst => inst.inboxes.length > 0);
          setInstancesWithInboxes(grouped);
        } else {
          setInstances([]);
          setInstancesWithInboxes([]);
        }
      }
    } catch (error) {
      handleError(error, 'Erro ao carregar instâncias', 'Sidebar fetch instances');
    }
  };

  useEffect(() => {
    if (user) {
      fetchInstances();
    }
  }, [user, isSuperAdmin]);

  // Listen for instance updates (e.g., after sync/delete orphans)
  useEffect(() => {
    const handleInstancesUpdate = () => {
      fetchInstances();
    };

    window.addEventListener('instances-updated', handleInstancesUpdate);
    return () => {
      window.removeEventListener('instances-updated', handleInstancesUpdate);
    };
  }, [fetchInstances]);

  // Classe base para links colapsados (centralizado)
  const collapsedLinkClass = cn(
    'flex items-center justify-center w-full px-3 py-2.5 rounded-lg transition-all'
  );

  const handleLinkClick = () => {
    if (onNavigate) {
      onNavigate();
    }
  };

  // Helper: render a collapsible section
  const renderCollapsible = (
    icon: React.ElementType,
    label: string,
    isOpen: boolean,
    setIsOpen: (v: boolean) => void,
    isGroupActive: boolean,
    collapsedPath: string,
    children: React.ReactNode
  ) => {
    const Icon = icon;
    if (isCollapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to={collapsedPath}
              onClick={handleLinkClick}
              aria-label={label}
              className={cn(
                collapsedLinkClass,
                isGroupActive
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent'
              )}
            >
              <Icon className="w-5 h-5" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all w-full text-left',
              isGroupActive
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'text-sidebar-foreground hover:bg-sidebar-accent'
            )}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="font-medium flex-1">{label}</span>
            <ChevronDown
              className={cn(
                'w-4 h-4 transition-transform',
                isOpen && 'transform rotate-180'
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-5 mt-1 space-y-0.5">
          {children}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  // Helper: sub-item link
  const renderSubItem = (path: string, label: string, icon?: React.ElementType) => {
    const Icon = icon;
    const active = isActive(path);
    return (
      <Link
        key={path}
        to={path}
        onClick={handleLinkClick}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-sm',
          active
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
        )}
      >
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
        <span className="truncate">{label}</span>
      </Link>
    );
  };

  return (
    <TooltipProvider>
      <aside
        className={cn(
          'h-full flex flex-col transition-all duration-300',
          isMobile ? 'w-full sidebar-glass' : 'sidebar-glass',
          !isMobile && (isCollapsed ? 'w-20' : 'w-64')
        )}
      >
      {/* Header */}
      <div className={cn(
        'h-16 flex items-center justify-between px-4 border-b border-primary/10',
        isMobile && 'hidden' // No mobile, o header está no MobileHeader
      )}>
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <MessageSquareMore className="w-5 h-5 text-primary" />
            </div>
            <span className="font-display font-bold text-lg">WhatsPRO</span>
          </div>
        )}
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className={cn('shrink-0', isCollapsed && 'mx-auto')}
            aria-label={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Menu principal">
        {/* Global Search */}
        {onOpenSearch && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onOpenSearch}
                className={cn(
                  isCollapsed ? collapsedLinkClass : 'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all w-full text-left',
                  'text-sidebar-foreground hover:bg-sidebar-accent'
                )}
              >
                <Search className="w-5 h-5 shrink-0" />
                {!isCollapsed && (
                  <div className="flex items-center justify-between flex-1 min-w-0">
                    <span className="font-medium">Buscar</span>
                    <kbd className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">Ctrl+K</kbd>
                  </div>
                )}
              </button>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right">Buscar (Ctrl+K)</TooltipContent>}
          </Tooltip>
        )}

        <div className="h-px bg-border/20 my-1" />

        {/* Dashboard + Agendamentos (admin only) */}
        {isSuperAdmin && navItems.map((item) => (
          <Tooltip key={item.path}>
            <TooltipTrigger asChild>
              <Link
                to={item.path}
                onClick={handleLinkClick}
                aria-label={item.label}
                className={cn(
                  isCollapsed ? collapsedLinkClass : 'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all',
                  isActive(item.path)
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent'
                )}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {!isCollapsed && <span className="font-medium">{item.label}</span>}
              </Link>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
          </Tooltip>
        ))}

        {/* Atendimento - Collapsible com instâncias e inboxes */}
        {!isCollapsed ? (
          <Collapsible open={helpdeskOpen} onOpenChange={setHelpdeskOpen}>
            <CollapsibleTrigger asChild>
              <button
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all w-full text-left',
                  isHelpdeskActive
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent'
                )}
              >
                <Headphones className="w-5 h-5 shrink-0" />
                <span className="font-medium flex-1">Atendimento</span>
                <ChevronDown
                  className={cn(
                    'w-4 h-4 transition-transform',
                    helpdeskOpen && 'transform rotate-180'
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-5 mt-1 space-y-1">
              {instancesWithInboxes.map((instance) => (
                <div key={instance.id} className="space-y-0.5">
                  <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <span
                      className={cn(
                        'w-1.5 h-1.5 rounded-full shrink-0',
                        instance.status === 'connected' ? 'bg-success' : 'bg-muted-foreground'
                      )}
                    />
                    <span className="truncate">{instance.name}</span>
                  </div>
                  {instance.inboxes.map((inbox) => (
                    <div key={inbox.id} className="space-y-0.5">
                      <Link
                        to={`/dashboard/helpdesk?inbox=${inbox.id}`}
                        onClick={handleLinkClick}
                        className={cn(
                          'flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-sm pl-6',
                          location.search.includes(inbox.id) && !location.search.includes('dept=')
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
                        )}
                      >
                        <Inbox className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{inbox.name}</span>
                      </Link>
                      {inbox.departments.map((dept) => (
                        <Link
                          key={dept.id}
                          to={dept.is_default ? `/dashboard/helpdesk?inbox=${inbox.id}` : `/dashboard/helpdesk?inbox=${inbox.id}&dept=${dept.id}`}
                          onClick={handleLinkClick}
                          className={cn(
                            'flex items-center gap-2 px-3 py-1 rounded-lg transition-all text-xs pl-10',
                            location.search.includes(dept.id)
                              ? 'bg-primary/10 text-primary'
                              : 'text-muted-foreground/70 hover:bg-sidebar-accent hover:text-foreground'
                          )}
                        >
                          <Building2 className="w-3 h-3 shrink-0" />
                          <span className="truncate">{dept.name}</span>
                          {dept.is_default && (
                            <span className="text-[9px] opacity-50 shrink-0">padrao</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  ))}
                  {instancesWithInboxes.length === 0 && (
                    <span className="px-3 py-2 text-xs text-muted-foreground">Nenhuma caixa configurada</span>
                  )}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/dashboard/helpdesk"
                onClick={handleLinkClick}
                aria-label="Atendimento"
                className={cn(
                  collapsedLinkClass,
                  isHelpdeskActive
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent'
                )}
              >
                <Headphones className="w-5 h-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Atendimento</TooltipContent>
          </Tooltip>
        )}

        {/* CRM Kanban - visível apenas para super_admin e gerente */}
        {(isSuperAdmin || isGerente) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/dashboard/crm"
                onClick={handleLinkClick}
                aria-label="CRM Kanban"
                className={cn(
                  isCollapsed ? collapsedLinkClass : 'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all',
                  location.pathname.startsWith('/dashboard/crm')
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent'
                )}
              >
                <Kanban className="w-5 h-5 shrink-0" />
                {!isCollapsed && <span className="font-medium">CRM</span>}
              </Link>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right">CRM Kanban</TooltipContent>}
          </Tooltip>
        )}

        {/* Leads - link direto (super admin + gerente) */}
        {(isSuperAdmin || isGerente) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/dashboard/leads"
                onClick={handleLinkClick}
                aria-label="Leads"
                className={cn(
                  isCollapsed ? collapsedLinkClass : 'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all',
                  isActive('/dashboard/leads')
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent'
                )}
              >
                <Contact2 className="w-5 h-5 shrink-0" />
                {!isCollapsed && <span className="font-medium">Leads</span>}
              </Link>
            </TooltipTrigger>
            {isCollapsed && <TooltipContent side="right">Leads</TooltipContent>}
          </Tooltip>
        )}

        {/* Campanhas - Collapsible (super admin only) */}
        {isSuperAdmin && renderCollapsible(
          Megaphone,
          'Campanhas',
          campanhasOpen,
          setCampanhasOpen,
          isCampanhasActive,
          '/dashboard/campaigns',
          <>
            {renderSubItem('/dashboard/campaigns', 'Todas', Megaphone)}
            {renderSubItem('/dashboard/campaigns/new', 'Nova campanha', Plus)}
          </>
        )}

        {/* Agente IA - Collapsible (super admin only) */}
        {isSuperAdmin && renderCollapsible(
          Bot,
          'Agente IA',
          aiAgentOpen,
          setAiAgentOpen,
          isAiAgentActive,
          '/dashboard/ai-agent',
          <>
            {renderSubItem('/dashboard/ai-agent', 'Configuracao', Bot)}
            {renderSubItem('/dashboard/ai-agent/playground', 'Playground', Play)}
          </>
        )}

        {/* Disparador - Collapsible (super admin only) */}
        {isSuperAdmin && renderCollapsible(
          Send,
          'Disparador',
          broadcastOpen,
          setBroadcastOpen,
          isBroadcastActive,
          '/dashboard/broadcast',
          <>
            {renderSubItem('/dashboard/broadcast', 'Grupos', undefined)}
            {renderSubItem('/dashboard/broadcast/leads', 'Leads', Contact2)}
            {renderSubItem('/dashboard/broadcast/templates', 'Templates', BookMarked)}
            {renderSubItem('/dashboard/broadcast/history', 'Historico', undefined)}
          </>
        )}

        {/* Instancias - Collapsible (super admin only) */}
        {isSuperAdmin && (!isCollapsed ? (
          <Collapsible open={instancesOpen} onOpenChange={setInstancesOpen}>
            <CollapsibleTrigger asChild>
              <button
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all w-full text-left',
                  isInstancesActive
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent'
                )}
              >
                <MonitorSmartphone className="w-5 h-5 shrink-0" />
                <span className="font-medium flex-1">Instancias</span>
                <ChevronDown
                  className={cn(
                    'w-4 h-4 transition-transform',
                    instancesOpen && 'transform rotate-180'
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-5 mt-1 space-y-1">
              <Link
                to="/dashboard/instances"
                onClick={handleLinkClick}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm',
                  isActive('/dashboard/instances')
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
                )}
              >
                <span>Todas as instancias</span>
              </Link>
              {instances.slice(0, 5).map((instance) => (
                <Link
                  key={instance.id}
                  to={`/dashboard/instances/${instance.id}`}
                  onClick={handleLinkClick}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm',
                    instanceId === instance.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full shrink-0',
                      instance.status === 'connected' ? 'bg-success' : 'bg-muted-foreground'
                    )}
                  />
                  <span className="truncate">{instance.name}</span>
                </Link>
              ))}
              {instances.length > 5 && (
                <Link
                  to="/dashboard/instances"
                  onClick={handleLinkClick}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground"
                >
                  <span>+{instances.length - 5} mais...</span>
                </Link>
              )}
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/dashboard/instances"
                onClick={handleLinkClick}
                aria-label="Instancias"
                className={cn(
                  collapsedLinkClass,
                  isInstancesActive
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent'
                )}
              >
                <MonitorSmartphone className="w-5 h-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Instancias</TooltipContent>
          </Tooltip>
        ))}

        {/* ── ADMIN SECTION ── */}
        {isSuperAdmin && (
          <>
            <div className="pt-4 pb-2">
              {!isCollapsed && (
                <div className="flex items-center gap-2 px-3 text-xs text-muted-foreground uppercase tracking-wider">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Admin</span>
                </div>
              )}
            </div>

            {/* Inteligencia - link simples */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/dashboard/intelligence"
                  onClick={handleLinkClick}
                  aria-label="Inteligencia"
                  className={cn(
                    isCollapsed ? collapsedLinkClass : 'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all',
                    isActive('/dashboard/intelligence')
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent'
                  )}
                >
                  <BrainCircuit className="w-5 h-5 shrink-0" />
                  {!isCollapsed && <span className="font-medium">Inteligencia</span>}
                </Link>
              </TooltipTrigger>
              {isCollapsed && <TooltipContent side="right">Inteligencia</TooltipContent>}
            </Tooltip>

            {/* Administracao - Collapsible */}
            {renderCollapsible(
              ShieldCheck,
              'Administracao',
              adminOpen,
              setAdminOpen,
              isAdminActive,
              '/dashboard/admin/inboxes',
              <>
                {renderSubItem('/dashboard/admin/inboxes', 'Caixas de Entrada', Inbox)}
                {renderSubItem('/dashboard/admin/users', 'Equipe', Users)}
                {renderSubItem('/dashboard/admin/departments', 'Departamentos', Briefcase)}
                {renderSubItem('/dashboard/admin/secrets', 'Secrets', KeyRound)}
              </>
            )}

            {/* Documentacao - Collapsible */}
            {renderCollapsible(
              FileText,
              'Documentacao',
              docsOpen,
              setDocsOpen,
              isDocsActive,
              '/dashboard/docs',
              <>
                {renderSubItem('/dashboard/docs', 'Docs', FileText)}
                {renderSubItem('/dashboard/roadmap', 'Roadmap', Map)}
                {renderSubItem('/dashboard/backup', 'Backup', Shield)}
              </>
            )}

            {/* Configuracoes - link simples */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/dashboard/settings"
                  onClick={handleLinkClick}
                  aria-label="Configuracoes"
                  className={cn(
                    isCollapsed ? collapsedLinkClass : 'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all',
                    isActive('/dashboard/settings')
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent'
                  )}
                >
                  <Settings className="w-5 h-5 shrink-0" />
                  {!isCollapsed && <span className="font-medium">Configuracoes</span>}
                </Link>
              </TooltipTrigger>
              {isCollapsed && <TooltipContent side="right">Configuracoes</TooltipContent>}
            </Tooltip>
          </>
        )}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-primary/10">
        <div
          className={cn(
            'flex items-center gap-3 p-2 rounded-lg',
            isCollapsed && 'justify-center'
          )}
        >
          <Avatar className="w-10 h-10 shrink-0">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{profile?.full_name || 'Usuario'}</p>
              <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
              {/* Badge de papel */}
              <span className={cn(
                'inline-flex items-center text-[10px] font-medium rounded-full px-1.5 py-0.5 mt-0.5',
                isSuperAdmin
                  ? 'bg-primary/15 text-primary'
                  : isGerente
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-muted text-muted-foreground'
              )}>
                {isSuperAdmin ? 'Super Admin' : isGerente ? 'Gerente' : 'Atendente'}
              </span>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
          className={cn(
            'w-full mt-2 text-muted-foreground hover:text-foreground',
            isCollapsed ? 'px-0 justify-center' : 'justify-start'
          )}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {!isCollapsed && <span className="ml-2">{theme === 'dark' ? 'Tema Claro' : 'Tema Escuro'}</span>}
        </Button>
        <Button
          variant="ghost"
          onClick={signOut}
          aria-label="Sair"
          className={cn(
            'w-full mt-2 text-muted-foreground hover:text-destructive',
            isCollapsed ? 'px-0 justify-center' : 'justify-start'
          )}
        >
          <LogOut className="w-4 h-4" />
          {!isCollapsed && <span className="ml-2">Sair</span>}
        </Button>
      </div>
    </aside>
    </TooltipProvider>
  );
};

export default Sidebar;
