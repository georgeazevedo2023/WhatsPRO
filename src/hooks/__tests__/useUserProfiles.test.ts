import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useUserProfiles } from '../useUserProfiles';

const mockIn = vi.fn();
const mockOrder = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe('useUserProfiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ order: mockOrder });
    mockOrder.mockReturnValue({ in: mockIn });
  });

  it('should fetch all profiles by default', async () => {
    const mockData = [
      { id: 'u-1', full_name: 'Alice', email: 'alice@test.com', avatar_url: null },
      { id: 'u-2', full_name: 'Bob', email: 'bob@test.com', avatar_url: null },
    ];
    mockOrder.mockResolvedValue({ data: mockData, error: null });

    const { result } = renderHook(() => useUserProfiles());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profiles).toEqual(mockData);
    expect(result.current.profilesMap['u-1']?.full_name).toBe('Alice');
    expect(result.current.namesMap['u-2']).toBe('Bob');
  });

  it('should filter by userIds', async () => {
    const mockData = [{ id: 'u-1', full_name: 'Alice', email: 'alice@test.com', avatar_url: null }];
    mockIn.mockResolvedValue({ data: mockData, error: null });

    const { result } = renderHook(() => useUserProfiles({ userIds: ['u-1'] }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockIn).toHaveBeenCalledWith('id', ['u-1']);
    expect(result.current.profiles).toEqual(mockData);
  });

  it('should return empty for empty userIds array', async () => {
    const { result } = renderHook(() => useUserProfiles({ userIds: [] }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(result.current.profiles).toEqual([]);
  });

  it('should build namesMap excluding null names', async () => {
    const mockData = [
      { id: 'u-1', full_name: null, email: 'no-name@test.com', avatar_url: null },
      { id: 'u-2', full_name: 'Bob', email: 'bob@test.com', avatar_url: null },
    ];
    mockOrder.mockResolvedValue({ data: mockData, error: null });

    const { result } = renderHook(() => useUserProfiles());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.namesMap).toEqual({ 'u-2': 'Bob' });
    expect(result.current.namesMap['u-1']).toBeUndefined();
  });
});
