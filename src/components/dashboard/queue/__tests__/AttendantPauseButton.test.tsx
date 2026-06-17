import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AttendantPauseButton from '../AttendantPauseButton';
import type { AttendantStat } from '@/hooks/useQueueDashboard';

// Mock do hook de mutação — controla mutate/isPending sem React Query nem RPC.
const h = vi.hoisted(() => ({ mutate: vi.fn(), pending: { value: false } }));
vi.mock('@/hooks/useQueueDashboard', () => ({
  useSetAttendantPaused: () => ({ mutate: h.mutate, isPending: h.pending.value }),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => mockToastSuccess(...a),
    error: (...a: unknown[]) => mockToastError(...a),
  },
}));

function stat(partial: Partial<AttendantStat>): AttendantStat {
  return {
    user_id: 'u1', full_name: 'Fernando Silva', avatar_url: null, queue_paused: false, queue_position: 0,
    received: 0, responded: 0, timed_out: 0, manual_override: 0, cancelled: 0, active: 0,
    avg_response_seconds: 0, is_manager: false, ...partial,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.pending.value = false;
});

describe('AttendantPauseButton', () => {
  it('disponível → mostra "Pausar"', () => {
    render(<AttendantPauseButton stat={stat({ queue_paused: false })} instanceId="inst-A" />);
    expect(screen.getByText('Pausar')).toBeInTheDocument();
  });

  it('pausado → mostra "Reativar"', () => {
    render(<AttendantPauseButton stat={stat({ queue_paused: true })} instanceId="inst-A" />);
    expect(screen.getByText('Reativar')).toBeInTheDocument();
  });

  it('clicar "Pausar" → mutate com {userId, instanceId, paused:true} + toast de sucesso', () => {
    h.mutate.mockImplementation((_vars: unknown, opts: { onSuccess?: () => void }) => opts.onSuccess?.());
    render(<AttendantPauseButton stat={stat({ user_id: 'u1', queue_paused: false })} instanceId="inst-A" />);
    fireEvent.click(screen.getByText('Pausar'));
    expect(h.mutate).toHaveBeenCalledWith(
      { userId: 'u1', instanceId: 'inst-A', paused: true },
      expect.anything(),
    );
    expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining('foi pausado'));
  });

  it('estado otimista: rótulo vira "Reativar" na hora do clique (antes do refetch)', () => {
    // mutate não resolve nada (pendente) → otimista deve segurar o novo estado
    h.mutate.mockImplementation(() => {});
    render(<AttendantPauseButton stat={stat({ queue_paused: false })} instanceId="inst-A" />);
    fireEvent.click(screen.getByText('Pausar'));
    expect(screen.getByText('Reativar')).toBeInTheDocument();
  });

  it('erro → reverte o otimista e dispara toast de erro com a mensagem', () => {
    h.mutate.mockImplementation((_vars: unknown, opts: { onError?: (e: unknown) => void }) =>
      opts.onError?.(new Error('forbidden')));
    render(<AttendantPauseButton stat={stat({ queue_paused: false })} instanceId="inst-A" />);
    fireEvent.click(screen.getByText('Pausar'));
    expect(mockToastError).toHaveBeenCalledWith('forbidden');
    // revertido pro estado real (disponível) → volta a "Pausar"
    expect(screen.getByText('Pausar')).toBeInTheDocument();
  });

  it('isPending → botão desabilitado', () => {
    h.pending.value = true;
    render(<AttendantPauseButton stat={stat({ queue_paused: false })} instanceId="inst-A" />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('sem instância → botão desabilitado e não chama mutate', () => {
    render(<AttendantPauseButton stat={stat({ queue_paused: false })} instanceId={null} />);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(h.mutate).not.toHaveBeenCalled();
  });
});
