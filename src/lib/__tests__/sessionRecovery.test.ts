import { describe, it, expect, vi, beforeEach } from 'vitest';

const getSession = vi.fn();
const signOut = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSession(...args),
      signOut: (...args: unknown[]) => signOut(...args),
    },
  },
}));

import { probeSession, clearDeadSession, recoverStuckSession } from '../sessionRecovery';

describe('probeSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 'valid' quando getSession resolve com sessão", async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'jwt' } }, error: null });
    await expect(probeSession()).resolves.toBe('valid');
  });

  it("retorna 'dead' quando getSession resolve com session=null (refresh token morto, sem throw)", async () => {
    // supabase-js sinaliza refresh token rejeitado RESOLVENDO com session=null.
    getSession.mockResolvedValue({ data: { session: null }, error: { message: 'invalid_grant' } });
    await expect(probeSession()).resolves.toBe('dead');
  });

  it("retorna 'unknown' quando getSession PENDURA (timeout) — nunca trava o chamador", async () => {
    getSession.mockReturnValue(new Promise(() => {})); // nunca resolve
    await expect(probeSession(30)).resolves.toBe('unknown');
  });

  it("retorna 'unknown' quando getSession lança (estado inesperado), sem propagar", async () => {
    getSession.mockRejectedValue(new Error('boom'));
    await expect(probeSession()).resolves.toBe('unknown');
  });
});

describe('clearDeadSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chama signOut com scope:'local' (sem revogação global cross-device)", async () => {
    signOut.mockResolvedValue({ error: null });
    await clearDeadSession();
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('não propaga erro quando signOut falha (best-effort)', async () => {
    signOut.mockRejectedValue(new Error('network'));
    await expect(clearDeadSession()).resolves.toBeUndefined();
  });

  it('não pendura o chamador se signOut travar (race de timeout)', async () => {
    signOut.mockReturnValue(new Promise(() => {})); // nunca resolve
    await expect(clearDeadSession(30)).resolves.toBeUndefined();
  });
});

describe('recoverStuckSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    try { sessionStorage.clear(); } catch { /* noop */ }
    try { localStorage.clear(); } catch { /* noop */ } // sem token → refresh cru é no-op
  });

  it('reinicializa (chama reload) quando não há recuperação recente', async () => {
    const reload = vi.fn();
    await expect(recoverStuckSession({ reload })).resolves.toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('NÃO reloada se já recuperou há < 30s (guarda anti-loop)', async () => {
    await recoverStuckSession({ reload: vi.fn() });
    const reload = vi.fn();
    await expect(recoverStuckSession({ reload })).resolves.toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('force:true reloada mesmo dentro da janela de 30s (retry explícito do usuário)', async () => {
    await recoverStuckSession({ reload: vi.fn() });
    const reload = vi.fn();
    await expect(recoverStuckSession({ force: true, reload })).resolves.toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
