import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useActiveQueueEvents, formatCountdown } from '../useActiveQueueEvents';

// --- Mock supabase client ----------------------------------------------------
type Resp = { data: unknown; error?: null };

const queueEventsResp: Resp = { data: [], error: null };
const userProfilesResp: Resp = { data: [], error: null };

const mockChannel = {
  on: vi.fn(function on(this: unknown) {
    return mockChannel;
  }),
  subscribe: vi.fn(function subscribe(this: unknown) {
    return mockChannel;
  }),
  unsubscribe: vi.fn(),
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'handoff_queue_events') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => queueEventsResp),
          })),
        };
      }
      if (table === 'user_profiles') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => userProfilesResp),
          })),
        };
      }
      return { select: vi.fn() };
    }),
    channel: vi.fn(() => mockChannel),
    removeChannel: vi.fn(),
  },
}));

// Helper para reescrever respostas entre testes
function setQueueEvents(rows: unknown[]) {
  queueEventsResp.data = rows;
}
function setUserProfiles(rows: unknown[]) {
  userProfilesResp.data = rows;
}

beforeEach(() => {
  setQueueEvents([]);
  setUserProfiles([]);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useActiveQueueEvents — fetch inicial', () => {
  it('mapa vazio quando nao ha eventos ativos', async () => {
    const { result } = renderHook(() => useActiveQueueEvents());
    await waitFor(() => {
      expect(result.current.events.size).toBe(0);
    });
  });

  it('popula mapa com nome do atendente', async () => {
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString(); // +3 min
    setQueueEvents([
      {
        id: 'evt-1',
        conversation_id: 'conv-A',
        assigned_user_id: 'user-1',
        expires_at: expiresAt,
        paused_at: null,
        status: 'active',
        rotation_number: 0,
      },
    ]);
    setUserProfiles([{ id: 'user-1', full_name: 'Lucas Silva' }]);

    const { result } = renderHook(() => useActiveQueueEvents());
    await waitFor(() => {
      expect(result.current.events.size).toBe(1);
    });
    const ev = result.current.events.get('conv-A');
    expect(ev?.assignee_name).toBe('Lucas'); // primeiro nome
    expect(ev?.event_id).toBe('evt-1');
    expect(ev?.paused_at).toBeNull();
  });

  it('fallback de nome para prefixo do user_id quando full_name vazio', async () => {
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();
    setQueueEvents([
      {
        id: 'evt-2',
        conversation_id: 'conv-B',
        assigned_user_id: '12345678-aaaa-bbbb-cccc-deadbeefdead',
        expires_at: expiresAt,
        paused_at: null,
        status: 'active',
        rotation_number: 0,
      },
    ]);
    setUserProfiles([{ id: '12345678-aaaa-bbbb-cccc-deadbeefdead', full_name: '' }]);

    const { result } = renderHook(() => useActiveQueueEvents());
    await waitFor(() => {
      expect(result.current.events.size).toBe(1);
    });
    expect(result.current.events.get('conv-B')?.assignee_name).toBe('12345678');
  });
});

describe('useActiveQueueEvents — secondsRemaining', () => {
  it('null quando nao ha evento na conversa', async () => {
    const { result } = renderHook(() => useActiveQueueEvents());
    await waitFor(() => {
      expect(result.current.events.size).toBe(0);
    });
    expect(result.current.secondsRemaining('conv-inexistente')).toBeNull();
  });

  it('null quando evento esta pausado (relogio congela em horario nao-comercial)', async () => {
    setQueueEvents([
      {
        id: 'evt-3',
        conversation_id: 'conv-C',
        assigned_user_id: 'user-1',
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        paused_at: new Date().toISOString(),
        status: 'active',
        rotation_number: 0,
      },
    ]);
    setUserProfiles([{ id: 'user-1', full_name: 'Lucas' }]);

    const { result } = renderHook(() => useActiveQueueEvents());
    await waitFor(() => {
      expect(result.current.events.size).toBe(1);
    });
    expect(result.current.secondsRemaining('conv-C')).toBeNull();
  });

  it('retorna inteiro positivo aproximando para baixo', async () => {
    const expiresAt = new Date(Date.now() + 245 * 1000).toISOString(); // +4:05
    setQueueEvents([
      {
        id: 'evt-4',
        conversation_id: 'conv-D',
        assigned_user_id: 'user-1',
        expires_at: expiresAt,
        paused_at: null,
        status: 'active',
        rotation_number: 0,
      },
    ]);
    setUserProfiles([{ id: 'user-1', full_name: 'Ana' }]);

    const { result } = renderHook(() => useActiveQueueEvents());
    await waitFor(() => {
      expect(result.current.events.size).toBe(1);
    });
    const remaining = result.current.secondsRemaining('conv-D');
    expect(remaining).not.toBeNull();
    expect(remaining!).toBeGreaterThan(240);
    expect(remaining!).toBeLessThanOrEqual(245);
  });

  it('zero quando expires_at ja passou (max(0, ...))', async () => {
    setQueueEvents([
      {
        id: 'evt-5',
        conversation_id: 'conv-E',
        assigned_user_id: 'user-1',
        expires_at: new Date(Date.now() - 60 * 1000).toISOString(), // -1min
        paused_at: null,
        status: 'active',
        rotation_number: 0,
      },
    ]);
    setUserProfiles([{ id: 'user-1', full_name: 'Joao' }]);

    const { result } = renderHook(() => useActiveQueueEvents());
    await waitFor(() => {
      expect(result.current.events.size).toBe(1);
    });
    expect(result.current.secondsRemaining('conv-E')).toBe(0);
  });
});

describe('useActiveQueueEvents — realtime subscribe', () => {
  it('inscreve em canal helpdesk-realtime com evento queue-update', async () => {
    renderHook(() => useActiveQueueEvents());
    await waitFor(() => {
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });
    // .on('broadcast', { event: 'queue-update' }, fn)
    const onCalls = mockChannel.on.mock.calls;
    const queueCall = onCalls.find(
      ([type, opts]) => type === 'broadcast' && (opts as { event?: string })?.event === 'queue-update',
    );
    expect(queueCall).toBeDefined();
  });

  it('refetch publico funciona (manual trigger)', async () => {
    setQueueEvents([]);
    const { result } = renderHook(() => useActiveQueueEvents());
    await waitFor(() => {
      expect(result.current.events.size).toBe(0);
    });

    // Simula um evento que aparece depois
    setQueueEvents([
      {
        id: 'evt-late',
        conversation_id: 'conv-late',
        assigned_user_id: 'user-1',
        expires_at: new Date(Date.now() + 30 * 1000).toISOString(),
        paused_at: null,
        status: 'active',
        rotation_number: 0,
      },
    ]);
    setUserProfiles([{ id: 'user-1', full_name: 'Lucas' }]);

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.events.size).toBe(1);
    expect(result.current.events.get('conv-late')?.assignee_name).toBe('Lucas');
  });
});

describe('formatCountdown', () => {
  it('formata segundos como m:ss', () => {
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(3)).toBe('0:03');
    expect(formatCountdown(45)).toBe('0:45');
    expect(formatCountdown(60)).toBe('1:00');
    expect(formatCountdown(125)).toBe('2:05');
    expect(formatCountdown(245)).toBe('4:05');
    expect(formatCountdown(599)).toBe('9:59');
  });
});
