/**
 * Testes para TemplateGallery component (M12 — Formulários WhatsApp).
 * Usa os templates reais de @/types/forms sem mock.
 */
import type { ReactElement } from 'react'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'

import { TemplateGallery } from '../TemplateGallery'
import { FORM_TEMPLATES } from '@/types/forms'
import type { FormTemplate } from '@/types/forms'

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

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('TemplateGallery', () => {
  const onSelect = vi.fn()
  const onBlank = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza sem crash', () => {
    renderWithQuery(React.createElement(TemplateGallery, { onSelect, onBlank }))
    expect(screen.getByText('Escolha um Template')).toBeInTheDocument()
  })

  it('mostra botão "Formulário em Branco"', () => {
    renderWithQuery(React.createElement(TemplateGallery, { onSelect, onBlank }))
    expect(screen.getByText('Formulário em Branco')).toBeInTheDocument()
  })

  it('mostra a quantidade correta de template cards (FORM_TEMPLATES.length)', () => {
    renderWithQuery(React.createElement(TemplateGallery, { onSelect, onBlank }))
    // Cada template exibe seu nome como texto no badge do card
    FORM_TEMPLATES.forEach((template) => {
      expect(screen.getByText(template.name)).toBeInTheDocument()
    })
    // Garante que todos os 12 templates estão na tela
    expect(FORM_TEMPLATES.length).toBe(12)
  })

  it('click em "Formulário em Branco" chama onBlank', () => {
    renderWithQuery(React.createElement(TemplateGallery, { onSelect, onBlank }))
    fireEvent.click(screen.getByText('Formulário em Branco'))
    expect(onBlank).toHaveBeenCalledTimes(1)
  })

  it('click em template card chama onSelect com o template correto', () => {
    renderWithQuery(React.createElement(TemplateGallery, { onSelect, onBlank }))
    // Clica no card do primeiro template
    const firstTemplate = FORM_TEMPLATES[0]
    const card = screen.getByText(firstTemplate.name).closest('button')
    expect(card).not.toBeNull()
    fireEvent.click(card!)
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining<Partial<FormTemplate>>({
        type: firstTemplate.type,
        name: firstTemplate.name,
      }),
    )
  })

  it('exibe nome e descrição do primeiro template (NPS — Satisfação)', () => {
    renderWithQuery(React.createElement(TemplateGallery, { onSelect, onBlank }))
    const npsTemplate = FORM_TEMPLATES.find((t) => t.type === 'nps')!
    expect(screen.getByText(npsTemplate.name)).toBeInTheDocument()
    expect(screen.getByText(npsTemplate.description)).toBeInTheDocument()
  })

  it('mostra badge de contagem de campos para cada template', () => {
    renderWithQuery(React.createElement(TemplateGallery, { onSelect, onBlank }))
    // Verifica o primeiro template (NPS tem 2 campos)
    const nps = FORM_TEMPLATES.find((t) => t.type === 'nps')!
    const camposText = `${nps.fields.length} campo${nps.fields.length !== 1 ? 's' : ''}`
    expect(screen.getByText(camposText)).toBeInTheDocument()
  })

  it('mostra badge de contagem de campos para template com campo único (se existir)', () => {
    // Verifica que templates com 1 campo mostram "campo" (singular)
    const singleFieldTemplates = FORM_TEMPLATES.filter((t) => t.fields.length === 1)
    if (singleFieldTemplates.length > 0) {
      renderWithQuery(React.createElement(TemplateGallery, { onSelect, onBlank }))
      expect(screen.getAllByText('1 campo').length).toBeGreaterThanOrEqual(1)
    } else {
      // Não há templates com 1 campo — verificar que plurais estão corretos
      renderWithQuery(React.createElement(TemplateGallery, { onSelect, onBlank }))
      const multiFieldBadges = screen.getAllByText(/\d+ campos/)
      expect(multiFieldBadges.length).toBe(FORM_TEMPLATES.length)
    }
  })

  it('cada template card é clicável (role implícito de button)', () => {
    renderWithQuery(React.createElement(TemplateGallery, { onSelect, onBlank }))
    const cards = screen.getAllByRole('button')
    // Ao menos os 12 cards + botão "Formulário em Branco"
    expect(cards.length).toBeGreaterThanOrEqual(FORM_TEMPLATES.length + 1)
  })

  it('click em template de sorteio chama onSelect com o template correto', () => {
    renderWithQuery(React.createElement(TemplateGallery, { onSelect, onBlank }))
    const sorteioTemplate = FORM_TEMPLATES.find((t) => t.type === 'sorteio')!
    const card = screen.getByText(sorteioTemplate.name).closest('button')
    fireEvent.click(card!)
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining<Partial<FormTemplate>>({
        type: 'sorteio',
        name: sorteioTemplate.name,
      }),
    )
  })
})
