import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useInstances } from '@/hooks/useInstances';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { LeadProfileSection } from '@/components/leads/LeadProfileSection';
import { LeadHistorySection } from '@/components/leads/LeadHistorySection';
import { LeadTimelineSection } from '@/components/leads/LeadTimelineSection';
import { LeadFilesSection } from '@/components/leads/LeadFilesSection';
import { ConversationModal } from '@/components/leads/ConversationModal';
import { ArrowLeft, MapPin, Settings2, Eye, Trash2, Loader2, Save, Contact2, ExternalLink, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { handleError } from '@/lib/errorUtils';
import type { ActionEvent, MediaFile, ExtractionField } from '@/components/leads/types';

const LeadDetail = () => {
  const { contactId } = useParams<{ contactId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { instances } = useInstances();
  const instanceId = searchParams.get('instance') || instances[0]?.id || null;

  // Data state
  const [contact, setContact] = useState<any>(null);
  const [leadProfile, setLeadProfile] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [kanbanData, setKanbanData] = useState<{ stage: string; color: string; board_id: string } | null>(null);
  const [labelNames, setLabelNames] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [extractionFields, setExtractionFields] = useState<ExtractionField[]>([]);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [actionEvents, setActionEvents] = useState<ActionEvent[]>([]);
  const [loading, setLoading] = useState(true);

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
  const [reloadKey, setReloadKey] = useState(0);

  // Fetch all data
  useEffect(() => {
    if (!contactId) return;
    setLoading(true);

    const fetchData = async () => {
      try {
        // 1. Contact
        const { data: contactData } = await supabase
          .from('contacts')
          .select('*')
          .eq('id', contactId)
          .single();
        if (!contactData) { setLoading(false); return; }
        setContact(contactData);

        // 2. Lead profile
        const { data: profile } = await supabase
          .from('lead_profiles')
          .select('*')
          .eq('contact_id', contactId)
          .maybeSingle();
        setLeadProfile(profile);

        // Init editable fields
        initialLoadRef.current = true;
        const lp = profile || {};
        setEditOrigin(lp.origin || '');
        setEditEmail(lp.email || '');
        setEditDocument(lp.document || '');
        setEditBirthDate(lp.birth_date || '');
        setEditAddress(lp.address || {});
        setEditCustom(lp.custom_fields || {});

        // 3. Conversations
        const { data: convs } = await supabase
          .from('conversations')
          .select('id, status, tags, last_message, last_message_at, ai_summary, created_at')
          .eq('contact_id', contactId)
          .order('last_message_at', { ascending: false });
        setConversations(convs || []);

        // Aggregate tags
        const allTags = [...new Set((convs || []).flatMap(c => c.tags || []))];
        setTags(allTags);

        // 4. Labels
        const convIds = (convs || []).map(c => c.id);
        if (convIds.length > 0) {
          const { data: convLabels } = await supabase
            .from('conversation_labels')
            .select('conversation_id, labels(name)')
            .in('conversation_id', convIds.slice(0, 500));
          const names = new Set<string>();
          for (const cl of (convLabels || [])) {
            if ((cl as any).labels?.name) names.add((cl as any).labels.name);
          }
          setLabelNames([...names]);
        }

        // 5. Kanban card
        const { data: kanbanCards } = await supabase
          .from('kanban_cards')
          .select('board_id, kanban_columns(name, color)')
          .eq('contact_id', contactId)
          .not('contact_id', 'is', null)
          .limit(1);
        if (kanbanCards?.[0] && (kanbanCards[0] as any).kanban_columns) {
          setKanbanData({
            stage: (kanbanCards[0] as any).kanban_columns.name,
            color: (kanbanCards[0] as any).kanban_columns.color,
            board_id: kanbanCards[0].board_id,
          });
        }

        // 6. Extraction fields
        if (instanceId) {
          const { data: agent } = await supabase
            .from('ai_agents')
            .select('extraction_fields')
            .eq('instance_id', instanceId)
            .maybeSingle();
          setExtractionFields((agent?.extraction_fields || []).filter((f: any) => f.enabled));
        }

        // 7. Media files
        if (convIds.length > 0) {
          supabase
            .from('conversation_messages')
            .select('id, media_url, media_type, direction, created_at, content, transcription')
            .in('conversation_id', convIds.slice(0, 100))
            .not('media_url', 'is', null)
            .neq('media_type', 'text')
            .order('created_at', { ascending: false })
            .limit(50)
            .then(({ data }) => setMediaFiles(data || []));
        }

        // 8. Action events
        if (convIds.length > 0) {
          supabase
            .from('ai_agent_logs')
            .select('event, created_at, metadata, tool_calls')
            .in('conversation_id', convIds.slice(0, 100))
            .order('created_at', { ascending: false })
            .limit(100)
            .then(({ data }) => {
              const events: ActionEvent[] = [];
              events.push({ date: contactData.created_at, type: 'contact', description: 'Primeiro contato' });

              for (const log of (data || [])) {
                const meta = log.metadata as any;
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

                const tools = log.tool_calls as any[];
                if (tools?.length) {
                  for (const tc of tools) {
                    if (tc.name === 'set_tags') {
                      events.push({ date: log.created_at, type: 'tag', description: `Tags: ${(tc.args?.tags || []).join(', ')}` });
                    }
                    if (tc.name === 'update_lead_profile') {
                      const parts = [];
                      if (tc.args?.full_name) parts.push(`nome=${tc.args.full_name}`);
                      if (tc.args?.city) parts.push(`cidade=${tc.args.city}`);
                      if (parts.length) events.push({ date: log.created_at, type: 'profile', description: `Perfil: ${parts.join(', ')}` });
                    }
                    if (tc.name === 'move_kanban') {
                      events.push({ date: log.created_at, type: 'kanban', description: `CRM: movido para ${tc.args?.column_name || '?'}` });
                    }
                  }
                }
              }

              events.sort((a, b) => b.date.localeCompare(a.date));
              setActionEvents(events);
            });
        }
      } catch (err) {
        handleError(err, 'Erro ao carregar lead', 'LeadDetail');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [contactId, instanceId, reloadKey]);

  // Auto-save with 1s debounce
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
    } catch (err) {
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
      setContact({ ...contact, ia_blocked_instances: updated });
      toast.success(updated.includes(instId) ? 'IA bloqueada nesta instancia' : 'IA desbloqueada');
    } catch (err) {
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
      }, { onConflict: 'contact_id' });

      // Clear conversations: tags, ai_summary + reactivate IA (status_ia → ligada)
      const convIds = conversations.map((c: any) => c.id);
      if (convIds.length > 0) {
        await supabase.from('conversations').update({ tags: [], ai_summary: null, status_ia: 'ligada' }).in('id', convIds);
        // Delete ai_agent_logs
        await supabase.from('ai_agent_logs').delete().in('conversation_id', convIds);
      }

      // Also unblock IA on this contact (clear ia_blocked_instances)
      if (contact) {
        await supabase.from('contacts').update({ ia_blocked_instances: [] }).eq('id', contact.id);
        setContact({ ...contact, ia_blocked_instances: [] });
      }

      // Reload all data to reflect cleared state
      setReloadKey(k => k + 1);
      toast.success('Contexto limpo — IA reativada');
    } catch (err) {
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

  const lp = leadProfile || {};
  const summaries: any[] = lp.conversation_summaries || [];
  const lastSummary = conversations.find((c: any) => c.ai_summary)?.ai_summary;

  // Parse extracted data from tags
  const extractedData: Record<string, string> = {};
  for (const tag of tags) {
    const [key, ...rest] = tag.split(':');
    if (rest.length > 0) extractedData[key] = rest.join(':');
  }

  const displayName = lp.full_name || contact.name || contact.phone;
  const customFieldsConfig = extractionFields.filter(f =>
    f.section === 'custom' || (!f.section && ['email', 'documento', 'profissao', 'site'].includes(f.key))
  );

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

          {/* History Section */}
          <LeadHistorySection
            conversations={conversations}
            lastSummary={lastSummary}
            summaries={summaries}
            notes={lp.notes}
            interests={lp.interests}
            onOpenConversation={openConversation}
          />

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
        onOpenChange={setConvModalOpen}
        conversationId={selectedConvId}
        contactName={displayName}
      />
    </div>
  );
};

export default LeadDetail;
