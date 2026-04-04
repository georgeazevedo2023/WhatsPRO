/**
 * Tests for useE2eBatchHistory hooks (F1 — persistent batch history).
 * Covers: useE2eBatchHistory, useE2eBatchRuns, useCreateBatch, useCompleteBatch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import {
  useE2eBatchHistory,
  useE2eBatchRuns,
  useCreateBatch,
  useCompleteBatch,
} from '../useE2eBatchHistory'

// ─── Supabase mock chain builders ────────────────────────────────────────────

const mockSingle = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()
const mockLimit = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

// ─── QueryClient wrapper ──────────────────────────────────────────────────────

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

// ─── useE2eBatchHistory ───────────────────────────────────────────────────────

describe('useE2eBatchHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ order: mockOrder })
    mockOrder.mockReturnValue({ limit: mockLimit })
  })

  it('query is disabled when agentId is null', () => {
    const wrapper = makeWrapper()
    const { result } = renderHook(() => useE2eBatchHistory(null), { wrapper })
    // When disabled, fetchStatus is 'idle' and data is undefined
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns empty array when DB returns no rows', async () => {
    mockLimit.mockResolvedValue({ data: [], error: null })
    const wrapper = makeWrapper()
    const { result } = renderHook(() => useE2eBatchHistory('agent-1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('returns batches sorted by created_at descending (DB order)', async () => {
    const batches = [
      { id: 'b-2', agent_id: 'agent-1', created_at: '2026-04-04T10:00:00Z', run_type: 'manual', total: 5, passed: 5, failed: 0, composite_score: 100, status: 'complete', prompt_hash: null, created_by: 'u-1' },
      { id: 'b-1', agent_id: 'agent-1', created_at: '2026-04-03T10:00:00Z', run_type: 'manual', total: 3, passed: 2, failed: 1, composite_score: 67,  status: 'complete', prompt_hash: null, created_by: 'u-1' },
    ]
    mockLimit.mockResolvedValue({ data: batches, error: null })
    const wrapper = makeWrapper()
    const { result } = renderHook(() => useE2eBatchHistory('agent-1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
    // First item must be the most recent (b-2)
    expect(result.current.data![0].id).toBe('b-2')
    expect(result.current.data![1].id).toBe('b-1')
  })

  it('queries the e2e_test_batches table with the correct agentId', async () => {
    mockLimit.mockResolvedValue({ data: [], error: null })
    const wrapper = makeWrapper()
    renderHook(() => useE2eBatchHistory('agent-abc'), { wrapper })

    await waitFor(() => expect(mockFrom).toHaveBeenCalledWith('e2e_test_batches'))
    expect(mockEq).toHaveBeenCalledWith('agent_id', 'agent-abc')
    expect(mockLimit).toHaveBeenCalledWith(30)
  })

  it('throws when supabase returns an error', async () => {
    const dbError = new Error('relation "e2e_test_batches" does not exist')
    mockLimit.mockResolvedValue({ data: null, error: dbError })
    const wrapper = makeWrapper()
    const { result } = renderHook(() => useE2eBatchHistory('agent-1'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBe(dbError)
  })
})

// ─── useE2eBatchRuns ──────────────────────────────────────────────────────────

describe('useE2eBatchRuns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ order: mockOrder })
  })

  it('query is disabled when batchUuid is null', () => {
    const wrapper = makeWrapper()
    const { result } = renderHook(() => useE2eBatchRuns(null), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('queries e2e_test_runs filtered by batch_uuid', async () => {
    const runs = [
      { id: 'r-1', scenario_id: 's-1', scenario_name: 'Fluxo venda', category: 'vendas', passed: true, tools_used: ['search_products'], tools_missing: [], latency_ms: 1200, error: null, results: null, created_at: '2026-04-04T10:01:00Z', approval: 'auto_approved' },
    ]
    mockOrder.mockResolvedValue({ data: runs, error: null })
    const wrapper = makeWrapper()
    const { result } = renderHook(() => useE2eBatchRuns('batch-xyz'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFrom).toHaveBeenCalledWith('e2e_test_runs')
    expect(mockEq).toHaveBeenCalledWith('batch_uuid', 'batch-xyz')
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].scenario_name).toBe('Fluxo venda')
  })

  it('returns empty array when batch has no runs', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null })
    const wrapper = makeWrapper()
    const { result } = renderHook(() => useE2eBatchRuns('batch-empty'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})

// ─── useCreateBatch ───────────────────────────────────────────────────────────

describe('useCreateBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({ insert: mockInsert })
    mockInsert.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ single: mockSingle })
  })

  it('inserts a new batch record with status=running and returns its UUID', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'new-batch-uuid' }, error: null })
    const wrapper = makeWrapper()
    const { result } = renderHook(() => useCreateBatch(), { wrapper })

    result.current.mutate({
      agentId: 'agent-1',
      runType: 'manual',
      createdBy: 'user-1',
      promptHash: 'abc123',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe('new-batch-uuid')

    expect(mockFrom).toHaveBeenCalledWith('e2e_test_batches')
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      agent_id: 'agent-1',
      run_type: 'manual',
      status: 'running',
      created_by: 'user-1',
      prompt_hash: 'abc123',
      total: 0,
      passed: 0,
      failed: 0,
    }))
  })

  it('supports scheduled and regression run types', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'batch-sched' }, error: null })
    const wrapper = makeWrapper()
    const { result } = renderHook(() => useCreateBatch(), { wrapper })

    result.current.mutate({
      agentId: 'agent-2',
      runType: 'scheduled',
      createdBy: 'system',
      promptHash: null,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      run_type: 'scheduled',
      prompt_hash: null,
    }))
  })

  it('throws when insert fails', async () => {
    const dbErr = new Error('insert failed')
    mockSingle.mockResolvedValue({ data: null, error: dbErr })
    const wrapper = makeWrapper()
    const { result } = renderHook(() => useCreateBatch(), { wrapper })

    result.current.mutate({
      agentId: 'agent-1',
      runType: 'manual',
      createdBy: 'user-1',
      promptHash: null,
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBe(dbErr)
  })
})

// ─── useCompleteBatch ─────────────────────────────────────────────────────────

describe('useCompleteBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({ update: mockUpdate })
    mockUpdate.mockReturnValue({ eq: mockEq })
  })

  it('updates batch to status=complete with computed composite_score', async () => {
    mockEq.mockResolvedValue({ data: null, error: null })
    const wrapper = makeWrapper()
    const { result } = renderHook(() => useCompleteBatch(), { wrapper })

    result.current.mutate({
      batchUuid: 'batch-1',
      total: 10,
      passed: 8,
      failed: 2,
      agentId: 'agent-1',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFrom).toHaveBeenCalledWith('e2e_test_batches')
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: 'complete',
      total: 10,
      passed: 8,
      failed: 2,
      composite_score: 80,   // Math.round((8/10)*100)
    }))
    expect(mockEq).toHaveBeenCalledWith('id', 'batch-1')
  })

  it('computes composite_score=100 when all scenarios pass', async () => {
    mockEq.mockResolvedValue({ data: null, error: null })
    const wrapper = makeWrapper()
    const { result } = renderHook(() => useCompleteBatch(), { wrapper })

    result.current.mutate({ batchUuid: 'b', total: 5, passed: 5, failed: 0, agentId: 'a' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ composite_score: 100 }))
  })

  it('computes composite_score=0 when total is 0 (no division by zero)', async () => {
    mockEq.mockResolvedValue({ data: null, error: null })
    const wrapper = makeWrapper()
    const { result } = renderHook(() => useCompleteBatch(), { wrapper })

    result.current.mutate({ batchUuid: 'b', total: 0, passed: 0, failed: 0, agentId: 'a' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ composite_score: 0 }))
  })

  it('computes composite_score=67 for partial pass (rounded)', async () => {
    mockEq.mockResolvedValue({ data: null, error: null })
    const wrapper = makeWrapper()
    const { result } = renderHook(() => useCompleteBatch(), { wrapper })

    result.current.mutate({ batchUuid: 'b', total: 3, passed: 2, failed: 1, agentId: 'a' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // Math.round((2/3)*100) = Math.round(66.67) = 67
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ composite_score: 67 }))
  })

  it('throws when update fails', async () => {
    const dbErr = new Error('update failed')
    mockEq.mockResolvedValue({ data: null, error: dbErr })
    const wrapper = makeWrapper()
    const { result } = renderHook(() => useCompleteBatch(), { wrapper })

    result.current.mutate({ batchUuid: 'b', total: 5, passed: 3, failed: 2, agentId: 'a' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBe(dbErr)
  })
})
