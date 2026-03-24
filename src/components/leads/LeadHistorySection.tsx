import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Eye, MessageSquare, Brain, Lightbulb, BookOpen } from 'lucide-react';

interface LeadHistorySectionProps {
  conversations: any[];
  lastSummary: any;
  summaries: any[];
  notes: string | null;
  interests: string | string[] | null;
  onOpenConversation: (convId: string) => void;
}

export function LeadHistorySection({
  conversations, lastSummary, summaries, notes, interests, onOpenConversation,
}: LeadHistorySectionProps) {
  const interestsList = Array.isArray(interests) ? interests : interests ? [interests] : [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          Histórico
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Last AI summary */}
        {lastSummary && (
          <div className="p-3 rounded-lg border bg-muted/30 space-y-1.5">
            <p className="text-xs text-muted-foreground uppercase font-semibold flex items-center gap-1.5">
              <Brain className="w-3 h-3" />Último Resumo IA
            </p>
            {lastSummary.reason && <p className="text-sm"><strong>Motivo:</strong> {lastSummary.reason}</p>}
            {lastSummary.summary && <p className="text-sm">{lastSummary.summary}</p>}
            {lastSummary.resolution && <p className="text-sm text-muted-foreground">{lastSummary.resolution}</p>}
          </div>
        )}

        {/* Long summaries */}
        {summaries.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold mb-2 flex items-center gap-1.5">
              <BookOpen className="w-3 h-3" />Resumo Longo ({summaries.length})
            </p>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {summaries.slice().reverse().map((s: any, i: number) => (
                <div key={i} className="p-3 rounded-lg border text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground">{new Date(s.date).toLocaleDateString('pt-BR')}</span>
                    {s.outcome && <Badge variant="outline" className="text-[9px]">{s.outcome}</Badge>}
                    {s.tools_used?.length > 0 && (
                      <Badge variant="secondary" className="text-[9px]">{s.tools_used.length} tool{s.tools_used.length > 1 ? 's' : ''}</Badge>
                    )}
                  </div>
                  <p className="line-clamp-3">{s.summary}</p>
                  {s.products?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {s.products.map((p: string, j: number) => (
                        <Badge key={j} variant="outline" className="text-[9px]">{p}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Context (notes) */}
        {notes && (
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3" />Contexto
            </p>
            <p className="text-sm mt-1.5 p-3 rounded-lg border bg-muted/30">{notes}</p>
          </div>
        )}

        {/* Insights (interests) */}
        {interestsList.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold flex items-center gap-1.5">
              <Lightbulb className="w-3 h-3" />Interesses
            </p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {interestsList.map((interest, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{interest}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Conversations list */}
        {conversations.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold mb-2">
              Conversas ({conversations.length})
            </p>
            <div className="space-y-1.5">
              {conversations.slice(0, 15).map((conv: any) => (
                <div
                  key={conv.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => onOpenConversation(conv.id)}
                >
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    conv.status === 'resolvida' ? 'bg-green-500' :
                    conv.status === 'pendente' ? 'bg-yellow-500' : 'bg-blue-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-muted-foreground">
                      {new Date(conv.created_at).toLocaleDateString('pt-BR')}
                    </span>
                    <p className="text-sm truncate">{conv.last_message || '(sem mensagens)'}</p>
                  </div>
                  <Eye className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        {!lastSummary && summaries.length === 0 && !notes && conversations.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum histórico registrado</p>
        )}
      </CardContent>
    </Card>
  );
}
