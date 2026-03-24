import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useInstances } from '@/hooks/useInstances';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Bot, BrainCircuit, Save, Loader2, Plus, Package, BookOpen, ShieldAlert, ShieldOff, ShieldBan, Mic, Scan, BarChart3, Users, MoreVertical, Copy, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { handleError } from '@/lib/errorUtils';
import { GeneralConfig } from './ai-agent/GeneralConfig';
import { BrainConfig } from './ai-agent/BrainConfig';
import { CatalogConfig } from './ai-agent/CatalogConfig';
import { KnowledgeConfig } from './ai-agent/KnowledgeConfig';
import { RulesConfig } from './ai-agent/RulesConfig';
import { GuardrailsConfig } from './ai-agent/GuardrailsConfig';
import { VoiceConfig } from './ai-agent/VoiceConfig';
import { ExtractionConfig } from './ai-agent/ExtractionConfig';
import { MetricsConfig } from './ai-agent/MetricsConfig';
import { SubAgentsConfig } from './ai-agent/SubAgentsConfig';
import { BlockedNumbersConfig } from './ai-agent/BlockedNumbersConfig';
import { NICHE_TEMPLATES } from '@/data/nicheTemplates';

interface AIAgent {
  id: string; instance_id: string; enabled: boolean; name: string;
  greeting_message: string; personality: string; system_prompt: string;
  model: string; temperature: number; max_tokens: number;
  debounce_seconds: number; context_short_messages: number;
  context_long_enabled: boolean; [key: string]: any;
}

export default function AIAgentTab() {
  const { instances } = useInstances();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AIAgent | null>(null);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentInstanceId, setNewAgentInstanceId] = useState('');
  const [newAgentNiche, setNewAgentNiche] = useState('homecenter');

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('ai_agents').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const list = (data || []) as AIAgent[];
      setAgents(list);
      if (list.length > 0 && !selectedAgentId) {
        setSelectedAgentId(list[0].id);
        setConfig(list[0]);
      }
    } catch (err) {
      handleError(err, 'Erro ao carregar agentes', 'Fetch AI agents');
    } finally {
      setLoading(false);
    }
  }, [selectedAgentId]);

  useEffect(() => { fetchAgents(); }, []);

  useEffect(() => {
    if (selectedAgentId && agents.length > 0) {
      const agent = agents.find(a => a.id === selectedAgentId);
      if (agent) setConfig({ ...agent });
      setHasChanges(false);
    }
  }, [selectedAgentId, agents]);

  const handleChange = (updates: Record<string, any>) => {
    setConfig(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const ALLOWED_FIELDS = [
    'instance_id', 'enabled', 'name', 'greeting_message', 'personality', 'system_prompt',
    'sub_agents', 'model', 'temperature', 'max_tokens', 'debounce_seconds',
    'handoff_triggers', 'handoff_cooldown_minutes', 'handoff_max_conversation_minutes',
    'handoff_negative_sentiment', 'blocked_topics', 'max_discount_percent', 'blocked_phrases',
    'voice_enabled', 'voice_max_text_length', 'voice_reply_to_audio', 'context_short_messages', 'context_long_enabled',
    'business_hours', 'out_of_hours_message', 'extraction_fields', 'blocked_numbers',
  ];

  const handleSave = async () => {
    if (!selectedAgentId) return;
    setSaving(true);
    try {
      const updateData: Record<string, any> = {};
      for (const key of ALLOWED_FIELDS) {
        if (key in config) updateData[key] = config[key];
      }
      const { error } = await supabase.from('ai_agents').update(updateData).eq('id', selectedAgentId);
      if (error) throw error;
      toast.success('Agente salvo!');
      setHasChanges(false);
      fetchAgents();
    } catch (err) {
      handleError(err, 'Erro ao salvar agente', 'Save AI agent');
    } finally {
      setSaving(false);
    }
  };

  // Available instances (not used by other agents)
  const usedInstanceIds = agents.map(a => a.instance_id);
  const availableInstances = (instances || []).filter(i => !usedInstanceIds.includes(i.id));

  const openCreateDialog = () => {
    if (availableInstances.length === 0) {
      toast.error('Todas as instâncias já têm um agente configurado');
      return;
    }
    setNewAgentName('');
    setNewAgentInstanceId(availableInstances[0]?.id || '');
    setNewAgentNiche('homecenter');
    setCreateDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!newAgentInstanceId) { toast.error('Selecione uma instância'); return; }
    const name = newAgentName.trim() || `Agente ${instances?.find(i => i.id === newAgentInstanceId)?.name || ''}`;
    const template = NICHE_TEMPLATES.find(t => t.id === newAgentNiche && t.available);
    const nicheConfig = template && template.id !== 'custom' ? template.config : {};
    try {
      const { data, error } = await supabase.from('ai_agents')
        .insert({ instance_id: newAgentInstanceId, name, ...nicheConfig })
        .select().single();
      if (error) throw error;

      // Create suggested labels in the instance's inbox
      if (template?.suggested_labels?.length) {
        const { data: inbox } = await supabase.from('inboxes')
          .select('id').eq('instance_id', newAgentInstanceId).maybeSingle();
        if (inbox) {
          for (const label of template.suggested_labels) {
            await supabase.from('labels').insert({ inbox_id: inbox.id, name: label.name, color: label.color }).catch(() => {});
          }
        }
      }

      toast.success(template && template.id !== 'custom'
        ? `Agente criado com template ${template.name}!`
        : 'Agente criado!');
      setCreateDialogOpen(false);
      setSelectedAgentId(data.id);
      fetchAgents();
    } catch (err) {
      handleError(err, 'Erro ao criar agente', 'Create AI agent');
    }
  };

  const handleDuplicate = async (agent: AIAgent) => {
    if (availableInstances.length === 0) {
      toast.error('Nenhuma instância disponível para duplicar');
      return;
    }
    try {
      const { id, created_at, updated_at, instance_id, ...copyData } = agent;
      const { data, error } = await supabase.from('ai_agents')
        .insert({ ...copyData, instance_id: availableInstances[0].id, name: `${agent.name} (Cópia)` })
        .select().single();
      if (error) throw error;
      toast.success('Agente duplicado! Altere a instância vinculada.');
      setSelectedAgentId(data.id);
      fetchAgents();
    } catch (err) {
      handleError(err, 'Erro ao duplicar agente', 'Duplicate AI agent');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('ai_agents').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Agente excluído');
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      if (selectedAgentId === deleteTarget.id) {
        setSelectedAgentId(null);
        setConfig({});
      }
      fetchAgents();
    } catch (err) {
      handleError(err, 'Erro ao excluir agente', 'Delete AI agent');
    }
  };

  const selectedAgent = agents.find(a => a.id === selectedAgentId);
  const instanceName = instances?.find(i => i.id === selectedAgent?.instance_id)?.name;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold">Agente de IA</h2>
            <p className="text-sm text-muted-foreground">
              {agents.length} agente{agents.length !== 1 ? 's' : ''} configurado{agents.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="outline" className="text-xs text-warning border-warning/30">Não salvo</Badge>
          )}
          {selectedAgentId && (
            <Button onClick={handleSave} disabled={saving || !hasChanges} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </Button>
          )}
          <Button variant="outline" className="gap-2" onClick={openCreateDialog}>
            <Plus className="w-4 h-4" />
            Novo Agente
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Bot className="w-8 h-8 text-primary" />
          </div>
          <div>
            <p className="font-semibold">Nenhum agente configurado</p>
            <p className="text-sm text-muted-foreground mt-1">Crie um agente para começar a responder automaticamente</p>
          </div>
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="w-4 h-4" /> Criar Primeiro Agente
          </Button>
        </div>
      ) : (
        <>
          {/* Agent cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {agents.map(agent => {
              const instName = instances?.find(i => i.id === agent.instance_id)?.name || agent.instance_id;
              const isSelected = selectedAgentId === agent.id;
              return (
                <div
                  key={agent.id}
                  className={`relative p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-primary/50 bg-primary/5 shadow-md'
                      : 'border-border hover:border-primary/30'
                  }`}
                  onClick={() => setSelectedAgentId(agent.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${agent.enabled ? 'bg-primary/15' : 'bg-muted'}`}>
                        <Bot className={`w-4 h-4 ${agent.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{agent.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{instName}</p>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={e => e.stopPropagation()}>
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedAgentId(agent.id); setActiveTab('general'); }}>
                          <Pencil className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicate(agent); }}>
                          <Copy className="w-4 h-4 mr-2" /> Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(agent); setDeleteDialogOpen(true); }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center gap-1.5 mt-2">
                    {agent.enabled ? (
                      <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">Ativo</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Inativo</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Config tabs */}
          {selectedAgentId && (
            <>
              <div className="border-t border-border/50 pt-4">
                <p className="text-xs text-muted-foreground mb-3">
                  Configurando: <strong>{selectedAgent?.name}</strong> · Instância: <Badge variant="outline" className="text-[10px] ml-1">{instanceName}</Badge>
                </p>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full sm:w-auto overflow-x-auto no-scrollbar">
                  <TabsTrigger value="general" className="gap-1.5"><Bot className="w-3.5 h-3.5" /><span>Geral</span></TabsTrigger>
                  <TabsTrigger value="brain" className="gap-1.5"><BrainCircuit className="w-3.5 h-3.5" /><span>Cérebro</span></TabsTrigger>
                  <TabsTrigger value="catalog" className="gap-1.5"><Package className="w-3.5 h-3.5" /><span>Catálogo</span></TabsTrigger>
                  <TabsTrigger value="knowledge" className="gap-1.5"><BookOpen className="w-3.5 h-3.5" /><span>Conhecimento</span></TabsTrigger>
                  <TabsTrigger value="rules" className="gap-1.5"><ShieldAlert className="w-3.5 h-3.5" /><span>Regras</span></TabsTrigger>
                  <TabsTrigger value="guardrails" className="gap-1.5"><ShieldOff className="w-3.5 h-3.5" /><span>Guardrails</span></TabsTrigger>
                  <TabsTrigger value="blocked-numbers" className="gap-1.5"><ShieldBan className="w-3.5 h-3.5" /><span>Bloqueios</span></TabsTrigger>
                  <TabsTrigger value="voice" className="gap-1.5"><Mic className="w-3.5 h-3.5" /><span>Voz</span></TabsTrigger>
                  <TabsTrigger value="extraction" className="gap-1.5"><Scan className="w-3.5 h-3.5" /><span>Extração</span></TabsTrigger>
                  <TabsTrigger value="sub-agents" className="gap-1.5"><Users className="w-3.5 h-3.5" /><span>Sub-Agentes</span></TabsTrigger>
                  <TabsTrigger value="metrics" className="gap-1.5"><BarChart3 className="w-3.5 h-3.5" /><span>Métricas</span></TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="mt-6">
                  <GeneralConfig config={config} onChange={handleChange} instances={instances || []} />
                </TabsContent>
                <TabsContent value="brain" className="mt-6">
                  <BrainConfig config={config} onChange={handleChange} />
                </TabsContent>
                <TabsContent value="catalog" className="mt-6">
                  <CatalogConfig agentId={selectedAgentId} />
                </TabsContent>
                <TabsContent value="knowledge" className="mt-6">
                  <KnowledgeConfig agentId={selectedAgentId} />
                </TabsContent>
                <TabsContent value="rules" className="mt-6">
                  <RulesConfig config={config} onChange={handleChange} />
                </TabsContent>
                <TabsContent value="guardrails" className="mt-6">
                  <GuardrailsConfig config={config} onChange={handleChange} />
                </TabsContent>
                <TabsContent value="blocked-numbers" className="mt-6">
                  <BlockedNumbersConfig config={config} onChange={handleChange} />
                </TabsContent>
                <TabsContent value="voice" className="mt-6">
                  <VoiceConfig config={config} onChange={handleChange} />
                </TabsContent>
                <TabsContent value="extraction" className="mt-6">
                  <ExtractionConfig config={config} onChange={handleChange} />
                </TabsContent>
                <TabsContent value="sub-agents" className="mt-6">
                  <SubAgentsConfig config={config} onChange={handleChange} />
                </TabsContent>
                <TabsContent value="metrics" className="mt-6">
                  {selectedAgentId && <MetricsConfig agentId={selectedAgentId} />}
                </TabsContent>
              </Tabs>
            </>
          )}
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Agente de IA</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome do Agente</Label>
                <Input
                  value={newAgentName}
                  onChange={e => setNewAgentName(e.target.value)}
                  placeholder="Ex: Assistente Vendas"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Instancia WhatsApp *</Label>
                <Select value={newAgentInstanceId} onValueChange={setNewAgentInstanceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableInstances.map(inst => (
                      <SelectItem key={inst.id} value={inst.id}>
                        {inst.name} {inst.status === 'connected' ? '\u{1F7E2}' : '\u{1F534}'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Niche selector */}
            <div className="space-y-2">
              <Label className="text-xs">Nicho do negocio</Label>
              <div className="grid grid-cols-3 gap-2">
                {NICHE_TEMPLATES.map(niche => (
                  <button
                    key={niche.id}
                    type="button"
                    disabled={!niche.available}
                    onClick={() => niche.available && setNewAgentNiche(niche.id)}
                    className={`relative p-3 rounded-lg border text-left transition-all ${
                      newAgentNiche === niche.id
                        ? 'border-primary bg-primary/10 ring-1 ring-primary'
                        : niche.available
                          ? 'border-border hover:border-primary/50 hover:bg-accent/50'
                          : 'border-border/50 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <span className="text-2xl block mb-1">{niche.icon}</span>
                    <p className="text-sm font-medium">{niche.name}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{niche.description}</p>
                    {!niche.available && (
                      <Badge variant="secondary" className="absolute top-1.5 right-1.5 text-[8px] px-1">Em breve</Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {availableInstances.length === 0 && (
              <p className="text-xs text-destructive">Todas as instancias ja tem agente</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!newAgentInstanceId} className="gap-1.5">
              <Plus className="w-4 h-4" /> Criar Agente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agente "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as configurações, catálogo, conhecimento e logs deste agente serão perdidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
