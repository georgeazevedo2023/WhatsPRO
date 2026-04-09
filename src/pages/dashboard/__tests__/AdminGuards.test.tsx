import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import Settings from '@/pages/dashboard/Settings';
import UsersManagement from '@/pages/dashboard/UsersManagement';

const mockUseAuth = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(),
      })),
    })),
  },
}));

vi.mock('@/hooks/useInboxes', () => ({
  useInboxes: () => ({ inboxes: [] }),
}));

vi.mock('@/hooks/useInstances', () => ({
  useInstances: () => ({ instances: [] }),
}));

vi.mock('@/lib/edgeFunctionClient', () => ({
  edgeFunctionFetch: vi.fn(),
}));

vi.mock('@/lib/errorUtils', () => ({
  handleError: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/components/dashboard/ManageUserInstancesDialog', () => ({
  default: () => null,
}));

vi.mock('@/lib/phoneUtils', () => ({
  formatPhone: (value: string | null) => value ?? '',
}));

vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate">{to}</div>,
}));

function renderWithQuery(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>,
  );
}

describe('admin guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps Settings on loading state while auth is unresolved', () => {
    mockUseAuth.mockReturnValue({
      isSuperAdmin: false,
      user: null,
      loading: true,
    });

    renderWithQuery(<Settings />);

    expect(screen.getByText(/Carregando configura/i)).toBeInTheDocument();
    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
  });

  it('redirects Settings only after auth resolves without admin access', () => {
    mockUseAuth.mockReturnValue({
      isSuperAdmin: false,
      user: null,
      loading: false,
    });

    renderWithQuery(<Settings />);

    expect(screen.getByTestId('navigate')).toHaveTextContent('/dashboard');
  });

  it('keeps UsersManagement on loading state while auth is unresolved', () => {
    mockUseAuth.mockReturnValue({
      isSuperAdmin: false,
      loading: true,
    });

    render(<UsersManagement />);

    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
    expect(screen.queryByText(/Usuários/i)).not.toBeInTheDocument();
  });

  it('redirects UsersManagement only after auth resolves without admin access', () => {
    mockUseAuth.mockReturnValue({
      isSuperAdmin: false,
      loading: false,
    });

    render(<UsersManagement />);

    expect(screen.getByTestId('navigate')).toHaveTextContent('/dashboard');
  });
});
