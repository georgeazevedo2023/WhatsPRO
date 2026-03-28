import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useInstances } from '@/hooks/useInstances';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Bot, BrainCircuit, Save, Loader2, Plus, Package, BookOpen, Shield, Mic, BarChart3, MoreVertical, Copy, Trash2, Pencil, Store, Check, AlertCircle } from 'lucide-react';
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
import { FollowUpConfig } from './ai-agent/FollowUpConfig';
import { BusinessInfoConfig } from './ai-agent/BusinessInfoConfig';
import { NICHE_TEMPLATES } from '@/data/nicheTemplates';

interface AIAgent {
  id: string; instance_id: string; enabled: boolean; name: string;
  greeting_message: string; personality: string; system_prompt: string;
  model: string; temperature: number; max_tokens: number;
  debounce_seconds: number; context_short_messages: number;
  context_long_enabled: boolean; [key: string]: any;
}

const TABS = [
  { id: 'setup', label: 'Setup', icon: Store },
  { id: 'intelligence', label: 'Inteligencia', icon: BrainCircuit },
  { id: 'catalog', label: 'Catalogo', icon: Package },
  { id: 'knowledge', label: 'Conhecimento', icon: BookOpen },
  { id: 'security', label: 'Seguranca', icon: Shield },
  { id: 'channels', label: 'Canais', icon: Mic },
  { id: 'metrics', label: 'Metricas', icon: BarChart3 },
] as const;

const ALLOWED_FIELDS = [
  'instance_id', 'enabled', 'name', 'greeting_message', 'personality', 'system_prompt',
  'sub_agents', 'model', 'temperature', 'max_tokens', 'debounce_seconds',
  'handoff_triggers', 'handoff_cooldown_minutes', 'handoff_max_conversation_minutes',
  'handoff_negative_sentiment', 'blocked_topics', 'max_discount_percent', 'blocked_phrases',
  'voice_enabled', 'voice_max_text_length', 'voice_reply_to_audio', 'voice_name', 'context_short_messages', 'context_long_enabled',
  'business_hours', 'out_of_hours_message', 'extraction_fields', 'blocked_numbers',
  'extraction_address_enabled', 'handoff_message',
  'follow_up_enabled', 'follow_up_rules', 'business_info',
  'returning_greeting_message',
];

export default function AIAgentTab() {
  const { instances } = useInstances();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('setup');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AIAgent | null>(null);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentInstanceId, setNewAgentInstanceId] = useState('');
  const [newAgentNiche, setNewAgentNiche] = useState('homecenter');

  // Auto-save refs
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const configRef = useRef(config);
  const selectedAgentIdRef = useRef(selectedAgentId);
  configRef.current = config;
  selectedAgentIdRef.current = selectedAgentId;

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
    // Cancel any pending auto-save from the previous agent to prevent cross-write
    clearTimeout(autoSaveTimerRef.current);
    if (selectedAgentId && agents.length > 0) {
      const agent = agents.find(a => a.id === selectedAgentId);
      if (agent) setConfig({ ...agent });
      setSaveStatus('idle');
    }
  }, [selectedAgentId, agents]);

  // Cleanup auto-save timer on unmount
  useEffect(() => () => clearTimeout(autoSaveTimerRef.current), []);

  // ── Auto-save logic ─────────────────────────────────────────────────
  const savingRef = useRef(false);
  const pendingSaveRef = useRef(false);

  const doSave = useCallback(async (silent = false) => {
    const agentId = selectedAgentIdRef.current;
    const cfg = configRef.current;
    if (!agentId) return;

    // If already saving, mark as pending so we re-save after current completes
    if (savingRef.current) {
      pendingSaveRef.current = true;
      return;
    }

    savingRef.current = true;
    pendingSaveRef.current = false;
    setSaveStatus('saving');
    try {
      const updateData: Record<string, any> = {};
      for (const key of ALLOWED_FIELDS) {
        if (key in cfg) updateData[key] = (cfg as any)[key];
      }
      const { data, error } = await supabase
        .from('ai_agents')
        .update(updateData)
        .eq('id', agentId)
        .select('id')
        .single();
      if (error) throw error;
      if (!data) throw new Error('Nenhuma linha atualizada — verifique permissões');
      setSaveStatus('saved');
      if (!silent) toast.success('Salvo!');
      setTimeout(() => setSaveStatus(prev => prev === 'saved' ? 'idle' : prev), 3000);
    } catch (err) {
      setSaveStatus('error');
      if (!silent) handleError(err, 'Erro ao salvar', 'Save AI agent');
      else console.error('[AI Agent] auto-save failed:', err);
    } finally {
      savingRef.current = false;
      // If changes arrived while saving, flush them now
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        doSave(true);
      }
    }
  }, []);

  const handleChange = useCallback((updates: Record<string, any>) => {
    setConfig(prev => {
      const next = { ...prev, ...updates };
      configRef.current = next;
      return next;
    });

    // Debounced auto-save (2s)
    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => doSave(true), 2000);
    // Only reset to idle if not currently saving
    setSaveStatus(prev => prev === 'saving' ? prev : 'idle');
  }, [doSave]);

  // Flush pending auto-save on tab change
  const handleTabChange = (tab: string) => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      doSave(true);
    }
    setActiveTab(tab);
  };

  // ── Agent CRUD ───────────────────────────────────────────────────────
  const usedInstanceIds = agents.map(a => a.instance_id);
  const availableInstances = (instances || []).filter(i => !usedInstanceIds.includes(i.id));

  const openCreateDialog = () => {
    if (availableInstances.length === 0) {
      toast.error('Todas as instancias ja tem um agente configurado');
      return;
    }
    setNewAgentName('');
    setNewAgentInstanceId(availableInstances[0]?.id || '');
    setNewAgentNiche('homecenter');
    setCreateDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!newAgentInstanceId) { toast.error('Selecione uma instancia'); return; }
    const name = newAgentName.trim() || `Agente ${instances?.find(i => i.id === newAgentInstanceId)?.name || ''}`;
    const template = NICHE_TEMPLATES.find(t => t.id === newAgentNiche && t.available);
    const nicheConfig = template && template.id !== 'custom' ? template.config : {};
    try {
      const { data, error } = await supabase.from('ai_agents')
        .insert({ instance_id: newAgentInstanceId, name, ...nicheConfig })
        .select().single();
      if (error) throw error;
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
      toast.error('Nenhuma instancia disponivel para duplicar');
      return;
    }
    try {
      const { id, created_at, updated_at, instance_id, ...copyData } = agent;
      const { data, error } = await supabase.from('ai_agents')
        .insert({ ...copyData, instance_id: availableInstances[0].id, name: `${agent.name} (Copia)` })
        .select().single();
      if (error) throw error;
      toast.success('Agente duplicado!');
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
      toast.success('Agente excluido');
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
          {/* Auto-save status indicator */}
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1.5 text-xs text-green-500">
              <Check className="w-3.5 h-3.5" /> Salvo
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1.5 text-xs text-destructive cursor-pointer" onClick={() => doSave(false)}>
              <AlertCircle className="w-3.5 h-3.5" /> Erro — clique para tentar
            </span>
          )}
          {selectedAgentId && (
            <Button variant="ghost" size="sm" onClick={() => doSave(false)} className="gap-1.5 text-xs">
              <Save className="w-3.5 h-3.5" /> Salvar
            </Button>
          )}
          <Button variant="outline" className="gap-2" onClick={openCreateDialog}>
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo Agente</span>
            <span className="sm:hidden">Novo</span>
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
            <p className="text-sm text-muted-foreground mt-1">Crie um agente para comecar a responder automaticamente</p>
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
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedAgentId(agent.id); setActiveTab('setup'); }}>
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

          {/* Config sections */}
          {selectedAgentId && (
            <>
              <div className="border-t border-border/50 pt-4">
                <p className="text-xs text-muted-foreground mb-3">
                  Configurando: <strong>{selectedAgent?.name}</strong> · Instancia: <Badge variant="outline" className="text-[10px] ml-1">{instanceName}</Badge>
                </p>
              </div>

              {/* Tab navigation — 7 grouped tabs */}
              <div className="flex flex-wrap gap-1.5">
                {TABS.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <div className="mt-2">
                {/* SETUP: Geral + Empresa */}
                {activeTab === 'setup' && (
                  <div className="space-y-6">
                    <GeneralConfig config={config} onChange={handleChange} instances={instances || []} />
                    <BusinessInfoConfig config={config} onChange={handleChange} />
                  </div>
                )}

                {/* INTELIGENCIA: Cerebro + Sub-agentes + Extracao */}
                {activeTab === 'intelligence' && (
                  <div className="space-y-6">
                    <BrainConfig config={config} onChange={handleChange} />
                    <SubAgentsConfig config={config} onChange={handleChange} />
                    <ExtractionConfig config={config} onChange={handleChange} />
                  </div>
                )}

                {/* CATALOGO */}
                {activeTab === 'catalog' && (
                  <CatalogConfig agentId={selectedAgentId} />
                )}

                {/* CONHECIMENTO */}
                {activeTab === 'knowledge' && (
                  <KnowledgeConfig agentId={selectedAgentId} />
                )}

                {/* SEGURANCA: Regras + Guardrails + Bloqueios */}
                {activeTab === 'security' && (
                  <div className="space-y-6">
                    <RulesConfig config={config} onChange={handleChange} />
                    <GuardrailsConfig config={config} onChange={handleChange} />
                    <BlockedNumbersConfig config={config} onChange={handleChange} />
                  </div>
                )}

                {/* CANAIS: Voz + Follow-up */}
                {activeTab === 'channels' && (
                  <div className="space-y-6">
                    <VoiceConfig config={config} onChange={handleChange} />
                    <FollowUpConfig config={config} onChange={handleChange} />
                  </div>
                )}

                {/* METRICAS */}
                {activeTab === 'metrics' && (
                  <MetricsConfig agentId={selectedAgentId} />
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Mobile sticky save indicator */}
      {selectedAgentId && saveStatus === 'saving' && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 md:hidden bg-background/95 backdrop-blur border rounded-full px-4 py-2 shadow-lg">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
          </span>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Agente de IA</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label className="text-xs">Nicho do negocio</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
              Todas as configuracoes, catalogo, conhecimento e logs deste agente serao perdidos. Esta acao nao pode ser desfeita.
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
