import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { edgeFunctionFetch } from '@/lib/edgeFunctionClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  KeyRound, Eye, EyeOff, Pencil, Trash2, Plus, Zap, CheckCircle2,
  AlertCircle, RefreshCw,
} from 'lucide-react';

interface SystemSetting {
  id: string;
  key: string;
  value: string;
  description: string | null;
  is_secret: boolean;
  updated_at: string;
}

const KNOWN_SECRETS: Array<{ key: string; description: string; is_secret: boolean }> = [
  { key: 'SUPABASE_MANAGEMENT_TOKEN', description: 'Token de gerenciamento do Supabase (para aplicar secrets via API)', is_secret: true },
  { key: 'GROQ_API_KEY', description: 'Chave da API Groq para IA e transcrição de áudio', is_secret: true },
  { key: 'UAZAPI_SERVER_URL', description: 'URL do servidor UAZAPI', is_secret: false },
  { key: 'UAZAPI_ADMIN_TOKEN', description: 'Token de administrador do UAZAPI', is_secret: true },
  { key: 'ALLOWED_ORIGIN', description: 'Origem permitida para CORS das Edge Functions (ex: https://seusite.com)', is_secret: false },
];

export default function SecretsTab() {
  const queryClient = useQueryClient();
  const [visibleValues, setVisibleValues] = useState<Record<string, boolean>>({});
  const [editDialog, setEditDialog] = useState<{ open: boolean; setting?: SystemSetting | null }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; setting?: SystemSetting | null }>({ open: false });
  const [addDialog, setAddDialog] = useState(false);
  const [applying, setApplying] = useState(false);

  // Form state
  const [formKey, setFormKey] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIsSecret, setFormIsSecret] = useState(true);

  const { data: settings = [], isLoading } = useQuery<SystemSetting[]>({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .order('key');
      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { id?: string; key: string; value: string; description: string; is_secret: boolean }) => {
      if (payload.id) {
        const { error } = await supabase
          .from('system_settings')
          .update({ key: payload.key, value: payload.value, description: payload.description, is_secret: payload.is_secret })
          .eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('system_settings')
          .upsert({ key: payload.key, value: payload.value, description: payload.description, is_secret: payload.is_secret }, { onConflict: 'key' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      setEditDialog({ open: false });
      setAddDialog(false);
      toast.success('Configuração salva com sucesso');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao salvar: ${err.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('system_settings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      setDeleteDialog({ open: false });
      toast.success('Configuração removida');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao remover: ${err.message}`);
    },
  });

  const handleApplySecrets = async () => {
    setApplying(true);
    try {
      const result = await edgeFunctionFetch<{ success: boolean; applied: number; secrets?: string[]; error?: string }>(
        'apply-env-secrets', {}
      );
      if (result.success) {
        toast.success(`${result.applied} secret(s) aplicada(s) com sucesso!`, {
          description: result.secrets?.join(', '),
        });
      } else {
        toast.error(result.error || 'Erro ao aplicar secrets');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Erro: ${msg}`);
    } finally {
      setApplying(false);
    }
  };

  const openEdit = (setting: SystemSetting) => {
    setFormKey(setting.key);
    setFormValue(setting.value);
    setFormDescription(setting.description || '');
    setFormIsSecret(setting.is_secret);
    setEditDialog({ open: true, setting });
  };

  const openAdd = (preset?: typeof KNOWN_SECRETS[0]) => {
    setFormKey(preset?.key || '');
    setFormValue('');
    setFormDescription(preset?.description || '');
    setFormIsSecret(preset?.is_secret ?? true);
    setAddDialog(true);
  };

  const handleSave = () => {
    if (!formKey.trim()) { toast.error('A chave é obrigatória'); return; }
    saveMutation.mutate({
      id: editDialog.setting?.id,
      key: formKey.trim().toUpperCase().replace(/\s+/g, '_'),
      value: formValue.trim(),
      description: formDescription.trim(),
      is_secret: formIsSecret,
    });
  };

  const toggleVisible = (id: string) => {
    setVisibleValues(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const maskedValue = (value: string) => {
    if (!value) return <span className="text-muted-foreground italic text-xs">não configurado</span>;
    return '•'.repeat(Math.min(value.length, 24));
  };

  // Find which known secrets are missing
  const configuredKeys = new Set(settings.map(s => s.key));
  const missingSecrets = KNOWN_SECRETS.filter(k => !configuredKeys.has(k.key));

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            Variáveis de Ambiente
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure as chaves de API e tokens usados pelas Edge Functions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => openAdd()}>
            <Plus className="w-4 h-4 mr-1.5" />
            Adicionar
          </Button>
          <Button size="sm" onClick={handleApplySecrets} disabled={applying}>
            {applying
              ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
              : <Zap className="w-4 h-4 mr-1.5" />}
            Aplicar ao Supabase
          </Button>
        </div>
      </div>

      {/* Missing secrets alert */}
      {missingSecrets.length > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
              <AlertCircle className="w-4 h-4" />
              Configurações pendentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {missingSecrets.map(s => (
              <div key={s.key} className="flex items-center justify-between gap-3">
                <div>
                  <code className="text-xs font-mono font-semibold">{s.key}</code>
                  <p className="text-xs text-muted-foreground">{s.description}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => openAdd(s)}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Configurar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Settings list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Configurações salvas</CardTitle>
          <CardDescription>
            Clique em <strong>Aplicar ao Supabase</strong> após editar para sincronizar com as Edge Functions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : settings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <KeyRound className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma configuração cadastrada</p>
            </div>
          ) : (
            <div className="divide-y">
              {settings.map(setting => (
                <div key={setting.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-sm font-mono font-semibold">{setting.key}</code>
                      {setting.is_secret
                        ? <Badge variant="secondary" className="text-xs px-1.5 py-0">secret</Badge>
                        : <Badge variant="outline" className="text-xs px-1.5 py-0">público</Badge>}
                      {setting.value
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        : <AlertCircle className="w-3.5 h-3.5 text-yellow-500 shrink-0" />}
                    </div>
                    {setting.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{setting.description}</p>
                    )}
                    {setting.updated_at && (
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        Atualizado em {new Date(setting.updated_at).toLocaleDateString('pt-BR')} {new Date(setting.updated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="font-mono text-xs text-muted-foreground">
                        {setting.is_secret && !visibleValues[setting.id]
                          ? maskedValue(setting.value)
                          : (setting.value || <span className="italic opacity-50">vazio</span>)}
                      </span>
                      {setting.is_secret && setting.value && (
                        <button
                          onClick={() => toggleVisible(setting.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {visibleValues[setting.id]
                            ? <EyeOff className="w-3 h-3" />
                            : <Eye className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(setting)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon" variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteDialog({ open: true, setting })}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* How it works */}
      <Card className="bg-muted/30">
        <CardContent className="pt-4 pb-4">
          <h3 className="text-sm font-medium mb-2">Como funciona</h3>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Configure o <code className="font-mono bg-muted px-1 rounded">SUPABASE_MANAGEMENT_TOKEN</code> com seu token de acesso do Supabase</li>
            <li>Preencha as demais chaves (GROQ_API_KEY, UAZAPI_SERVER_URL, UAZAPI_ADMIN_TOKEN)</li>
            <li>Clique em <strong>Aplicar ao Supabase</strong> para sincronizar com as Edge Functions</li>
            <li>As Edge Functions passarão a usar os novos valores automaticamente</li>
          </ol>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onOpenChange={open => setEditDialog({ open })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar configuração</DialogTitle>
            <DialogDescription>Atualize o valor da variável de ambiente.</DialogDescription>
          </DialogHeader>
          <SettingForm
            formKey={formKey} setFormKey={setFormKey}
            formValue={formValue} setFormValue={setFormValue}
            formDescription={formDescription} setFormDescription={setFormDescription}
            formIsSecret={formIsSecret} setFormIsSecret={setFormIsSecret}
            keyReadonly
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false })}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova configuração</DialogTitle>
            <DialogDescription>Adicione uma nova variável de ambiente.</DialogDescription>
          </DialogHeader>
          <SettingForm
            formKey={formKey} setFormKey={setFormKey}
            formValue={formValue} setFormValue={setFormValue}
            formDescription={formDescription} setFormDescription={setFormDescription}
            formIsSecret={formIsSecret} setFormIsSecret={setFormIsSecret}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Salvando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={open => setDeleteDialog({ open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover configuração?</AlertDialogTitle>
            <AlertDialogDescription>
              A variável <code className="font-mono font-semibold">{deleteDialog.setting?.key}</code> será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteDialog.setting && deleteMutation.mutate(deleteDialog.setting.id)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Sub-component: form fields ────────────────────────────────────────────────
interface SettingFormProps {
  formKey: string; setFormKey: (v: string) => void;
  formValue: string; setFormValue: (v: string) => void;
  formDescription: string; setFormDescription: (v: string) => void;
  formIsSecret: boolean; setFormIsSecret: (v: boolean) => void;
  keyReadonly?: boolean;
}

function SettingForm({ formKey, setFormKey, formValue, setFormValue, formDescription, setFormDescription, formIsSecret, setFormIsSecret, keyReadonly }: SettingFormProps) {
  const [showValue, setShowValue] = useState(false);

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label>Chave</Label>
        <Input
          value={formKey}
          onChange={e => setFormKey(e.target.value)}
          placeholder="EX: GROQ_API_KEY"
          disabled={keyReadonly}
          className="font-mono"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Valor</Label>
        <div className="relative">
          <Input
            type={formIsSecret && !showValue ? 'password' : 'text'}
            value={formValue}
            onChange={e => setFormValue(e.target.value)}
            placeholder="Cole o valor aqui..."
            className="font-mono pr-9"
          />
          {formIsSecret && (
            <button
              type="button"
              onClick={() => setShowValue(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Descrição <span className="text-muted-foreground text-xs">(opcional)</span></Label>
        <Input
          value={formDescription}
          onChange={e => setFormDescription(e.target.value)}
          placeholder="Para que serve esta variável..."
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch id="is-secret" checked={formIsSecret} onCheckedChange={setFormIsSecret} />
        <Label htmlFor="is-secret" className="cursor-pointer">
          Valor secreto <span className="text-muted-foreground text-xs">(ocultar por padrão)</span>
        </Label>
      </div>
    </div>
  );
}
