import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---- mocks ----------------------------------------------------------------
vi.mock('@/components/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/hooks/useNotifications', () => ({ useNotifications: vi.fn() }));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }));

const mockFrom = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));
// ---------------------------------------------------------------------------

import DashboardPage from '@/pages/DashboardPage';

const makeChain = (result: any) => {
  const chain: any = {
    select: vi.fn(() => chain),
    order: vi.fn(() => Promise.resolve(result)),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
  };
  return chain;
};

const adminUser = {
  user: { id: 'u1' } as any,
  usuario: { id: 'usr-1', auth_user_id: 'u1', nome: 'Admin', tipo: 'admin' },
  loading: false,
  isAdmin: true,
  signInByNome: vi.fn(),
  signOut: vi.fn(),
};

const renderDashboard = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue(makeChain({ data: [], error: null }));
  });

  it('renderiza saudação com nome do usuário', async () => {
    mockUseAuth.mockReturnValue(adminUser);
    renderDashboard();
    await waitFor(() => {
      const heading = screen.getByText(/Olá,/);
      expect(heading).toBeInTheDocument();
      expect(heading.textContent).toContain('Admin');
    });
  });

  it('renderiza as 3 abas de resumo (A pagar, Vencidas, Pago)', async () => {
    mockUseAuth.mockReturnValue(adminUser);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('A pagar')).toBeInTheDocument();
      expect(screen.getByText('Vencidas')).toBeInTheDocument();
      expect(screen.getByText('Pago')).toBeInTheDocument();
    });
  });

  it('renderiza seletor de mês', async () => {
    mockUseAuth.mockReturnValue(adminUser);
    renderDashboard();
    await waitFor(() => expect(screen.getByText(/abril 2026/i)).toBeInTheDocument());
  });

  it('estado vazio exibe mensagem', async () => {
    mockUseAuth.mockReturnValue(adminUser);
    renderDashboard();
    await waitFor(() =>
      expect(screen.getByText(/Tudo em dia/i)).toBeInTheDocument(),
    );
  });
});
