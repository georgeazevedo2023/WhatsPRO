// Smoke tests for the 9 Admin* pages — gate redirect when !isSuperAdmin.
// Sprint 1.5 da auditoria-admin-2026-05-04. Cobertura mínima viável.
import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import AdminPanel from '@/pages/dashboard/AdminPanel';
import AdminInboxes from '@/pages/dashboard/AdminInboxes';
import AdminUsers from '@/pages/dashboard/AdminUsers';
import AdminDepartments from '@/pages/dashboard/AdminDepartments';
import AdminSecrets from '@/pages/dashboard/AdminSecrets';
import AdminDocs from '@/pages/dashboard/AdminDocs';
import AdminRoadmap from '@/pages/dashboard/AdminRoadmap';
import AdminBackup from '@/pages/dashboard/AdminBackup';
import AdminRetention from '@/pages/dashboard/AdminRetention';

const mockUseAuth = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// Stub Navigate so the test only checks intent without engaging the router.
vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate">{to}</div>,
}));

// Heavy children — replaced with no-ops to avoid pulling unrelated dependencies.
vi.mock('@/components/admin/InboxesTab', () => ({ default: () => null }));
vi.mock('@/components/admin/UsersTab', () => ({ default: () => null }));
vi.mock('@/components/admin/SecretsTab', () => ({ default: () => null }));
vi.mock('@/components/admin/DocumentationTab', () => ({ default: () => null }));
vi.mock('@/components/admin/RoadmapTab', () => ({ default: () => null }));
vi.mock('@/components/dashboard/BackupModule', () => ({ default: () => null }));
vi.mock('@/components/dashboard/DepartmentsTab', () => ({ default: () => null }));

// AdminRetention has hooks that fire BEFORE the gate (audit C4 — ex-critical, now medium).
// Mock supabase + edge client so the early useEffect call is silent.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    })),
  },
}));
vi.mock('@/lib/edgeFunctionClient', () => ({
  edgeFunctionFetch: vi.fn(),
}));
vi.mock('@/lib/errorUtils', () => ({
  handleError: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function renderWithQuery(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

interface PageCase {
  name: string;
  Page: () => ReactElement;
  // AdminPanel always redirects (even for super_admin) — different expectation.
  alwaysRedirects?: boolean;
}

const PAGES: PageCase[] = [
  { name: 'AdminPanel',       Page: AdminPanel,       alwaysRedirects: true },
  { name: 'AdminInboxes',     Page: AdminInboxes },
  { name: 'AdminUsers',       Page: AdminUsers },
  { name: 'AdminDepartments', Page: AdminDepartments },
  { name: 'AdminSecrets',     Page: AdminSecrets },
  { name: 'AdminDocs',        Page: AdminDocs },
  { name: 'AdminRoadmap',     Page: AdminRoadmap },
  { name: 'AdminBackup',      Page: AdminBackup },
  { name: 'AdminRetention',   Page: AdminRetention },
];

describe('Admin pages — gate behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('redirects when !isSuperAdmin', () => {
    for (const { name, Page } of PAGES) {
      it(`${name} redirects to /dashboard`, () => {
        mockUseAuth.mockReturnValue({ isSuperAdmin: false, loading: false });
        renderWithQuery(<Page />);
        expect(screen.getByTestId('navigate')).toHaveTextContent('/dashboard');
      });
    }
  });

  describe('does NOT redirect when isSuperAdmin', () => {
    for (const { name, Page, alwaysRedirects } of PAGES) {
      if (alwaysRedirects) {
        it(`${name} still redirects (panel root → first sub-page)`, () => {
          mockUseAuth.mockReturnValue({ isSuperAdmin: true, loading: false });
          renderWithQuery(<Page />);
          expect(screen.getByTestId('navigate')).toHaveTextContent('/dashboard/admin/inboxes');
        });
      } else {
        it(`${name} renders content for super_admin`, () => {
          mockUseAuth.mockReturnValue({ isSuperAdmin: true, loading: false });
          renderWithQuery(<Page />);
          expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
        });
      }
    }
  });
});
