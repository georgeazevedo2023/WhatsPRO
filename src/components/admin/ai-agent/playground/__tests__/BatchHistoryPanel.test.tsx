/**
 * Tests for BatchHistoryPanel component (F4 — regression-aware batch history list).
 * Covers: loading, empty state, score colors, regression border, re-test button.
 */
import type { ReactElement } from 'react'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'

import { BatchHistoryPanel } from '../BatchHistoryPanel'

// ─── Mock data hook ───────────────────────────────────────────────────────────

const mockUseE2eBatchHistory = vi.fn()

vi.mock('@/hooks/useE2eBatchHistory', () => ({
  useE2eBatchHistory: (...args: unknown[]) => mockUseE2eBatchHistory(...args),
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
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(TooltipProvider, null, ui),
    ),
  )
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeBatch(overrides: Partial<{
  id: string
  batch_id_text: string | null
  run_type: string
  created_at: string
  total: number
  passed: number
  failed: number
  composite_score: number | null
  is_regression: boolean
  regression_context: unknown
  status: string
}> = {}) {
  return {
    id: 'batch-1',
    batch_id_text: 'B-001',
    run_type: 'manual',
    created_at: new Date().toISOString(),
    total: 10,
    passed: 8,
    failed: 2,
    composite_score: 80,
    is_regression: false,
    regression_context: null,
    status: 'complete',
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BatchHistoryPanel — loading', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mostra estado de carregamento', () => {
    mockUseE2eBatchHistory.mockReturnValue({ data: undefined, isLoading: true })
    renderWithQuery(<BatchHistoryPanel agentId="agent-1" />)
    expect(screen.getByText(/Carregando histórico/i)).toBeInTheDocument()
  })
})

describe('BatchHistoryPanel — estado vazio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mostra estado vazio quando sem batches', () => {
    mockUseE2eBatchHistory.mockReturnValue({ data: [], isLoading: false })
    renderWithQuery(<BatchHistoryPanel agentId="agent-1" />)
    expect(screen.getByText(/Nenhum batch registrado ainda/i)).toBeInTheDocument()
  })

  it('mostra estado vazio quando data=undefined', () => {
    mockUseE2eBatchHistory.mockReturnValue({ data: undefined, isLoading: false })
    renderWithQuery(<BatchHistoryPanel agentId="agent-1" />)
    expect(screen.getByText(/Nenhum batch registrado ainda/i)).toBeInTheDocument()
  })
})

describe('BatchHistoryPanel — lista de batches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza lista de batches com score colorido', () => {
    mockUseE2eBatchHistory.mockReturnValue({
      data: [makeBatch({ passed: 8, total: 10, composite_score: 80 })],
      isLoading: false,
    })
    renderWithQuery(<BatchHistoryPanel agentId="agent-1" />)
    // passRate = 80% → emerald text
    expect(screen.getByText('80%')).toBeInTheDocument()
  })

  it('score >= 80% recebe classe de texto emerald', () => {
    mockUseE2eBatchHistory.mockReturnValue({
      data: [makeBatch({ passed: 9, total: 10, composite_score: 90 })],
      isLoading: false,
    })
    renderWithQuery(<BatchHistoryPanel agentId="agent-1" />)
    const scoreEl = screen.getByText('90%')
    expect(scoreEl.className).toMatch(/emerald/i)
  })

  it('score 60-79% recebe classe de texto amber', () => {
    mockUseE2eBatchHistory.mockReturnValue({
      data: [makeBatch({ passed: 6, total: 10, composite_score: 60 })],
      isLoading: false,
    })
    renderWithQuery(<BatchHistoryPanel agentId="agent-1" />)
    const scoreEl = screen.getByText('60%')
    expect(scoreEl.className).toMatch(/amber/i)
  })

  it('score < 60% recebe classe de texto red', () => {
    mockUseE2eBatchHistory.mockReturnValue({
      data: [makeBatch({ passed: 3, total: 10, composite_score: 30 })],
      isLoading: false,
    })
    renderWithQuery(<BatchHistoryPanel agentId="agent-1" />)
    const scoreEl = screen.getByText('30%')
    expect(scoreEl.className).toMatch(/red/i)
  })

  it('batch com is_regression=true tem classe border-red-500/30', () => {
    const batch = makeBatch({
      is_regression: true,
      regression_context: {
        delta: -15,
        current_score: 65,
        previous_score: 80,
        consecutive_below_threshold: 1,
        failed_scenarios: [],
      },
    })
    mockUseE2eBatchHistory.mockReturnValue({
      data: [batch],
      isLoading: false,
    })
    renderWithQuery(<BatchHistoryPanel agentId="agent-1" />)

    // The wrapper div for regression batches gets border-red-500/30
    const scoreEl = screen.getByText('80%')
    const batchRow = scoreEl.closest('div[class*="border"]')
    expect(batchRow?.className).toMatch(/border-red-500/i)
  })

  it('mostra passed/total no formato "X/Y pass"', () => {
    mockUseE2eBatchHistory.mockReturnValue({
      data: [makeBatch({ passed: 7, total: 10 })],
      isLoading: false,
    })
    renderWithQuery(<BatchHistoryPanel agentId="agent-1" />)
    expect(screen.getByText('7/10 pass')).toBeInTheDocument()
  })

  it('mostra "—" quando composite_score=null e total=0', () => {
    mockUseE2eBatchHistory.mockReturnValue({
      data: [makeBatch({ passed: 0, total: 0, composite_score: null })],
      isLoading: false,
    })
    renderWithQuery(<BatchHistoryPanel agentId="agent-1" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})

describe('BatchHistoryPanel — botão Re-testar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('botão Re-testar não aparece quando batch não tem falhas', () => {
    mockUseE2eBatchHistory.mockReturnValue({
      data: [makeBatch({ failed: 0, passed: 10, total: 10 })],
      isLoading: false,
    })
    renderWithQuery(<BatchHistoryPanel agentId="agent-1" onRetestBatch={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Re-testar/i })).not.toBeInTheDocument()
  })

  it('botão Re-testar não aparece quando onRetestBatch não fornecido', () => {
    mockUseE2eBatchHistory.mockReturnValue({
      data: [makeBatch({ failed: 2 })],
      isLoading: false,
    })
    renderWithQuery(<BatchHistoryPanel agentId="agent-1" />)
    expect(screen.queryByRole('button', { name: /Re-testar/i })).not.toBeInTheDocument()
  })

  it('botão Re-testar aparece quando batch tem falhas e onRetestBatch fornecido', () => {
    mockUseE2eBatchHistory.mockReturnValue({
      data: [makeBatch({ failed: 2 })],
      isLoading: false,
    })
    renderWithQuery(<BatchHistoryPanel agentId="agent-1" onRetestBatch={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Re-testar/i })).toBeInTheDocument()
  })

  it('botão Re-testar chama onRetestBatch com id e batch_id_text corretos', () => {
    const onRetestBatch = vi.fn()
    const batch = makeBatch({
      id: 'uuid-batch-99',
      batch_id_text: 'B-099',
      failed: 3,
    })
    mockUseE2eBatchHistory.mockReturnValue({
      data: [batch],
      isLoading: false,
    })
    renderWithQuery(<BatchHistoryPanel agentId="agent-1" onRetestBatch={onRetestBatch} />)

    fireEvent.click(screen.getByRole('button', { name: /Re-testar/i }))

    expect(onRetestBatch).toHaveBeenCalledWith('uuid-batch-99', 'B-099')
  })

  it('botão Re-testar usa batch.id como fallback quando batch_id_text=null', () => {
    const onRetestBatch = vi.fn()
    const batch = makeBatch({
      id: 'uuid-fallback',
      batch_id_text: null,
      failed: 1,
    })
    mockUseE2eBatchHistory.mockReturnValue({
      data: [batch],
      isLoading: false,
    })
    renderWithQuery(<BatchHistoryPanel agentId="agent-1" onRetestBatch={onRetestBatch} />)

    fireEvent.click(screen.getByRole('button', { name: /Re-testar/i }))

    // batch_id_text is null → fallback to batch.id
    expect(onRetestBatch).toHaveBeenCalledWith('uuid-fallback', 'uuid-fallback')
  })
})
