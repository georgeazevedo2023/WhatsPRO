import { describe, it, expect, vi, afterEach } from 'vitest';
import { directUploadWithRetry, getStoredAccessToken, uploadAttemptTimeouts } from '@/lib/directStorageUpload';

const AUTH_KEY = 'sb-prfcbfumyrrycsrcrvms-auth-token';

function storeToken(expiresInS: number, accessToken = 'tok-123') {
  localStorage.setItem(AUTH_KEY, JSON.stringify({
    access_token: accessToken,
    refresh_token: 'rt',
    expires_at: Math.floor(Date.now() / 1000) + expiresInS,
  }));
}

afterEach(() => localStorage.removeItem(AUTH_KEY));

describe('uploadAttemptTimeouts', () => {
  it('foto downscalada (~350KB): 3 tentativas curtas — socket morto re-tenta cedo', () => {
    const t = uploadAttemptTimeouts(350_000);
    expect(t).toHaveLength(3);
    expect(t[0]).toBe(30_000);
  });

  it('arquivo grande (15MB): 1 tentativa de 120s (paridade com o teto antigo)', () => {
    expect(uploadAttemptTimeouts(15 * 1024 * 1024)).toEqual([120_000]);
  });

  it('imagem média (1,5MB): teto proporcional, ≥1 retry dentro do orçamento', () => {
    const t = uploadAttemptTimeouts(1_500_000);
    expect(t.length).toBe(2);
    expect(t[0]).toBe(60_000);
  });
});

describe('getStoredAccessToken', () => {
  it('token válido é devolvido', () => {
    storeToken(3600);
    expect(getStoredAccessToken()).toBe('tok-123');
  });

  it('token perto de expirar (<60s) NÃO é usado — o storage-js refresca', () => {
    storeToken(30);
    expect(getStoredAccessToken()).toBeNull();
  });

  it('sem sessão no storage → null', () => {
    expect(getStoredAccessToken()).toBeNull();
  });

  it('JSON corrompido → null (nunca lança)', () => {
    localStorage.setItem(AUTH_KEY, '{corrompido');
    expect(getStoredAccessToken()).toBeNull();
  });
});

describe('directUploadWithRetry', () => {
  const file = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
  const base = {
    bucket: 'helpdesk-media',
    file,
    contentType: 'image/jpeg',
    tokenProvider: () => 'tok-123',
  };

  it('sucesso na 1ª tentativa devolve o path e manda os headers de auth', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }));
    const res = await directUploadWithRetry({
      ...base,
      pathFor: (a) => `conv/${a}.jpg`,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(res).toEqual({ ok: true, path: 'conv/0.jpg', attempts: 1 });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/storage/v1/object/helpdesk-media/conv/0.jpg');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok-123');
    expect((init.headers as Record<string, string>)['x-upsert']).toBe('false');
  });

  it('rede caindo na 1ª tentativa → re-tenta em PATH NOVO e sucede', async () => {
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const res = await directUploadWithRetry({
      ...base,
      pathFor: (a) => `conv/${a}.jpg`,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutsOverride: [50, 50],
    });
    expect(res).toEqual({ ok: true, path: 'conv/1.jpg', attempts: 2 });
  });

  it('hang em TODAS as tentativas → exhausted com o último erro (chamador roda a sonda)', async () => {
    // fetch que respeita o AbortController: pendura até o signal abortar.
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      }));
    const res = await directUploadWithRetry({
      ...base,
      pathFor: (a) => `conv/${a}.jpg`,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutsOverride: [30, 30, 30],
    });
    expect(res).toMatchObject({ ok: false, kind: 'exhausted', attempts: 3 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('401 → unavailable SEM retry (o storage-js decide o refresh)', async () => {
    const fetchImpl = vi.fn(async () => new Response('denied', { status: 401 }));
    const res = await directUploadWithRetry({
      ...base,
      pathFor: (a) => `conv/${a}.jpg`,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(res).toMatchObject({ ok: false, kind: 'unavailable' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('4xx de payload → error limpo sem retry', async () => {
    const fetchImpl = vi.fn(async () => new Response('Payload too large', { status: 413 }));
    const res = await directUploadWithRetry({
      ...base,
      pathFor: (a) => `conv/${a}.jpg`,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(res).toMatchObject({ ok: false, kind: 'error' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('5xx transitório re-tenta e pode suceder', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('oops', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const res = await directUploadWithRetry({
      ...base,
      pathFor: (a) => `conv/${a}.jpg`,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutsOverride: [50, 50],
    });
    expect(res).toEqual({ ok: true, path: 'conv/1.jpg', attempts: 2 });
  });

  it('sem token → unavailable sem nenhum fetch (cai no caminho legado)', async () => {
    const fetchImpl = vi.fn();
    const res = await directUploadWithRetry({
      ...base,
      tokenProvider: () => null,
      pathFor: (a) => `conv/${a}.jpg`,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(res).toMatchObject({ ok: false, kind: 'unavailable' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
