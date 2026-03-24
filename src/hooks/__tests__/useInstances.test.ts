import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useInstances } from '../useInstances';

// Mock Supabase client
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe('useInstances', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ order: mockOrder });
    mockOrder.mockReturnValue({ eq: mockEq });
  });

  it('should fetch instances on mount', async () => {
    const mockData = [
      { id: 'inst-1', name: 'Instance 1', status: 'connected', disabled: false },
      { id: 'inst-2', name: 'Instance 2', status: 'disconnected', disabled: false },
    ];
    mockEq.mockResolvedValue({ data: mockData, error: null });

    const { result } = renderHook(() => useInstances());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalledWith('instances');
    expect(result.current.instances).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  it('should not fetch when enabled is false', async () => {
    const { result } = renderHook(() => useInstances({ enabled: false }));

    // Give it a tick
    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    const mockError = new Error('Network error');
    mockEq.mockResolvedValue({ data: null, error: mockError });

    const { result } = renderHook(() => useInstances());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe(mockError);
    expect(result.current.instances).toEqual([]);
  });

  it('should exclude disabled instances by default', async () => {
    mockEq.mockResolvedValue({ data: [], error: null });

    renderHook(() => useInstances());

    await waitFor(() => {
      expect(mockEq).toHaveBeenCalledWith('disabled', false);
    });
  });

  it('should include disabled instances when excludeDisabled is false', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });

    renderHook(() => useInstances({ excludeDisabled: false }));

    await waitFor(() => {
      expect(mockOrder).toHaveBeenCalled();
    });

    expect(mockEq).not.toHaveBeenCalled();
  });
});
