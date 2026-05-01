import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistedState, clearPersistedState } from '../usePersistedState';

beforeEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('usePersistedState', () => {
  it('returns initial value when storage is empty', () => {
    const { result } = renderHook(() => usePersistedState('k1', 'inicial'));
    expect(result.current[0]).toBe('inicial');
  });

  it('reads value previously persisted on mount', () => {
    sessionStorage.setItem('k2', JSON.stringify('previously-saved'));
    const { result } = renderHook(() => usePersistedState('k2', 'fallback'));
    expect(result.current[0]).toBe('previously-saved');
  });

  it('persists updates to sessionStorage', () => {
    const { result } = renderHook(() => usePersistedState('k3', 0));
    act(() => result.current[1](42));
    expect(result.current[0]).toBe(42);
    expect(JSON.parse(sessionStorage.getItem('k3')!)).toBe(42);
  });

  it('supports updater functions', () => {
    const { result } = renderHook(() => usePersistedState('k4', 1));
    act(() => result.current[1](prev => prev + 5));
    expect(result.current[0]).toBe(6);
    expect(JSON.parse(sessionStorage.getItem('k4')!)).toBe(6);
  });

  it('handles complex objects', () => {
    type Mapping = { title: number; price: number };
    sessionStorage.setItem('k5', JSON.stringify({ title: 0, price: 1 }));
    const { result } = renderHook(() => usePersistedState<Mapping>('k5', { title: -1, price: -1 }));
    expect(result.current[0]).toEqual({ title: 0, price: 1 });
    act(() => result.current[1]({ title: 2, price: 3 }));
    expect(JSON.parse(sessionStorage.getItem('k5')!)).toEqual({ title: 2, price: 3 });
  });

  it('falls back to initial when stored JSON is corrupt', () => {
    sessionStorage.setItem('k6', 'not-json{');
    const { result } = renderHook(() => usePersistedState('k6', 'safe'));
    expect(result.current[0]).toBe('safe');
  });

  it('handles null as a valid persisted value', () => {
    sessionStorage.setItem('k7', JSON.stringify(null));
    const { result } = renderHook(() => usePersistedState<string | null>('k7', 'default'));
    expect(result.current[0]).toBe(null);
  });

  it('does not throw when sessionStorage.setItem fails (quota)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const { result } = renderHook(() => usePersistedState('k8', 'a'));
    expect(() => act(() => result.current[1]('b'))).not.toThrow();
    expect(result.current[0]).toBe('b');
    spy.mockRestore();
  });

  it('uses different keys for different hooks', () => {
    const { result: r1 } = renderHook(() => usePersistedState('keyA', 1));
    const { result: r2 } = renderHook(() => usePersistedState('keyB', 99));
    act(() => r1.current[1](5));
    expect(r2.current[0]).toBe(99);
    expect(JSON.parse(sessionStorage.getItem('keyA')!)).toBe(5);
    expect(sessionStorage.getItem('keyB')).toBe(JSON.stringify(99));
  });
});

describe('clearPersistedState', () => {
  it('removes the key from sessionStorage', () => {
    sessionStorage.setItem('k9', JSON.stringify('value'));
    clearPersistedState('k9');
    expect(sessionStorage.getItem('k9')).toBe(null);
  });

  it('is a no-op when key does not exist', () => {
    expect(() => clearPersistedState('nonexistent')).not.toThrow();
  });
});
