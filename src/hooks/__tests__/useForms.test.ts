/**
 * Testes para src/hooks/useForms.ts (M12 — Formulários WhatsApp).
 * Cobre: useFormsForAgent, useCreateForm, useUpdateForm, useDeleteForm, useUpsertFormFields.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  useFormsForAgent,
  useCreateForm,
  useUpdateForm,
  useDeleteForm,
  useUpsertFormFields,
} from '../useForms'

// ─── Sonner mock ──────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// ─── Supabase mock ────────────────────────────────────────────────────────────

const mockSingle = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()
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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeForm(overrides = {}) {
  return {
    id: 'form-1',
    agent_id: 'agent-1',
    name: 'Formulário Teste',
    slug: 'formulario-teste-abc123',
    description: null,
    template_type: null,
    status: 'active' as const,
    welcome_message: 'Olá!',
    completion_message: 'Obrigado!',
    webhook_url: null,
    max_submissions: null,
    expires_at: null,
    created_by: null,
    created_at: '2026-04-04T10:00:00Z',
    updated_at: '2026-04-04T10:00:00Z',
    form_fields: [],
    ...overrides,
  }
}

// ─── useFormsForAgent ─────────────────────────────────────────────────────────

describe('useFormsForAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ order: mockOrder })
  })

  it('query desabilitada quando agentId é null', () => {
    const wrapper = makeWrapper()
    const { result } = renderHook(() => useFormsForAgent(null), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('retorna [] quando DB retorna null', async () => {
    mockOrder.mockResolvedValue({ data: null, error: null })
    const wrapper = makeWrapper()
    const { result } = renderHook(() => useFormsForAgent('agent-1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('retorna lista de forms quando DB retorna dados', async () => {
    const forms = [makeForm(), makeForm({ id: 'form-2', name: 'Formulário 2' })]
    mockOrder.mockResolvedValue({ data: forms, error: null })
    const wrapper = makeWrapper()
    const { result } = renderHook(() => useFormsForAgent('agent-1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data![0].id).toBe('form-1')
    expect(result.current.data![1].id).toBe('form-2')
  })

  it('consulta whatsapp_forms com agent_id correto ordenado por created_at DESC', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null })
    const wrapper = makeWrapper()
    renderHook(() => useFormsForAgent('agent-abc'), { wrapper })

    await waitFor(() => expect(mockFrom).toHaveBeenCalledWith('whatsapp_forms'))
    expect(mockEq).toHaveBeenCalledWith('agent_id', 'agent-abc')
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('propaga erro quando DB retorna error', async () => {
    const dbError = new Error('DB error')
    mockOrder.mockResolvedValue({ data: null, error: dbError })
    const wrapper = makeWrapper()
    const { result } = renderHook(() => useFormsForAgent('agent-1'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBe(dbError)
  })
})

// ─── useCreateForm ────────────────────────────────────────────────────────────

describe('useCreateForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('chama supabase.from("whatsapp_forms").insert() com slug gerado', async () => {
    const createdForm = makeForm()
    mockFrom.mockReturnValue({ insert: mockInsert })
    mockInsert.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({ data: createdForm, error: null })

    const wrapper = makeWrapper()
    const { result } = renderHook(() => useCreateForm(), { wrapper })

    await act(async () => {
      result.current.mutate({ agentId: 'agent-1', name: 'Meu Formulário' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFrom).toHaveBeenCalledWith('whatsapp_forms')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        agent_id: 'agent-1',
        name: 'Meu Formulário',
        slug: expect.stringMatching(/^meu-formulario-/),
      }),
    )
  })

  it('chama form_fields.insert() quando fields fornecido', async () => {
    const createdForm = makeForm()
    const mockFieldsInsert = vi.fn().mockResolvedValue({ data: null, error: null })
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: createdForm, error: null }),
            }),
          }),
        }
      }
      return { insert: mockFieldsInsert }
    })

    const wrapper = makeWrapper()
    const { result } = renderHook(() => useCreateForm(), { wrapper })

    await act(async () => {
      result.current.mutate({
        agentId: 'agent-1',
        name: 'Formulário',
        fields: [
          {
            position: 0,
            field_type: 'short_text',
            label: 'Nome',
            required: true,
            validation_rules: null,
            error_message: null,
            skip_if_known: false,
            field_key: 'nome',
          },
        ],
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFieldsInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          form_id: 'form-1',
          field_type: 'short_text',
          label: 'Nome',
        }),
      ]),
    )
  })

  it('chama toast.success em onSuccess', async () => {
    const createdForm = makeForm()
    mockFrom.mockReturnValue({ insert: mockInsert })
    mockInsert.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({ data: createdForm, error: null })

    const wrapper = makeWrapper()
    const { result } = renderHook(() => useCreateForm(), { wrapper })

    await act(async () => {
      result.current.mutate({ agentId: 'agent-1', name: 'Teste' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Formulário criado com sucesso!')
  })

  it('não chama form_fields.insert() quando fields não fornecido', async () => {
    const createdForm = makeForm()
    const insertSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: createdForm, error: null }),
      }),
    })
    mockFrom.mockReturnValue({ insert: insertSpy })

    const wrapper = makeWrapper()
    const { result } = renderHook(() => useCreateForm(), { wrapper })

    await act(async () => {
      result.current.mutate({ agentId: 'agent-1', name: 'Sem campos' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // Só uma chamada ao from (whatsapp_forms), sem segunda para form_fields
    expect(mockFrom).toHaveBeenCalledTimes(1)
  })
})

// ─── useUpdateForm ────────────────────────────────────────────────────────────

describe('useUpdateForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({ update: mockUpdate })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValue({ data: null, error: null })
  })

  it('chama update com updated_at incluído', async () => {
    const wrapper = makeWrapper()
    const { result } = renderHook(() => useUpdateForm(), { wrapper })

    await act(async () => {
      result.current.mutate({
        id: 'form-1',
        agentId: 'agent-1',
        updates: { name: 'Novo nome', status: 'draft' },
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFrom).toHaveBeenCalledWith('whatsapp_forms')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Novo nome',
        status: 'draft',
        updated_at: expect.any(String),
      }),
    )
    expect(mockEq).toHaveBeenCalledWith('id', 'form-1')
  })

  it('invalida queryKeys ["whatsapp-forms", agentId] e ["whatsapp-form-fields", id]', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)

    const { result } = renderHook(() => useUpdateForm(), { wrapper })

    await act(async () => {
      result.current.mutate({
        id: 'form-1',
        agentId: 'agent-1',
        updates: { status: 'active' },
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['whatsapp-forms', 'agent-1'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['whatsapp-form-fields', 'form-1'] })
  })

  it('chama toast.success em onSuccess', async () => {
    const wrapper = makeWrapper()
    const { result } = renderHook(() => useUpdateForm(), { wrapper })

    await act(async () => {
      result.current.mutate({ id: 'form-1', agentId: 'agent-1', updates: { status: 'active' } })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Formulário atualizado!')
  })
})

// ─── useDeleteForm ────────────────────────────────────────────────────────────

describe('useDeleteForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({ delete: mockDelete })
    mockDelete.mockReturnValue({ eq: mockEq })
    mockEq.mockResolvedValue({ data: null, error: null })
  })

  it('chama supabase.from("whatsapp_forms").delete().eq("id", id)', async () => {
    const wrapper = makeWrapper()
    const { result } = renderHook(() => useDeleteForm(), { wrapper })

    await act(async () => {
      result.current.mutate({ id: 'form-1', agentId: 'agent-1' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFrom).toHaveBeenCalledWith('whatsapp_forms')
    expect(mockDelete).toHaveBeenCalled()
    expect(mockEq).toHaveBeenCalledWith('id', 'form-1')
  })

  it('chama toast.success com "Formulário excluído."', async () => {
    const wrapper = makeWrapper()
    const { result } = renderHook(() => useDeleteForm(), { wrapper })

    await act(async () => {
      result.current.mutate({ id: 'form-2', agentId: 'agent-1' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Formulário excluído.')
  })

  it('propaga erro e chama toast.error quando delete falha', async () => {
    const dbErr = new Error('FK constraint')
    mockEq.mockResolvedValue({ data: null, error: dbErr })

    const wrapper = makeWrapper()
    const { result } = renderHook(() => useDeleteForm(), { wrapper })

    await act(async () => {
      result.current.mutate({ id: 'form-1', agentId: 'agent-1' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBe(dbErr)
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(expect.stringContaining('FK constraint'))
  })
})

// ─── useUpsertFormFields ──────────────────────────────────────────────────────

describe('useUpsertFormFields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('executa DELETE then INSERT para substituir campos', async () => {
    const mockFieldsInsert = vi.fn().mockResolvedValue({ data: null, error: null })
    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }
      }
      return { insert: mockFieldsInsert }
    })

    const wrapper = makeWrapper()
    const { result } = renderHook(() => useUpsertFormFields(), { wrapper })

    await act(async () => {
      result.current.mutate({
        formId: 'form-1',
        fields: [
          {
            position: 0,
            field_type: 'short_text',
            label: 'Pergunta',
            required: true,
            validation_rules: null,
            error_message: null,
            skip_if_known: false,
            field_key: 'pergunta',
          },
        ],
      })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFieldsInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          form_id: 'form-1',
          label: 'Pergunta',
          field_type: 'short_text',
        }),
      ]),
    )
  })

  it('não chama insert quando fields=[]', async () => {
    const mockFieldsInsert = vi.fn()
    mockFrom.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      insert: mockFieldsInsert,
    })

    const wrapper = makeWrapper()
    const { result } = renderHook(() => useUpsertFormFields(), { wrapper })

    await act(async () => {
      result.current.mutate({ formId: 'form-1', fields: [] })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockFieldsInsert).not.toHaveBeenCalled()
  })

  it('invalida queryKey ["whatsapp-form-fields", formId] em onSuccess', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children)

    mockFrom.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    })

    const { result } = renderHook(() => useUpsertFormFields(), { wrapper })

    await act(async () => {
      result.current.mutate({ formId: 'form-42', fields: [] })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['whatsapp-form-fields', 'form-42'] })
  })
})
