import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFunnel, useUpdateFunnel } from '@/hooks/useFunnels';
import { useFunnelMetrics } from '@/hooks/useFunnelMetrics';
import { FUNNEL_TYPE_CONFIGS, FUNNEL_STATUS_CONFIG } from '@/types/funnels';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Users,
  Eye,
  FileText,
  Megaphone,
  Link2,
  Kanban,
  Copy,
  ExternalLink,
  BarChart3,
  Settings,
  MessageSquare,
  Zap,
  Brain,
  PlusCircle,
  Pencil,
  Trash2,
} from 'lucide-react';
import { AutomationRuleEditor } from '@/components/funnels/AutomationRuleEditor';
import {
  useAutomationRules,
  useDeleteAutomationRule,
  useUpdateAutomationRule,
  type AutomationRule,
} from '@/hooks/useAutomationRules';
import { useAgentProfilesByInstance, type AgentProfile } from '@/hooks/useAgentProfiles';

const TRIGGER_LABELS: Record<string, string> = {
  card_moved: 'Card movido',
  form_completed: 'Form completo',
  lead_created: 'Lead criado',
  conversation_resolved: 'Conversa resolvida',
  tag_added: 'Tag adicionada',
  label_applied: 'Etiqueta aplicada',
  poll_answered: 'Enquete respondida',
};

const CONDITION_LABELS: Record<string, string> = {
  always: 'sempre',
  tag_contains: 'tag contem',
  funnel_is: 'funil e este',
  business_hours: 'horario comercial',
};

const ACTION_LABELS: Record<string, string> = {
  send_message: 'Enviar mensagem',
  move_card: 'Mover card',
  add_tag: 'Adicionar tag',
  activate_ai: 'Ativar IA',
  handoff: 'Transbordo',
  send_poll: 'Enquete (F4)',
};

export default function FunnelDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: funnel, isLoading } = useFunnel(id);
  const { data: metrics } = useFunnelMetrics(funnel);

  // M17 F1: Motor de Automação — hooks sempre no topo (Rules of Hooks)
  const [automationEditorOpen, setAutomationEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | undefined>(undefined);
  const { data: automationRules = [] } = useAutomationRules(funnel?.id);
  const deleteRule = useDeleteAutomationRule();
  const updateRule = useUpdateAutomationRule();

  // M17 F2+F3: Funis Agênticos + Perfis
  const updateFunnel = useUpdateFunnel();
  const { data: agentProfiles = [] } = useAgentProfilesByInstance(funnel?.instance_id);
  const [localProfileId, setLocalProfileId] = useState<string | null>(funnel?.profile_id ?? null);
  const [localPrompt, setLocalPrompt] = useState(funnel?.funnel_prompt ?? '');
  const [localHandoffRule, setLocalHandoffRule] = useState<'so_se_pedir' | 'apos_n_msgs' | 'nunca'>(
    funnel?.handoff_rule ?? 'so_se_pedir'
  );
  const [localHandoffMaxMsgs, setLocalHandoffMaxMsgs] = useState(funnel?.handoff_max_messages ?? 8);

  // Sync local state when funnel data changes (navigation between funnels)
  useEffect(() => {
    if (funnel) {
      setLocalProfileId(funnel.profile_id ?? null);
      setLocalPrompt(funnel.funnel_prompt ?? '');
      setLocalHandoffRule(funnel.handoff_rule ?? 'so_se_pedir');
      setLocalHandoffMaxMsgs(funnel.handoff_max_messages ?? 8);
    }
  }, [funnel?.id]);

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

  function handleOpenEditor(rule?: AutomationRule) {
    setEditingRule(rule);
    setAutomationEditorOpen(true);
  }

  function handleCloseEditor() {
    setAutomationEditorOpen(false);
    setEditingRule(undefined);
  }

  function handleDeleteRule(rule: AutomationRule) {
    if (!confirm(`Remover automacao "${rule.name}"?`)) return;
    deleteRule.mutate({ id: rule.id, funnelId: funnel.id });
  }

  function handleSaveAiConfig() {
    updateFunnel.mutate({
      id: funnel.id,
      profile_id: localProfileId || null,
      funnel_prompt: localPrompt || null,
      handoff_rule: localHandoffRule,
      handoff_max_messages: localHandoffRule === 'apos_n_msgs' ? localHandoffMaxMsgs : null,
    });
  }

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

      {/* Automation Rule Editor Dialog */}
      <AutomationRuleEditor
        open={automationEditorOpen}
        onClose={handleCloseEditor}
        funnelId={funnel.id}
        rule={editingRule}
      />

      {/* Tabs */}
      <Tabs defaultValue="channels">
        <TabsList>
          <TabsTrigger value="channels">Canais</TabsTrigger>
          <TabsTrigger value="form">Formulario</TabsTrigger>
          <TabsTrigger value="automations">Automacoes</TabsTrigger>
          <TabsTrigger value="ai">Agente IA</TabsTrigger>
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

        {/* Tab: Automacoes */}
        <TabsContent value="automations" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => handleOpenEditor()}>
              <PlusCircle className="w-4 h-4 mr-1.5" />
              Adicionar regra
            </Button>
          </div>

          {automationRules.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 gap-2">
                <Zap className="w-8 h-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground text-center">
                  Nenhuma automacao configurada. Adicione regras para automatizar acoes no funil.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {automationRules.map((rule) => (
                <Card key={rule.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(v) =>
                          updateRule.mutate({ id: rule.id, enabled: v })
                        }
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{rule.name}</span>
                          <Badge
                            variant="outline"
                            className={
                              rule.enabled
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : 'bg-slate-500/10 text-slate-500'
                            }
                          >
                            {rule.enabled ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          QUANDO {TRIGGER_LABELS[rule.trigger_type] ?? rule.trigger_type}
                          {' '}&rarr; SE {CONDITION_LABELS[rule.condition_type] ?? rule.condition_type}
                          {' '}&rarr; ENTAO {ACTION_LABELS[rule.action_type] ?? rule.action_type}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenEditor(rule)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteRule(rule)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab: Agente IA */}
        <TabsContent value="ai">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="w-4 h-4" />
                Configuracao do Agente por Funil
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* M17 F3: Seletor de Perfil */}
              <div className="space-y-1.5">
                <Label>Perfil de Atendimento</Label>
                <Select
                  value={localProfileId || '_none'}
                  onValueChange={(v) => setLocalProfileId(v === '_none' ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um perfil..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhum (usar config geral do agente)</SelectItem>
                    {agentProfiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}{p.is_default ? ' (Padrao)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  O perfil define instrucoes, regra de transbordo e mensagem de handoff.
                  Configure perfis em AI Agent &gt; Inteligencia.
                </p>
              </div>

              {/* Seleção de perfil mostra preview */}
              {localProfileId && agentProfiles.find(p => p.id === localProfileId) && (
                <div className="p-3 rounded-md bg-muted/50 border space-y-1">
                  <p className="text-xs font-medium">Preview do perfil selecionado:</p>
                  <p className="text-xs text-muted-foreground line-clamp-4">
                    {agentProfiles.find(p => p.id === localProfileId)?.prompt || '(sem instrucoes)'}
                  </p>
                </div>
              )}

              {/* Roteiro Agêntico legado */}
              <div className="space-y-1.5">
                <Label htmlFor="funnel-prompt" className="text-muted-foreground">
                  Roteiro adicional (legado)
                </Label>
                <Textarea
                  id="funnel-prompt"
                  value={localPrompt}
                  onChange={(e) => setLocalPrompt(e.target.value)}
                  placeholder="Instrucoes adicionais para este funil (opcional se perfil selecionado)"
                  rows={4}
                  className="opacity-75"
                />
                <p className="text-xs text-muted-foreground">
                  {localProfileId
                    ? 'O perfil selecionado tem prioridade. Este campo serve como fallback.'
                    : 'Sem perfil selecionado, estas instrucoes serao usadas diretamente.'}
                </p>
              </div>

              {/* Regra de Transbordo — desabilitado se perfil selecionado */}
              {!localProfileId && (
                <>
                  <div className="space-y-1.5">
                    <Label>Regra de Transbordo</Label>
                    <Select
                      value={localHandoffRule}
                      onValueChange={(v) =>
                        setLocalHandoffRule(v as 'so_se_pedir' | 'apos_n_msgs' | 'nunca')
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="so_se_pedir">Transbordo somente se lead pedir</SelectItem>
                        <SelectItem value="apos_n_msgs">Transbordo automatico apos N mensagens</SelectItem>
                        <SelectItem value="nunca">Nunca transbordar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {localHandoffRule === 'apos_n_msgs' && (
                    <div className="space-y-1.5">
                      <Label htmlFor="handoff-max">Maximo de mensagens (handoff automatico)</Label>
                      <input
                        id="handoff-max"
                        type="number"
                        min={1}
                        value={localHandoffMaxMsgs}
                        onChange={(e) => setLocalHandoffMaxMsgs(Number(e.target.value))}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                  )}
                </>
              )}

              <Button onClick={handleSaveAiConfig} disabled={updateFunnel.isPending}>
                {updateFunnel.isPending ? 'Salvando...' : 'Salvar Configuracoes'}
              </Button>
            </CardContent>
          </Card>
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
