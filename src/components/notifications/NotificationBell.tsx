// M19 S8 Camada 2: NotificationBell minimal (super_admin-only via caller)
// Popover com lista compacta. M19 S7 pode evoluir para multi-canal e realtime.
import { useNavigate } from 'react-router-dom';
import { Bell, Check, AlertTriangle, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useNotifications, type AppNotification } from '@/hooks/useNotifications';

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  db_size_alert: Database,
};

function severityClass(metadata: Record<string, unknown>): string {
  const sev = (metadata?.severity as string) || '';
  if (sev === 'critical') return 'text-red-500';
  if (sev === 'red') return 'text-rose-500';
  if (sev === 'yellow') return 'text-amber-500';
  return 'text-muted-foreground';
}

function relTime(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.floor(hr / 24);
  return `${d}d`;
}

export const NotificationBell = () => {
  const navigate = useNavigate();
  const { items, unreadCount, loading, markAsRead, markAllRead } = useNotifications();

  const handleClick = (n: AppNotification) => {
    if (!n.read) markAsRead(n.id);
    const route = n.metadata?.route as string | undefined;
    if (route) navigate(route);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          aria-label={`Notificações${unreadCount > 0 ? ` (${unreadCount} não lidas)` : ''}`}
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
          <h3 className="text-sm font-semibold">Notificações</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={markAllRead}>
              <Check className="w-3 h-3" /> Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {loading && items.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">Carregando...</div>
          ) : items.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              <Bell className="w-6 h-6 mx-auto mb-2 opacity-30" />
              Nenhuma notificação ainda
            </div>
          ) : (
            <ul className="divide-y divide-border/30">
              {items.map(n => {
                const Icon = TYPE_ICONS[n.type] || AlertTriangle;
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => handleClick(n)}
                      className={cn(
                        'w-full text-left px-3 py-2.5 hover:bg-muted/40 transition-colors flex gap-2.5',
                        !n.read && 'bg-primary/5'
                      )}
                    >
                      <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', severityClass((n.metadata || {}) as Record<string, unknown>))} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold truncate">{n.title}</p>
                          <span className="text-[10px] text-muted-foreground shrink-0">{relTime(n.created_at)}</span>
                        </div>
                        {n.message && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                        )}
                        {!n.read && (
                          <Badge variant="default" className="mt-1 h-4 px-1.5 text-[9px]">novo</Badge>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
