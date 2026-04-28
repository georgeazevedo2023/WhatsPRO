import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUiMode } from '../useUiMode';

describe('useUiMode', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('retorna "simple" como default quando localStorage está vazio', () => {
    const { result } = renderHook(() => useUiMode());
    expect(result.current[0]).toBe('simple');
  });

  it('persiste mudança em localStorage', () => {
    const { result } = renderHook(() => useUiMode());
    act(() => {
      result.current[1]('advanced');
    });
    expect(result.current[0]).toBe('advanced');
    expect(localStorage.getItem('qualif-ui-mode')).toBe('advanced');
  });

  it('lê o valor do localStorage no mount', () => {
    localStorage.setItem('qualif-ui-mode', 'advanced');
    const { result } = renderHook(() => useUiMode());
    expect(result.current[0]).toBe('advanced');
  });

  it('ignora valores inválidos no localStorage e usa default', () => {
    localStorage.setItem('qualif-ui-mode', 'invalid_mode');
    const { result } = renderHook(() => useUiMode());
    expect(result.current[0]).toBe('simple');
  });

  it('alterna entre simple e advanced', () => {
    const { result } = renderHook(() => useUiMode());
    act(() => result.current[1]('advanced'));
    expect(result.current[0]).toBe('advanced');
    act(() => result.current[1]('simple'));
    expect(result.current[0]).toBe('simple');
  });
});
