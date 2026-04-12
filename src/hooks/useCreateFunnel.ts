/**
 * M16: Hook de orquestracao — cria todos os recursos de um funil em 1 clique
 * Sequencia: Kanban Board → Form → Bio Page + Buttons → Campaign → Funnel
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { FunnelType } from '@/types/funnels';
import { FUNNEL_TYPE_CONFIGS, generateFunnelSlug } from '@/types/funnels';
import { FUNNEL_KANBAN_COLUMNS, FUNNEL_BIO_DEFAULTS, FUNNEL_CAMPAIGN_DEFAULTS, FUNNEL_FORM_TEMPLATE } from '@/data/funnelTemplates';
import { FORM_TEMPLATES } from '@/types/forms';
import type { FormTemplateType } from '@/types/forms';

export interface CreateFunnelWizardInput {
  name: string;
  type: FunnelType;
  instanceId: string;
  description?: string;
  // Overrides opcionais (wizard pode customizar)
  createKanban?: boolean;
  createForm?: boolean;
  createBio?: boolean;
  createCampaign?: boolean;
  utmSource?: string;
  utmMedium?: string;
  aiTemplate?: string;
  destinationPhone?: string;
  // Custom configuration from wizard
  kanbanTitle?: string;
  kanbanColumns?: { name: string; color: string }[];
  campaignLandingMode?: 'redirect' | 'form';
  bioTemplate?: 'simples' | 'shopping' | 'negocio';
  bioTitle?: string;
  bioDescription?: string;
  bioButtons?: { type: string; label: string }[];
  formWelcomeMessage?: string;
  formCompletionMessage?: string;
}

export interface CreateFunnelResult {
  funnelId: string;
  funnelSlug: string;
  campaignId?: string;
  campaignSlug?: string;
  bioPageId?: string;
  bioSlug?: string;
  formId?: string;
  formSlug?: string;
  kanbanBoardId?: string;
}

export function useCreateFunnelWizard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateFunnelWizardInput): Promise<CreateFunnelResult> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nao autenticado');

      const config = FUNNEL_TYPE_CONFIGS[input.type];
      const slug = generateFunnelSlug(input.name);
      const result: CreateFunnelResult = { funnelId: '', funnelSlug: slug };

      // Descobrir agent_id e phone da instancia
      const { data: agentRow } = await supabase
        .from('ai_agents')
        .select('id')
        .eq('instance_id', input.instanceId)
        .limit(1)
        .maybeSingle();

      const { data: instanceRow } = await supabase
        .from('instances')
        .select('name, owner_jid')
        .eq('id', input.instanceId)
        .maybeSingle();

      const agentId = agentRow?.id;
      const phone = input.destinationPhone || instanceRow?.owner_jid?.replace('@s.whatsapp.net', '') || '';

      // ── 1. Kanban Board ───────────────────────────────────────────
      const shouldCreateKanban = input.createKanban !== false;
      let kanbanBoardId: string | undefined;

      if (shouldCreateKanban) {
        const columns = input.kanbanColumns || FUNNEL_KANBAN_COLUMNS[input.type] || [];
        if (columns.length > 0) {
          const { data: board, error: boardErr } = await supabase
            .from('kanban_boards')
            .insert({
              name: input.kanbanTitle || `Funil: ${input.name}`,
              instance_id: input.instanceId,
              created_by: user.id,
              visibility: 'instance' as const,
            })
            .select('id')
            .single();
          if (boardErr) throw new Error(`Erro ao criar board: ${boardErr.message}`);

          // Criar colunas
          const colInserts = columns.map((col, idx) => ({
            board_id: board.id,
            name: col.name,
            color: col.color,
            position: idx,
          }));
          const { error: colErr } = await supabase.from('kanban_columns').insert(colInserts);
          if (colErr) throw new Error(`Erro ao criar colunas: ${colErr.message}`);

          kanbanBoardId = board.id;
          result.kanbanBoardId = board.id;
        }
      }

      // ── 2. Formulario ─────────────────────────────────────────────
      const shouldCreateForm = (input.createForm !== false) && config.needsForm && agentId;
      let formId: string | undefined;
      let formSlug: string | undefined;

      if (shouldCreateForm) {
        const templateKey = FUNNEL_FORM_TEMPLATE[input.type];
        const template = templateKey ? FORM_TEMPLATES.find(t => t.type === (templateKey as FormTemplateType)) : undefined;

        formSlug = slug;
        const { data: form, error: formErr } = await supabase
          .from('whatsapp_forms')
          .insert({
            agent_id: agentId,
            name: input.name,
            slug: formSlug,
            description: input.description || `Formulario do funil ${input.name}`,
            template_type: templateKey || 'custom',
            welcome_message: input.formWelcomeMessage || template?.welcome_message || 'Ola! Vou te fazer algumas perguntas rapidas.',
            completion_message: input.formCompletionMessage || template?.completion_message || 'Obrigado pelas suas respostas!',
            created_by: user.id,
          })
          .select('id, slug')
          .single();
        if (formErr) throw new Error(`Erro ao criar formulario: ${formErr.message}`);

        formId = form.id;
        formSlug = form.slug;
        result.formId = form.id;
        result.formSlug = form.slug;

        // Criar campos do template
        if (template?.fields && template.fields.length > 0) {
          const fieldInserts = template.fields.map((f, idx) => ({
            form_id: form.id,
            position: idx,
            field_type: f.field_type,
            label: f.label,
            required: f.required,
            field_key: f.field_key,
            validation_rules: f.validation_rules || {},
          }));
          await supabase.from('form_fields').insert(fieldInserts);
        }
      }

      // ── 3. Bio Page + Botoes ──────────────────────────────────────
      const shouldCreateBio = (input.createBio !== false) && config.needsBioPage;
      let bioPageId: string | undefined;
      let bioSlug: string | undefined;

      if (shouldCreateBio) {
        const bioDefaults = FUNNEL_BIO_DEFAULTS[input.type];
        bioSlug = slug;

        const { data: bioPage, error: bioErr } = await supabase
          .from('bio_pages')
          .insert({
            instance_id: input.instanceId,
            created_by: user.id,
            slug: bioSlug,
            title: input.bioTitle || input.name,
            description: input.bioDescription || input.description || '',
            template: input.bioTemplate || bioDefaults?.template || 'simples',
            capture_enabled: bioDefaults?.captureEnabled ?? true,
            capture_fields: bioDefaults?.captureFields || ['name', 'phone'],
            ai_context_enabled: true,
            ai_context_template: `Lead veio do funil "${input.name}". Adapte a conversa ao objetivo.`,
          })
          .select('id, slug')
          .single();
        if (bioErr) throw new Error(`Erro ao criar bio page: ${bioErr.message}`);

        bioPageId = bioPage.id;
        bioSlug = bioPage.slug;
        result.bioPageId = bioPage.id;
        result.bioSlug = bioPage.slug;

        // Criar botoes
        if (bioDefaults?.buttons) {
          const buttonInserts = bioDefaults.buttons.map((btn, idx) => ({
            bio_page_id: bioPage.id,
            position: idx,
            type: btn.type,
            label: btn.label,
            layout: btn.layout || 'stack',
            // Se tipo form, linkar o form criado
            ...(btn.type === 'form' && formSlug ? { form_slug: formSlug } : {}),
            // Se tipo whatsapp, setar phone
            ...(btn.type === 'whatsapp' ? { phone, pre_message: `Oi! Vim pelo ${input.name}` } : {}),
          }));
          await supabase.from('bio_buttons').insert(buttonInserts);
        }
      }

      // ── 4. Campanha UTM ───────────────────────────────────────────
      const shouldCreateCampaign = (input.createCampaign !== false) && config.needsCampaign;
      let campaignId: string | undefined;
      let campaignSlug: string | undefined;

      if (shouldCreateCampaign) {
        const campDefaults = FUNNEL_CAMPAIGN_DEFAULTS[input.type];
        campaignSlug = slug;

        const { data: campaign, error: campErr } = await supabase
          .from('utm_campaigns')
          .insert({
            instance_id: input.instanceId,
            created_by: user.id,
            name: input.name,
            slug: campaignSlug,
            status: 'active',
            campaign_type: campDefaults?.campaignType || 'venda',
            utm_source: input.utmSource || campDefaults?.utmSource || 'instagram',
            utm_medium: input.utmMedium || campDefaults?.utmMedium || 'organic',
            utm_campaign: slug,
            landing_mode: formSlug ? 'form' : 'redirect',
            form_slug: formSlug || null,
            kanban_board_id: kanbanBoardId || null,
            destination_phone: phone,
            welcome_message: `Ola! Vim pelo ${input.name}`,
            ai_template: input.aiTemplate || config.defaultAiTemplate.replace('{funnel_name}', input.name),
          })
          .select('id, slug')
          .single();
        if (campErr) throw new Error(`Erro ao criar campanha: ${campErr.message}`);

        campaignId = campaign.id;
        campaignSlug = campaign.slug;
        result.campaignId = campaign.id;
        result.campaignSlug = campaign.slug;
      }

      // ── 5. Funnel (orquestrador) ──────────────────────────────────
      const aiTemplate = input.aiTemplate || config.defaultAiTemplate.replace('{funnel_name}', input.name).replace('{form_slug}', formSlug || '');

      const { data: funnel, error: funnelErr } = await supabase
        .from('funnels')
        .insert({
          instance_id: input.instanceId,
          created_by: user.id,
          name: input.name,
          slug,
          description: input.description || null,
          type: input.type,
          icon: config.icon,
          campaign_id: campaignId || null,
          bio_page_id: bioPageId || null,
          form_id: formId || null,
          kanban_board_id: kanbanBoardId || null,
          ai_template: aiTemplate,
        })
        .select('id')
        .single();
      if (funnelErr) throw new Error(`Erro ao criar funil: ${funnelErr.message}`);

      result.funnelId = funnel.id;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnels'] });
      queryClient.invalidateQueries({ queryKey: ['funnel-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['utm-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['bio-pages'] });
      toast({ title: 'Funil criado com sucesso!' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar funil',
        description: String(error),
        variant: 'destructive',
      });
    },
  });
}
