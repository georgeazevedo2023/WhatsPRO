// M17 F3: Agent Profiles (Perfis de Atendimento) — CRUD
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AgentProfile {
  id: string;
  agent_id: string;
  name: string;
  slug: string;
  prompt: string;
  handoff_rule: 'so_se_pedir' | 'apos_n_msgs' | 'nunca';
  handoff_max_messages: number;
  handoff_department_id: string | null;
  handoff_message: string | null;
  is_default: boolean;
  position: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAgentProfileInput {
  agent_id: string;
  name: string;
  slug: string;
  prompt?: string;
  handoff_rule?: AgentProfile['handoff_rule'];
  handoff_max_messages?: number;
  handoff_department_id?: string | null;
  handoff_message?: string | null;
  is_default?: boolean;
  position?: number;
  enabled?: boolean;
}

// ── List profiles by agent ──────────────────────────────────────────
export function useAgentProfiles(agentId: string | undefined) {
  return useQuery({
    queryKey: ['agent_profiles', agentId],
    enabled: !!agentId,
    queryFn: async (): Promise<AgentProfile[]> => {
      if (!agentId) return [];
      const { data, error } = await supabase
        .from('agent_profiles')
        .select('*')
        .eq('agent_id', agentId)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data ?? []) as AgentProfile[];
    },
  });
}

// ── List profiles by instance (for funnel profile selector) ─────────
export function useAgentProfilesByInstance(instanceId: string | undefined) {
  return useQuery({
    queryKey: ['agent_profiles_instance', instanceId],
    enabled: !!instanceId,
    queryFn: async (): Promise<AgentProfile[]> => {
      if (!instanceId) return [];
      // Get agent for this instance, then load profiles
      const { data: agent } = await supabase
        .from('ai_agents')
        .select('id')
        .eq('instance_id', instanceId)
        .maybeSingle();
      if (!agent) return [];
      const { data, error } = await supabase
        .from('agent_profiles')
        .select('*')
        .eq('agent_id', agent.id)
        .eq('enabled', true)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data ?? []) as AgentProfile[];
    },
  });
}

// ── Create profile ──────────────────────────────────────────────────
export function useCreateAgentProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateAgentProfileInput) => {
      // If setting as default, unset current default first
      if (input.is_default) {
        await supabase
          .from('agent_profiles')
          .update({ is_default: false })
          .eq('agent_id', input.agent_id)
          .eq('is_default', true);
      }
      const { data, error } = await supabase
        .from('agent_profiles')
        .insert({
          ...input,
          prompt: input.prompt ?? '',
          handoff_rule: input.handoff_rule ?? 'so_se_pedir',
          handoff_max_messages: input.handoff_max_messages ?? 8,
          enabled: input.enabled ?? true,
          position: input.position ?? 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data as AgentProfile;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agent_profiles', data.agent_id] });
      queryClient.invalidateQueries({ queryKey: ['agent_profiles_instance'] });
      toast({ title: 'Perfil criado com sucesso' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao criar perfil', description: String(error), variant: 'destructive' });
    },
  });
}

// ── Update profile ──────────────────────────────────────────────────
export function useUpdateAgentProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AgentProfile> & { id: string }) => {
      // If setting as default, unset current default first
      if (updates.is_default && updates.agent_id) {
        await supabase
          .from('agent_profiles')
          .update({ is_default: false })
          .eq('agent_id', updates.agent_id)
          .eq('is_default', true);
      }
      const { data, error } = await supabase
        .from('agent_profiles')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as AgentProfile;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agent_profiles', data.agent_id] });
      queryClient.invalidateQueries({ queryKey: ['agent_profiles_instance'] });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar perfil', description: String(error), variant: 'destructive' });
    },
  });
}

// ── Delete profile ──────────────────────────────────────────────────
export function useDeleteAgentProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, agentId }: { id: string; agentId: string }) => {
      const { error } = await supabase
        .from('agent_profiles')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return agentId;
    },
    onSuccess: (agentId) => {
      queryClient.invalidateQueries({ queryKey: ['agent_profiles', agentId] });
      queryClient.invalidateQueries({ queryKey: ['agent_profiles_instance'] });
      toast({ title: 'Perfil removido' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao remover perfil', description: String(error), variant: 'destructive' });
    },
  });
}
