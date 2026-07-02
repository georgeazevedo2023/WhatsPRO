import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createVisibleDebouncedRefetch } from './broadcastRefetch';

describe('createVisibleDebouncedRefetch', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('dispara UM refetch após a janela, mesmo com rajada de eventos', () => {
    const refetch = vi.fn();
    const r = createVisibleDebouncedRefetch(refetch, 10_000, () => true);
    r.trigger();
    r.trigger();
    r.trigger();
    expect(refetch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_000);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('nova janela após o disparo aceita novo evento', () => {
    const refetch = vi.fn();
    const r = createVisibleDebouncedRefetch(refetch, 10_000, () => true);
    r.trigger();
    vi.advanceTimersByTime(10_000);
    r.trigger();
    vi.advanceTimersByTime(10_000);
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it('ignora eventos com a aba oculta (0 refetch)', () => {
    const refetch = vi.fn();
    const r = createVisibleDebouncedRefetch(refetch, 10_000, () => false);
    r.trigger();
    vi.advanceTimersByTime(60_000);
    expect(refetch).not.toHaveBeenCalled();
  });

  it('aba ficou oculta DEPOIS de agendar → não dispara (re-sincroniza no focus)', () => {
    const refetch = vi.fn();
    let visible = true;
    const r = createVisibleDebouncedRefetch(refetch, 10_000, () => visible);
    r.trigger();
    visible = false;
    vi.advanceTimersByTime(10_000);
    expect(refetch).not.toHaveBeenCalled();
  });

  it('cancel() desarma o refetch pendente (cleanup do effect)', () => {
    const refetch = vi.fn();
    const r = createVisibleDebouncedRefetch(refetch, 10_000, () => true);
    r.trigger();
    r.cancel();
    vi.advanceTimersByTime(60_000);
    expect(refetch).not.toHaveBeenCalled();
  });
});
