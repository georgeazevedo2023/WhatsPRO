import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import type { WhatsappForm, FormField } from '@/types/forms'

// ─── useFormsForAgent ─────────────────────────────────────────────────────────
// Lista todos os formulários de um agente, ordenados por created_at DESC
export function useFormsForAgent(agentId: string | null) {
  return useQuery({
    queryKey: ['whatsapp-forms', agentId],
    queryFn: async (): Promise<WhatsappForm[]> => {
      if (!agentId) return []
      const { data, error } = await supabase
        .from('whatsapp_forms')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as WhatsappForm[]
    },
    enabled: !!agentId,
    staleTime: 30_000,
  })
}

// ─── useFormWithFields ────────────────────────────────────────────────────────
// Busca formulário + campos ordenados por position
export function useFormWithFields(formId: string | null) {
  return useQuery({
    queryKey: ['whatsapp-form-fields', formId],
    queryFn: async (): Promise<WhatsappForm | null> => {
      if (!formId) return null
      const { data, error } = await supabase
        .from('whatsapp_forms')
        .select('*, form_fields(*)')
        .eq('id', formId)
        .order('position', { referencedTable: 'form_fields', ascending: true })
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const form = data as WhatsappForm & { form_fields: FormField[] }
      return { ...form, form_fields: form.form_fields ?? [] }
    },
    enabled: !!formId,
    staleTime: 10_000,
  })
}

// ─── useCreateForm ────────────────────────────────────────────────────────────
export function useCreateForm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      agentId: string
      name: string
      description?: string
      templateType?: string
      welcomeMessage?: string
      completionMessage?: string
      fields?: Array<Omit<FormField, 'id' | 'form_id' | 'created_at'>>
    }) => {
      const slug = input.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50) + '-' + Date.now().toString(36)

      const { data: { session } } = await supabase.auth.getSession()

      const { data: form, error: formErr } = await supabase
        .from('whatsapp_forms')
        .insert({
          agent_id: input.agentId,
          name: input.name,
          slug,
          description: input.description ?? null,
          template_type: input.templateType ?? null,
          welcome_message: input.welcomeMessage ?? 'Olá! Vou te fazer algumas perguntas rápidas. 😊',
          completion_message: input.completionMessage ?? 'Obrigado pelas suas respostas! Entraremos em contato em breve. ✅',
          created_by: session?.user?.id ?? null,
        })
        .select()
        .single()
      if (formErr) throw formErr

      if (input.fields && input.fields.length > 0) {
        const fieldsToInsert = input.fields.map((f, i) => ({
          form_id: (form as WhatsappForm).id,
          position: f.position ?? i,
          field_type: f.field_type,
          label: f.label,
          required: f.required,
          validation_rules: f.validation_rules ?? null,
          error_message: f.error_message ?? null,
          skip_if_known: f.skip_if_known ?? false,
          field_key: f.field_key,
        }))
        const { error: fieldsErr } = await supabase.from('form_fields').insert(fieldsToInsert)
        if (fieldsErr) throw fieldsErr
      }

      return form as WhatsappForm
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-forms', vars.agentId] })
      toast.success('Formulário criado com sucesso!')
    },
    onError: (err: Error) => {
      toast.error('Erro ao criar formulário: ' + err.message)
    },
  })
}

// ─── useUpdateForm ────────────────────────────────────────────────────────────
export function useUpdateForm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      agentId: string
      updates: Partial<Pick<WhatsappForm, 'name' | 'description' | 'status' | 'welcome_message' | 'completion_message' | 'webhook_url' | 'max_submissions' | 'expires_at'>>
    }) => {
      const { error } = await supabase
        .from('whatsapp_forms')
        .update({ ...input.updates, updated_at: new Date().toISOString() })
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-forms', vars.agentId] })
      queryClient.invalidateQueries({ queryKey: ['whatsapp-form-fields', vars.id] })
      toast.success('Formulário atualizado!')
    },
    onError: (err: Error) => {
      toast.error('Erro ao atualizar formulário: ' + err.message)
    },
  })
}

// ─── useDeleteForm ────────────────────────────────────────────────────────────
export function useDeleteForm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; agentId: string }) => {
      const { error } = await supabase.from('whatsapp_forms').delete().eq('id', input.id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-forms', vars.agentId] })
      toast.success('Formulário excluído.')
    },
    onError: (err: Error) => {
      toast.error('Erro ao excluir formulário: ' + err.message)
    },
  })
}

// ─── useUpsertFormFields ──────────────────────────────────────────────────────
// Substitui todos os campos do formulário (DELETE all + INSERT new)
export function useUpsertFormFields() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      formId: string
      fields: Array<Omit<FormField, 'id' | 'form_id' | 'created_at'>>
    }) => {
      const { error: delErr } = await supabase.from('form_fields').delete().eq('form_id', input.formId)
      if (delErr) throw delErr

      if (input.fields.length === 0) return

      const toInsert = input.fields.map((f, i) => ({
        form_id: input.formId,
        position: i,
        field_type: f.field_type,
        label: f.label,
        required: f.required,
        validation_rules: f.validation_rules ?? null,
        error_message: f.error_message ?? null,
        skip_if_known: f.skip_if_known ?? false,
        field_key: f.field_key,
      }))
      const { error: insErr } = await supabase.from('form_fields').insert(toInsert)
      if (insErr) throw insErr
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-form-fields', vars.formId] })
    },
    onError: (err: Error) => {
      toast.error('Erro ao salvar campos: ' + err.message)
    },
  })
}
