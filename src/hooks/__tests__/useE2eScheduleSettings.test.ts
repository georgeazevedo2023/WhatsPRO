/**
 * Tests for useE2eScheduleSettings (F4 — scheduled cycle config).
 * Covers: query state, key mapping, defaults, boolean coercion, save mutations.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useE2eScheduleSettings } from '../useE2eScheduleSettings'

// ─── Supabase mock chain builders ────────────────────────────────────────────

const mockMaybeSingle = vi.fn()
const mockUpdate = vi.fn()
const mockIn = vi.fn()
const mockEq = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

// ─── QueryClient wrapper ──────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}

// ─── useE2eScheduleSettings — query ──────────────────────────────────────────

describe('useE2eScheduleSettings — query', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default chain: from → select → in (terminal for query)
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ in: mockIn })
  })

  it('inicia em estado de carregamento antes de resolver', () => {
    // Never resolves — keeps the hook in pending state
    mockIn.mockReturnValue(new Promise(() => {}))
    const wrapper = makeWrapper()
    const { result } = renderHook(() => useE2eScheduleSettings(), { wrapper })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.settings).toBeUndefined()
  })

  it('mapeia chaves do system_settings para campos tipados', async () => {
    mockIn.mockResolvedValue({
      data: [
        { key: 'e2e_schedule_interval_hours', value: '12' },
        { key: 'e2e_healthy_pass_rate', value: '90' },
        { key: 'e2e_regression_threshold', value: '15' },
        { key: 'e2e_alert_whatsapp_enabled', value: 'false' },
      ],
      error: null,
    })
    const wrapper = makeWrapper()
    const { result } = renderHook(() => useE2eScheduleSettings(), { wrapper })

    await waitFor(() => expect(result.current.settings).toBeDefined())
    expect(result.current.settings).toEqual({
      intervalHours: 12,
      healthyPassRate: 90,
      regressionThreshold: 15,
      whatsappEnabled: false,
    })
  })

  it('usa defaults quando chaves não existem no DB', async () => {
    mockIn.mockResolvedValue({ data: [], error: null })
    const wrapper = makeWrapper()
    const { result } = renderHook(() => useE2eScheduleSettings(), { wrapper })

    await waitFor(() => expect(result.current.settings).toBeDefined())
    expect(result.current.settings).toEqual({
      intervalHours: 6,
      healthyPassRate: 80,
      regressionThreshold: 10,
      whatsappEnabled: true,
    })
  })

  it('whatsappEnabled=false quando value="false"', async () => {
    mockIn.mockResolvedValue({
      data: [{ key: 'e2e_alert_whatsapp_enabled', value: 'false' }],
      error: null,
    })
    const wrapper = makeWrapper()
    const { result } = renderHook(() => useE2eScheduleSettings(), { wrapper })

    await waitFor(() => expect(result.current.settings).toBeDefined())
    expect(result.current.settings!.whatsappEnabled).toBe(false)
  })

  it('whatsappEnabled=true quando value="true"', async () => {
    mockIn.mockResolvedValue({
      data: [{ key: 'e2e_alert_whatsapp_enabled', value: 'true' }],
      error: null,
    })
    const wrapper = makeWrapper()
    const { result } = renderHook(() => useE2eScheduleSettings(), { wrapper })

    await waitFor(() => expect(result.current.settings).toBeDefined())
    expect(result.current.settings!.whatsappEnabled).toBe(true)
  })

  it('lança erro quando supabase retorna error', async () => {
    const dbError = new Error('relation "system_settings" does not exist')
    mockIn.mockResolvedValue({ data: null, error: dbError })
    const wrapper = makeWrapper()
    const { result } = renderHook(() => useE2eScheduleSettings(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    // settings fica undefined quando query falha
    expect(result.current.settings).toBeUndefined()
  })

  it('consulta a tabela system_settings com as chaves corretas', async () => {
    mockIn.mockResolvedValue({ data: [], error: null })
    const wrapper = makeWrapper()
    renderHook(() => useE2eScheduleSettings(), { wrapper })

    await waitFor(() => expect(mockFrom).toHaveBeenCalledWith('system_settings'))
    expect(mockSelect).toHaveBeenCalledWith('key, value')
    expect(mockIn).toHaveBeenCalledWith(
      'key',
      expect.arrayContaining([
        'e2e_schedule_interval_hours',
        'e2e_healthy_pass_rate',
        'e2e_regression_threshold',
        'e2e_alert_whatsapp_enabled',
      ]),
    )
  })
})

// ─── useE2eScheduleSettings — save (mutation) ────────────────────────────────

describe('useE2eScheduleSettings — save', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Query chain (select path)
    mockFrom.mockImplementation((table: string) => {
      if (table === 'system_settings') {
        return { select: mockSelect, update: mockUpdate }
      }
      return { select: mockSelect }
    })
    mockSelect.mockReturnValue({ in: mockIn })
    mockIn.mockResolvedValue({ data: [], error: null })
    // Update chain
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValue({ data: null, error: null })
  })

  it('save chama update para cada chave alterada com o valor correto', async () => {
    // Re-setup: from always returns both select and update
    mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate })
    mockSelect.mockReturnValue({ in: mockIn })
    mockIn.mockResolvedValue({ data: [], error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValue({ data: null, error: null })

    const wrapper = makeWrapper()
    const { result } = renderHook(() => useE2eScheduleSettings(), { wrapper })

    await waitFor(() => expect(result.current.settings).toBeDefined())

    await act(async () => {
      await result.current.save({ intervalHours: 12 })
    })

    expect(mockUpdate).toHaveBeenCalledWith({ value: '12' })
    expect(mockEq).toHaveBeenCalledWith('key', 'e2e_schedule_interval_hours')
  })

  it('save não chama update se nenhum campo fornecido', async () => {
    mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate })
    mockSelect.mockReturnValue({ in: mockIn })
    mockIn.mockResolvedValue({ data: [], error: null })

    const wrapper = makeWrapper()
    const { result } = renderHook(() => useE2eScheduleSettings(), { wrapper })

    await waitFor(() => expect(result.current.settings).toBeDefined())

    // Reset call count after query setup
    mockUpdate.mockClear()

    await act(async () => {
      await result.current.save({})
    })

    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('save serializa whatsappEnabled como string "false"', async () => {
    mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate })
    mockSelect.mockReturnValue({ in: mockIn })
    mockIn.mockResolvedValue({ data: [], error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValue({ data: null, error: null })

    const wrapper = makeWrapper()
    const { result } = renderHook(() => useE2eScheduleSettings(), { wrapper })

    await waitFor(() => expect(result.current.settings).toBeDefined())

    await act(async () => {
      await result.current.save({ whatsappEnabled: false })
    })

    expect(mockUpdate).toHaveBeenCalledWith({ value: 'false' })
    expect(mockEq).toHaveBeenCalledWith('key', 'e2e_alert_whatsapp_enabled')
  })

  it('save persiste múltiplos campos em sequência', async () => {
    const updateCallArgs: Array<{ value: string }> = []
    const eqCallArgs: Array<[string, string]> = []

    mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate })
    mockSelect.mockReturnValue({ in: mockIn })
    mockIn.mockResolvedValue({ data: [], error: null })
    mockUpdate.mockImplementation((v: { value: string }) => {
      updateCallArgs.push(v)
      return { eq: mockEq }
    })
    mockEq.mockImplementation((col: string, val: string) => {
      eqCallArgs.push([col, val])
      return Promise.resolve({ data: null, error: null })
    })

    const wrapper = makeWrapper()
    const { result } = renderHook(() => useE2eScheduleSettings(), { wrapper })

    await waitFor(() => expect(result.current.settings).toBeDefined())

    await act(async () => {
      await result.current.save({ intervalHours: 24, healthyPassRate: 90 })
    })

    expect(updateCallArgs).toContainEqual({ value: '24' })
    expect(updateCallArgs).toContainEqual({ value: '90' })
    expect(eqCallArgs).toContainEqual(['key', 'e2e_schedule_interval_hours'])
    expect(eqCallArgs).toContainEqual(['key', 'e2e_healthy_pass_rate'])
  })

  it('save lança erro quando update falha', async () => {
    const dbErr = new Error('update failed')
    mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate })
    mockSelect.mockReturnValue({ in: mockIn })
    mockIn.mockResolvedValue({ data: [], error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValue({ data: null, error: dbErr })

    const wrapper = makeWrapper()
    const { result } = renderHook(() => useE2eScheduleSettings(), { wrapper })

    await waitFor(() => expect(result.current.settings).toBeDefined())

    await expect(
      act(async () => {
        await result.current.save({ intervalHours: 6 })
      }),
    ).rejects.toThrow('update failed')
  })
})
