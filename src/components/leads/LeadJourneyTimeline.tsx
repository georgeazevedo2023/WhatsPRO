import { useLeadJourney, type JourneyEvent } from '@/hooks/useLeadJourney'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Link2, Megaphone, FileText, MessageSquare, Kanban } from 'lucide-react'

const EVENT_CONFIG: Record<JourneyEvent['type'], { icon: React.ReactNode; color: string }> = {
  bio_capture: { icon: <Link2 className="w-3.5 h-3.5" />, color: 'bg-emerald-500' },
  campaign_visit: { icon: <Megaphone className="w-3.5 h-3.5" />, color: 'bg-blue-500' },
  form_submission: { icon: <FileText className="w-3.5 h-3.5" />, color: 'bg-purple-500' },
  conversation: { icon: <MessageSquare className="w-3.5 h-3.5" />, color: 'bg-amber-500' },
  kanban: { icon: <Kanban className="w-3.5 h-3.5" />, color: 'bg-pink-500' },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export function LeadJourneyTimeline({ contactId }: { contactId: string }) {
  const { data: events, isLoading } = useLeadJourney(contactId)

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!events?.length) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          Jornada do Lead
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
            {events.length} evento{events.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="relative pl-6">
          {/* Vertical line */}
          <div className="absolute left-[11px] top-1 bottom-1 w-px bg-border" />

          <div className="space-y-4">
            {events.map((event, i) => {
              const cfg = EVENT_CONFIG[event.type]
              return (
                <div key={`${event.type}-${i}`} className="relative flex items-start gap-3">
                  {/* Dot */}
                  <div className={`absolute -left-6 mt-0.5 w-[22px] h-[22px] rounded-full ${cfg.color} flex items-center justify-center text-white shrink-0`}>
                    {cfg.icon}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight">{event.title}</p>
                    {event.subtitle && (
                      <p className="text-xs text-muted-foreground mt-0.5">{event.subtitle}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">{formatDate(event.timestamp)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
