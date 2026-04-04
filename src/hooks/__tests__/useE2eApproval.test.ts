/**
 * Testes para src/hooks/useE2eApproval.ts (F2 — Fluxo de Aprovação Admin).
 * Cobre smoke tests do hook com mocks de Supabase e verificações de tipo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useE2eApproval, type PendingRun, type UseE2eApprovalReturn } from '../useE2eApproval';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockLimit = vi.fn();
const mockOrder = vi.fn();
const mockEq = vi.fn();
const mockIs = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// ─── QueryClient wrapper ──────────────────────────────────────────────────────

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

function setupSelectChain(resolvedValue: { data: unknown; error: unknown }) {
  mockFrom.mockReturnValue({ select: mockSelect });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ is: mockIs });
  mockIs.mockReturnValue({ eq: vi.fn().mockReturnValue({ order: mockOrder }) });
  mockOrder.mockReturnValue({ limit: mockLimit });
  mockLimit.mockResolvedValue(resolvedValue);
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('useE2eApproval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pendingCount=0 e pending=[] quando agentId é null (query desabilitada)', () => {
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useE2eApproval(null, 'user-1'), { wrapper });

    // Query deve estar desabilitada — fetchStatus=idle, sem chamadas ao Supabase
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.pending).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('retorna pending=[] quando DB retorna array vazio', async () => {
    setupSelectChain({ data: [], error: null });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useE2eApproval('agent-1', 'user-1'), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.pending).toEqual([]);
    expect(result.current.pendingCount).toBe(0);
  });

  it('popula pending quando DB retorna runs com approval=null e passed=false', async () => {
    const mockRuns: Partial<PendingRun>[] = [
      {
        id: 'run-1',
        scenario_id: 'scenario-1',
        scenario_name: 'Fluxo de venda com desconto',
        category: 'vendas',
        created_at: '2026-04-04T10:00:00Z',
        passed: false,
        tools_missing: ['search_products'],
        tools_used: [],
        error: 'timeout',
        results: null,
        batch_id: 'batch-1',
        latency_ms: 8000,
        total_steps: 3,
      },
    ];
    setupSelectChain({ data: mockRuns, error: null });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useE2eApproval('agent-1', 'user-1'), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.pending).toHaveLength(1);
    expect(result.current.pendingCount).toBe(1);
    expect(result.current.pending[0].scenario_name).toBe('Fluxo de venda com desconto');
  });

  it('hook expõe função approve no retorno', () => {
    setupSelectChain({ data: [], error: null });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useE2eApproval('agent-1', 'user-1'), { wrapper });

    expect(typeof result.current.approve).toBe('function');
  });

  it('hook expõe função reject no retorno', () => {
    setupSelectChain({ data: [], error: null });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useE2eApproval('agent-1', 'user-1'), { wrapper });

    expect(typeof result.current.reject).toBe('function');
  });

  it('hook expõe isApproving e isRejecting como booleans', () => {
    setupSelectChain({ data: [], error: null });
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useE2eApproval('agent-1', 'user-1'), { wrapper });

    expect(typeof result.current.isApproving).toBe('boolean');
    expect(typeof result.current.isRejecting).toBe('boolean');
    expect(result.current.isApproving).toBe(false);
    expect(result.current.isRejecting).toBe(false);
  });

  it('consulta e2e_test_runs com agent_id correto', async () => {
    setupSelectChain({ data: [], error: null });
    const wrapper = makeWrapper();
    renderHook(() => useE2eApproval('agent-abc', 'user-1'), { wrapper });

    await waitFor(() => expect(mockFrom).toHaveBeenCalledWith('e2e_test_runs'));
    expect(mockEq).toHaveBeenCalledWith('agent_id', 'agent-abc');
  });

  it('query é desabilitada quando agentId é string vazia', () => {
    const wrapper = makeWrapper();
    const { result } = renderHook(() => useE2eApproval('', 'user-1'), { wrapper });

    expect(result.current.pendingCount).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ─── Verificação de tipos (compile-time) ─────────────────────────────────────

describe('PendingRun — campos obrigatórios da interface', () => {
  it('PendingRun contém todos os campos esperados', () => {
    // Verificação de tipo em tempo de compilação: se o campo não existir,
    // o TypeScript vai falhar ao compilar este teste.
    const run: PendingRun = {
      id: 'r-1',
      scenario_id: 's-1',
      scenario_name: 'Teste',
      category: null,
      created_at: '2026-04-04T10:00:00Z',
      passed: false,
      tools_missing: null,
      tools_used: null,
      error: null,
      results: null,
      batch_id: null,
      latency_ms: null,
      total_steps: 0,
    };

    expect(run.id).toBe('r-1');
    expect(run.scenario_name).toBe('Teste');
    expect(run.passed).toBe(false);
    expect(run.total_steps).toBe(0);
  });

  it('UseE2eApprovalReturn contém todos os campos esperados', () => {
    // Verificação de tipo: se a interface mudar, este teste vai falhar
    type RequiredKeys = keyof UseE2eApprovalReturn;
    const requiredKeys: RequiredKeys[] = [
      'pending',
      'pendingCount',
      'isLoading',
      'approve',
      'reject',
      'isApproving',
      'isRejecting',
    ];
    // Se chegou aqui sem erro de compilação, todos os campos existem
    expect(requiredKeys).toHaveLength(7);
  });
});
