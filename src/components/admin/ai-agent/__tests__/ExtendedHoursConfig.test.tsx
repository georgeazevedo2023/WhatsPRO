import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExtendedHoursConfig } from '../ExtendedHoursConfig';

beforeEach(() => {
  vi.useFakeTimers();
  // Fixar "agora" em 2026-05-05 14:00 local pra garantir comportamento determinístico
  vi.setSystemTime(new Date('2026-05-05T14:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ExtendedHoursConfig — status', () => {
  it('mostra "Não ativado" quando value é null/undefined', () => {
    render(<ExtendedHoursConfig value={null} onChange={() => {}} />);
    expect(screen.getByTestId('extended-hours-status').textContent).toMatch(/Não ativado/);
  });

  it('mostra "Não ativado" quando value e passado', () => {
    const past = new Date('2026-05-05T13:00:00').toISOString();
    render(<ExtendedHoursConfig value={past} onChange={() => {}} />);
    expect(screen.getByTestId('extended-hours-status').textContent).toMatch(/Não ativado/);
  });

  it('mostra "Ativo" + horario formatado quando futuro', () => {
    const future = new Date('2026-05-05T18:30:00').toISOString();
    render(<ExtendedHoursConfig value={future} onChange={() => {}} />);
    const status = screen.getByTestId('extended-hours-status');
    expect(status.textContent).toMatch(/Ativo/);
    expect(status.textContent).toMatch(/05\/05/);
    expect(status.textContent).toMatch(/18:30/);
  });

  it('botao "Cancelar" so aparece quando ativo', () => {
    const future = new Date('2026-05-05T18:30:00').toISOString();
    const { rerender } = render(<ExtendedHoursConfig value={null} onChange={() => {}} />);
    expect(screen.queryByLabelText('Cancelar Modo Estendido')).toBeNull();

    rerender(<ExtendedHoursConfig value={future} onChange={() => {}} />);
    expect(screen.getByLabelText('Cancelar Modo Estendido')).toBeInTheDocument();
  });
});

describe('ExtendedHoursConfig — quick actions', () => {
  it('+1h chama onChange com timestamp ~1h no futuro', () => {
    const onChange = vi.fn();
    render(<ExtendedHoursConfig value={null} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('extend-1h'));
    expect(onChange).toHaveBeenCalledTimes(1);
    const arg = onChange.mock.calls[0][0] as { extended_hours_until: string };
    const ts = new Date(arg.extended_hours_until).getTime();
    expect(ts).toBeGreaterThan(Date.now() + 59 * 60 * 1000);
    expect(ts).toBeLessThanOrEqual(Date.now() + 60 * 60 * 1000 + 1000);
  });

  it('+2h chama onChange com timestamp ~2h no futuro', () => {
    const onChange = vi.fn();
    render(<ExtendedHoursConfig value={null} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('extend-2h'));
    const arg = onChange.mock.calls[0][0] as { extended_hours_until: string };
    const ts = new Date(arg.extended_hours_until).getTime();
    expect(ts).toBeGreaterThan(Date.now() + 119 * 60 * 1000);
  });

  it('Resto do dia chama onChange com 23:59 de hoje', () => {
    const onChange = vi.fn();
    render(<ExtendedHoursConfig value={null} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('extend-today'));
    const arg = onChange.mock.calls[0][0] as { extended_hours_until: string };
    const d = new Date(arg.extended_hours_until);
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
    expect(d.getDate()).toBe(5); // mesmo dia
  });

  it('Até amanha 23:59 muda para o dia seguinte', () => {
    const onChange = vi.fn();
    render(<ExtendedHoursConfig value={null} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('extend-tomorrow'));
    const arg = onChange.mock.calls[0][0] as { extended_hours_until: string };
    const d = new Date(arg.extended_hours_until);
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
    expect(d.getDate()).toBe(6); // dia seguinte (5 + 1)
  });
});

describe('ExtendedHoursConfig — cancelar', () => {
  it('botao Cancelar dispara onChange com null', () => {
    const onChange = vi.fn();
    const future = new Date('2026-05-05T18:30:00').toISOString();
    render(<ExtendedHoursConfig value={future} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Cancelar Modo Estendido'));
    expect(onChange).toHaveBeenCalledWith({ extended_hours_until: null });
  });
});

describe('ExtendedHoursConfig — custom datetime', () => {
  it('botao Aplicar disabled quando input vazio', () => {
    render(<ExtendedHoursConfig value={null} onChange={() => {}} />);
    const apply = screen.getByRole('button', { name: 'Aplicar' });
    expect(apply).toBeDisabled();
  });

  it('botao Aplicar disabled quando data e passada', () => {
    render(<ExtendedHoursConfig value={null} onChange={() => {}} />);
    const input = screen.getByLabelText('Data/hora personalizada') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2026-05-05T13:00' } }); // antes de "agora" 14:00
    const apply = screen.getByRole('button', { name: 'Aplicar' });
    expect(apply).toBeDisabled();
  });

  it('aplica datetime no futuro chamando onChange com ISO', () => {
    const onChange = vi.fn();
    render(<ExtendedHoursConfig value={null} onChange={onChange} />);
    const input = screen.getByLabelText('Data/hora personalizada') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2026-05-06T10:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const arg = onChange.mock.calls[0][0] as { extended_hours_until: string };
    expect(arg.extended_hours_until).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const d = new Date(arg.extended_hours_until);
    expect(d.getDate()).toBe(6);
    expect(d.getHours()).toBe(10);
  });

  it('input pre-populado com value atual', () => {
    const future = new Date('2026-05-06T15:30:00').toISOString();
    render(<ExtendedHoursConfig value={future} onChange={() => {}} />);
    const input = screen.getByLabelText('Data/hora personalizada') as HTMLInputElement;
    expect(input.value).toBe('2026-05-06T15:30');
  });
});
