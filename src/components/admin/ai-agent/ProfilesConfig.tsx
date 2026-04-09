// M17 F3: Perfis de Atendimento — substitui SubAgentsConfig
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { UserCircle, Plus, Pencil, Trash2, Star, Loader2 } from 'lucide-react';
import {
  useAgentProfiles,
  useCreateAgentProfile,
  useUpdateAgentProfile,
  useDeleteAgentProfile,
  type AgentProfile,
  type CreateAgentProfileInput,
} from '@/hooks/useAgentProfiles';

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const suffix = Date.now().toString(36).slice(-4);
  return `${base}-${suffix}`;
}

const HANDOFF_RULE_OPTIONS = [
  { value: 'so_se_pedir', label: 'So se o lead pedir' },
  { value: 'apos_n_msgs', label: 'Apos N mensagens' },
  { value: 'nunca', label: 'Nunca (desativado)' },
] as const;

interface ProfilesConfigProps {
  agentId: string;
}

export function ProfilesConfig({ agentId }: ProfilesConfigProps) {
  const { data: profiles = [], isLoading } = useAgentProfiles(agentId);
  const createProfile = useCreateAgentProfile();
  const updateProfile = useUpdateAgentProfile();
  const deleteProfile = useDeleteAgentProfile();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<AgentProfile | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [handoffRule, setHandoffRule] = useState<'so_se_pedir' | 'apos_n_msgs' | 'nunca'>('so_se_pedir');
  const [handoffMaxMessages, setHandoffMaxMessages] = useState(8);
  const [handoffMessage, setHandoffMessage] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [enabled, setEnabled] = useState(true);

  const resetForm = () => {
    setName('');
    setPrompt('');
    setHandoffRule('so_se_pedir');
    setHandoffMaxMessages(8);
    setHandoffMessage('');
    setIsDefault(false);
    setEnabled(true);
    setEditingProfile(null);
  };

  const openCreate = () => {
    resetForm();
    setIsDefault(profiles.length === 0);
    setDialogOpen(true);
  };

  const openEdit = (profile: AgentProfile) => {
    setEditingProfile(profile);
    setName(profile.name);
    setPrompt(profile.prompt);
    setHandoffRule(profile.handoff_rule);
    setHandoffMaxMessages(profile.handoff_max_messages);
    setHandoffMessage(profile.handoff_message || '');
    setIsDefault(profile.is_default);
    setEnabled(profile.enabled);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    if (editingProfile) {
      await updateProfile.mutateAsync({
        id: editingProfile.id,
        agent_id: agentId,
        name: name.trim(),
        prompt: prompt.trim(),
        handoff_rule: handoffRule,
        handoff_max_messages: handoffMaxMessages,
        handoff_message: handoffMessage.trim() || null,
        is_default: isDefault,
        enabled,
      });
    } else {
      const input: CreateAgentProfileInput = {
        agent_id: agentId,
        name: name.trim(),
        slug: generateSlug(name),
        prompt: prompt.trim(),
        handoff_rule: handoffRule,
        handoff_max_messages: handoffMaxMessages,
        handoff_message: handoffMessage.trim() || null,
        is_default: isDefault,
        enabled,
      };
      await createProfile.mutateAsync(input);
    }
    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = async (profile: AgentProfile) => {
    if (profile.is_default) return;
    await deleteProfile.mutateAsync({ id: profile.id, agentId });
  };

  const handleToggleEnabled = async (profile: AgentProfile) => {
    await updateProfile.mutateAsync({
      id: profile.id,
      agent_id: agentId,
      enabled: !profile.enabled,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCircle className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Perfis de Atendimento</span>
          <span className="text-xs text-muted-foreground">— Comportamentos reutilizaveis por contexto</span>
        </div>
        <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={openCreate}>
          <Plus className="w-3 h-3" /> Novo Perfil
        </Button>
      </div>

      {profiles.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <UserCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhum perfil criado.</p>
            <p className="text-xs text-muted-foreground mt-1">Crie perfis como "Vendas", "Suporte", "Agendamento" etc.</p>
            <Button size="sm" variant="outline" className="mt-3 gap-1" onClick={openCreate}>
              <Plus className="w-3 h-3" /> Criar primeiro perfil
            </Button>
          </CardContent>
        </Card>
      )}

      {profiles.map((profile) => (
        <Card key={profile.id} className={!profile.enabled ? 'opacity-60' : ''}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <UserCircle className="w-4 h-4 text-primary" />
                {profile.name}
                {profile.is_default && (
                  <Badge variant="secondary" className="text-[10px] gap-1 h-5">
                    <Star className="w-3 h-3" /> Padrao
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Switch
                  checked={profile.enabled}
                  onCheckedChange={() => handleToggleEnabled(profile)}
                />
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(profile)}>
                  <Pencil className="w-3 h-3" />
                </Button>
                {!profile.is_default && (
                  <Button
                    variant="ghost" size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(profile)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
            <CardDescription className="text-xs">
              {HANDOFF_RULE_OPTIONS.find(o => o.value === profile.handoff_rule)?.label || profile.handoff_rule}
              {profile.handoff_rule === 'apos_n_msgs' && ` (${profile.handoff_max_messages} msgs)`}
            </CardDescription>
          </CardHeader>
          {profile.prompt && (
            <CardContent>
              <p className="text-xs text-muted-foreground line-clamp-3">{profile.prompt}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{profile.prompt.length} caracteres</p>
            </CardContent>
          )}
        </Card>
      ))}

      {/* Dialog Criar/Editar */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProfile ? 'Editar Perfil' : 'Novo Perfil de Atendimento'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Nome */}
            <div className="space-y-1">
              <Label className="text-xs">Nome do perfil</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Vendas, Suporte, Agendamento..."
                className="text-sm"
              />
            </div>

            {/* Prompt */}
            <div className="space-y-1">
              <Label className="text-xs">Instrucoes do perfil</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Descreva como o agente deve se comportar neste contexto. Ex: 'Qualifique o lead perguntando nome, cidade e interesse. Faca 1 pergunta por vez...'"
                className="min-h-[120px] resize-y text-xs"
              />
              <p className="text-[10px] text-muted-foreground">{prompt.length} caracteres</p>
            </div>

            {/* Regra de Handoff */}
            <div className="space-y-1">
              <Label className="text-xs">Regra de transbordo</Label>
              <Select value={handoffRule} onValueChange={(v: any) => setHandoffRule(v)}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HANDOFF_RULE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Max Messages (condicional) */}
            {handoffRule === 'apos_n_msgs' && (
              <div className="space-y-1">
                <Label className="text-xs">Maximo de mensagens antes do transbordo</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={handoffMaxMessages}
                  onChange={(e) => setHandoffMaxMessages(Number(e.target.value) || 8)}
                  className="text-sm w-24"
                />
              </div>
            )}

            {/* Mensagem de Handoff */}
            <div className="space-y-1">
              <Label className="text-xs">Mensagem de transbordo (opcional)</Label>
              <Textarea
                value={handoffMessage}
                onChange={(e) => setHandoffMessage(e.target.value)}
                placeholder="Ex: Vou te transferir para um consultor especializado..."
                className="min-h-[60px] resize-none text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Se vazio, usa a mensagem padrao do agente.</p>
            </div>

            {/* Controles */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-2">
                <Switch checked={isDefault} onCheckedChange={setIsDefault} id="profile-default" />
                <Label htmlFor="profile-default" className="text-xs">Perfil padrao (usado quando nao ha funil)</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={enabled} onCheckedChange={setEnabled} id="profile-enabled" />
                <Label htmlFor="profile-enabled" className="text-xs">Ativo</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setDialogOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!name.trim() || createProfile.isPending || updateProfile.isPending}
            >
              {(createProfile.isPending || updateProfile.isPending) && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              {editingProfile ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
