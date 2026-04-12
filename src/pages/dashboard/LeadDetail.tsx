import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useInstances } from '@/hooks/useInstances';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { LeadProfileSection } from '@/components/leads/LeadProfileSection';
import { LeadHistorySection } from '@/components/leads/LeadHistorySection';
import { LeadTimelineSection } from '@/components/leads/LeadTimelineSection';
import { LeadFormsSection } from '@/components/leads/LeadFormsSection';
import { LeadFilesSection } from '@/components/leads/LeadFilesSection';
import { LeadJourneyTimeline } from '@/components/leads/LeadJourneyTimeline';
import { LeadFunnelCard } from '@/components/leads/LeadFunnelCard';
import { ConversationModal } from '@/components/leads/ConversationModal';
import { ArrowLeft, MapPin, Settings2, Trash2, Loader2, Save, Contact2, ExternalLink, Activity, ShoppingCart, AlertCircle, Bot, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { handleError } from '@/lib/errorUtils';
import type { ActionEvent, MediaFile } from '@/components/leads/types';
import type { ExtractionField } from '@/types/agent';
import type { ToolCall } from '@/types/playground';
import { STATUS_IA } from '@/constants/statusIa';

// Local types for Supabase joined query results
type LeadProfileRow = Database['public']['Tables']['lead_profiles']['Row'];
type ContactRow = Database['public']['Tables']['contacts']['Row'];

interface ConvRow {
  id: string;
  status: string;
  tags: string[] | null;
  last_message: string | null;
  last_message_at: string | null;
  ai_summary: { reason?: string; summary?: string } | null;
  created_at: string;
}

interface ConvLabelWithName {
  conversation_id: string;
  labels: { name: string } | null;
}

interface KanbanCardWithColumn {
  board_id: string;
  kanban_columns: { name: string; color: string } | null;
}

interface LogMetadata {
  response_text?: string;
  reason?: string;
  label_name?: string;
  latency_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  model?: string;
}

const LeadDetail = () => {
  const { contactId } = useParams<{ contactId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { instances } = useInstances();
  const instanceId = searchParams.get('instance') || instances[0]?.id || null;
  const queryClient = useQueryClient();

  // Editable fields
  const [editOrigin, setEditOrigin] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDocument, setEditDocument] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editAddress, setEditAddress] = useState<Record<string, string>>({});
  const [editCustom, setEditCustom] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadRef = useRef(true);

  // Conversation modal
  const [convModalOpen, setConvModalOpen] = useState(false);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);

  // Query 1 — Contact (primary)
  const { data: contactData, isLoading: contactLoading } = useQuery({
    queryKey: ['lead-contact', contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId!)
        .single();
      if (error) throw error;
      return data as ContactRow;
    },
    enabled: !!contactId,
  });
  const contact = contactData ?? null;

  // Query 2 — Lead profile
  const { data: leadProfile = null, isLoading: profileLoading } = useQuery({
    queryKey: ['lead-profile', contactId],
    queryFn: async () => {
      const { data } = await supabase
        .from('lead_profiles')
        .select('*')
        .eq('contact_id', contactId!)
        .maybeSingle();
      return data as LeadProfileRow | null;
    },
    enabled: !!contactId,
  });

  // Sync editable fields when leadProfile loads/changes
  useEffect(() => {
    if (!leadProfile) return;
    initialLoadRef.current = true;
    setEditOrigin(leadProfile.origin || '');
    setEditEmail(leadProfile.email || '');
    setEditDocument(leadProfile.document || '');
    setEditBirthDate(leadProfile.birth_date || '');
    setEditAddress((leadProfile.address as Record<string, string>) || {});
    setEditCustom((leadProfile.custom_fields as Record<string, string>) || {});
  }, [leadProfile]);

  // Query 3 — Conversations + derived data (labels, tags, kanban)
  const { data: convsData, isLoading: convsLoading } = useQuery({
    queryKey: ['lead-conversations', contactId],
    queryFn: async () => {
      const { data: rawConvs } = await supabase
        .from('conversations')
        .select('id, status, tags, last_message, last_message_at, ai_summary, created_at')
        .eq('contact_id', contactId!)
        .order('last_message_at', { ascending: false });
      const convs = (rawConvs as ConvRow[] | null) || [];

      const allTags = [...new Set(convs.flatMap(c => c.tags || []))];
      const convIds = convs.map(c => c.id);

      let labelNamesArr: string[] = [];
      if (convIds.length > 0) {
        const { data: rawConvLabels } = await supabase
          .from('conversation_labels')
          .select('conversation_id, labels(name)')
          .in('conversation_id', convIds.slice(0, 500));
        const convLabels = rawConvLabels as ConvLabelWithName[] | null;
        const names = new Set<string>();
        for (const cl of (convLabels || [])) {
          if (cl.labels?.name) names.add(cl.labels.name);
        }
        labelNamesArr = [...names];
      }

      let kanban: { stage: string; color: string; board_id: string } | null = null;
      const { data: rawKanbanCards } = await supabase
        .from('kanban_cards')
        .select('board_id, kanban_columns(name, color)')
        .eq('contact_id', contactId!)
        .not('contact_id', 'is', null)
        .limit(1);
      const kanbanCards = rawKanbanCards as KanbanCardWithColumn[] | null;
      if (kanbanCards?.[0]?.kanban_columns) {
        kanban = {
          stage: kanbanCards[0].kanban_columns.name,
          color: kanbanCards[0].kanban_columns.color,
          board_id: kanbanCards[0].board_id,
        };
      }

      return { conversations: convs, tags: allTags, labelNames: labelNamesArr, kanbanData: kanban, convIds };
    },
    enabled: !!contactId,
  });
  const conversations = convsData?.conversations ?? [];
  const tags = convsData?.tags ?? [];
  const labelNames = convsData?.labelNames ?? [];
  const kanbanData = convsData?.kanbanData ?? null;
  const convIds = convsData?.convIds ?? [];

  // Query 4 — Extraction fields (depends on instanceId)
  const { data: extractionFields = [] } = useQuery({
    queryKey: ['lead-extraction-fields', instanceId],
    queryFn: async () => {
      const { data: agent } = await supabase
        .from('ai_agents')
        .select('extraction_fields')
        .eq('instance_id', instanceId!)
        .maybeSingle();
      return ((agent?.extraction_fields || []) as unknown as ExtractionField[]).filter(f => f.enabled);
    },
    enabled: !!instanceId,
  });

  // Query 5 — Media files (depends on conversations)
  const { data: mediaFiles = [] } = useQuery({
    queryKey: ['lead-media', contactId, convIds.length],
    queryFn: async () => {
      if (convIds.length === 0) return [];
      const { data } = await supabase
        .from('conversation_messages')
        .select('id, media_url, media_type, direction, created_at, content, transcription')
        .in('conversation_id', convIds.slice(0, 100))
        .not('media_url', 'is', null)
        .neq('media_type', 'text')
        .order('created_at', { ascending: false })
        .limit(50);
      return (data || []) as MediaFile[];
    },
    enabled: convIds.length > 0,
  });

  // Query 6 — Action events (depends on conversations + contact)
  const { data: actionEvents = [] } = useQuery({
    queryKey: ['lead-events', contactId, convIds.length],
    queryFn: async () => {
      if (convIds.length === 0 || !contact) return [];
      const { data } = await supabase
        .from('ai_agent_logs')
        .select('event, created_at, metadata, tool_calls')
        .in('conversation_id', convIds.slice(0, 100))
        .order('created_at', { ascending: false })
        .limit(100);

      const events: ActionEvent[] = [];
      events.push({ date: contact.created_at, type: 'contact', description: 'Primeiro contato' });

      for (const log of (data || [])) {
        const meta = log.metadata as LogMetadata | null;
        switch (log.event) {
          case 'response_sent':
            events.push({ date: log.created_at, type: 'response', description: `IA respondeu: "${(meta?.response_text || '').substring(0, 60)}..."` });
            break;
          case 'handoff':
            events.push({ date: log.created_at, type: 'handoff', description: `Transbordo: ${meta?.reason || 'sem motivo'}` });
            break;
          case 'label_assigned':
            events.push({ date: log.created_at, type: 'label', description: `Etiqueta: ${meta?.label_name || '?'}` });
            break;
          case 'shadow_extraction':
            events.push({ date: log.created_at, type: 'shadow', description: 'Shadow: dados extraidos' });
            break;
        }

        const tools = (log.tool_calls || []) as unknown as ToolCall[];
        if (tools?.length) {
          for (const tc of tools) {
            if (tc.name === 'set_tags') {
              const tagList = (tc.args?.tags as string[] | undefined) || [];
              events.push({ date: log.created_at, type: 'tag', description: `Tags: ${tagList.join(', ')}` });
            }
            if (tc.name === 'update_lead_profile') {
              const parts: string[] = [];
              if (tc.args?.full_name) parts.push(`nome=${tc.args.full_name}`);
              if (tc.args?.city) parts.push(`cidade=${tc.args.city}`);
              if (parts.length) events.push({ date: log.created_at, type: 'profile', description: `Perfil: ${parts.join(', ')}` });
            }
            if (tc.name === 'move_kanban') {
              events.push({ date: log.created_at, type: 'kanban', description: `CRM: movido para ${(tc.args?.column_name as string | undefined) || '?'}` });
            }
          }
        }
      }

      events.sort((a, b) => b.date.localeCompare(a.date));
      return events;
    },
    enabled: convIds.length > 0 && !!contact,
  });

  // Derived loading state
  const loading = contactLoading || profileLoading || convsLoading;

  // Auto-save with 1s debounce (preserved as-is per Pitfall 5 — do NOT migrate to useMutation)
  const autoSave = useCallback(async () => {
    if (!contactId) return;
    setSaveStatus('saving');
    try {
      await supabase.from('lead_profiles').upsert({
        contact_id: contactId,
        origin: editOrigin || null,
        email: editEmail || null,
        document: editDocument || null,
        birth_date: editBirthDate || null,
        address: editAddress,
        custom_fields: editCustom,
        last_contact_at: new Date().toISOString(),
      }, { onConflict: 'contact_id' });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err: unknown) {
      handleError(err, 'Erro ao salvar', 'LeadDetail');
      setSaveStatus('idle');
    }
  }, [contactId, editOrigin, editEmail, editDocument, editBirthDate, editAddress, editCustom]);

  useEffect(() => {
    if (initialLoadRef.current) { initialLoadRef.current = false; return; }
    if (!contactId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(autoSave, 1000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [editOrigin, editEmail, editDocument, editBirthDate, editAddress, editCustom]);

  // Handlers
  const handleToggleBlockInstance = async (instId: string) => {
    if (!contact) return;
    try {
      const current: string[] = contact.ia_blocked_instances || [];
      const updated = current.includes(instId)
        ? current.filter((id: string) => id !== instId)
        : [...current, instId];
      await supabase.from('contacts').update({ ia_blocked_instances: updated }).eq('id', contact.id);
      // Invalidate contact query to reflect new ia_blocked_instances
      queryClient.invalidateQueries({ queryKey: ['lead-contact', contactId] });
      toast.success(updated.includes(instId) ? 'IA bloqueada nesta instancia' : 'IA desbloqueada');
    } catch (err: unknown) {
      handleError(err, 'Erro', 'LeadDetail');
    }
  };

  const handleClearContext = async () => {
    try {
      // Clear lead_profile: summaries, interests, notes, reason, full_name (reset everything)
      await supabase.from('lead_profiles').upsert({
        contact_id: contactId,
        conversation_summaries: [], interests: null, notes: null,
        reason: null, full_name: null, average_ticket: null,
        custom_fields: {},
      }, { onConflict: 'contact_id' });

      // Clear conversations: replace tags with ia_cleared marker, clear ai_summary, reactivate IA
      // IMPORTANT: ia_cleared:TIMESTAMP resets the handoff message counter in ai-agent
      const clearedTag = `ia_cleared:${new Date().toISOString()}`;
      if (convIds.length > 0) {
        await supabase.from('conversations').update({ tags: [clearedTag], ai_summary: null, status_ia: STATUS_IA.LIGADA }).in('id', convIds);
        // Delete ai_agent_logs
        await supabase.from('ai_agent_logs').delete().in('conversation_id', convIds);
      }

      // Also unblock IA on this contact (clear ia_blocked_instances)
      if (contact) {
        await supabase.from('contacts').update({ ia_blocked_instances: [] }).eq('id', contact.id);
      }

      // Invalidate queries to reload fresh data
      queryClient.invalidateQueries({ queryKey: ['lead-conversations', contactId] });
      queryClient.invalidateQueries({ queryKey: ['lead-events', contactId] });
      queryClient.invalidateQueries({ queryKey: ['lead-contact', contactId] });
      queryClient.invalidateQueries({ queryKey: ['lead-profile', contactId] });
      toast.success('Contexto limpo — IA reativada');
    } catch (err: unknown) {
      handleError(err, 'Erro', 'LeadDetail');
    }
  };

  const openConversation = (convId: string) => {
    setSelectedConvId(convId);
    setConvModalOpen(true);
  };

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not found
  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Contact2 className="w-16 h-16 text-muted-foreground opacity-30" />
        <p className="text-lg text-muted-foreground">Lead nao encontrado</p>
        <Button variant="outline" onClick={() => navigate('/dashboard/leads')}>
          <ArrowLeft className="w-4 h-4 mr-2" />Voltar para Leads
        </Button>
      </div>
    );
  }

  const lp = leadProfile;
  const summaries: Array<{ date: string; summary: string }> = (lp?.conversation_summaries || []) as Array<{ date: string; summary: string }>;
  const lastSummary = conversations.find(c => c.ai_summary)?.ai_summary;

  // Parse extracted data from tags
  const extractedData: Record<string, string> = {};
  for (const tag of tags) {
    const [key, ...rest] = tag.split(':');
    if (rest.length > 0) extractedData[key] = rest.join(':');
  }

  const displayName = lp?.full_name || contact.name || contact.phone;
  const customFieldsConfig = extractionFields.filter(f =>
    f.section === 'custom' || (!f.section && ['email', 'documento', 'profissao', 'site'].includes(f.key))
  );

  // KPI — Resumo do Atendimento (most recently CREATED conversation, not most recently messaged)
  const latestConv = [...conversations].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
  const kpiProdutos = tags.filter(t => t.startsWith('produto:')).map(t => t.split(':').slice(1).join(':').replace(/_/g, ' '));
  const kpiInteresses = tags.filter(t => t.startsWith('interesse:')).map(t => t.split(':').slice(1).join(':').replace(/_/g, ' '));
  const kpiItens = [...new Set([...kpiProdutos, ...kpiInteresses])];
  const kpiProdutoFalta = tags.find(t => t.startsWith('marca_indisponivel:'))?.split(':').slice(1).join(':').replace(/_/g, ' ').replace(/,\s*/g, ', ') ?? null;
  const kpiTipoCliente = tags.find(t => t.startsWith('tipo_cliente:'))?.split(':').slice(1).join(':').replace(/_/g, ' ') ?? extractedData['tipo_cliente'] ?? null;
  // Shadow/IA check usa APENAS tags da conversa mais recente (não agregadas — evita herdar ia:shadow de conversas antigas)
  const latestConvTags = latestConv?.tags ?? [];
  const kpiAtendidoIA = latestConvTags.some(t => t.startsWith('ia:shadow')) ? 'Shadow' : (latestConvTags.some(t => t.startsWith('motivo:') || t.startsWith('produto:') || t.startsWith('interesse:')) ? 'Sim' : 'Não');
  const fmtKpi = (iso: string | null | undefined, mode: 'time' | 'date') => {
    if (!iso) return '—';
    return mode === 'time'
      ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };
  const kpiInicio = latestConv ? `${fmtKpi(latestConv.created_at, 'date')} ${fmtKpi(latestConv.created_at, 'time')}` : '—';
  const kpiFim = latestConv?.last_message_at ? `${fmtKpi(latestConv.last_message_at, 'date')} ${fmtKpi(latestConv.last_message_at, 'time')}` : '—';
  const kpiDuracao = (() => {
    if (!latestConv) return '—';
    const start = new Date(latestConv.created_at).getTime();
    const end = latestConv.last_message_at ? new Date(latestConv.last_message_at).getTime() : Date.now();
    const mins = Math.round((end - start) / 60000);
    if (mins < 60) return `${mins}min`;
    const h = Math.floor(mins / 60);
    if (h < 24) { const m = mins % 60; return m > 0 ? `${h}h ${m}min` : `${h}h`; }
    const d = Math.floor(h / 24); const rh = h % 24;
    return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
  })();

  // Lead engagement score (0–100)
  const leadScore = (() => {
    let s = 0;
    if (lp?.full_name || contact.name) s += 10;
    if (lp?.email || editEmail) s += 10;
    if (tags.some(t => t.startsWith('motivo:'))) s += 10;
    if (kpiItens.length > 0) s += 15;
    s += Math.min(conversations.length * 5, 20);
    s += Math.min(lp?.total_interactions || 0, 15);
    if (lp?.city || extractedData['cidade']) s += 10;
    if (kanbanData) s += 10;
    return Math.min(s, 100);
  })();

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Back button + save status */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground" onClick={() => navigate('/dashboard/leads')}>
          <ArrowLeft className="w-4 h-4" />
          Voltar para Leads
        </Button>
        {saveStatus !== 'idle' && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground animate-slide-up">
            {saveStatus === 'saving' && <><Loader2 className="w-3.5 h-3.5 animate-spin" />Salvando...</>}
            {saveStatus === 'saved' && <><Save className="w-3.5 h-3.5 text-primary" /><span className="text-primary">Salvo</span></>}
          </div>
        )}
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Section */}
          <LeadProfileSection
            contact={{
              display_name: displayName,
              phone: contact.phone,
              profile_pic_url: contact.profile_pic_url,
              first_contact_at: contact.created_at,
              tags,
              label_names: labelNames,
              ia_blocked_instances: contact.ia_blocked_instances || [],
              kanban_stage: kanbanData?.stage || null,
              kanban_color: kanbanData?.color || null,
              kanban_board_id: kanbanData?.board_id || null,
            }}
            leadProfile={leadProfile}
            extractionFields={extractionFields}
            extractedData={extractedData}
            instances={instances.map(i => ({ id: i.id, name: i.name }))}
            editOrigin={editOrigin}
            setEditOrigin={setEditOrigin}
            editBirthDate={editBirthDate}
            setEditBirthDate={setEditBirthDate}
            editEmail={editEmail}
            setEditEmail={setEditEmail}
            editDocument={editDocument}
            setEditDocument={setEditDocument}
            onToggleBlockInstance={handleToggleBlockInstance}
            leadScore={leadScore}
          />

          {/* Address Section */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Endereco
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: 'street', label: 'Rua' },
                  { key: 'number', label: 'Numero' },
                  { key: 'neighborhood', label: 'Bairro' },
                  { key: 'city', label: 'Cidade' },
                  { key: 'zip', label: 'CEP' },
                ].map(f => (
                  <div key={f.key}>
                    <Label className="text-xs text-muted-foreground">{f.label}</Label>
                    <Input
                      value={editAddress[f.key] || ''}
                      onChange={e => setEditAddress(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Custom Fields Section */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-primary" />
                Campos Adicionais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customFieldsConfig.filter(f => f.enabled && !['email', 'documento'].includes(f.key)).map(f => (
                  <div key={f.key}>
                    <Label className="text-xs text-muted-foreground">{f.label}</Label>
                    <Input
                      value={editCustom[f.key] || extractedData[f.key] || ''}
                      onChange={e => setEditCustom(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                ))}
                {customFieldsConfig.filter(f => f.enabled && !['email', 'documento'].includes(f.key)).length === 0 && (
                  <p className="text-sm text-muted-foreground col-span-2">Nenhum campo adicional configurado. Configure no painel do Agente IA &gt; Extracao.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* CRM Kanban */}
          {kanbanData && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  CRM
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-lg border bg-muted/30">
                  <p className="text-xs text-muted-foreground">Estagio atual</p>
                  <p className="text-base font-semibold mt-0.5" style={{ color: kanbanData.color || undefined }}>
                    {kanbanData.stage}
                  </p>
                </div>
                <a
                  href={`/dashboard/crm/${kanbanData.board_id}`}
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />Ver no CRM
                </a>
              </CardContent>
            </Card>
          )}

          {/* Resumo do Atendimento — KPI grid */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Resumo do Atendimento
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-1.5">
                <div className="flex flex-col gap-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-2">
                  <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-400/70"><ShoppingCart className="w-2.5 h-2.5" />Produto</span>
                  <span className="text-xs font-medium text-emerald-300 leading-tight truncate" title={kpiItens[0] ?? '—'}>{kpiItens[0] ?? '—'}</span>
                </div>
                <div className="flex flex-col gap-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 px-2.5 py-2">
                  <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-violet-400/70"><Bot className="w-2.5 h-2.5" />Tipo de Cliente</span>
                  <span className="text-xs font-medium text-violet-300 leading-tight truncate" title={kpiTipoCliente ?? '—'}>{kpiTipoCliente ?? '—'}</span>
                </div>
                <div className="flex flex-col gap-0.5 rounded-md bg-red-500/10 border border-red-500/20 px-2.5 py-2">
                  <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-red-400/70"><AlertCircle className="w-2.5 h-2.5" />Em falta</span>
                  <span className="text-xs font-medium text-red-300 leading-tight truncate" title={kpiProdutoFalta ?? '—'}>{kpiProdutoFalta ?? '—'}</span>
                </div>
                <div className="flex flex-col gap-0.5 rounded-md bg-slate-500/10 border border-slate-500/20 px-2.5 py-2">
                  <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400/70"><Clock className="w-2.5 h-2.5" />Início</span>
                  <span className="text-xs font-medium text-slate-300 leading-tight">{kpiInicio}</span>
                </div>
                <div className="flex flex-col gap-0.5 rounded-md bg-slate-500/10 border border-slate-500/20 px-2.5 py-2">
                  <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400/70"><Clock className="w-2.5 h-2.5" />Fim</span>
                  <span className="text-xs font-medium text-slate-300 leading-tight">{kpiFim}</span>
                </div>
                <div className="flex flex-col gap-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 px-2.5 py-2">
                  <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-400/70"><Clock className="w-2.5 h-2.5" />Duração</span>
                  <span className="text-xs font-medium text-amber-300 leading-tight">{kpiDuracao}</span>
                </div>
                <div className="flex flex-col gap-0.5 rounded-md bg-primary/10 border border-primary/20 px-2.5 py-2">
                  <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary/70"><Bot className="w-2.5 h-2.5" />Atendido por IA</span>
                  <span className={`text-xs font-medium leading-tight ${kpiAtendidoIA === 'Sim' ? 'text-primary' : kpiAtendidoIA === 'Shadow' ? 'text-yellow-400' : 'text-muted-foreground'}`}>{kpiAtendidoIA}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* History Section */}
          <LeadHistorySection
            conversations={conversations}
            lastSummary={lastSummary}
            summaries={summaries}
            notes={lp?.notes}
            interests={lp?.interests}
            onOpenConversation={openConversation}
          />

          {/* Funnel Card — M16 */}
          {contactId && contact?.tags && <LeadFunnelCard contactId={contactId} tags={contact.tags || []} />}

          {/* Journey Timeline — M15 */}
          {contactId && <LeadJourneyTimeline contactId={contactId} />}

          {/* Forms Section */}
          {contactId && <LeadFormsSection contactId={contactId} />}

          {/* Timeline Section */}
          <LeadTimelineSection events={actionEvents} />

          {/* Files Section */}
          <LeadFilesSection mediaFiles={mediaFiles} />

          {/* Clear context */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full gap-2 text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4" />Limpar contexto do agente
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar contexto?</AlertDialogTitle>
                <AlertDialogDescription>
                  Apaga historico de interacoes, interesses e notas da memoria do agente IA. As mensagens do helpdesk NAO serao apagadas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearContext} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Limpar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Conversation Modal */}
      <ConversationModal
        open={convModalOpen}
        onOpenChange={(open) => {
          setConvModalOpen(open);
          if (!open) {
            // Invalidate queries instead of reloadKey
            queryClient.invalidateQueries({ queryKey: ['lead-conversations', contactId] });
            queryClient.invalidateQueries({ queryKey: ['lead-events', contactId] });
          }
        }}
        conversationId={selectedConvId}
        contactName={displayName}
      />
    </div>
  );
};

export default LeadDetail;
