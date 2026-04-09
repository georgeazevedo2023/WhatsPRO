// M17 F1: Motor de Automação — CRUD de regras de automação por funil
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AutomationRule {
  id: string;
  funnel_id: string;
  name: string;
  enabled: boolean;
  position: number;
  trigger_type:
    | 'card_moved'
    | 'poll_answered'
    | 'form_completed'
    | 'lead_created'
    | 'conversation_resolved'
    | 'tag_added'
    | 'label_applied';
  trigger_config: Record<string, unknown>;
  condition_type: 'always' | 'tag_contains' | 'funnel_is' | 'business_hours';
  condition_config: Record<string, unknown>;
  action_type:
    | 'send_message'
    | 'move_card'
    | 'add_tag'
    | 'activate_ai'
    | 'handoff'
    | 'send_poll';
  action_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateAutomationRuleInput {
  funnel_id: string;
  name: string;
  enabled?: boolean;
  position?: number;
  trigger_type: AutomationRule['trigger_type'];
  trigger_config?: Record<string, unknown>;
  condition_type: AutomationRule['condition_type'];
  condition_config?: Record<string, unknown>;
  action_type: AutomationRule['action_type'];
  action_config?: Record<string, unknown>;
}

// ── List rules by funnel ────────────────────────────────────────────
export function useAutomationRules(funnelId: string | undefined) {
  return useQuery({
    queryKey: ['automation_rules', funnelId],
    enabled: !!funnelId,
    queryFn: async (): Promise<AutomationRule[]> => {
      if (!funnelId) return [];
      const { data, error } = await supabase
        .from('automation_rules')
        .select('*')
        .eq('funnel_id', funnelId)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data ?? []) as AutomationRule[];
    },
  });
}

// ── Create rule ─────────────────────────────────────────────────────
export function useCreateAutomationRule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateAutomationRuleInput) => {
      const { data, error } = await supabase
        .from('automation_rules')
        .insert({
          ...input,
          trigger_config: input.trigger_config ?? {},
          condition_config: input.condition_config ?? {},
          action_config: input.action_config ?? {},
          enabled: input.enabled ?? true,
          position: input.position ?? 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data as AutomationRule;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['automation_rules', data.funnel_id] });
      toast({ title: 'Automacao criada com sucesso' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar automacao', description: String(error), variant: 'destructive' });
    },
  });
}

// ── Update rule ─────────────────────────────────────────────────────
export function useUpdateAutomationRule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AutomationRule> & { id: string }) => {
      const { data, error } = await supabase
        .from('automation_rules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as AutomationRule;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['automation_rules', data.funnel_id] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar automacao', description: String(error), variant: 'destructive' });
    },
  });
}

// ── Delete rule ─────────────────────────────────────────────────────
export function useDeleteAutomationRule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, funnelId }: { id: string; funnelId: string }) => {
      const { error } = await supabase
        .from('automation_rules')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return funnelId;
    },
    onSuccess: (funnelId) => {
      queryClient.invalidateQueries({ queryKey: ['automation_rules', funnelId] });
      toast({ title: 'Automacao removida' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao remover automacao', description: String(error), variant: 'destructive' });
    },
  });
}
