import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import QueuePauseToggle from '../QueuePauseToggle';

const mockEq = vi.fn();
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockRpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-lucas' } }),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('QueuePauseToggle — render', () => {
  it('nao renderiza quando user nao pertence a nenhum dept', async () => {
    mockEq.mockResolvedValue({ data: [], error: null });
    const { container } = render(<QueuePauseToggle />);
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('renderiza Disponivel quando algum dept esta nao-pausado', async () => {
    mockEq.mockResolvedValue({
      data: [{ queue_paused: false }, { queue_paused: true }],
      error: null,
    });
    render(<QueuePauseToggle />);
    await waitFor(() => {
      expect(screen.getByText('Disponível')).toBeInTheDocument();
    });
  });

  it('renderiza Pausado quando TODOS deptos estao pausados', async () => {
    mockEq.mockResolvedValue({
      data: [{ queue_paused: true }, { queue_paused: true }],
      error: null,
    });
    render(<QueuePauseToggle />);
    await waitFor(() => {
      expect(screen.getByText('Pausado')).toBeInTheDocument();
    });
  });
});

describe('QueuePauseToggle — toggle (R93 fix)', () => {
  it('clica em Disponivel -> chama RPC set_my_queue_paused com paused=true', async () => {
    mockEq.mockResolvedValue({ data: [{ queue_paused: false }], error: null });
    mockRpc.mockResolvedValue({ data: { rows_affected: 1, paused: true }, error: null });

    render(<QueuePauseToggle />);
    await waitFor(() => expect(screen.getByText('Disponível')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Disponível'));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('set_my_queue_paused', {
        _paused: true,
        _reason: 'Pausado pelo atendente no helpdesk',
      });
    });
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  it('clica em Pausado -> chama RPC com paused=false e reason=null', async () => {
    mockEq.mockResolvedValue({ data: [{ queue_paused: true }], error: null });
    mockRpc.mockResolvedValue({ data: { rows_affected: 1, paused: false }, error: null });

    render(<QueuePauseToggle />);
    await waitFor(() => expect(screen.getByText('Pausado')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Pausado'));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith('set_my_queue_paused', {
        _paused: false,
        _reason: null,
      });
    });
  });

  it('R93 regression: rows_affected=0 dispara toast ERRO (nao success)', async () => {
    mockEq.mockResolvedValue({ data: [{ queue_paused: false }], error: null });
    mockRpc.mockResolvedValue({ data: { rows_affected: 0, paused: true }, error: null });

    render(<QueuePauseToggle />);
    await waitFor(() => expect(screen.getByText('Disponível')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Disponível'));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
    expect(mockToastSuccess).not.toHaveBeenCalled();
    // State NAO muda quando o UPDATE falha silenciosamente
    expect(screen.getByText('Disponível')).toBeInTheDocument();
  });

  it('RPC retorna error -> toast erro com mensagem', async () => {
    mockEq.mockResolvedValue({ data: [{ queue_paused: false }], error: null });
    mockRpc.mockResolvedValue({ data: null, error: { message: 'rpc broken' } });

    render(<QueuePauseToggle />);
    await waitFor(() => expect(screen.getByText('Disponível')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Disponível'));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('rpc broken');
    });
  });

  it('RPC retorna error no payload (unauthenticated) -> toast erro', async () => {
    mockEq.mockResolvedValue({ data: [{ queue_paused: false }], error: null });
    mockRpc.mockResolvedValue({
      data: { error: 'unauthenticated', rows_affected: 0 },
      error: null,
    });

    render(<QueuePauseToggle />);
    await waitFor(() => expect(screen.getByText('Disponível')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Disponível'));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('unauthenticated');
    });
  });
});
