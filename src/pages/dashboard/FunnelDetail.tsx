import { useParams, useNavigate } from 'react-router-dom';
import { useFunnel } from '@/hooks/useFunnels';
import { useFunnelMetrics } from '@/hooks/useFunnelMetrics';
import { FUNNEL_TYPE_CONFIGS, FUNNEL_STATUS_CONFIG } from '@/types/funnels';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Users,
  Eye,
  MousePointerClick,
  FileText,
  Megaphone,
  Link2,
  Kanban,
  Copy,
  ExternalLink,
  BarChart3,
  Target,
  Settings,
  MessageSquare,
} from 'lucide-react';

export default function FunnelDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: funnel, isLoading } = useFunnel(id);
  const { data: metrics } = useFunnelMetrics(funnel);

  if (isLoading) {
    return <div className="p-6 animate-pulse"><div className="h-8 w-48 bg-muted rounded" /></div>;
  }

  if (!funnel) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Funil nao encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/dashboard/funnels')}>Voltar</Button>
      </div>
    );
  }

  const config = FUNNEL_TYPE_CONFIGS[funnel.type];
  const statusConfig = FUNNEL_STATUS_CONFIG[funnel.status];
  const baseUrl = window.location.origin;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/funnels')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{config?.icon}</span>
            <div>
              <h1 className="text-xl font-bold">{funnel.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm text-muted-foreground">{config?.label}</span>
                <Badge variant="outline" className={statusConfig?.color}>
                  {statusConfig?.label}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Leads</p>
              <p className="text-xl font-bold">{metrics?.totalLeads ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground">Conversas</p>
              <p className="text-xl font-bold">{metrics?.totalConversations ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Eye className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Visitas</p>
              <p className="text-xl font-bold">{(metrics?.campaignVisits ?? 0) + (metrics?.bioViews ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <BarChart3 className="w-5 h-5 text-emerald-500" />
            <div>
              <p className="text-xs text-muted-foreground">Conversao</p>
              <p className="text-xl font-bold">{metrics?.campaignConversionRate ?? 0}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kanban Stages */}
      {metrics?.kanbanStages && metrics.kanbanStages.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Kanban className="w-4 h-4" />
              Funil de Conversao
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-1 h-8 rounded-lg overflow-hidden">
              {metrics.kanbanStages.map((stage, idx) => {
                const total = metrics.kanbanStages.reduce((s, st) => s + st.count, 0);
                const pct = total > 0 ? Math.max((stage.count / total) * 100, 8) : 100 / metrics.kanbanStages.length;
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-center text-white text-xs font-medium transition-all"
                    style={{ width: `${pct}%`, backgroundColor: stage.color || '#6b7280' }}
                    title={`${stage.column}: ${stage.count}`}
                  >
                    {stage.count > 0 && stage.count}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3 mt-2 flex-wrap">
              {metrics.kanbanStages.map((stage, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                  <span className="text-muted-foreground">{stage.column}</span>
                  <span className="font-medium">{stage.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="channels">
        <TabsList>
          <TabsTrigger value="channels">Canais</TabsTrigger>
          <TabsTrigger value="form">Formulario</TabsTrigger>
          <TabsTrigger value="config">Configuracao</TabsTrigger>
        </TabsList>

        {/* Tab: Canais */}
        <TabsContent value="channels" className="space-y-4">
          {funnel.campaign_id && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-blue-500" />
                  Campanha UTM
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><p className="text-muted-foreground">Visitas</p><p className="font-bold">{metrics?.campaignVisits ?? 0}</p></div>
                  <div><p className="text-muted-foreground">Conversoes</p><p className="font-bold">{metrics?.campaignConversions ?? 0}</p></div>
                  <div><p className="text-muted-foreground">Taxa</p><p className="font-bold">{metrics?.campaignConversionRate ?? 0}%</p></div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-muted rounded text-xs">
                  <code className="flex-1 truncate">{baseUrl}/go?c={funnel.slug}</code>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(`${baseUrl}/go?c=${funnel.slug}`)}>
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/campaigns/${funnel.campaign_id}`)}>
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Ver campanha
                </Button>
              </CardContent>
            </Card>
          )}

          {funnel.bio_page_id && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-emerald-500" />
                  Bio Link
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div><p className="text-muted-foreground">Views</p><p className="font-bold">{metrics?.bioViews ?? 0}</p></div>
                  <div><p className="text-muted-foreground">Cliques</p><p className="font-bold">{metrics?.bioClicks ?? 0}</p></div>
                  <div><p className="text-muted-foreground">Leads</p><p className="font-bold">{metrics?.bioLeads ?? 0}</p></div>
                  <div><p className="text-muted-foreground">CTR</p><p className="font-bold">{metrics?.bioCTR ?? 0}%</p></div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-muted rounded text-xs">
                  <code className="flex-1 truncate">{baseUrl}/bio/{funnel.slug}</code>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(`${baseUrl}/bio/${funnel.slug}`)}>
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
                <Button variant="outline" size="sm" onClick={() => window.open(`/bio/${funnel.slug}`, '_blank')}>
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Abrir bio page
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Formulario */}
        <TabsContent value="form">
          {funnel.form_id ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-500" />
                  Formulario
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><p className="text-muted-foreground">Submissoes</p><p className="font-bold">{metrics?.formSubmissions ?? 0}</p></div>
                  <div><p className="text-muted-foreground">Hoje</p><p className="font-bold">{metrics?.formSubmissionsToday ?? 0}</p></div>
                </div>
                <div className="flex items-center gap-2 p-2 bg-muted rounded text-xs">
                  <code>Trigger WhatsApp: FORM:{funnel.slug}</code>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(`FORM:${funnel.slug}`)}>
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/forms')}>
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Gerenciar formularios
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <FileText className="w-8 h-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">Este funil nao tem formulario.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Config */}
        <TabsContent value="config">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Configuracao do Funil
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground">Tipo</p>
                  <p className="font-medium">{config?.icon} {config?.label}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant="outline" className={statusConfig?.color}>{statusConfig?.label}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Max msgs antes handoff</p>
                  <p className="font-medium">{funnel.max_messages_before_handoff}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Departamento handoff</p>
                  <p className="font-medium">{funnel.handoff_department || 'Padrao'}</p>
                </div>
              </div>

              {funnel.ai_template && (
                <div>
                  <p className="text-muted-foreground mb-1">Template AI Agent</p>
                  <div className="p-3 bg-muted rounded text-xs whitespace-pre-wrap">{funnel.ai_template}</div>
                </div>
              )}

              {funnel.handoff_message && (
                <div>
                  <p className="text-muted-foreground mb-1">Mensagem de handoff</p>
                  <div className="p-3 bg-muted rounded text-xs">{funnel.handoff_message}</div>
                </div>
              )}

              {funnel.description && (
                <div>
                  <p className="text-muted-foreground mb-1">Descricao</p>
                  <p>{funnel.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
