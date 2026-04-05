import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  helpdesk: 'Atendimento',
  scheduled: 'Agendamentos',
  broadcast: 'Disparador',
  history: 'Historico',
  instances: 'Instancias',
  leads: 'Leads',
  'ai-agent': 'Agente IA',
  catalog: 'Catalogo',
  knowledge: 'Conhecimento',
  playground: 'Playground',
  admin: 'Admin',
  inboxes: 'Caixas',
  users: 'Equipe',
  departments: 'Departamentos',
  secrets: 'Secrets',
  settings: 'Configuracoes',
  intelligence: 'Inteligencia',
  campaigns: 'Campanhas',
  new: 'Nova',
  'kanban-crm': 'CRM',
  docs: 'Documentacao',
  backup: 'Backup',
  roadmap: 'Roadmap',
};

const Breadcrumbs = () => {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  // Don't show breadcrumbs on the root dashboard page
  if (segments.length <= 1) return null;

  const crumbs = segments.map((segment, index) => {
    const path = '/' + segments.slice(0, index + 1).join('/');
    const label = ROUTE_LABELS[segment] || segment;
    const isLast = index === segments.length - 1;
    // Skip UUID-like segments (instance details, etc.)
    if (/^[0-9a-f]{8}-/.test(segment)) return null;
    return { path, label, isLast, segment };
  }).filter(Boolean);

  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground mb-3 px-1">
      <Link to="/dashboard" className="hover:text-foreground transition-colors">
        <Home className="w-3.5 h-3.5" />
      </Link>
      {crumbs.slice(1).map((crumb) => (
        <span key={crumb!.path} className="flex items-center gap-1">
          <ChevronRight className="w-3 h-3 opacity-40" />
          {crumb!.isLast ? (
            <span className="text-foreground font-medium truncate max-w-[120px] sm:max-w-none">{crumb!.label}</span>
          ) : (
            <Link to={crumb!.path} className="hover:text-foreground transition-colors truncate max-w-[120px] sm:max-w-none">
              {crumb!.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
};

export default Breadcrumbs;
