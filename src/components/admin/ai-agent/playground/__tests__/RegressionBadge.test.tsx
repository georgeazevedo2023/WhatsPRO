/**
 * Tests for RegressionBadge component (F4 — regression detection display).
 * Covers: null render when no regression, badge text, delta sign, null context.
 */
import type { ReactElement } from 'react'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { RegressionBadge } from '../RegressionBadge'

// ─── Render helper (wraps with TooltipProvider required by Tooltip) ───────────

function renderWithTooltip(ui: ReactElement) {
  return render(
    React.createElement(TooltipProvider, null, ui),
  )
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeBatch(overrides: Partial<{
  is_regression: boolean
  regression_context: {
    delta: number
    current_score: number
    previous_score: number
    consecutive_below_threshold: number
    failed_scenarios: Array<{ id: string; name: string; reason: string }>
  } | null
}> = {}) {
  return {
    is_regression: false,
    regression_context: null,
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RegressionBadge', () => {
  it('retorna null quando is_regression=false', () => {
    const { container } = renderWithTooltip(
      <RegressionBadge batch={makeBatch({ is_regression: false })} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renderiza badge REGRESSÃO quando is_regression=true', () => {
    renderWithTooltip(
      <RegressionBadge
        batch={makeBatch({
          is_regression: true,
          regression_context: {
            delta: -12,
            current_score: 68,
            previous_score: 80,
            consecutive_below_threshold: 1,
            failed_scenarios: [],
          },
        })}
      />,
    )
    expect(screen.getByText(/REGRESSÃO/i)).toBeInTheDocument()
  })

  it('mostra delta negativo no badge (ex: -12pts)', () => {
    renderWithTooltip(
      <RegressionBadge
        batch={makeBatch({
          is_regression: true,
          regression_context: {
            delta: -12,
            current_score: 68,
            previous_score: 80,
            consecutive_below_threshold: 1,
            failed_scenarios: [],
          },
        })}
      />,
    )
    // Badge text: "REGRESSÃO -12pts"
    expect(screen.getByText(/\-12pts/i)).toBeInTheDocument()
  })

  it('mostra delta positivo no badge (ex: +5pts)', () => {
    renderWithTooltip(
      <RegressionBadge
        batch={makeBatch({
          is_regression: true,
          regression_context: {
            delta: 5,
            current_score: 85,
            previous_score: 80,
            consecutive_below_threshold: 0,
            failed_scenarios: [],
          },
        })}
      />,
    )
    // delta > 0 → "+5pts"
    expect(screen.getByText(/\+5pts/i)).toBeInTheDocument()
  })

  it('não quebra quando regression_context=null', () => {
    expect(() =>
      renderWithTooltip(
        <RegressionBadge
          batch={makeBatch({
            is_regression: true,
            regression_context: null,
          })}
        />,
      ),
    ).not.toThrow()
    // Badge still renders without delta text
    expect(screen.getByText(/REGRESSÃO/i)).toBeInTheDocument()
  })

  it('renderiza sem crash com regression_context completo (score + cenários)', () => {
    // TooltipContent é lazy no Radix (só entra no DOM após hover).
    // Verificamos que o componente renderiza o badge sem erros.
    const { container } = renderWithTooltip(
      <RegressionBadge
        batch={makeBatch({
          is_regression: true,
          regression_context: {
            delta: -10,
            current_score: 70,
            previous_score: 80,
            consecutive_below_threshold: 0,
            failed_scenarios: [{ id: 's-1', name: 'Fluxo de venda', reason: 'tool missing' }],
          },
        })}
      />,
    )
    expect(container.firstChild).not.toBeNull()
    expect(screen.getByText(/REGRESSÃO/i)).toBeInTheDocument()
  })

  it('renderiza sem crash com batches consecutivos >= 2', () => {
    const { container } = renderWithTooltip(
      <RegressionBadge
        batch={makeBatch({
          is_regression: true,
          regression_context: {
            delta: -15,
            current_score: 65,
            previous_score: 80,
            consecutive_below_threshold: 3,
            failed_scenarios: [],
          },
        })}
      />,
    )
    expect(container.firstChild).not.toBeNull()
    expect(screen.getByText(/REGRESSÃO/i)).toBeInTheDocument()
  })

  it('renderiza sem crash com lista de cenários no context', () => {
    const { container } = renderWithTooltip(
      <RegressionBadge
        batch={makeBatch({
          is_regression: true,
          regression_context: {
            delta: -20,
            current_score: 60,
            previous_score: 80,
            consecutive_below_threshold: 1,
            failed_scenarios: [
              { id: 's-1', name: 'Fluxo de venda', reason: 'tool missing' },
            ],
          },
        })}
      />,
    )
    expect(container.firstChild).not.toBeNull()
    // O badge deve conter o delta visível
    expect(screen.getByText(/-20pts/i)).toBeInTheDocument()
  })
})
