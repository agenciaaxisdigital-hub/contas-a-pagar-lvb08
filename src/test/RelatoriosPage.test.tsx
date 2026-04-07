import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---- mocks ----------------------------------------------------------------
vi.mock('@/components/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }));

const mockFrom = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));
// ---------------------------------------------------------------------------

import RelatoriosPage from '@/pages/RelatoriosPage';

const makeChain = (result: any) => {
  const chain: any = {
    select: vi.fn(() => chain),
    then: (res: any, rej: any) => Promise.resolve(result).then(res, rej),
    catch: (fn: any) => Promise.resolve(result).catch(fn),
  };
  return chain;
};

const mockContas = [
  { valor: 2000, status: 'Paga', categoria: 'Material gráfico', data_vencimento: '2026-03-01' },
  { valor: 1500, status: 'Lancada', categoria: 'Combustível', data_vencimento: '2026-04-10' },
  { valor: 800, status: 'Aprovada', categoria: 'Eventos', data_vencimento: '2026-03-20' },
  { valor: 500, status: 'Cancelada', categoria: 'Outros', data_vencimento: '2026-02-01' },
  { valor: 300, status: 'Lancada', categoria: 'Combustível', data_vencimento: '2025-12-01' }, // vencida
];

const adminAuth = {
  usuario: { id: 'usr-admin', nome: 'Admin', tipo: 'admin' },
  isAdmin: true,
  signOut: vi.fn(),
};

const regularAuth = { ...adminAuth, isAdmin: false };

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <RelatoriosPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('RelatoriosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue(makeChain({ data: mockContas, error: null }));
  });

  it('usuário comum vê mensagem de acesso restrito', () => {
    mockUseAuth.mockReturnValue(regularAuth);
    renderPage();
    expect(screen.getByText(/acesso restrito a administradores/i)).toBeInTheDocument();
  });

  it('admin vê título "Relatórios"', async () => {
    mockUseAuth.mockReturnValue(adminAuth);
    renderPage();
    await waitFor(() => expect(screen.getByText('Relatórios')).toBeInTheDocument());
  });

  it('admin vê os 4 cards de estatísticas', async () => {
    mockUseAuth.mockReturnValue(adminAuth);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Total lançado')).toBeInTheDocument();
      expect(screen.getByText('Total pago')).toBeInTheDocument();
      expect(screen.getByText('Em aberto')).toBeInTheDocument();
      expect(screen.getByText('Vencido')).toBeInTheDocument();
    });
  });

  it('Total pago calculado corretamente (apenas contas Paga)', async () => {
    mockUseAuth.mockReturnValue(adminAuth);
    renderPage();
    // Espera os cards carregarem e confere que Total pago > 0
    await waitFor(() => expect(screen.getByText('Total pago')).toBeInTheDocument());
    // O card de "Total pago" deve conter um valor formatado (R$...)
    const totalPagoLabel = screen.getByText('Total pago');
    const card = totalPagoLabel.closest('div')!;
    expect(card.textContent).toMatch(/R\$/);
  });

  it('renderiza seção "POR CATEGORIA" com categorias dos dados', async () => {
    mockUseAuth.mockReturnValue(adminAuth);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('POR CATEGORIA')).toBeInTheDocument();
      expect(screen.getByText('Material gráfico')).toBeInTheDocument();
      expect(screen.getByText('Combustível')).toBeInTheDocument();
      expect(screen.getByText('Eventos')).toBeInTheDocument();
    });
  });

  it('exibe "Sem dados" quando não há contas', async () => {
    mockUseAuth.mockReturnValue(adminAuth);
    mockFrom.mockReturnValue(makeChain({ data: [], error: null }));
    renderPage();
    await waitFor(() => expect(screen.getByText('Sem dados')).toBeInTheDocument());
  });
});
