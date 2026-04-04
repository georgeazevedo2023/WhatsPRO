/**
 * Tests for BatchHistoryTab component (F1 — persistent batch history).
 * Covers: empty states, loading, batch list rendering, expand/collapse, StatusBadge colors.
 */
import type { ReactElement } from 'react'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { BatchHistoryTab } from '@/components/admin/ai-agent/playground/BatchHistoryTab'

// ─── Mock the data hooks ──────────────────────────────────────────────────────

const mockUseE2eBatchHistory = vi.fn()
const mockUseE2eBatchRuns    = vi.fn()

vi.mock('@/hooks/useE2eBatchHistory', () => ({
  useE2eBatchHistory: (...args: unknown[]) => mockUseE2eBatchHistory(...args),
  useE2eBatchRuns:    (...args: unknown[]) => mockUseE2eBatchRuns(...args),
}))

// ─── Render helper ────────────────────────────────────────────────────────────

function renderWithQuery(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    React.createElement(QueryClientProvider, { client: queryClient }, ui),
  )
}

// ─── Sample fixtures ──────────────────────────────────────────────────────────

const BATCH_COMPLETE = {
  id: 'b-complete',
  agent_id: 'agent-1',
  created_at: '2026-04-04T10:00:00.000Z',
  run_type: 'manual' as const,
  total: 10,
  passed: 8,
  failed: 2,
  composite_score: 80,
  status: 'complete' as const,
  prompt_hash: 'abc12',
  created_by: 'u-1',
}

const BATCH_RUNNING = {
  id: 'b-running',
  agent_id: 'agent-1',
  created_at: '2026-04-04T11:00:00.000Z',
  run_type: 'scheduled' as const,
  total: 5,
  passed: 3,
  failed: 2,
  composite_score: 60,
  status: 'running' as const,
  prompt_hash: null,
  created_by: 'u-2',
}

const BATCH_APPROVED = {
  id: 'b-approved',
  agent_id: 'agent-1',
  created_at: '2026-04-03T09:00:00.000Z',
  run_type: 'regression' as const,
  total: 8,
  passed: 8,
  failed: 0,
  composite_score: 100,
  status: 'approved' as const,
  prompt_hash: null,
  created_by: 'u-1',
}

const BATCH_REJECTED = {
  id: 'b-rejected',
  agent_id: 'agent-1',
  created_at: '2026-04-02T08:00:00.000Z',
  run_type: 'manual' as const,
  total: 4,
  passed: 1,
  failed: 3,
  composite_score: 25,
  status: 'rejected' as const,
  prompt_hash: null,
  created_by: 'u-1',
}

const RUN_FIXTURE = {
  id: 'r-1',
  scenario_id: 's-1',
  scenario_name: 'Fluxo completo de venda',
  category: 'vendas',
  passed: true,
  tools_used: ['search_products', 'set_tags'],
  tools_missing: [],
  latency_ms: 1800,
  error: null,
  results: null,
  created_at: '2026-04-04T10:01:00.000Z',
  approval: 'auto_approved',
}

// ─── "Selecione um agente" state ──────────────────────────────────────────────

describe('BatchHistoryTab — no agent selected', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseE2eBatchHistory.mockReturnValue({ data: undefined, isLoading: false })
    mockUseE2eBatchRuns.mockReturnValue({ data: undefined, isLoading: false })
  })

  it('shows "Selecione um agente" message when agentId is null', () => {
    renderWithQuery(<BatchHistoryTab agentId={null} />)
    expect(screen.getByText(/Selecione um agente para ver o historico/i)).toBeInTheDocument()
  })

  it('does not call useE2eBatchHistory with null agentId', () => {
    renderWithQuery(<BatchHistoryTab agentId={null} />)
    expect(mockUseE2eBatchHistory).toHaveBeenCalledWith(null)
  })
})

// ─── Loading state ────────────────────────────────────────────────────────────

describe('BatchHistoryTab — loading', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseE2eBatchHistory.mockReturnValue({ data: undefined, isLoading: true })
    mockUseE2eBatchRuns.mockReturnValue({ data: undefined, isLoading: false })
  })

  it('shows a loading spinner while data is being fetched', () => {
    renderWithQuery(<BatchHistoryTab agentId="agent-1" />)
    // The Loader2 icon renders with animate-spin; check its class or the spinner container
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('does not show the empty state message while loading', () => {
    renderWithQuery(<BatchHistoryTab agentId="agent-1" />)
    expect(screen.queryByText(/Nenhum batch registrado/i)).not.toBeInTheDocument()
  })
})

// ─── Empty state ──────────────────────────────────────────────────────────────

describe('BatchHistoryTab — empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseE2eBatchHistory.mockReturnValue({ data: [], isLoading: false })
    mockUseE2eBatchRuns.mockReturnValue({ data: undefined, isLoading: false })
  })

  it('shows empty state message when no batches exist', () => {
    renderWithQuery(<BatchHistoryTab agentId="agent-1" />)
    expect(screen.getByText(/Nenhum batch registrado ainda/i)).toBeInTheDocument()
  })

  it('shows call-to-action hint in empty state', () => {
    renderWithQuery(<BatchHistoryTab agentId="agent-1" />)
    expect(screen.getByText(/Execute E2E Real/i)).toBeInTheDocument()
  })
})

// ─── Batch list rendering ─────────────────────────────────────────────────────

describe('BatchHistoryTab — batch list', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseE2eBatchHistory.mockReturnValue({
      data: [BATCH_COMPLETE],
      isLoading: false,
    })
    mockUseE2eBatchRuns.mockReturnValue({ data: undefined, isLoading: false })
  })

  it('shows batch count summary line', () => {
    renderWithQuery(<BatchHistoryTab agentId="agent-1" />)
    expect(screen.getByText(/1 batch registrado/i)).toBeInTheDocument()
  })

  it('shows score bar ratio (passed/total) for each batch', () => {
    renderWithQuery(<BatchHistoryTab agentId="agent-1" />)
    // ScoreBar renders "8/10"
    expect(screen.getByText('8/10')).toBeInTheDocument()
  })

  it('shows prompt hash when present', () => {
    renderWithQuery(<BatchHistoryTab agentId="agent-1" />)
    expect(screen.getByText('#abc12')).toBeInTheDocument()
  })

  it('shows plural "batches" when there are multiple', () => {
    mockUseE2eBatchHistory.mockReturnValue({
      data: [BATCH_COMPLETE, BATCH_RUNNING],
      isLoading: false,
    })
    renderWithQuery(<BatchHistoryTab agentId="agent-1" />)
    expect(screen.getByText(/2 batches registrados/i)).toBeInTheDocument()
  })

  it('shows RunTypeBadge label for manual run type', () => {
    renderWithQuery(<BatchHistoryTab agentId="agent-1" />)
    expect(screen.getByText('Manual')).toBeInTheDocument()
  })

  it('shows RunTypeBadge label for scheduled run type', () => {
    mockUseE2eBatchHistory.mockReturnValue({
      data: [BATCH_RUNNING],
      isLoading: false,
    })
    renderWithQuery(<BatchHistoryTab agentId="agent-1" />)
    expect(screen.getByText('Agendado')).toBeInTheDocument()
  })

  it('shows RunTypeBadge label for regression run type', () => {
    mockUseE2eBatchHistory.mockReturnValue({
      data: [BATCH_APPROVED],
      isLoading: false,
    })
    renderWithQuery(<BatchHistoryTab agentId="agent-1" />)
    expect(screen.getByText('Regressao')).toBeInTheDocument()
  })
})

// ─── StatusBadge ──────────────────────────────────────────────────────────────

describe('StatusBadge — label rendering per status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseE2eBatchRuns.mockReturnValue({ data: undefined, isLoading: false })
  })

  it('renders "Completo" label for status=complete', () => {
    mockUseE2eBatchHistory.mockReturnValue({ data: [BATCH_COMPLETE], isLoading: false })
    renderWithQuery(<BatchHistoryTab agentId="agent-1" />)
    expect(screen.getByText('Completo')).toBeInTheDocument()
  })

  it('renders "Rodando" label for status=running', () => {
    mockUseE2eBatchHistory.mockReturnValue({ data: [BATCH_RUNNING], isLoading: false })
    renderWithQuery(<BatchHistoryTab agentId="agent-1" />)
    expect(screen.getByText('Rodando')).toBeInTheDocument()
  })

  it('renders "Aprovado" label for status=approved', () => {
    mockUseE2eBatchHistory.mockReturnValue({ data: [BATCH_APPROVED], isLoading: false })
    renderWithQuery(<BatchHistoryTab agentId="agent-1" />)
    expect(screen.getByText('Aprovado')).toBeInTheDocument()
  })

  it('renders "Rejeitado" label for status=rejected', () => {
    mockUseE2eBatchHistory.mockReturnValue({ data: [BATCH_REJECTED], isLoading: false })
    renderWithQuery(<BatchHistoryTab agentId="agent-1" />)
    expect(screen.getByText('Rejeitado')).toBeInTheDocument()
  })

  it('applies destructive variant class for status=rejected', () => {
    mockUseE2eBatchHistory.mockReturnValue({ data: [BATCH_REJECTED], isLoading: false })
    renderWithQuery(<BatchHistoryTab agentId="agent-1" />)
    const badge = screen.getByText('Rejeitado')
    // Badge with variant='destructive' gets bg-destructive class from shadcn
    expect(badge.className).toMatch(/destructive|bg-red/i)
  })

  it('applies green class for status=approved', () => {
    mockUseE2eBatchHistory.mockReturnValue({ data: [BATCH_APPROVED], isLoading: false })
    renderWithQuery(<BatchHistoryTab agentId="agent-1" />)
    const badge = screen.getByText('Aprovado')
    expect(badge.className).toMatch(/bg-green/i)
  })

  it('applies blue class for status=running', () => {
    mockUseE2eBatchHistory.mockReturnValue({ data: [BATCH_RUNNING], isLoading: false })
    renderWithQuery(<BatchHistoryTab agentId="agent-1" />)
    const badge = screen.getByText('Rodando')
    expect(badge.className).toMatch(/bg-blue/i)
  })
})

// ─── Expand/collapse batch detail ─────────────────────────────────────────────

describe('BatchHistoryTab — expand/collapse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseE2eBatchHistory.mockReturnValue({
      data: [BATCH_COMPLETE],
      isLoading: false,
    })
  })

  it('does not show run list before expanding a batch', () => {
    mockUseE2eBatchRuns.mockReturnValue({ data: undefined, isLoading: false })
    renderWithQuery(<BatchHistoryTab agentId="agent-1" />)
    expect(screen.queryByText('Fluxo completo de venda')).not.toBeInTheDocument()
  })

  it('calls useE2eBatchRuns with batchId after expanding', async () => {
    mockUseE2eBatchRuns.mockReturnValue({ data: [RUN_FIXTURE], isLoading: false })
    renderWithQuery(<BatchHistoryTab agentId="agent-1" />)

    // Click the batch row button to expand
    const button = screen.getByRole('button')
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockUseE2eBatchRuns).toHaveBeenCalledWith('b-complete')
    })
  })

  it('shows scenario name after expanding a batch with runs', async () => {
    mockUseE2eBatchRuns.mockReturnValue({ data: [RUN_FIXTURE], isLoading: false })
    renderWithQuery(<BatchHistoryTab agentId="agent-1" />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText('Fluxo completo de venda')).toBeInTheDocument()
    })
  })

  it('shows tools used for a run when expanded', async () => {
    mockUseE2eBatchRuns.mockReturnValue({ data: [RUN_FIXTURE], isLoading: false })
    renderWithQuery(<BatchHistoryTab agentId="agent-1" />)

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText(/search_products/i)).toBeInTheDocument()
    })
  })

  it('shows "Nenhum run" empty state inside expanded batch with no runs', async () => {
    mockUseE2eBatchRuns.mockReturnValue({ data: [], isLoading: false })
    renderWithQuery(<BatchHistoryTab agentId="agent-1" />)

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText(/Nenhum run neste batch/i)).toBeInTheDocument()
    })
  })

  it('collapses batch detail on second click', async () => {
    mockUseE2eBatchRuns.mockReturnValue({ data: [RUN_FIXTURE], isLoading: false })
    renderWithQuery(<BatchHistoryTab agentId="agent-1" />)

    const button = screen.getByRole('button')
    fireEvent.click(button)
    await waitFor(() => expect(screen.getByText('Fluxo completo de venda')).toBeInTheDocument())

    fireEvent.click(button)
    await waitFor(() => {
      expect(screen.queryByText('Fluxo completo de venda')).not.toBeInTheDocument()
    })
  })

  it('shows latency in seconds for a run', async () => {
    mockUseE2eBatchRuns.mockReturnValue({ data: [RUN_FIXTURE], isLoading: false })
    renderWithQuery(<BatchHistoryTab agentId="agent-1" />)

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      // 1800 ms → 1.8s
      expect(screen.getByText('1.8s')).toBeInTheDocument()
    })
  })

  it('shows detail spinner while runs are loading', async () => {
    mockUseE2eBatchRuns.mockReturnValue({ data: undefined, isLoading: true })
    renderWithQuery(<BatchHistoryTab agentId="agent-1" />)

    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      const spinners = document.querySelectorAll('.animate-spin')
      expect(spinners.length).toBeGreaterThan(0)
    })
  })
})
