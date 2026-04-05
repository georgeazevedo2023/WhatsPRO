import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CampaignAiTemplate } from './CampaignAiTemplate';
import { CampaignLinkPreview } from './CampaignLinkPreview';
import { CampaignQrCode } from './CampaignQrCode';
import { useCreateCampaign, useUpdateCampaign, generateSlug, buildTrackingUrl } from '@/hooks/useCampaigns';
import { getCampaignTemplate } from '@/data/campaignTemplates';
import type { UtmCampaign, CampaignType, LandingMode } from '@/types';
import { Loader2, Save, ArrowLeft, MousePointerClick, FileText } from 'lucide-react';

interface Instance {
  id: string;
  name: string;
  owner_jid: string;
}

interface CampaignFormProps {
  campaign?: UtmCampaign | null;
}

export function CampaignForm({ campaign }: CampaignFormProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const createMutation = useCreateCampaign();
  const updateMutation = useUpdateCampaign();
  const isEdit = !!campaign;

  const [instances, setInstances] = useState<Instance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(true);

  const [name, setName] = useState(campaign?.name || '');
  const [slug, setSlug] = useState(campaign?.slug || '');
  const [instanceId, setInstanceId] = useState(campaign?.instance_id || '');
  const [utmSource, setUtmSource] = useState(campaign?.utm_source || '');
  const [utmMedium, setUtmMedium] = useState(campaign?.utm_medium || '');
  const [utmCampaign, setUtmCampaign] = useState(campaign?.utm_campaign || '');
  const [destinationPhone, setDestinationPhone] = useState(campaign?.destination_phone || '');
  const [welcomeMessage, setWelcomeMessage] = useState(campaign?.welcome_message || '');
  const [campaignType, setCampaignType] = useState<CampaignType>(campaign?.campaign_type || 'venda');
  const [aiTemplate, setAiTemplate] = useState(campaign?.ai_template || getCampaignTemplate('venda')?.template || '');
  const [aiCustomText, setAiCustomText] = useState(campaign?.ai_custom_text || '');
  const [startsAt, setStartsAt] = useState(campaign?.starts_at?.substring(0, 10) || '');
  const [expiresAt, setExpiresAt] = useState(campaign?.expires_at?.substring(0, 10) || '');
  const [status, setStatus] = useState<'active' | 'paused' | 'archived'>(campaign?.status || 'active');
  const [landingMode, setLandingMode] = useState<LandingMode>(campaign?.landing_mode || 'redirect');
  const [formSlug, setFormSlug] = useState(campaign?.form_slug || '');
  const [kanbanBoardId, setKanbanBoardId] = useState(campaign?.kanban_board_id || '');
  const [slugManual, setSlugManual] = useState(false);
  const [forms, setForms] = useState<{ slug: string; name: string }[]>([]);
  const [boards, setBoards] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('instances').select('id, name, owner_jid').eq('disabled', false).order('name');
      setInstances(data || []);
      setLoadingInstances(false);
    })();
    // Load kanban boards
    (async () => {
      const { data } = await (supabase as any).from('kanban_boards').select('id, name').order('name');
      setBoards(data || []);
    })();
  }, []);

  // Load forms when instance changes (find agent_id for instance)
  useEffect(() => {
    if (!instanceId) { setForms([]); return; }
    (async () => {
      const { data: agents } = await (supabase as any).from('ai_agents').select('id').eq('instance_id', instanceId).limit(1);
      const agentId = agents?.[0]?.id;
      if (!agentId) { setForms([]); return; }
      const { data } = await (supabase as any).from('whatsapp_forms').select('slug, name').eq('agent_id', agentId).eq('status', 'active').order('name');
      setForms(data || []);
    })();
  }, [instanceId]);

  // Auto-generate slug from name
  useEffect(() => {
    if (!slugManual && !isEdit) {
      setSlug(generateSlug(name));
    }
  }, [name, slugManual, isEdit]);

  // Auto-fill phone from instance
  useEffect(() => {
    if (instanceId && !destinationPhone) {
      const inst = instances.find(i => i.id === instanceId);
      if (inst?.owner_jid) {
        setDestinationPhone(inst.owner_jid.replace(/@.*/, ''));
      }
    }
  }, [instanceId, instances, destinationPhone]);

  const trackingUrl = slug ? buildTrackingUrl(slug) : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const payload = {
      name,
      slug,
      instance_id: instanceId,
      created_by: user.id,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      destination_phone: destinationPhone,
      welcome_message: welcomeMessage,
      campaign_type: campaignType,
      ai_template: aiTemplate,
      ai_custom_text: aiCustomText,
      landing_mode: landingMode,
      form_slug: landingMode === 'form' ? formSlug || null : null,
      kanban_board_id: kanbanBoardId || null,
      status,
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    };

    if (isEdit && campaign) {
      await updateMutation.mutateAsync({ id: campaign.id, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    navigate('/dashboard/campaigns');
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={() => navigate('/dashboard/campaigns')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold">{isEdit ? 'Editar Campanha' : 'Nova Campanha'}</h1>
      </div>

      {/* Basic info */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Informacoes basicas</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome da campanha *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Promo Dia dos Pais" required />
            </div>
            <div className="space-y-2">
              <Label>Slug (URL) *</Label>
              <Input
                value={slug}
                onChange={e => { setSlug(e.target.value); setSlugManual(true); }}
                placeholder="promo-dia-dos-pais"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Instancia *</Label>
              {loadingInstances ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                </div>
              ) : (
                <Select value={instanceId} onValueChange={setInstanceId} required>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {instances.map(i => (
                      <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Telefone destino (wa.me) *</Label>
              <Input value={destinationPhone} onChange={e => setDestinationPhone(e.target.value)} placeholder="5511999999999" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Mensagem de boas-vindas</Label>
            <Textarea
              value={welcomeMessage}
              onChange={e => setWelcomeMessage(e.target.value)}
              placeholder="Ex: Oi! Vi sua promocao e quero saber mais"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">Texto pre-preenchido no WhatsApp do lead (antes do codigo de rastreamento).</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v: 'active' | 'paused' | 'archived') => setStatus(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="paused">Pausada</SelectItem>
                  <SelectItem value="archived">Arquivada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Inicio programado</Label>
              <Input type="date" value={startsAt} onChange={e => setStartsAt(e.target.value)} />
              <p className="text-xs text-muted-foreground">Link so funciona a partir desta data.</p>
            </div>
            <div className="space-y-2">
              <Label>Validade</Label>
              <Input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
              <p className="text-xs text-muted-foreground">Link para de funcionar nesta data.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* UTM Params */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Parametros UTM</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>utm_source *</Label>
              <Input value={utmSource} onChange={e => setUtmSource(e.target.value)} placeholder="instagram, google, tiktok" required />
            </div>
            <div className="space-y-2">
              <Label>utm_medium</Label>
              <Input value={utmMedium} onChange={e => setUtmMedium(e.target.value)} placeholder="cpc, social, bio, qrcode" />
            </div>
            <div className="space-y-2">
              <Label>utm_campaign</Label>
              <Input value={utmCampaign} onChange={e => setUtmCampaign(e.target.value)} placeholder="black_friday, dia_pais" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Landing Mode */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Modo da Landing Page</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setLandingMode('redirect')}
              className={`p-4 rounded-lg border-2 text-left transition-all ${landingMode === 'redirect' ? 'border-primary bg-primary/5' : 'border-border/40 hover:border-border'}`}
            >
              <MousePointerClick className={`w-6 h-6 mb-2 ${landingMode === 'redirect' ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="font-medium text-sm">Redirect direto</div>
              <p className="text-xs text-muted-foreground mt-1">Countdown 3s e redireciona para WhatsApp. Rapido, sem atrito.</p>
            </button>
            <button
              type="button"
              onClick={() => setLandingMode('form')}
              className={`p-4 rounded-lg border-2 text-left transition-all ${landingMode === 'form' ? 'border-primary bg-primary/5' : 'border-border/40 hover:border-border'}`}
            >
              <FileText className={`w-6 h-6 mb-2 ${landingMode === 'form' ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="font-medium text-sm">Formulario primeiro</div>
              <p className="text-xs text-muted-foreground mt-1">Lead preenche dados antes de ir pro WhatsApp. Captura nome e telefone.</p>
            </button>
          </div>

          {landingMode === 'form' && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Formulario *</Label>
                {forms.length > 0 ? (
                  <Select value={formSlug} onValueChange={setFormSlug}>
                    <SelectTrigger><SelectValue placeholder="Selecione um formulario..." /></SelectTrigger>
                    <SelectContent>
                      {forms.map(f => (
                        <SelectItem key={f.slug} value={f.slug}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-xs text-muted-foreground py-2">
                    {instanceId ? 'Nenhum formulario ativo nesta instancia. Crie um em Formularios.' : 'Selecione uma instancia primeiro.'}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Funil CRM (opcional)</Label>
            <Select value={kanbanBoardId} onValueChange={setKanbanBoardId}>
              <SelectTrigger><SelectValue placeholder="Nenhum — nao criar card automatico" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum</SelectItem>
                {boards.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Lead que entrar por esta campanha sera adicionado automaticamente ao funil selecionado.</p>
          </div>
        </CardContent>
      </Card>

      {/* AI Template */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Configuracao IA</CardTitle></CardHeader>
        <CardContent>
          <CampaignAiTemplate
            campaignType={campaignType}
            aiTemplate={aiTemplate}
            aiCustomText={aiCustomText}
            onTypeChange={setCampaignType}
            onTemplateChange={setAiTemplate}
            onCustomTextChange={setAiCustomText}
          />
        </CardContent>
      </Card>

      {/* Link preview + QR */}
      {slug && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Link e QR Code</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <CampaignLinkPreview url={trackingUrl} />
            <Separator />
            <CampaignQrCode url={trackingUrl} campaignName={name || slug} size={200} />
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending || !name || !slug || !instanceId || !destinationPhone || !utmSource} className="gap-2">
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isEdit ? 'Salvar alteracoes' : 'Criar campanha'}
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate('/dashboard/campaigns')}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
