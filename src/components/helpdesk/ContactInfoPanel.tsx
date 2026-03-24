import { useState, useEffect, useMemo } from 'react';
import { useUserProfiles } from '@/hooks/useUserProfiles';
import { useContactProfilePic } from '@/hooks/useContactProfilePic';
import { ContactAvatar } from './ContactAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Phone, ArrowLeft, Tags, Settings2, UserCheck, Sparkles, RefreshCw, Clock, Target, CheckCircle2, AlertCircle, History, ChevronDown, ChevronUp, MessageSquare, Wand2 } from 'lucide-react';
import type { Conversation, AiSummary, Label } from '@/types';
import { ConversationLabels } from './ConversationLabels';
import { LabelPicker } from './LabelPicker';
import { ManageLabelsDialog } from './ManageLabelsDialog';
import { supabase } from '@/integrations/supabase/client';
import { edgeFunctionFetch, type EdgeFunctionError } from '@/lib/edgeFunctionClient';
import { toast } from 'sonner';
import { formatBR } from '@/lib/dateUtils';
import { handleError } from '@/lib/errorUtils';
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from '@/lib/constants';
import { useDepartments } from '@/hooks/useDepartments';

interface PastConversation {
  id: string;
  status: string;
  last_message_at: string | null;
  created_at: string;
  ai_summary: AiSummary | null;
  last_message: string | null;
}

interface ContactInfoPanelProps {
  conversation: Conversation;
  onUpdateConversation: (id: string, updates: Partial<Conversation>) => void;
  onBack?: () => void;
  inboxLabels?: Label[];
  assignedLabelIds?: string[];
  onLabelsChanged?: () => void;
  agentNamesMap?: Record<string, string>;
}

const statusOptions = STATUS_OPTIONS;

const priorityOptions = PRIORITY_OPTIONS;

const statusBadgeClass: Record<string, string> = {
  aberta: 'bg-primary/15 text-primary border-primary/30',
  pendente: 'bg-warning/15 text-warning border-warning/30',
  resolvida: 'bg-success/15 text-success border-success/30',
};

const statusLabel: Record<string, string> = {
  aberta: 'Aberta',
  pendente: 'Pendente',
  resolvida: 'Resolvida',
};

export const ContactInfoPanel = ({
  conversation,
  onUpdateConversation,
  onBack,
  inboxLabels = [],
  assignedLabelIds = [],
  onLabelsChanged,
  agentNamesMap = {},
}: ContactInfoPanelProps) => {
  const contact = conversation.contact;
  const name = contact?.name || contact?.phone || 'Desconhecido';
  const [manageLabelsOpen, setManageLabelsOpen] = useState(false);
  const [inboxMemberIds, setInboxMemberIds] = useState<string[]>([]);
  const { profiles: agentProfiles } = useUserProfiles({ userIds: inboxMemberIds, enabled: inboxMemberIds.length > 0 });
  const agents = useMemo(() =>
    agentProfiles.map(p => ({ user_id: p.id, full_name: p.full_name || 'Sem nome' })).sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [agentProfiles]
  );
  const { departments } = useDepartments({ inboxId: conversation.inbox_id, enabled: !!conversation.inbox_id });
  const [aiSummary, setAiSummary] = useState<AiSummary | null>(conversation.ai_summary || null);
  const [summarizing, setSummarizing] = useState(false);

  // Past conversations state
  const [pastConversations, setPastConversations] = useState<PastConversation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set());
  const [generatingSummaryFor, setGeneratingSummaryFor] = useState<string | null>(null);
  const [historyLimit, setHistoryLimit] = useState(20);
  const [totalHistoryCount, setTotalHistoryCount] = useState(0);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);

  const contactPic = useContactProfilePic(
    contact?.id, contact?.jid, conversation.inbox?.instance_id, contact?.profile_pic_url
  );

  // Sync aiSummary when conversation changes
  useEffect(() => {
    setAiSummary(conversation.ai_summary || null);
  }, [conversation.id, conversation.ai_summary]);

  // Fetch past conversations for this contact
  useEffect(() => {
    const fetchHistory = async () => {
      if (!conversation.contact_id) return;
      setHistoryLoading(true);
      try {
        // Fetch count of total past conversations
        const { count } = await supabase
          .from('conversations')
          .select('id', { count: 'exact', head: true })
          .eq('contact_id', conversation.contact_id)
          .neq('id', conversation.id);

        setTotalHistoryCount(count ?? 0);

        const { data, error } = await supabase
          .from('conversations')
          .select('id, status, last_message_at, created_at, ai_summary, last_message')
          .eq('contact_id', conversation.contact_id)
          .neq('id', conversation.id)
          .order('last_message_at', { ascending: false })
          .limit(historyLimit);

        if (error) throw error;
        setPastConversations(
          (data || []).map((c) => ({
            ...c,
            ai_summary: (c.ai_summary as unknown as AiSummary) ?? null,
          }))
        );
      } catch (err) {
        handleError(err, 'Erro ao carregar histórico', '[ContactInfoPanel] fetchHistory');
      } finally {
        setHistoryLoading(false);
      }
    };
    fetchHistory();
  }, [conversation.id, conversation.contact_id, historyLimit]);

  // Load all past conversations
  const handleLoadAllHistory = async () => {
    if (!conversation.contact_id || loadingMoreHistory) return;
    setLoadingMoreHistory(true);
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, status, last_message_at, created_at, ai_summary, last_message')
        .eq('contact_id', conversation.contact_id)
        .neq('id', conversation.id)
        .order('last_message_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setPastConversations(
        (data || []).map((c) => ({
          ...c,
          ai_summary: (c.ai_summary as unknown as AiSummary) ?? null,
        }))
      );
      setHistoryLimit(200);
    } catch (err) {
      handleError(err, 'Erro ao carregar histórico completo', '[ContactInfoPanel] loadAllHistory');
    } finally {
      setLoadingMoreHistory(false);
    }
  };

  const handleSummarize = async (forceRefresh = false) => {
    setSummarizing(true);
    try {
      const result = await edgeFunctionFetch<{ summary: AiSummary }>('summarize-conversation', {
        conversation_id: conversation.id, force_refresh: forceRefresh,
      });

      setAiSummary(result.summary);
    } catch (err) {
      handleError(err, 'Erro ao gerar resumo', '[ContactInfoPanel] summarize');
    } finally {
      setSummarizing(false);
    }
  };

  // Fetch inbox member IDs for agent select
  useEffect(() => {
    const fetchMemberIds = async () => {
      if (!conversation.inbox_id) return;
      const { data: members } = await supabase
        .from('inbox_users')
        .select('user_id')
        .eq('inbox_id', conversation.inbox_id);
      setInboxMemberIds(members?.map(m => m.user_id) ?? []);
    };
    fetchMemberIds();
  }, [conversation.inbox_id]);

  const assignedLabels = inboxLabels.filter(l => assignedLabelIds.includes(l.id));

  const handleRemoveLabel = async (labelId: string) => {
    try {
      await supabase
        .from('conversation_labels')
        .delete()
        .eq('conversation_id', conversation.id)
        .eq('label_id', labelId);
      onLabelsChanged?.();
    } catch (err) {
      handleError(err, 'Erro ao remover etiqueta', '[ContactInfoPanel] removeLabel');
    }
  };

  const handleAssignAgent = async (value: string) => {
    const agentId = value === '__none__' ? null : value;
    const agent = agentId ? agents.find(a => a.user_id === agentId) : null;
    const agentName = agent?.full_name || null;

    // Update DB
    const { error } = await supabase
      .from('conversations')
      .update({ assigned_to: agentId })
      .eq('id', conversation.id);

    if (error) {
      toast.error('Erro ao atribuir agente');
      return;
    }

    // Broadcast para sync em tempo real
    await supabase.channel('helpdesk-conversations').send({
      type: 'broadcast',
      event: 'assigned-agent',
      payload: {
        conversation_id: conversation.id,
        assigned_to: agentId,
      },
    });

    // Update local via callback
    onUpdateConversation(conversation.id, { assigned_to: agentId });
    toast.success(agentId ? `Atribuído a ${agentName}` : 'Agente removido');
  };

  const handleAssignDepartment = async (value: string) => {
    const deptId = value === '__none__' ? null : value;
    const { error } = await supabase
      .from('conversations')
      .update({ department_id: deptId })
      .eq('id', conversation.id);
    if (error) {
      toast.error('Erro ao atribuir departamento');
      return;
    }
    onUpdateConversation(conversation.id, { department_id: deptId });
    const deptName = deptId ? departments.find(d => d.id === deptId)?.name : null;
    toast.success(deptId ? `Departamento: ${deptName}` : 'Departamento removido');
  };

  const toggleSummaryExpanded = (convId: string) => {
    setExpandedSummaries(prev => {
      const next = new Set(prev);
      if (next.has(convId)) {
        next.delete(convId);
      } else {
        next.add(convId);
      }
      return next;
    });
  };

  const handleGenerateHistorySummary = async (convId: string) => {
    setGeneratingSummaryFor(convId);
    try {
      const result = await edgeFunctionFetch<{ summary: AiSummary }>('summarize-conversation', {
        conversation_id: convId, force_refresh: false,
      });

      // Update local state with the new summary
      setPastConversations(prev =>
        prev.map(c =>
          c.id === convId ? { ...c, ai_summary: result.summary } : c
        )
      );
      toast.success('Resumo gerado com sucesso!');
    } catch (err) {
      handleError(err, 'Erro ao gerar resumo', '[ContactInfoPanel] generateHistorySummary');
    } finally {
      setGeneratingSummaryFor(null);
    }
  };

  return (
    <div className="p-4 space-y-5 overflow-y-auto flex-1">
      {onBack && (
        <Button variant="ghost" size="sm" className="gap-1 -ml-2 -mt-2" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
      )}

      {/* Contact */}
      <div className="flex flex-col items-center text-center">
        <ContactAvatar src={contactPic} name={name} size={64} className="mb-2" />
        <h3 className="font-semibold">{name}</h3>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          <Phone className="w-3 h-3" />
          <span>{contact?.phone}</span>
        </div>
      </div>

      {/* Labels */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <Tags className="w-3 h-3" />
            Etiquetas
          </label>
          <div className="flex items-center gap-0.5">
            {onLabelsChanged && (
              <LabelPicker
                conversationId={conversation.id}
                inboxLabels={inboxLabels}
                assignedLabelIds={assignedLabelIds}
                onChanged={onLabelsChanged}
              />
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setManageLabelsOpen(true)} title="Gerenciar etiquetas">
              <Settings2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
        <ConversationLabels labels={assignedLabels} size="md" onRemove={handleRemoveLabel} />
        {assignedLabels.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhuma etiqueta</p>
        )}
      </div>

      {/* Status */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground font-medium">Status</label>
        <Select
          value={conversation.status}
          onValueChange={(v) => onUpdateConversation(conversation.id, { status: v })}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Priority */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground font-medium">Prioridade</label>
        <Select
          value={conversation.priority}
          onValueChange={(v) => onUpdateConversation(conversation.id, { priority: v })}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {priorityOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex items-center gap-2">
                  <span className={cn('w-2 h-2 rounded-full', opt.color)} />
                  {opt.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Agent Assignment */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
          <UserCheck className="w-3 h-3" />
          Agente Responsável
        </label>
        <div className="flex gap-1">
          <Select
            value={conversation.assigned_to || '__none__'}
            onValueChange={handleAssignAgent}
          >
            <SelectTrigger className="h-8 text-sm flex-1">
              <SelectValue placeholder="Nenhum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Nenhum —</SelectItem>
              {agents.map(agent => (
                <SelectItem key={agent.user_id} value={agent.user_id}>
                  {agent.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {conversation.assigned_to && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => handleAssignAgent('__none__')}
              title="Remover atribuição"
            >
              ✕
            </Button>
          )}
        </div>
        {conversation.assigned_to && conversation.updated_at && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
            <Clock className="w-2.5 h-2.5" />
            Atribuído em {formatBR(conversation.updated_at, 'dd/MM/yyyy HH:mm')}
          </p>
        )}
      </div>

      {/* Department Assignment */}
      {departments.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <Target className="w-3 h-3" />
            Departamento
          </label>
          <Select
            value={conversation.department_id || '__none__'}
            onValueChange={handleAssignDepartment}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Nenhum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Nenhum —</SelectItem>
              {departments.map(dept => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* AI Summary — current conversation */}
      <div className="space-y-2 border border-border/50 rounded-lg p-3 bg-muted/30">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium flex items-center gap-1.5 text-foreground">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Resumo da Conversa
          </label>
          {aiSummary && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => handleSummarize(true)}
              disabled={summarizing}
              title="Atualizar resumo"
            >
              <RefreshCw className={cn('w-3 h-3', summarizing && 'animate-spin')} />
            </Button>
          )}
        </div>

        {summarizing && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Sparkles className="w-3.5 h-3.5 animate-pulse text-primary" />
            <span>Analisando conversa com IA...</span>
          </div>
        )}

        {!summarizing && !aiSummary && (
          <p className="text-xs text-muted-foreground italic py-1">
            Resumo gerado automaticamente ao resolver a conversa ou após 1h de inatividade.
          </p>
        )}

        {!summarizing && aiSummary && (
          <div className="space-y-2.5 text-xs">
            {/* Reason */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-1 text-muted-foreground font-medium">
                <Target className="w-3 h-3" />
                Motivo do contato
              </div>
              <p className="text-foreground leading-relaxed">{aiSummary.reason}</p>
            </div>

            {/* Summary */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-1 text-muted-foreground font-medium">
                <AlertCircle className="w-3 h-3" />
                Resumo
              </div>
              <p className="text-foreground leading-relaxed">{aiSummary.summary}</p>
            </div>

            {/* Resolution */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-1 text-muted-foreground font-medium">
                <CheckCircle2 className="w-3 h-3" />
                Resolução
              </div>
              <p className="text-foreground leading-relaxed">{aiSummary.resolution}</p>
            </div>

            {/* Metadata */}
            <div className="flex items-center justify-between pt-1 border-t border-border/40">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="w-2.5 h-2.5" />
                <span>
                  Gerado {new Date(aiSummary.generated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <span className="text-muted-foreground">{aiSummary.message_count} msgs</span>
            </div>
          </div>
        )}
      </div>

      {/* Contact History Timeline */}
      <div className="space-y-2">
        <button
          onClick={() => setHistoryExpanded(v => !v)}
          className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group"
        >
          <span className="flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" />
            {totalHistoryCount > 0
              ? `${totalHistoryCount} ${totalHistoryCount === 1 ? 'conversa anterior' : 'conversas anteriores'}`
              : 'Histórico do contato'}
            {!historyLoading && totalHistoryCount > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {totalHistoryCount}
              </span>
            )}
          </span>
          {historyExpanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        {historyExpanded && (
          <div className="space-y-0">
            {historyLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-3 pl-1">
                <div className="w-3 h-3 rounded-full border border-muted-foreground/30 border-t-primary animate-spin" />
                Carregando histórico...
              </div>
            )}

            {!historyLoading && pastConversations.length === 0 && (
              <p className="text-xs text-muted-foreground italic py-2 pl-1">
                Nenhuma conversa anterior com este contato.
              </p>
            )}

            {!historyLoading && pastConversations.length > 0 && (
              <div className="relative">
                {/* Timeline vertical line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border/60" />

                <div className="space-y-0">
                  {pastConversations.map((past) => {
                    const dateStr = past.last_message_at || past.created_at;
                    const isExpanded = expandedSummaries.has(past.id);
                    const hasSummary = !!past.ai_summary;

                    return (
                      <div key={past.id} className="relative pl-5 pb-4 last:pb-0">
                        {/* Timeline dot */}
                        <div className={cn(
                          'absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 bg-background flex items-center justify-center',
                          past.status === 'resolvida'
                            ? 'border-success'
                            : past.status === 'pendente'
                            ? 'border-warning'
                            : 'border-primary'
                        )}>
                          <div className={cn(
                            'w-1.5 h-1.5 rounded-full',
                            past.status === 'resolvida'
                              ? 'bg-success'
                              : past.status === 'pendente'
                              ? 'bg-warning'
                              : 'bg-primary'
                          )} />
                        </div>

                        {/* Card */}
                        <div className="rounded-md border border-border/40 bg-muted/20 overflow-hidden">
                          {/* Header */}
                          <div className="flex items-center justify-between px-2.5 py-1.5 gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[11px] font-medium text-foreground shrink-0">
                                {formatBR(dateStr, 'dd/MM/yyyy')}
                              </span>
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {formatBR(dateStr, 'HH:mm')}
                              </span>
                            </div>
                            <span className={cn(
                              'text-[10px] font-medium px-1.5 py-0.5 rounded-full border shrink-0',
                              statusBadgeClass[past.status] || 'bg-muted text-muted-foreground border-border'
                            )}>
                              {statusLabel[past.status] || past.status}
                            </span>
                          </div>

                          {/* Last message preview + generate summary button (if no summary) */}
                          {!hasSummary && (
                            <div className="px-2.5 pb-2 space-y-1.5">
                              {past.last_message && (
                                <div className="flex items-start gap-1">
                                  <MessageSquare className="w-2.5 h-2.5 text-muted-foreground mt-0.5 shrink-0" />
                                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                                    {past.last_message}
                                  </p>
                                </div>
                              )}
                              <button
                                onClick={() => handleGenerateHistorySummary(past.id)}
                                disabled={generatingSummaryFor === past.id}
                                className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                {generatingSummaryFor === past.id ? (
                                  <>
                                    <Sparkles className="w-3 h-3 animate-pulse" />
                                    Gerando resumo...
                                  </>
                                ) : (
                                  <>
                                    <Wand2 className="w-3 h-3" />
                                    Gerar resumo com IA
                                  </>
                                )}
                              </button>
                            </div>
                          )}

                          {/* AI Summary */}
                          {hasSummary && (
                            <div className="border-t border-border/30">
                              {/* Reason always visible */}
                              <div className="px-2.5 py-1.5">
                                <div className="flex items-start gap-1">
                                  <Target className="w-2.5 h-2.5 text-primary mt-0.5 shrink-0" />
                                  <p className="text-[11px] text-foreground leading-relaxed">
                                    {past.ai_summary.reason}
                                  </p>
                                </div>
                              </div>

                              {/* Expanded detail */}
                              {isExpanded && (
                                <div className="px-2.5 pb-2 space-y-1.5 border-t border-border/20 pt-1.5">
                                  {past.ai_summary.summary && (
                                    <div className="flex items-start gap-1">
                                      <AlertCircle className="w-2.5 h-2.5 text-muted-foreground mt-0.5 shrink-0" />
                                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                                        {past.ai_summary.summary}
                                      </p>
                                    </div>
                                  )}
                                  {past.ai_summary.resolution && (
                                    <div className="flex items-start gap-1">
                                      <CheckCircle2 className="w-2.5 h-2.5 text-success mt-0.5 shrink-0" />
                                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                                        {past.ai_summary.resolution}
                                      </p>
                                    </div>
                                  )}
                                  {past.ai_summary.message_count && (
                                    <p className="text-[10px] text-muted-foreground/60">
                                      {past.ai_summary.message_count} mensagens
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Toggle expand */}
                              <button
                                onClick={() => toggleSummaryExpanded(past.id)}
                                className="w-full flex items-center justify-center gap-1 py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors border-t border-border/20"
                              >
                                {isExpanded ? (
                                  <>Ver menos <ChevronUp className="w-3 h-3" /></>
                                ) : (
                                  <>Ver resumo completo <ChevronDown className="w-3 h-3" /></>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Ver todas button */}
                {totalHistoryCount > pastConversations.length && (
                  <div className="pt-2 pl-5">
                    <button
                      onClick={handleLoadAllHistory}
                      disabled={loadingMoreHistory}
                      aria-label="Ver todas as conversas anteriores"
                      className="w-full py-1.5 text-xs font-medium text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {loadingMoreHistory ? (
                        <>
                          <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          Carregando...
                        </>
                      ) : (
                        <>
                          <History className="w-3 h-3" />
                          Ver todas ({totalHistoryCount - pastConversations.length} restantes)
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Inbox */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground font-medium">Caixa de Entrada</label>
        <Badge variant="secondary" className="text-xs">
          {conversation.inbox?.name || 'N/A'}
        </Badge>
      </div>

      {/* Manage Labels Dialog */}
      {conversation.inbox_id && onLabelsChanged && (
        <ManageLabelsDialog
          open={manageLabelsOpen}
          onOpenChange={setManageLabelsOpen}
          inboxId={conversation.inbox_id}
          labels={inboxLabels}
          onChanged={onLabelsChanged}
        />
      )}
    </div>
  );
};
