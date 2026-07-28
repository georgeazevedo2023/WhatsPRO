import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ConversationModal } from '../ConversationModal';

/**
 * Regressão do pedido do gestor (2026-07-27): na Fila, o áudio aparecia como um
 * "[audio]" seco — sem player e sem transcrição —, então metade do atendimento
 * (o vendedor responde falando) era ilegível para quem supervisiona.
 */

const MESSAGES = [
  {
    id: 'm1',
    direction: 'incoming',
    content: '',
    media_type: 'audio',
    media_url: 'https://wsmart.uazapi.com/files/lead.mp3',
    transcription: 'Queria saber se esse revestimento serve para piso',
    sender_id: null,
    external_id: null,
    created_at: '2026-07-27T18:05:16.000Z',
  },
  {
    id: 'm2',
    direction: 'outgoing',
    content: '',
    media_type: 'audio',
    media_url: 'https://wsmart.uazapi.com/files/vendedor.mp3',
    transcription: null,
    sender_id: null,
    external_id: null,
    created_at: '2026-07-27T18:37:54.000Z',
  },
];

const thenable = (payload: unknown) => ({
  then: (cb: (p: unknown) => void) => {
    cb(payload);
    return { catch: () => {} };
  },
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'conversations') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => thenable({ data: { assigned_to: null, inbox: { instance_id: 'inst-1' } } }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            order: () => thenable({ data: MESSAGES, error: null }),
          }),
        }),
      };
    },
  },
}));

vi.mock('@/hooks/useUserProfiles', () => ({
  useUserProfiles: () => ({ namesMap: {} }),
}));

// O player real instancia <audio> e mede duração — aqui só provamos que ele é
// montado com a URL já resolvida pelo proxy.
vi.mock('@/components/helpdesk/AudioPlayer', () => ({
  AudioPlayer: ({ src }: { src: string }) => <div data-testid="audio-player" data-src={src} />,
}));

const mockUseMediaUrl = vi.fn(() => ({ url: 'blob:resolvido', loading: false, error: false }));
vi.mock('@/hooks/useMediaUrl', () => ({
  useMediaUrl: (...args: unknown[]) => mockUseMediaUrl(...(args as [])),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

beforeEach(() => vi.clearAllMocks());

function renderModal() {
  return render(
    <ConversationModal
      open
      onOpenChange={() => {}}
      conversationId="conv-1"
      contactName="Kátia"
    />,
  );
}

describe('ConversationModal — áudio', () => {
  it('renderiza um player para cada áudio (nunca mais o texto "[audio]")', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getAllByTestId('audio-player')).toHaveLength(2);
    });
    expect(screen.queryByText('[audio]')).toBeNull();
  });

  it('mostra a transcrição quando existe', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByText(/Queria saber se esse revestimento serve para piso/)).toBeTruthy();
    });
  });

  it('mostra "(sem transcrição)" no áudio ainda não transcrito — nunca um vazio ambíguo', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByText('(sem transcrição)')).toBeTruthy();
    });
  });

  it('distingue áudio do cliente e do atendente', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getByText('🎤 Áudio do cliente')).toBeTruthy();
      expect(screen.getByText('🎤 Áudio enviado')).toBeTruthy();
    });
  });

  it('resolve a mídia pelo proxy com o instance_id da inbox (URL do UAZAPI expira/403 se usada crua)', async () => {
    renderModal();
    await waitFor(() => {
      expect(screen.getAllByTestId('audio-player').length).toBeGreaterThan(0);
    });
    const chamadasComInstancia = mockUseMediaUrl.mock.calls.filter((c) => (c as unknown[])[1] === 'inst-1');
    expect(chamadasComInstancia.length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('audio-player')[0].getAttribute('data-src')).toBe('blob:resolvido');
  });
});
