import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface LeadFormsSectionProps {
  contactId: string;
}

export function LeadFormsSection({ contactId }: LeadFormsSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: submissions, isLoading } = useQuery({
    queryKey: ['lead-form-submissions', contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('form_submissions')
        .select('id, data, submitted_at, whatsapp_forms(name, slug, template_type)')
        .eq('contact_id', contactId)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading || !submissions?.length) return null;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Formularios respondidos
          <Badge variant="secondary" className="text-[10px]">{submissions.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {submissions.map((sub: any) => {
          const isExpanded = expandedId === sub.id;
          const formName = sub.whatsapp_forms?.name || 'Formulario';
          const entries = Object.entries((sub.data || {}) as Record<string, unknown>);
          const preview = entries.slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(' · ');

          return (
            <button
              key={sub.id}
              onClick={() => setExpandedId(isExpanded ? null : sub.id)}
              className="w-full text-left p-3 rounded-lg border border-border/30 hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{sub.whatsapp_forms?.template_type || 'custom'}</Badge>
                  <span className="text-sm font-medium">{formName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{formatDate(sub.submitted_at)}</span>
                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </div>
              </div>

              {!isExpanded && preview && (
                <p className="text-xs text-muted-foreground mt-1 truncate">{preview}</p>
              )}

              {isExpanded && (
                <div className="mt-3 space-y-1.5 border-t border-border/20 pt-2">
                  {entries.map(([key, value]) => (
                    <div key={key} className="flex gap-2 text-xs">
                      <span className="text-muted-foreground min-w-[80px]">{key}:</span>
                      <span className="text-foreground">{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
