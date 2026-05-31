import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const probeSession = vi.fn();
const clearDeadSession = vi.fn();
const realtimeConnect = vi.fn();

vi.mock('@/lib/sessionRecovery', () => ({
  probeSession: (...a: unknown[]) => probeSession(...a),
  clearDeadSession: (...a: unknown[]) => clearDeadSession(...a),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { realtime: { connect: (...a: unknown[]) => realtimeConnect(...a) } },
}));

import { useTabFocusRefresh } from '../useTabFocusRefresh';

let hiddenValue = false;
function setVisibility(hidden: boolean) {
  hiddenValue = hidden;
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useTabFocusRefresh', () => {
  let nowSpy: ReturnType<typeof vi.spyOn>;
  let dispatchSpy: ReturnType<typeof vi.spyOn>;
  let unmount: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    hiddenValue = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hiddenValue });
    nowSpy = vi.spyOn(Date, 'now');
    dispatchSpy = vi.spyOn(window, 'dispatchEvent');
  });

  afterEach(() => {
    unmount?.();
    nowSpy.mockRestore();
    dispatchSpy.mockRestore();
  });

  const resumedEvents = () =>
    dispatchSpy.mock.calls
      .map((c) => c[0])
      .filter((e): e is CustomEvent => e instanceof CustomEvent && e.type === 'app:tab-resumed');

  /** Simula sair da aba em t=1000 e voltar em t=10000 (away = 9s > 3s). */
  function suspendAndResume() {
    nowSpy.mockReturnValue(1000);
    setVisibility(true);
    nowSpy.mockReturnValue(10_000);
    setVisibility(false);
  }

  it('sessão válida: revalida → reconecta realtime → dispara app:tab-resumed (sem deslogar)', async () => {
    probeSession.mockResolvedValue('valid');
    ({ unmount } = renderHook(() => useTabFocusRefresh()));

    suspendAndResume();

    await waitFor(() => expect(resumedEvents()).toHaveLength(1));
    expect(probeSession).toHaveBeenCalledTimes(1);
    expect(realtimeConnect).toHaveBeenCalledTimes(1);
    expect(clearDeadSession).not.toHaveBeenCalled();
  });

  it('sessão morta: limpa (signOut local) e NÃO reconecta nem refetcha — ProtectedRoute redireciona', async () => {
    probeSession.mockResolvedValue('dead');
    ({ unmount } = renderHook(() => useTabFocusRefresh()));

    suspendAndResume();

    await waitFor(() => expect(clearDeadSession).toHaveBeenCalledTimes(1));
    expect(realtimeConnect).not.toHaveBeenCalled();
    expect(resumedEvents()).toHaveLength(0);
  });

  it('ambíguo (timeout/offline): reconecta realtime mas NÃO refetcha nem desloga — preserva a conversa aberta', async () => {
    probeSession.mockResolvedValue('unknown');
    ({ unmount } = renderHook(() => useTabFocusRefresh()));

    suspendAndResume();

    await waitFor(() => expect(realtimeConnect).toHaveBeenCalledTimes(1));
    expect(clearDeadSession).not.toHaveBeenCalled();
    // refetch manual suprimido: refetchar num token incerto reproduziria o timeout
    expect(resumedEvents()).toHaveLength(0);
  });

  it('retorno < 3s: não revalida nem dispara (evita refresh desnecessário)', async () => {
    probeSession.mockResolvedValue('valid');
    ({ unmount } = renderHook(() => useTabFocusRefresh()));

    nowSpy.mockReturnValue(1000);
    setVisibility(true);
    nowSpy.mockReturnValue(2500); // away = 1.5s < 3s
    setVisibility(false);

    await new Promise((r) => setTimeout(r, 20));
    expect(probeSession).not.toHaveBeenCalled();
    expect(resumedEvents()).toHaveLength(0);
  });
});
