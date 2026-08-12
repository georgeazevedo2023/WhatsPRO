import { describe, it, expect, vi } from 'vitest';
import { rawRestInsert, rawRestUpdate } from '@/lib/rawSupabaseApi';

const opts = (fetchImpl: unknown, timeoutMs?: number) => ({
  accessToken: 'tok-abc',
  fetchImpl: fetchImpl as typeof fetch,
  timeoutMs,
});

describe('rawRestInsert', () => {
  it('POST com headers de auth + Prefer e devolve a linha criada', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify([{ id: 'm1', content: 'x' }]), { status: 201 }));
    const row = await rawRestInsert<{ id: string }>('conversation_messages', { content: 'x' }, opts(fetchImpl));
    expect(row.id).toBe('m1');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/rest/v1/conversation_messages');
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer tok-abc');
    expect(headers.prefer).toBe('return=representation');
    expect(headers.apikey).toBeTruthy();
  });

  it('erro do PostgREST vira exceção com status + corpo (RLS 403, constraint 409…)', async () => {
    const fetchImpl = vi.fn(async () => new Response('duplicate key', { status: 409 }));
    await expect(rawRestInsert('t', {}, opts(fetchImpl))).rejects.toThrow(/409.*duplicate key/);
  });

  it('resposta 2xx sem linha (representação vazia) é erro, não sucesso mudo', async () => {
    const fetchImpl = vi.fn(async () => new Response('[]', { status: 201 }));
    await expect(rawRestInsert('t', {}, opts(fetchImpl))).rejects.toThrow(/sem a linha criada/);
  });

  it('request PENDURADO aborta no teto (nunca spinner infinito)', async () => {
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      }));
    await expect(rawRestInsert('t', {}, opts(fetchImpl, 30))).rejects.toThrow();
  });
});

describe('rawRestUpdate', () => {
  it('PATCH com filtro eq na querystring', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    await rawRestUpdate('conversations', { status_ia: 'desligada' }, { id: 'c-1' }, opts(fetchImpl));
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/rest/v1/conversations?id=eq.c-1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ status_ia: 'desligada' });
  });

  it('erro HTTP vira exceção', async () => {
    const fetchImpl = vi.fn(async () => new Response('forbidden', { status: 403 }));
    await expect(rawRestUpdate('t', {}, { id: 'x' }, opts(fetchImpl))).rejects.toThrow(/403/);
  });
});
