import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDepartments } from '../useDepartments';

const mockIn = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe('useDepartments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ order: mockOrder });
    mockOrder.mockReturnValue({ eq: mockEq, in: mockIn });
  });

  it('should return empty when no inboxId provided', async () => {
    const { result } = renderHook(() => useDepartments());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.departments).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('should fetch departments for a single inbox', async () => {
    const mockData = [
      { id: 'dept-1', name: 'Sales', inbox_id: 'inbox-1' },
      { id: 'dept-2', name: 'Support', inbox_id: 'inbox-1' },
    ];
    mockEq.mockResolvedValue({ data: mockData, error: null });

    const { result } = renderHook(() => useDepartments({ inboxId: 'inbox-1' }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockEq).toHaveBeenCalledWith('inbox_id', 'inbox-1');
    expect(result.current.departments).toEqual(mockData);
  });

  it('should fetch departments for multiple inboxes', async () => {
    const mockData = [
      { id: 'dept-1', name: 'Sales', inbox_id: 'inbox-1' },
      { id: 'dept-2', name: 'Support', inbox_id: 'inbox-2' },
    ];
    mockIn.mockResolvedValue({ data: mockData, error: null });

    const { result } = renderHook(() =>
      useDepartments({ inboxIds: ['inbox-1', 'inbox-2'] })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockIn).toHaveBeenCalledWith('inbox_id', ['inbox-1', 'inbox-2']);
    expect(result.current.departmentsByInbox).toEqual({
      'inbox-1': [{ id: 'dept-1', name: 'Sales', inbox_id: 'inbox-1' }],
      'inbox-2': [{ id: 'dept-2', name: 'Support', inbox_id: 'inbox-2' }],
    });
  });

  it('should not fetch when disabled', async () => {
    const { result } = renderHook(() =>
      useDepartments({ enabled: false, inboxId: 'inbox-1' })
    );

    expect(mockFrom).not.toHaveBeenCalled();
    expect(result.current.departments).toEqual([]);
  });
});
