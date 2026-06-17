import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { visibleAttendants, useSetAttendantPaused, type AttendantStat } from '../useQueueDashboard';

const mockRpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
// Mocks p/ os imports de topo do hook (não usados por useSetAttendantPaused, mas
// evitam side-effects de módulo ao importar useQueueDashboard).
vi.mock('@/lib/edgeFunctionClient', () => ({ edgeFunctionFetch: vi.fn() }));
vi.mock('@/lib/helpdeskBroadcast', () => ({
  broadcastAssignedAgent: vi.fn(),
  broadcastQueueUpdate: vi.fn(),
}));

function stat(partial: Partial<AttendantStat>): AttendantStat {
  return {
    user_id: 'u', full_name: 'X', avatar_url: null, queue_paused: false, queue_position: 0,
    received: 0, responded: 0, timed_out: 0, manual_override: 0, cancelled: 0, active: 0,
    avg_response_seconds: 0, is_manager: false, ...partial,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('visibleAttendants — esconde gestores', () => {
  it('exclui is_manager e mantém atendentes (ordem preservada)', () => {
    const out = visibleAttendants([
      stat({ user_id: 'alberto', is_manager: false }),
      stat({ user_id: 'josafa', is_manager: true }),
      stat({ user_id: 'fernando', is_manager: false }),
      stat({ user_id: 'michelly', is_manager: true }),
    ]);
    expect(out.map((s) => s.user_id)).toEqual(['alberto', 'fernando']);
  });

  it('lista vazia → vazia; só-gestores → vazia', () => {
    expect(visibleAttendants([])).toEqual([]);
    expect(visibleAttendants([stat({ is_manager: true }), stat({ is_manager: true })])).toEqual([]);
  });
});

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  return { qc, wrapper };
}

describe('useSetAttendantPaused — gestor pausa/despausa atendente', () => {
  it('pausar → RPC set_queue_paused_for_user com instância + paused=true + reason', async () => {
    mockRpc.mockResolvedValue({ data: { rows_affected: 2, paused: true }, error: null });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetAttendantPaused(), { wrapper });
    result.current.mutate({ userId: 'u1', instanceId: 'inst-A', paused: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockRpc).toHaveBeenCalledWith('set_queue_paused_for_user', {
      p_user_id: 'u1', p_instance_id: 'inst-A', p_paused: true, p_reason: 'Pausado pelo gestor no painel',
    });
  });

  it('despausar → paused=false + reason=null (instância repassada)', async () => {
    mockRpc.mockResolvedValue({ data: { rows_affected: 1, paused: false }, error: null });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetAttendantPaused(), { wrapper });
    result.current.mutate({ userId: 'u1', instanceId: 'inst-A', paused: false });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockRpc).toHaveBeenCalledWith('set_queue_paused_for_user', {
      p_user_id: 'u1', p_instance_id: 'inst-A', p_paused: false, p_reason: null,
    });
  });

  it('rows_affected=0 → erro (não confirma pausa fantasma)', async () => {
    mockRpc.mockResolvedValue({ data: { rows_affected: 0, paused: true }, error: null });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetAttendantPaused(), { wrapper });
    result.current.mutate({ userId: 'ghost', instanceId: 'inst-A', paused: true });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('payload {error:forbidden} → erro com a MENSAGEM forbidden (chega no toast)', async () => {
    mockRpc.mockResolvedValue({ data: { error: 'forbidden' }, error: null });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetAttendantPaused(), { wrapper });
    result.current.mutate({ userId: 'u1', instanceId: 'inst-A', paused: true });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe('forbidden');
  });

  it('erro de RPC → erro', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetAttendantPaused(), { wrapper });
    result.current.mutate({ userId: 'u1', instanceId: 'inst-A', paused: true });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('sucesso → invalida queue-stats e queue-live (UI atualiza)', async () => {
    mockRpc.mockResolvedValue({ data: { rows_affected: 1, paused: true }, error: null });
    const { qc, wrapper } = makeWrapper();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useSetAttendantPaused(), { wrapper });
    result.current.mutate({ userId: 'u1', instanceId: 'inst-A', paused: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['queue-stats'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['queue-live'] });
  });
});
