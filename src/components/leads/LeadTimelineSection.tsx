import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, ChevronDown } from 'lucide-react';
import type { ActionEvent } from './types';

interface LeadTimelineSectionProps {
  events: ActionEvent[];
}

const EVENT_ICONS: Record<string, string> = {
  contact: '📱',
  response: '🤖',
  handoff: '🔄',
  label: '🏷',
  shadow: '👁',
  tag: '#️⃣',
  profile: '👤',
  kanban: '📋',
};

const EVENT_COLORS: Record<string, string> = {
  contact: 'border-blue-500/50',
  response: 'border-primary/50',
  handoff: 'border-orange-500/50',
  label: 'border-violet-500/50',
  shadow: 'border-cyan-500/50',
  tag: 'border-yellow-500/50',
  profile: 'border-green-500/50',
  kanban: 'border-indigo-500/50',
};

export function LeadTimelineSection({ events }: LeadTimelineSectionProps) {
  const [showAll, setShowAll] = useState(false);
  const visibleEvents = showAll ? events : events.slice(0, 20);
  const hasMore = events.length > 20;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Ações
          <Badge variant="secondary" className="text-xs">{events.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma ação registrada</p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

            <div className="space-y-0.5">
              {visibleEvents.map((ev, i) => (
                <div key={i} className="flex items-start gap-3 py-2 relative">
                  {/* Icon circle */}
                  <div className={`w-[31px] h-[31px] rounded-full border-2 bg-background flex items-center justify-center flex-shrink-0 text-sm z-10 ${EVENT_COLORS[ev.type] || 'border-muted'}`}>
                    {EVENT_ICONS[ev.type] || '•'}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-1">
                    <p className="text-xs text-muted-foreground">
                      {new Date(ev.date).toLocaleDateString('pt-BR')}{' '}
                      {new Date(ev.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-sm mt-0.5">{ev.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {hasMore && !showAll && (
              <Button variant="ghost" size="sm" className="w-full mt-2 gap-1.5 text-xs" onClick={() => setShowAll(true)}>
                <ChevronDown className="w-3.5 h-3.5" />
                Ver mais {events.length - 20} eventos
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
