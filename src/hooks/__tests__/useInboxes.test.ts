import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useInboxes } from '../useInboxes';

const mockOrder = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe('useInboxes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ order: mockOrder });
  });

  it('should fetch inboxes on mount', async () => {
    const mockData = [
      { id: 'inbox-1', name: 'Inbox 1', instance_id: 'inst-1' },
      { id: 'inbox-2', name: 'Inbox 2', instance_id: 'inst-2' },
    ];
    mockOrder.mockResolvedValue({ data: mockData, error: null });

    const { result } = renderHook(() => useInboxes());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalledWith('inboxes');
    expect(result.current.inboxes).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  it('should not fetch when disabled', async () => {
    const { result } = renderHook(() => useInboxes({ enabled: false }));

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('should handle query errors', async () => {
    const err = new Error('DB error');
    mockOrder.mockResolvedValue({ data: null, error: err });

    const { result } = renderHook(() => useInboxes());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe(err);
    expect(result.current.inboxes).toEqual([]);
  });
});
