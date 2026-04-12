import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { FLOW_INSTALL_DEFINITIONS } from '@/data/flowTemplates'

export function useInstallTemplate() {
  return useMutation({
    mutationFn: async ({ templateId, instanceId }: { templateId: string; instanceId: string }) => {
      const def = FLOW_INSTALL_DEFINITIONS[templateId]
      if (!def) throw new Error(`Template não encontrado: ${templateId}`)
      if (!instanceId) throw new Error('Selecione uma instância antes de instalar')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('install_flow_template', {
        p_instance_id: instanceId,
        p_name: def.default_name,
        p_slug: def.default_slug,
        p_description: def.description,
        p_template_id: def.template_id,
        p_steps: def.steps,
        p_triggers: def.triggers,
        p_publish: true,
      })

      if (error) throw error
      return data as string // UUID do flow criado
    },
  })
}
