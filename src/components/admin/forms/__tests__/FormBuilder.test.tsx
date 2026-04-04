/**
 * Testes para FormBuilder component (M12 — Formulários WhatsApp).
 * Cobre: abas, campos, save, configurações, preview.
 */
import type { ReactElement } from 'react'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'

import { FormBuilder } from '../FormBuilder'
import type { WhatsappForm } from '@/types/forms'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const mockUseUpdateForm = vi.fn()
const mockUseUpsertFormFields = vi.fn()

vi.mock('@/hooks/useForms', () => ({
  useUpdateForm: () => mockUseUpdateForm(),
  useUpsertFormFields: () => mockUseUpsertFormFields(),
}))

// ─── Render helper ────────────────────────────────────────────────────────────

function renderWithQuery(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(TooltipProvider, null, ui),
    ),
  )
}

// ─── Fixture ──────────────────────────────────────────────────────────────────

function makeForm(overrides: Partial<WhatsappForm> = {}): WhatsappForm {
  return {
    id: 'form-1',
    agent_id: 'agent-1',
    name: 'Formulário Teste',
    slug: 'formulario-teste',
    description: null,
    template_type: null,
    status: 'active',
    welcome_message: 'Olá!',
    completion_message: 'Obrigado!',
    webhook_url: null,
    max_submissions: null,
    expires_at: null,
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    form_fields: [],
    ...overrides,
  }
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockUseUpdateForm.mockReturnValue({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false })
  mockUseUpsertFormFields.mockReturnValue({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false })
})

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('FormBuilder', () => {
  it('renderiza sem crash com form vazio (sem campos)', () => {
    const onClose = vi.fn()
    renderWithQuery(React.createElement(FormBuilder, { form: makeForm(), onClose }))
    expect(screen.getByText('Formulário Teste')).toBeInTheDocument()
  })

  it('mostra o nome do formulário no header', () => {
    const onClose = vi.fn()
    renderWithQuery(
      React.createElement(FormBuilder, { form: makeForm({ name: 'Meu Form Especial' }), onClose }),
    )
    expect(screen.getByText('Meu Form Especial')).toBeInTheDocument()
  })

  it('aba "Campos" está ativa por padrão', () => {
    const onClose = vi.fn()
    renderWithQuery(React.createElement(FormBuilder, { form: makeForm(), onClose }))
    const camposTab = screen.getByText('Campos')
    expect(camposTab).toBeInTheDocument()
    // A aba ativa tem text-foreground (não text-muted-foreground)
    expect(camposTab.className).toContain('text-foreground')
  })

  it('exibe aba "Configurações"', () => {
    const onClose = vi.fn()
    renderWithQuery(React.createElement(FormBuilder, { form: makeForm(), onClose }))
    expect(screen.getByText('Configurações')).toBeInTheDocument()
  })

  it('exibe aba "Preview"', () => {
    const onClose = vi.fn()
    renderWithQuery(React.createElement(FormBuilder, { form: makeForm(), onClose }))
    expect(screen.getByText('Preview')).toBeInTheDocument()
  })

  it('botão "+ Adicionar Campo" adiciona um campo na lista', () => {
    const onClose = vi.fn()
    renderWithQuery(React.createElement(FormBuilder, { form: makeForm(), onClose }))

    // Antes: nenhum campo
    expect(screen.getByText('Nenhum campo ainda')).toBeInTheDocument()

    // Clica para adicionar
    fireEvent.click(screen.getByText('Adicionar Campo'))

    // Depois: um campo "Nova pergunta" aparece
    expect(screen.getByText('Nova pergunta')).toBeInTheDocument()
    expect(screen.queryByText('Nenhum campo ainda')).not.toBeInTheDocument()
  })

  it('com form_fields preenchidos, renderiza a lista de campos', () => {
    const onClose = vi.fn()
    const formWithFields = makeForm({
      form_fields: [
        {
          id: 'f-1',
          form_id: 'form-1',
          position: 0,
          field_type: 'short_text',
          label: 'Qual é o seu nome?',
          required: true,
          validation_rules: null,
          error_message: null,
          skip_if_known: false,
          field_key: 'nome',
          created_at: new Date().toISOString(),
        },
        {
          id: 'f-2',
          form_id: 'form-1',
          position: 1,
          field_type: 'email',
          label: 'Qual é o seu e-mail?',
          required: true,
          validation_rules: null,
          error_message: null,
          skip_if_known: false,
          field_key: 'email',
          created_at: new Date().toISOString(),
        },
      ],
    })
    renderWithQuery(React.createElement(FormBuilder, { form: formWithFields, onClose }))

    expect(screen.getByText('Qual é o seu nome?')).toBeInTheDocument()
    expect(screen.getByText('Qual é o seu e-mail?')).toBeInTheDocument()
  })

  it('click em campo na lista o seleciona e exibe o FieldEditor', () => {
    const onClose = vi.fn()
    const formWithFields = makeForm({
      form_fields: [
        {
          id: 'f-1',
          form_id: 'form-1',
          position: 0,
          field_type: 'short_text',
          label: 'Pergunta de teste',
          required: true,
          validation_rules: null,
          error_message: null,
          skip_if_known: false,
          field_key: 'pergunta_teste',
          created_at: new Date().toISOString(),
        },
      ],
    })
    renderWithQuery(React.createElement(FormBuilder, { form: formWithFields, onClose }))

    // Clica no campo para selecioná-lo
    fireEvent.click(screen.getByText('Pergunta de teste'))

    // FieldEditor deve aparecer (contém o label "Pergunta")
    expect(screen.getByLabelText('Pergunta')).toBeInTheDocument()
  })

  it('botão "Salvar" chama useUpdateForm.mutateAsync', async () => {
    const mutateSpy = vi.fn().mockResolvedValue(undefined)
    const mutateFieldsSpy = vi.fn().mockResolvedValue(undefined)
    mockUseUpdateForm.mockReturnValue({ mutate: vi.fn(), mutateAsync: mutateSpy, isPending: false })
    mockUseUpsertFormFields.mockReturnValue({ mutate: vi.fn(), mutateAsync: mutateFieldsSpy, isPending: false })

    const onClose = vi.fn()
    renderWithQuery(React.createElement(FormBuilder, { form: makeForm(), onClose }))

    fireEvent.click(screen.getByText('Salvar'))

    // Aguarda a chamada assíncrona
    await vi.waitFor(() => {
      expect(mutateSpy).toHaveBeenCalledTimes(1)
    })
    expect(mutateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'form-1',
        agentId: 'agent-1',
      }),
    )
  })

  it('click em aba "Configurações" exibe inputs de welcome/completion message', () => {
    const onClose = vi.fn()
    renderWithQuery(React.createElement(FormBuilder, { form: makeForm(), onClose }))

    fireEvent.click(screen.getByText('Configurações'))

    // Deve aparecer o label da mensagem de boas-vindas
    expect(screen.getByLabelText('Mensagem de boas-vindas')).toBeInTheDocument()
    expect(screen.getByLabelText('Mensagem de conclusão')).toBeInTheDocument()
  })

  it('inputs de configurações mostram os valores do form', () => {
    const onClose = vi.fn()
    renderWithQuery(
      React.createElement(
        FormBuilder,
        {
          form: makeForm({
            welcome_message: 'Bem-vindo ao formulário!',
            completion_message: 'Respostas enviadas com sucesso!',
          }),
          onClose,
        },
      ),
    )

    fireEvent.click(screen.getByText('Configurações'))

    const welcomeInput = screen.getByLabelText('Mensagem de boas-vindas') as HTMLTextAreaElement
    const completionInput = screen.getByLabelText('Mensagem de conclusão') as HTMLTextAreaElement
    expect(welcomeInput.value).toBe('Bem-vindo ao formulário!')
    expect(completionInput.value).toBe('Respostas enviadas com sucesso!')
  })

  it('click em aba "Preview" mostra o preview da conversa (Bot Formulário)', () => {
    const onClose = vi.fn()
    renderWithQuery(React.createElement(FormBuilder, { form: makeForm(), onClose }))

    fireEvent.click(screen.getByText('Preview'))

    // O FormPreview exibe "Bot Formulário" no header do chat simulado
    expect(screen.getByText('Bot Formulário')).toBeInTheDocument()
  })
})
