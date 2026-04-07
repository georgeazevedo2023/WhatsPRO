import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateFunnelWizard } from '@/hooks/useCreateFunnel';
import { FUNNEL_TYPE_CONFIGS } from '@/types/funnels';
import type { FunnelType } from '@/types/funnels';
import { FUNNEL_KANBAN_COLUMNS, FUNNEL_BIO_DEFAULTS, FUNNEL_CAMPAIGN_DEFAULTS, FUNNEL_FORM_TEMPLATE } from '@/data/funnelTemplates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Target,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Megaphone,
  Link2,
  FileText,
  Kanban,
  Sparkles,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Instance } from '@/types';

const STEPS = ['Tipo', 'Detalhes', 'Canais', 'Resumo'];

export default function FunnelWizard() {
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  const createFunnel = useCreateFunnelWizard();

  const [step, setStep] = useState(0);
  const [instances, setInstances] = useState<Instance[]>([]);

  // Form state
  const [selectedType, setSelectedType] = useState<FunnelType | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instanceId, setInstanceId] = useState('');
  const [createKanban, setCreateKanban] = useState(true);
  const [createForm, setCreateForm] = useState(true);
  const [createBio, setCreateBio] = useState(true);
  const [createCampaign, setCreateCampaign] = useState(true);
  const [utmSource, setUtmSource] = useState('instagram');
  const [utmMedium, setUtmMedium] = useState('organic');

  // Result state
  const [result, setResult] = useState<{
    funnelId: string;
    campaignSlug?: string;
    bioSlug?: string;
    formSlug?: string;
  } | null>(null);

  useEffect(() => {
    const fetchInstances = async () => {
      const { data } = await supabase
        .from('instances')
        .select('id, name, status')
        .eq('disabled', false)
        .order('name');
      setInstances(data || []);
      if (data && data.length === 1) setInstanceId(data[0].id);
    };
    fetchInstances();
  }, []);

  // Sync defaults based on type
  useEffect(() => {
    if (!selectedType) return;
    const config = FUNNEL_TYPE_CONFIGS[selectedType];
    setCreateForm(config.needsForm);
    setCreateBio(config.needsBioPage);
    setCreateCampaign(config.needsCampaign);
    const campDefaults = FUNNEL_CAMPAIGN_DEFAULTS[selectedType];
    if (campDefaults) {
      setUtmSource(campDefaults.utmSource);
      setUtmMedium(campDefaults.utmMedium);
    }
  }, [selectedType]);

  if (!isSuperAdmin) {
    return <div className="p-6 text-muted-foreground">Acesso restrito.</div>;
  }

  const config = selectedType ? FUNNEL_TYPE_CONFIGS[selectedType] : null;
  const canProceed = () => {
    if (step === 0) return !!selectedType;
    if (step === 1) return name.trim().length > 0 && !!instanceId;
    return true;
  };

  const handleCreate = async () => {
    if (!selectedType || !instanceId) return;
    try {
      const res = await createFunnel.mutateAsync({
        name,
        type: selectedType,
        instanceId,
        description: description || undefined,
        createKanban,
        createForm,
        createBio,
        createCampaign,
        utmSource,
        utmMedium,
      });
      setResult({
        funnelId: res.funnelId,
        campaignSlug: res.campaignSlug,
        bioSlug: res.bioSlug,
        formSlug: res.formSlug,
      });
      setStep(4); // success step
    } catch {
      // Error handled by mutation
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // ── Step 0: Tipo ──────────────────────────────────────────────────
  const renderTypeStep = () => (
    <div className="space-y-4">
      <p className="text-muted-foreground">Qual o objetivo do seu funil?</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {(Object.values(FUNNEL_TYPE_CONFIGS) as Array<typeof FUNNEL_TYPE_CONFIGS[FunnelType]>).map((tc) => (
          <button
            key={tc.type}
            onClick={() => setSelectedType(tc.type)}
            className={`p-4 rounded-lg border-2 text-left transition-all hover:border-primary/50 ${
              selectedType === tc.type
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                : 'border-border'
            }`}
          >
            <span className="text-3xl block mb-2">{tc.icon}</span>
            <p className="font-semibold text-sm">{tc.label}</p>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tc.description}</p>
          </button>
        ))}
      </div>
    </div>
  );

  // ── Step 1: Detalhes ──────────────────────────────────────────────
  const renderDetailsStep = () => (
    <div className="space-y-5 max-w-md">
      <div className="space-y-2">
        <Label htmlFor="name">Nome do funil</Label>
        <Input
          id="name"
          placeholder={`Ex: ${config?.label || 'Funil'} de Natal`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Descricao (opcional)</Label>
        <Textarea
          id="description"
          placeholder="Descreva o objetivo do funil..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>
      <div className="space-y-2">
        <Label>Instancia WhatsApp</Label>
        <Select value={instanceId} onValueChange={setInstanceId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione a instancia" />
          </SelectTrigger>
          <SelectContent>
            {instances.map((inst) => (
              <SelectItem key={inst.id} value={inst.id}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${inst.status === 'connected' ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                  {inst.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  // ── Step 2: Canais ────────────────────────────────────────────────
  const renderChannelsStep = () => {
    const kanbanCols = FUNNEL_KANBAN_COLUMNS[selectedType!] || [];
    const bioDefaults = selectedType ? FUNNEL_BIO_DEFAULTS[selectedType] : undefined;
    const formTemplate = selectedType ? FUNNEL_FORM_TEMPLATE[selectedType] : undefined;

    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Configure quais recursos criar automaticamente.</p>

        {/* Kanban */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Kanban className="w-5 h-5 text-pink-500" />
                <div>
                  <p className="font-medium">Board Kanban</p>
                  <p className="text-xs text-muted-foreground">{kanbanCols.length} colunas: {kanbanCols.map(c => c.name).join(' → ')}</p>
                </div>
              </div>
              <Switch checked={createKanban} onCheckedChange={setCreateKanban} />
            </div>
          </CardContent>
        </Card>

        {/* Campanha */}
        {config?.needsCampaign && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Megaphone className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="font-medium">Campanha UTM</p>
                    <p className="text-xs text-muted-foreground">Link rastreavel + QR Code</p>
                  </div>
                </div>
                <Switch checked={createCampaign} onCheckedChange={setCreateCampaign} />
              </div>
              {createCampaign && (
                <div className="flex gap-3 pl-8">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Fonte</Label>
                    <Select value={utmSource} onValueChange={setUtmSource}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['instagram', 'facebook', 'google', 'whatsapp', 'tiktok', 'email', 'sms'].map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Meio</Label>
                    <Select value={utmMedium} onValueChange={setUtmMedium}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['organic', 'paid', 'social', 'email', 'referral'].map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Bio Link */}
        {config?.needsBioPage && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Link2 className="w-5 h-5 text-emerald-500" />
                  <div>
                    <p className="font-medium">Pagina Bio Link</p>
                    <p className="text-xs text-muted-foreground">
                      Template: {bioDefaults?.template || 'simples'} · {bioDefaults?.buttons?.length || 0} botoes
                    </p>
                  </div>
                </div>
                <Switch checked={createBio} onCheckedChange={setCreateBio} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Formulario */}
        {config?.needsForm && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-purple-500" />
                  <div>
                    <p className="font-medium">Formulario</p>
                    <p className="text-xs text-muted-foreground">
                      Template: {formTemplate || 'personalizado'}
                    </p>
                  </div>
                </div>
                <Switch checked={createForm} onCheckedChange={setCreateForm} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // ── Step 3: Resumo ────────────────────────────────────────────────
  const renderSummaryStep = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="text-2xl">{config?.icon}</span>
            {name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Tipo</p>
              <p className="font-medium">{config?.label}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Instancia</p>
              <p className="font-medium">{instances.find(i => i.id === instanceId)?.name || '-'}</p>
            </div>
          </div>

          <div className="border-t pt-3 space-y-2">
            <p className="text-sm font-medium">Recursos que serao criados:</p>
            <div className="flex flex-wrap gap-2">
              {createKanban && (
                <Badge variant="secondary" className="gap-1">
                  <Kanban className="w-3 h-3" /> Board Kanban
                </Badge>
              )}
              {createCampaign && config?.needsCampaign && (
                <Badge variant="secondary" className="gap-1">
                  <Megaphone className="w-3 h-3" /> Campanha ({utmSource}/{utmMedium})
                </Badge>
              )}
              {createBio && config?.needsBioPage && (
                <Badge variant="secondary" className="gap-1">
                  <Link2 className="w-3 h-3" /> Bio Link
                </Badge>
              )}
              {createForm && config?.needsForm && (
                <Badge variant="secondary" className="gap-1">
                  <FileText className="w-3 h-3" /> Formulario
                </Badge>
              )}
            </div>
          </div>

          {description && (
            <div className="border-t pt-3">
              <p className="text-muted-foreground text-sm">{description}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // ── Step 4: Sucesso ───────────────────────────────────────────────
  const renderSuccessStep = () => {
    const baseUrl = window.location.origin;

    return (
      <div className="space-y-6 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
          <Check className="w-8 h-8 text-emerald-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Funil criado com sucesso!</h2>
          <p className="text-muted-foreground mt-1">Todos os recursos foram criados automaticamente.</p>
        </div>

        <div className="space-y-3 max-w-md mx-auto text-left">
          {result?.campaignSlug && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Megaphone className="w-4 h-4 text-blue-500" />
                <span className="text-muted-foreground">Link UTM:</span>
                <code className="text-xs">{baseUrl}/go?c={result.campaignSlug}</code>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyToClipboard(`${baseUrl}/go?c=${result.campaignSlug}`)}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
          {result?.bioSlug && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Link2 className="w-4 h-4 text-emerald-500" />
                <span className="text-muted-foreground">Bio Link:</span>
                <code className="text-xs">{baseUrl}/bio/{result.bioSlug}</code>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyToClipboard(`${baseUrl}/bio/${result.bioSlug}`)}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
          {result?.formSlug && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-purple-500" />
                <span className="text-muted-foreground">Trigger WhatsApp:</span>
                <code className="text-xs">FORM:{result.formSlug}</code>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyToClipboard(`FORM:${result.formSlug}`)}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => navigate('/dashboard/funnels')}>
            Ver todos os funis
          </Button>
          <Button onClick={() => navigate(`/dashboard/funnels/${result?.funnelId}`)}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Abrir funil
          </Button>
        </div>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => step === 0 ? navigate('/dashboard/funnels') : setStep(s => s - 1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Novo Funil
          </h1>
          {step < 4 && (
            <p className="text-sm text-muted-foreground">Passo {step + 1} de {STEPS.length} — {STEPS[step]}</p>
          )}
        </div>
      </div>

      {/* Progress */}
      {step < 4 && (
        <div className="flex gap-1">
          {STEPS.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 flex-1 rounded-full transition-colors ${
                idx <= step ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      )}

      {/* Content */}
      {step === 0 && renderTypeStep()}
      {step === 1 && renderDetailsStep()}
      {step === 2 && renderChannelsStep()}
      {step === 3 && renderSummaryStep()}
      {step === 4 && renderSuccessStep()}

      {/* Navigation */}
      {step < 4 && (
        <div className="flex justify-between pt-4 border-t">
          <Button variant="ghost" onClick={() => step === 0 ? navigate('/dashboard/funnels') : setStep(s => s - 1)}>
            {step === 0 ? 'Cancelar' : 'Voltar'}
          </Button>

          {step < 3 ? (
            <Button onClick={() => setStep(s => s + 1)} disabled={!canProceed()}>
              Proximo
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={createFunnel.isPending}>
              {createFunnel.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Target className="w-4 h-4 mr-2" />
                  Criar Funil
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
