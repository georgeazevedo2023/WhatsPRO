/**
 * M16 F5: Dialog para vincular recursos existentes (campanhas, bio pages, forms, boards) a um novo funil
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCreateFunnel } from '@/hooks/useFunnels';
import { FUNNEL_TYPE_CONFIGS, generateFunnelSlug } from '@/types/funnels';
import type { FunnelType } from '@/types/funnels';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Target, Megaphone, Link2, FileText, Kanban } from 'lucide-react';

interface ImportExistingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ResourceOption {
  id: string;
  name: string;
  instance_id?: string;
}

export function ImportExistingDialog({ open, onOpenChange }: ImportExistingDialogProps) {
  const navigate = useNavigate();
  const createFunnel = useCreateFunnel();

  const [name, setName] = useState('');
  const [type, setType] = useState<FunnelType>('captacao');
  const [instanceId, setInstanceId] = useState('');
  const [campaignId, setCampaignId] = useState<string>('');
  const [bioPageId, setBioPageId] = useState<string>('');
  const [formId, setFormId] = useState<string>('');
  const [boardId, setBoardId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data lists
  const [instances, setInstances] = useState<ResourceOption[]>([]);
  const [campaigns, setCampaigns] = useState<ResourceOption[]>([]);
  const [bioPages, setBioPages] = useState<ResourceOption[]>([]);
  const [forms, setForms] = useState<ResourceOption[]>([]);
  const [boards, setBoards] = useState<ResourceOption[]>([]);

  // Load instances on mount
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from('instances')
        .select('id, name')
        .eq('disabled', false)
        .order('name');
      setInstances((data || []).map(d => ({ id: d.id, name: d.name })));
      if (data && data.length === 1) setInstanceId(data[0].id);
    })();
  }, [open]);

  // Load resources when instance changes
  useEffect(() => {
    if (!instanceId) return;

    // Campaigns
    (async () => {
      const { data } = await supabase
        .from('utm_campaigns')
        .select('id, name')
        .eq('instance_id', instanceId)
        .order('name');
      setCampaigns((data || []).map(d => ({ id: d.id, name: d.name })));
    })();

    // Bio Pages
    (async () => {
      const { data } = await supabase
        .from('bio_pages')
        .select('id, title')
        .eq('instance_id', instanceId)
        .order('title');
      setBioPages((data || []).map(d => ({ id: d.id, name: d.title })));
    })();

    // Forms (via ai_agents)
    (async () => {
      const { data: agents } = await supabase
        .from('ai_agents')
        .select('id')
        .eq('instance_id', instanceId)
        .limit(1);
      if (agents?.[0]) {
        const { data } = await supabase
          .from('whatsapp_forms')
          .select('id, name')
          .eq('agent_id', agents[0].id)
          .order('name');
        setForms((data || []).map(d => ({ id: d.id, name: d.name })));
      }
    })();

    // Kanban Boards
    (async () => {
      const { data } = await supabase
        .from('kanban_boards')
        .select('id, name')
        .eq('instance_id', instanceId)
        .order('name');
      setBoards((data || []).map(d => ({ id: d.id, name: d.name })));
    })();
  }, [instanceId]);

  const handleSubmit = async () => {
    if (!name.trim() || !instanceId) return;
    setIsSubmitting(true);

    try {
      const config = FUNNEL_TYPE_CONFIGS[type];
      const slug = generateFunnelSlug(name);

      const result = await createFunnel.mutateAsync({
        instance_id: instanceId,
        name,
        slug,
        type,
        icon: config.icon,
        campaign_id: (campaignId && campaignId !== 'none') ? campaignId : undefined,
        bio_page_id: (bioPageId && bioPageId !== 'none') ? bioPageId : undefined,
        form_id: (formId && formId !== 'none') ? formId : undefined,
        kanban_board_id: (boardId && boardId !== 'none') ? boardId : undefined,
        ai_template: config.defaultAiTemplate.replace('{funnel_name}', name),
      });

      onOpenChange(false);
      navigate(`/dashboard/funnels/${result.id}`);
    } catch {
      // Error handled by mutation toast
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setType('captacao');
    setCampaignId('');
    setBioPageId('');
    setFormId('');
    setBoardId('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Importar para Funil
          </DialogTitle>
          <DialogDescription>
            Vincule recursos existentes (campanhas, bio pages, formularios) a um novo funil.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label>Nome do funil</Label>
            <Input
              placeholder="Ex: Funil de Vendas Principal"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Tipo */}
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as FunnelType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(FUNNEL_TYPE_CONFIGS).map(tc => (
                  <SelectItem key={tc.type} value={tc.type}>
                    {tc.icon} {tc.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Instancia */}
          <div className="space-y-1.5">
            <Label>Instancia</Label>
            <Select value={instanceId} onValueChange={setInstanceId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {instances.map(i => (
                  <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {instanceId && (
            <>
              {/* Campanha */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm">
                  <Megaphone className="w-3.5 h-3.5 text-blue-500" />
                  Campanha (opcional)
                </Label>
                <Select value={campaignId} onValueChange={setCampaignId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {campaigns.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Bio Page */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm">
                  <Link2 className="w-3.5 h-3.5 text-emerald-500" />
                  Bio Link (opcional)
                </Label>
                <Select value={bioPageId} onValueChange={setBioPageId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {bioPages.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Formulario */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm">
                  <FileText className="w-3.5 h-3.5 text-purple-500" />
                  Formulario (opcional)
                </Label>
                <Select value={formId} onValueChange={setFormId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {forms.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Kanban Board */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm">
                  <Kanban className="w-3.5 h-3.5 text-pink-500" />
                  Board Kanban (opcional)
                </Label>
                <Select value={boardId} onValueChange={setBoardId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {boards.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || !instanceId || isSubmitting}>
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Criando...</>
            ) : (
              <><Target className="w-4 h-4 mr-2" /> Criar Funil</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
