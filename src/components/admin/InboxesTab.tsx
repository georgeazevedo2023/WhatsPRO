import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CopyableId } from '@/components/shared/CopyableId';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  Search, Inbox, Users, Loader2, Trash2, MonitorSmartphone, Copy, Pencil, Check, X, Plus, AlertTriangle, ArrowUpRight, ArrowDownLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import ManageInboxUsersDialog from '@/components/dashboard/ManageInboxUsersDialog';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InboxWithDetails {
  id: string;
  name: string;
  instance_id: string;
  instance_name: string;
  instance_status: string;
  created_by: string;
  created_at: string;
  member_count: number;
  webhook_url: string | null;
  webhook_outgoing_url: string | null;
}

interface Props {
  onTeamChanged?: () => void;
  openCreate?: boolean;
  onOpenCreateChange?: (open: boolean) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

const InboxesTab: React.FC<Props> = ({ onTeamChanged, openCreate, onOpenCreateChange }) => {
  const { user } = useAuth();

  const [inboxes, setInboxes] = useState<InboxWithDetails[]>([]);
  const [inboxesLoading, setInboxesLoading] = useState(true);
  const [instances, setInstances] = useState<{ id: string; name: string; status: string }[]>([]);
  const [inboxSearch, setInboxSearch] = useState('');

  // Create inbox
  const [isCreateInboxOpen, setIsCreateInboxOpen] = useState(false);

  // Sync external openCreate prop
  useEffect(() => {
    if (openCreate) {
      setIsCreateInboxOpen(true);
      onOpenCreateChange?.(false);
    }
  }, [openCreate, onOpenCreateChange]);
  const [isCreatingInbox, setIsCreatingInbox] = useState(false);
  const [newInboxName, setNewInboxName] = useState('');
  const [selectedInstanceId, setSelectedInstanceId] = useState('');

  // Delete inbox
  const [inboxToDelete, setInboxToDelete] = useState<InboxWithDetails | null>(null);
  const [isDeletingInbox, setIsDeletingInbox] = useState(false);

  // Manage members
  const [manageInbox, setManageInbox] = useState<InboxWithDetails | null>(null);

  // Webhooks
  const [editingWebhookId, setEditingWebhookId] = useState<string | null>(null);
  const [editWebhookValue, setEditWebhookValue] = useState('');
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [editingOutgoingId, setEditingOutgoingId] = useState<string | null>(null);
  const [editOutgoingValue, setEditOutgoingValue] = useState('');
  const [isSavingOutgoing, setIsSavingOutgoing] = useState(false);

  // ── Fetchers ───────────────────────────────────────────────────────────────

  const fetchInboxes = useCallback(async () => {
    setInboxesLoading(true);
    try {
      const { data: inboxData, error } = await supabase
        .from('inboxes').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (!inboxData?.length) { setInboxes([]); return; }

      const instanceIds = [...new Set(inboxData.map(i => i.instance_id))];
      const { data: instanceData } = await supabase.from('instances').select('id, name, status').in('id', instanceIds);
      const instanceMap = new Map((instanceData || []).map(i => [i.id, i]));

      const { data: memberData } = await supabase.from('inbox_users').select('inbox_id');
      const memberCounts = new Map<string, number>();
      (memberData || []).forEach(m => memberCounts.set(m.inbox_id, (memberCounts.get(m.inbox_id) || 0) + 1));

      setInboxes(inboxData.map(inbox => ({
        id: inbox.id,
        name: inbox.name,
        instance_id: inbox.instance_id,
        instance_name: instanceMap.get(inbox.instance_id)?.name || 'Instância removida',
        instance_status: instanceMap.get(inbox.instance_id)?.status || 'disconnected',
        created_by: inbox.created_by,
        created_at: inbox.created_at,
        member_count: memberCounts.get(inbox.id) || 0,
        webhook_url: inbox.webhook_url ?? null,
        webhook_outgoing_url: inbox.webhook_outgoing_url ?? null,
      })));
    } catch {
      toast.error('Erro ao carregar caixas');
    } finally {
      setInboxesLoading(false);
    }
  }, []);

  const fetchInstances = useCallback(async () => {
    const { data } = await supabase.from('instances').select('id, name, status').eq('disabled', false).order('name');
    if (data) setInstances(data);
  }, []);

  useEffect(() => { fetchInboxes(); fetchInstances(); }, [fetchInboxes, fetchInstances]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleCreateInbox = async () => {
    if (!newInboxName.trim() || !selectedInstanceId) { toast.error('Preencha nome e instância'); return; }
    setIsCreatingInbox(true);
    try {
      const { error } = await supabase.from('inboxes').insert({
        name: newInboxName.trim(), instance_id: selectedInstanceId, created_by: user!.id,
      });
      if (error) throw error;
      toast.success('Caixa criada!');
      setIsCreateInboxOpen(false);
      setNewInboxName(''); setSelectedInstanceId('');
      fetchInboxes();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar caixa');
    } finally {
      setIsCreatingInbox(false);
    }
  };

  const handleDeleteInbox = async () => {
    if (!inboxToDelete) return;
    setIsDeletingInbox(true);
    try {
      const { error } = await supabase.rpc('delete_inbox', { _inbox_id: inboxToDelete.id });
      if (error) throw error;
      toast.success('Caixa excluída');
      setInboxToDelete(null);
      fetchInboxes();
    } catch (e: any) {
      console.error('Erro ao excluir inbox:', e);
      toast.error(e?.message || e?.details || JSON.stringify(e) || 'Erro ao excluir');
    } finally {
      setIsDeletingInbox(false);
    }
  };

  const handleSaveWebhook = async (inboxId: string) => {
    setIsSavingWebhook(true);
    try {
      const { error } = await supabase.from('inboxes').update({ webhook_url: editWebhookValue.trim() || null }).eq('id', inboxId);
      if (error) throw error;
      toast.success('Webhook atualizado!');
      setEditingWebhookId(null);
      fetchInboxes();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar webhook');
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const handleSaveOutgoing = async (inboxId: string) => {
    setIsSavingOutgoing(true);
    try {
      const { error } = await supabase.from('inboxes').update({ webhook_outgoing_url: editOutgoingValue.trim() || null }).eq('id', inboxId);
      if (error) throw error;
      toast.success('Webhook Outgoing atualizado!');
      setEditingOutgoingId(null);
      fetchInboxes();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar webhook');
    } finally {
      setIsSavingOutgoing(false);
    }
  };

  // ── Filtered ───────────────────────────────────────────────────────────────

  const filteredInboxes = inboxes.filter(
    i => i.name.toLowerCase().includes(inboxSearch.toLowerCase()) ||
         i.instance_name.toLowerCase().includes(inboxSearch.toLowerCase())
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold tracking-tight">Caixas de Entrada</h2>
          <p className="text-sm text-muted-foreground">Gerencie suas caixas de atendimento WhatsApp. Os IDs são usados para integrações (n8n, API).</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou instância..." className="pl-9 h-11 text-sm" value={inboxSearch} onChange={e => setInboxSearch(e.target.value)} />
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline shrink-0">
            {filteredInboxes.length} {filteredInboxes.length === 1 ? 'caixa' : 'caixas'}
          </span>
        </div>

        {inboxesLoading ? (
          <div className="grid gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}</div>
        ) : filteredInboxes.length === 0 ? (
          <EmptyState icon={Inbox} title="Nenhuma caixa encontrada" desc="Crie a primeira caixa de entrada" />
        ) : (
          <TooltipProvider delayDuration={300}>
            <div className="grid gap-4">
              {filteredInboxes.map(inbox => (
                <div key={inbox.id} className="group border border-border/40 bg-card/50 backdrop-blur-sm rounded-xl overflow-hidden hover:bg-card/80 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                  <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border/20">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${inbox.instance_status === 'connected' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-muted/30 border-border/30'}`}>
                        <Inbox className={`w-5 h-5 ${inbox.instance_status === 'connected' ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-base truncate">{inbox.name}</h3>
                          <Badge variant="outline" className={`text-xs h-6 gap-1 shrink-0 ${inbox.instance_status === 'connected' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-muted/30 text-muted-foreground border-border/30'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${inbox.instance_status === 'connected' ? 'bg-emerald-400' : 'bg-muted-foreground/40'}`} />
                            {inbox.instance_status === 'connected' ? 'Online' : 'Offline'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-0.5 flex items-center gap-1.5">
                          <MonitorSmartphone className="w-3.5 h-3.5 shrink-0" />
                          {inbox.instance_name}
                          <span className="mx-1">•</span>
                          <Users className="w-3.5 h-3.5 shrink-0" />
                          {inbox.member_count} membro{inbox.member_count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setManageInbox(inbox)}>
                            <Users className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Gerenciar Membros</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive" onClick={() => setInboxToDelete(inbox)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Excluir</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  <div className="px-5 py-4 space-y-4">
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground/60 font-semibold">IDs para integração</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <CopyableId label="Caixa de Entrada" id={inbox.id} icon={Inbox} />
                        <CopyableId label="Instância" id={inbox.instance_id} icon={MonitorSmartphone} />
                      </div>
                    </div>

                    {/* Endpoint do Sistema */}
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground/60 font-semibold">Endpoint do Sistema</p>
                      <p className="text-[11px] text-muted-foreground">Configure esta URL no webhook da instância UAZAPI para receber mensagens nesta caixa.</p>
                      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary/5 border border-primary/20">
                        <ArrowDownLeft className="w-3.5 h-3.5 text-primary shrink-0" />
                        <code className="text-xs text-foreground truncate flex-1 font-mono">{`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`}</code>
                        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`); toast.success('URL copiada!'); }}><Copy className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Copiar URL</TooltipContent></Tooltip>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground/60 font-semibold">Webhooks</p>

                      {/* Webhook Entrada (n8n) */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <ArrowDownLeft className="w-3 h-3 text-muted-foreground" />
                          <p className="text-xs font-medium text-muted-foreground">Webhook Entrada (n8n)</p>
                        </div>
                        <p className="text-[11px] text-muted-foreground/70">URL do n8n que recebe dados da UAZAPI e repassa ao sistema (opcional, para fluxos com IA).</p>
                        {editingWebhookId === inbox.id ? (
                          <div className="flex gap-2">
                            <Input className="h-9 text-sm flex-1" value={editWebhookValue} onChange={e => setEditWebhookValue(e.target.value)} autoFocus placeholder="https://seu-n8n.com/webhook/..." />
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-primary" disabled={isSavingWebhook} onClick={() => handleSaveWebhook(inbox.id)}>
                              {isSavingWebhook ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setEditingWebhookId(null)}><X className="w-4 h-4" /></Button>
                          </div>
                        ) : inbox.webhook_url ? (
                          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/30 border border-border/30">
                            <code className="text-xs text-muted-foreground truncate flex-1 font-mono">{inbox.webhook_url}</code>
                            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { navigator.clipboard.writeText(inbox.webhook_url!); toast.success('Copiado!'); }}><Copy className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Copiar URL</TooltipContent></Tooltip>
                            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { setEditingWebhookId(inbox.id); setEditWebhookValue(inbox.webhook_url || ''); }}><Pencil className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Editar</TooltipContent></Tooltip>
                          </div>
                        ) : (
                          <Button variant="outline" size="sm" className="h-9 text-sm w-full" onClick={() => { setEditingWebhookId(inbox.id); setEditWebhookValue(''); }}>
                            <Plus className="w-4 h-4 mr-1.5" /> Adicionar Webhook Entrada
                          </Button>
                        )}
                      </div>

                      {/* Webhook Saída */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <ArrowUpRight className="w-3 h-3 text-muted-foreground" />
                          <p className="text-xs font-medium text-muted-foreground">Webhook Saída (outgoing)</p>
                        </div>
                        <p className="text-[11px] text-muted-foreground/70">URL externa que recebe eventos quando o agente envia mensagem ou ativa IA. Payload: timestamp, instance, inbox, contact, message, agent, status_ia.</p>
                        {editingOutgoingId === inbox.id ? (
                          <div className="flex gap-2">
                            <Input className="h-9 text-sm flex-1" value={editOutgoingValue} onChange={e => setEditOutgoingValue(e.target.value)} autoFocus placeholder="https://seu-n8n.com/webhook/..." />
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-primary" disabled={isSavingOutgoing} onClick={() => handleSaveOutgoing(inbox.id)}>
                              {isSavingOutgoing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setEditingOutgoingId(null)}><X className="w-4 h-4" /></Button>
                          </div>
                        ) : inbox.webhook_outgoing_url ? (
                          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/30 border border-border/30">
                            <code className="text-xs text-muted-foreground truncate flex-1 font-mono">{inbox.webhook_outgoing_url}</code>
                            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { navigator.clipboard.writeText(inbox.webhook_outgoing_url!); toast.success('Copiado!'); }}><Copy className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Copiar URL</TooltipContent></Tooltip>
                            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { setEditingOutgoingId(inbox.id); setEditOutgoingValue(inbox.webhook_outgoing_url || ''); }}><Pencil className="w-3.5 h-3.5" /></Button></TooltipTrigger><TooltipContent>Editar</TooltipContent></Tooltip>
                          </div>
                        ) : (
                          <Button variant="outline" size="sm" className="h-9 text-sm w-full" onClick={() => { setEditingOutgoingId(inbox.id); setEditOutgoingValue(''); }}>
                            <Plus className="w-4 h-4 mr-1.5" /> Adicionar Webhook Saída
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TooltipProvider>
        )}
      </div>

      {/* Create Inbox Dialog */}
      <Dialog open={isCreateInboxOpen} onOpenChange={setIsCreateInboxOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Caixa de Entrada</DialogTitle>
            <DialogDescription>Vincule uma caixa a uma instância WhatsApp</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input placeholder="Ex: Suporte, Vendas..." value={newInboxName} onChange={e => setNewInboxName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Instância WhatsApp *</Label>
              <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {instances.map(inst => (
                    <SelectItem key={inst.id} value={inst.id}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${inst.status === 'connected' ? 'bg-emerald-400' : 'bg-muted-foreground/40'}`} />
                        {inst.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateInboxOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateInbox} disabled={isCreatingInbox}>
              {isCreatingInbox ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Criando...</> : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Inbox */}
      <AlertDialog open={!!inboxToDelete} onOpenChange={open => !open && setInboxToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Excluir caixa de entrada?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{inboxToDelete?.name}</strong> e todos seus membros e etiquetas serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInbox} disabled={isDeletingInbox} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeletingInbox ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manage Inbox Members */}
      {manageInbox && (
        <ManageInboxUsersDialog
          open={!!manageInbox}
          onOpenChange={open => !open && setManageInbox(null)}
          inboxId={manageInbox.id}
          inboxName={manageInbox.name}
          onUpdate={() => { fetchInboxes(); onTeamChanged?.(); }}
        />
      )}
    </>
  );
};

export default InboxesTab;
export { InboxesTab };
