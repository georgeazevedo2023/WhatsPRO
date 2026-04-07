import { Suspense, lazy, useEffect, useRef } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import DashboardLayout from "./components/dashboard/DashboardLayout";

// Lazy load dashboard pages for better initial load performance
const DashboardHome = lazy(() => import("./pages/dashboard/DashboardHome"));
const Instances = lazy(() => import("./pages/dashboard/Instances"));
const InstanceDetails = lazy(() => import("./pages/dashboard/InstanceDetails"));
const GroupDetails = lazy(() => import("./pages/dashboard/GroupDetails"));
const SendToGroup = lazy(() => import("./pages/dashboard/SendToGroup"));
const UsersManagement = lazy(() => import("./pages/dashboard/UsersManagement"));
const Settings = lazy(() => import("./pages/dashboard/Settings"));
const ScheduledMessages = lazy(() => import("./pages/dashboard/ScheduledMessages"));
const Broadcaster = lazy(() => import("./pages/dashboard/Broadcaster"));
const BroadcastHistoryPage = lazy(() => import("./pages/dashboard/BroadcastHistoryPage"));
const LeadsBroadcaster = lazy(() => import("./pages/dashboard/LeadsBroadcaster"));
const MessageTemplatesPage = lazy(() => import("./pages/dashboard/MessageTemplatesPage"));
const HelpDesk = lazy(() => import("./pages/dashboard/HelpDesk"));
const InboxManagement = lazy(() => import("./pages/dashboard/InboxManagement"));
const InboxUsersManagement = lazy(() => import("./pages/dashboard/InboxUsersManagement"));
const AdminPanel = lazy(() => import("./pages/dashboard/AdminPanel"));
const AdminInboxes = lazy(() => import("./pages/dashboard/AdminInboxes"));
const AdminUsers = lazy(() => import("./pages/dashboard/AdminUsers"));
const AdminDepartments = lazy(() => import("./pages/dashboard/AdminDepartments"));
const AdminSecrets = lazy(() => import("./pages/dashboard/AdminSecrets"));
const AdminDocs = lazy(() => import("./pages/dashboard/AdminDocs"));
const AdminRoadmap = lazy(() => import("./pages/dashboard/AdminRoadmap"));
const AdminBackup = lazy(() => import("./pages/dashboard/AdminBackup"));
const AIAgentConfig = lazy(() => import("./pages/dashboard/AIAgentConfig"));
const AIAgentCatalog = lazy(() => import("./pages/dashboard/AIAgentCatalog"));
const AIAgentKnowledge = lazy(() => import("./pages/dashboard/AIAgentKnowledge"));
const AIAgentPlayground = lazy(() => import("./pages/dashboard/AIAgentPlayground"));
const Intelligence = lazy(() => import("./pages/dashboard/Intelligence"));
const Campaigns = lazy(() => import("./pages/dashboard/Campaigns"));
const CampaignCreate = lazy(() => import("./pages/dashboard/CampaignCreate"));
const CampaignDetail = lazy(() => import("./pages/dashboard/CampaignDetail"));
const KanbanCRM = lazy(() => import("./pages/dashboard/KanbanCRM"));
const KanbanBoard = lazy(() => import("./pages/dashboard/KanbanBoard"));
const Leads = lazy(() => import("./pages/dashboard/Leads"));
const LeadDetail = lazy(() => import("./pages/dashboard/LeadDetail"));
const WhatsappFormsPage = lazy(() => import("./pages/dashboard/WhatsappFormsPage"));
const CampaignRedirect = lazy(() => import("./pages/CampaignRedirect"));
const BioPage = lazy(() => import("./pages/BioPage"));
const BioLinksPage = lazy(() => import("./pages/dashboard/BioLinksPage"));
const FunnelsPage = lazy(() => import("./pages/dashboard/FunnelsPage"));
const FunnelWizard = lazy(() => import("./pages/dashboard/FunnelWizard"));
const FunnelDetail = lazy(() => import("./pages/dashboard/FunnelDetail"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,     // 1 minute default (more responsive for helpdesk)
      gcTime: 5 * 60 * 1000,    // 5 minutes — keep unused cache
      retry: 1,
      refetchOnWindowFocus: true, // Re-fetch on tab focus (agents switch tabs)
    },
  },
});

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

/**
 * Refreshes stale data when user returns to the tab after being away.
 * Fixes: useInstances (legacy hook) + Supabase session going stale on inactive tabs.
 */
function useTabFocusRefresh() {
  const qc = useQueryClient();
  const hiddenAtRef = useRef<number>(0);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
        return;
      }
      // Tab became visible — check how long it was hidden
      const awayMs = Date.now() - hiddenAtRef.current;
      if (awayMs < 30_000) return; // less than 30s, skip

      // Refresh Supabase session (may have expired while tab was suspended)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) return; // logged out, auth context will handle redirect
        // Invalidate all React Query caches so they refetch with fresh token
        qc.invalidateQueries();
        // Trigger refetch for legacy hooks (useInstances listens for this)
        window.dispatchEvent(new Event('instances-updated'));
      });
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [qc]);
}

// Protected route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Auth route wrapper (redirect based on role if already logged in)
const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isSuperAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    // Super admin vai para o dashboard principal, outros vão para o helpdesk
    const target = isSuperAdmin ? "/dashboard" : "/dashboard/helpdesk";
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
};

// Admin-only route wrapper
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isSuperAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard/helpdesk" replace />;
  }

  return <>{children}</>;
};

// CRM route wrapper — apenas super_admin e gerente
const CrmRoute = ({ children }: { children: React.ReactNode }) => {
  const { isSuperAdmin, isGerente, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isSuperAdmin && !isGerente) {
    return <Navigate to="/dashboard/helpdesk" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  useTabFocusRefresh();
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/r" element={<Suspense fallback={null}><CampaignRedirect /></Suspense>} />
      <Route path="/bio/:slug" element={<Suspense fallback={null}><BioPage /></Suspense>} />
      <Route
        path="/login"
        element={
          <AuthRoute>
            <Login />
          </AuthRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminRoute><ErrorBoundary section="Dashboard"><Suspense fallback={<PageLoader />}><DashboardHome /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="broadcast" element={<AdminRoute><ErrorBoundary section="Disparador"><Suspense fallback={<PageLoader />}><Broadcaster /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="broadcast/history" element={<AdminRoute><ErrorBoundary section="Histórico"><Suspense fallback={<PageLoader />}><BroadcastHistoryPage /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="broadcast/leads" element={<AdminRoute><ErrorBoundary section="Leads"><Suspense fallback={<PageLoader />}><LeadsBroadcaster /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="broadcast/templates" element={<AdminRoute><ErrorBoundary section="Templates"><Suspense fallback={<PageLoader />}><MessageTemplatesPage /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="instances" element={<AdminRoute><ErrorBoundary section="Instâncias"><Suspense fallback={<PageLoader />}><Instances /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="instances/:id" element={<AdminRoute><ErrorBoundary section="Detalhes da Instância"><Suspense fallback={<PageLoader />}><InstanceDetails /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="instances/:instanceId/groups/:groupId" element={<AdminRoute><ErrorBoundary section="Grupo"><Suspense fallback={<PageLoader />}><GroupDetails /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="instances/:instanceId/groups/:groupId/send" element={<AdminRoute><ErrorBoundary section="Enviar ao Grupo"><Suspense fallback={<PageLoader />}><SendToGroup /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="users" element={<AdminRoute><ErrorBoundary section="Usuários"><Suspense fallback={<PageLoader />}><UsersManagement /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="settings" element={<AdminRoute><ErrorBoundary section="Configurações"><Suspense fallback={<PageLoader />}><Settings /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="scheduled" element={<AdminRoute><ErrorBoundary section="Agendamentos"><Suspense fallback={<PageLoader />}><ScheduledMessages /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="helpdesk" element={<ErrorBoundary section="Atendimento"><Suspense fallback={<PageLoader />}><HelpDesk /></Suspense></ErrorBoundary>} />
        <Route path="inboxes" element={<AdminRoute><ErrorBoundary section="Caixas"><Suspense fallback={<PageLoader />}><InboxManagement /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="inbox-users" element={<AdminRoute><ErrorBoundary section="Membros"><Suspense fallback={<PageLoader />}><InboxUsersManagement /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="admin" element={<AdminRoute><ErrorBoundary section="Administração"><Suspense fallback={<PageLoader />}><AdminPanel /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="admin/inboxes" element={<AdminRoute><ErrorBoundary section="Caixas"><Suspense fallback={<PageLoader />}><AdminInboxes /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="admin/users" element={<AdminRoute><ErrorBoundary section="Equipe"><Suspense fallback={<PageLoader />}><AdminUsers /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="admin/departments" element={<AdminRoute><ErrorBoundary section="Departamentos"><Suspense fallback={<PageLoader />}><AdminDepartments /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="admin/secrets" element={<AdminRoute><ErrorBoundary section="Secrets"><Suspense fallback={<PageLoader />}><AdminSecrets /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="admin/docs" element={<AdminRoute><ErrorBoundary section="Documentação"><Suspense fallback={<PageLoader />}><AdminDocs /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="admin/roadmap" element={<AdminRoute><ErrorBoundary section="Roadmap"><Suspense fallback={<PageLoader />}><AdminRoadmap /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="admin/backup" element={<AdminRoute><ErrorBoundary section="Backup"><Suspense fallback={<PageLoader />}><AdminBackup /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="docs" element={<AdminRoute><ErrorBoundary section="Documentação"><Suspense fallback={<PageLoader />}><AdminDocs /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="roadmap" element={<AdminRoute><ErrorBoundary section="Roadmap"><Suspense fallback={<PageLoader />}><AdminRoadmap /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="backup" element={<AdminRoute><ErrorBoundary section="Backup"><Suspense fallback={<PageLoader />}><AdminBackup /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="ai-agent" element={<AdminRoute><ErrorBoundary section="Agente IA"><Suspense fallback={<PageLoader />}><AIAgentConfig /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="ai-agent/catalog" element={<AdminRoute><ErrorBoundary section="Catálogo IA"><Suspense fallback={<PageLoader />}><AIAgentCatalog /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="ai-agent/knowledge" element={<AdminRoute><ErrorBoundary section="Conhecimento IA"><Suspense fallback={<PageLoader />}><AIAgentKnowledge /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="ai-agent/playground" element={<AdminRoute><ErrorBoundary section="Playground IA"><Suspense fallback={<PageLoader />}><AIAgentPlayground /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="intelligence" element={<AdminRoute><ErrorBoundary section="Inteligência"><Suspense fallback={<PageLoader />}><Intelligence /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="campaigns" element={<AdminRoute><ErrorBoundary section="Campanhas"><Suspense fallback={<PageLoader />}><Campaigns /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="campaigns/new" element={<AdminRoute><ErrorBoundary section="Nova Campanha"><Suspense fallback={<PageLoader />}><CampaignCreate /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="campaigns/:id" element={<AdminRoute><ErrorBoundary section="Campanha"><Suspense fallback={<PageLoader />}><CampaignDetail /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="campaigns/:id/edit" element={<AdminRoute><ErrorBoundary section="Editar Campanha"><Suspense fallback={<PageLoader />}><CampaignCreate /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="crm" element={<CrmRoute><ErrorBoundary section="CRM"><Suspense fallback={<PageLoader />}><KanbanCRM /></Suspense></ErrorBoundary></CrmRoute>} />
        <Route path="crm/:boardId" element={<CrmRoute><ErrorBoundary section="Quadro CRM"><Suspense fallback={<PageLoader />}><KanbanBoard /></Suspense></ErrorBoundary></CrmRoute>} />
        <Route path="leads" element={<CrmRoute><ErrorBoundary section="Leads"><Suspense fallback={<PageLoader />}><Leads /></Suspense></ErrorBoundary></CrmRoute>} />
        <Route path="leads/:contactId" element={<CrmRoute><ErrorBoundary section="Lead"><Suspense fallback={<PageLoader />}><LeadDetail /></Suspense></ErrorBoundary></CrmRoute>} />
        <Route path="forms" element={<AdminRoute><ErrorBoundary section="Formulários"><Suspense fallback={<PageLoader />}><WhatsappFormsPage /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="bio-links" element={<AdminRoute><ErrorBoundary section="Bio Link"><Suspense fallback={<PageLoader />}><BioLinksPage /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="funnels" element={<AdminRoute><ErrorBoundary section="Funis"><Suspense fallback={<PageLoader />}><FunnelsPage /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="funnels/new" element={<AdminRoute><ErrorBoundary section="Novo Funil"><Suspense fallback={<PageLoader />}><FunnelWizard /></Suspense></ErrorBoundary></AdminRoute>} />
        <Route path="funnels/:id" element={<AdminRoute><ErrorBoundary section="Funil"><Suspense fallback={<PageLoader />}><FunnelDetail /></Suspense></ErrorBoundary></AdminRoute>} />
        {/* Redirect legacy/bookmarked URLs */}
        <Route path="leads-broadcast" element={<Navigate to="/dashboard/broadcast/leads" replace />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" themes={["dark", "light"]} disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
