import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Server, Shield, Database, Clock, Plus, Trash2, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { edgeFunctionFetch, type EdgeFunctionError } from '@/lib/edgeFunctionClient';
import { toast } from 'sonner';
import { handleError } from '@/lib/errorUtils';
import { useInstances } from '@/hooks/useInstances';
import { useInboxes } from '@/hooks/useInboxes';

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: `${String(i).padStart(2, '0')}:00`,
}));

interface ShiftConfig {
  id: string;
  inbox_id: string;
  instance_id: string;
  recipient_number: string;
  send_hour: number;
  enabled: boolean;
  last_sent_at: string | null;
  inbox_name?: string;
  instance_name?: string;
}

interface NewConfigForm {
  inbox_id: string;
  instance_id: string;
  recipient_number: string;
  send_hour: string;
}

const Settings = () => {
  const { isSuperAdmin, user } = useAuth();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; report?: string } | null>(null);
  const [form, setForm] = useState<NewConfigForm>({
    inbox_id: '',
    instance_id: '',
    recipient_number: '',
    send_hour: '18',
  });

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const { inboxes } = useInboxes();
  const { instances } = useInstances();

  // Fetch shift report configs
  const { data: configs, isLoading: configsLoading } = useQuery({
    queryKey: ['shift-report-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shift_report_configs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Enrich with names
      const enriched: ShiftConfig[] = (data || []).map((c) => ({
        ...c,
        inbox_name: inboxes?.find((i) => i.id === c.inbox_id)?.name,
        instance_name: instances?.find((i) => i.id === c.instance_id)?.name,
      }));
      return enriched;
    },
    enabled: inboxes.length > 0 && instances.length > 0,
  });

  // Create config
  const createMutation = useMutation({
    mutationFn: async (data: NewConfigForm) => {
      const { error } = await supabase.from('shift_report_configs').insert({
        inbox_id: data.inbox_id,
        instance_id: data.instance_id,
        recipient_number: data.recipient_number,
        send_hour: parseInt(data.send_hour),
        created_by: user!.id,
        enabled: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-report-configs'] });
      setShowForm(false);
      setForm({ inbox_id: '', instance_id: '', recipient_number: '', send_hour: '18' });
      toast.success('Relatório de turno configurado com sucesso!');
    },
    onError: (err: unknown) => {
      handleError(err, 'Erro ao salvar configuração', 'Error saving shift report config');
    },
  });

  // Toggle enabled
  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('shift_report_configs')
        .update({ enabled })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-report-configs'] });
    },
  });

  // Delete config
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shift_report_configs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-report-configs'] });
      toast.success('Configuração removida.');
    },
  });

  // Test / send now
  const handleTestSend = async (configId: string, testMode: boolean) => {
    setTestingId(configId);
    setTestResult(null);
    try {
      const data = await edgeFunctionFetch<{ success?: boolean; report?: string; error?: string }>(
        'send-shift-report',
        { config_id: configId, test_mode: testMode },
      );

      if (testMode) {
        setTestResult({ id: configId, success: true, report: data.report });
        toast.success('Prévia gerada com sucesso!');
      } else {
        setTestResult({ id: configId, success: !!data.success });
        if (data.success) {
          toast.success('Relatório enviado via WhatsApp!');
          queryClient.invalidateQueries({ queryKey: ['shift-report-configs'] });
        } else {
          toast.error(data.error || 'Falha ao enviar pelo WhatsApp. Verifique se a instância está conectada.');
        }
      }
    } catch (err) {
      handleError(err, 'Erro inesperado', 'Error testing shift report');
      setTestResult({ id: configId, success: false });
    } finally {
      setTestingId(null);
    }
  };

  // Auto-fill instance when inbox is selected
  const handleInboxChange = (inboxId: string) => {
    const inbox = inboxes?.find((i) => i.id === inboxId);
    setForm((f) => ({
      ...f,
      inbox_id: inboxId,
      instance_id: inbox?.instance_id || f.instance_id,
    }));
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Configurações do sistema WhatsPRO</p>
      </div>

      {/* ── Relatório de Turno ── */}
      <Card className="glass-card-hover">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Relatório de Turno Automático
              </CardTitle>
              <CardDescription className="mt-1">
                Envie um resumo diário de atendimentos via WhatsApp para o gestor no horário configurado
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)} className="shrink-0">
              <Plus className="w-4 h-4 mr-1" />
              Novo
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* New config form */}
          {showForm && (
            <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-4">
              <p className="text-sm font-semibold text-foreground">Nova configuração</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Caixa de atendimento</Label>
                  <Select value={form.inbox_id} onValueChange={handleInboxChange}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Selecionar caixa..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(inboxes || []).map((inbox) => (
                        <SelectItem key={inbox.id} value={inbox.id}>{inbox.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Instância para envio</Label>
                  <Select value={form.instance_id} onValueChange={(v) => setForm((f) => ({ ...f, instance_id: v }))}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Selecionar instância..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(instances || []).map((inst) => (
                        <SelectItem key={inst.id} value={inst.id}>
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${inst.status === 'connected' ? 'bg-primary' : 'bg-muted-foreground'}`} />
                            {inst.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">WhatsApp do gestor</Label>
                  <Input
                    placeholder="5511999999999"
                    value={form.recipient_number}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/\D/g, '');
                      setForm((f) => ({ ...f, recipient_number: cleaned }));
                    }}
                    maxLength={15}
                    className="bg-background"
                  />
                  <p className="text-xs text-muted-foreground">DDI + DDD + número (sem espaços ou traços) — Ex: 5511999999999</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Horário de envio (São Paulo)</Label>
                  <Select value={form.send_hour} onValueChange={(v) => setForm((f) => ({ ...f, send_hour: v }))}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map((h) => (
                        <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button
                  size="sm"
                  disabled={!form.inbox_id || !form.instance_id || !form.recipient_number || createMutation.isPending}
                  onClick={() => createMutation.mutate(form)}
                >
                  {createMutation.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                  Salvar configuração
                </Button>
              </div>
            </div>
          )}

          {/* Config list */}
          {configsLoading && (
            <div className="text-sm text-muted-foreground text-center py-4">Carregando...</div>
          )}

          {!configsLoading && (!configs || configs.length === 0) && !showForm && (
            <div className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border rounded-lg">
              Nenhum relatório de turno configurado ainda.
              <br />
              Clique em <strong>Novo</strong> para configurar.
            </div>
          )}

          {(configs || []).map((config) => (
            <div key={config.id} className="border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">
                      {config.inbox_name || config.inbox_id}
                    </p>
                    <Badge variant={config.enabled ? 'default' : 'secondary'} className="text-xs">
                      {config.enabled ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <span>📱 {config.recipient_number}</span>
                    <span>🕐 {String(config.send_hour).padStart(2, '0')}:00 (SP)</span>
                    <span>📡 {config.instance_name || config.instance_id}</span>
                  </div>
                  {config.last_sent_at && (
                    <p className="text-xs text-muted-foreground">
                      Último envio: {new Date(config.last_sent_at).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={config.enabled}
                    onCheckedChange={(v) => toggleMutation.mutate({ id: config.id, enabled: v })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive h-8 w-8"
                    onClick={() => deleteMutation.mutate(config.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Test result preview */}
              {testResult?.id === config.id && testResult.report && (
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Prévia do relatório</p>
                  <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">{testResult.report}</pre>
                </div>
              )}

              <div className="flex gap-2 pt-1 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => handleTestSend(config.id, true)}
                  disabled={testingId === config.id}
                >
                  {testingId === config.id ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                  )}
                  Ver prévia
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 text-primary border-primary/30 hover:bg-primary/10"
                  onClick={() => handleTestSend(config.id, false)}
                  disabled={testingId === config.id}
                >
                  {testingId === config.id ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Send className="w-3 h-3 mr-1" />
                  )}
                  Enviar agora
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* System Info */}
      <Card className="glass-card-hover">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            Informações do Sistema
          </CardTitle>
          <CardDescription>
            Detalhes sobre a configuração atual do sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Versão</span>
            <Badge variant="outline">v1.6.0</Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">API UAZAPI</span>
            <Badge className="bg-success/10 text-success border-success/20">
              Conectada
            </Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Ambiente</span>
            <Badge variant="secondary">Produção</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="glass-card-hover">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Segurança
          </CardTitle>
          <CardDescription>
            Configurações de segurança do sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">RLS (Row Level Security)</span>
            <Badge className="bg-success/10 text-success border-success/20">
              Ativo
            </Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Autenticação</span>
            <Badge className="bg-success/10 text-success border-success/20">
              Email + Senha
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Database */}
      <Card className="glass-card-hover">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Banco de Dados
          </CardTitle>
          <CardDescription>
            Informações sobre o armazenamento de dados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Provider</span>
            <Badge variant="outline">Supabase Cloud</Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge className="bg-success/10 text-success border-success/20">
              Online
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
