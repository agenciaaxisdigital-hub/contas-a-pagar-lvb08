import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/components/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

const mockFrom = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => null,
  Pie: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

import AdminDashboard from '@/pages/AdminDashboard';

// Chain returns the SAME object for all chained calls (select, order, limit)
const makeChain = (result: any) => {
  const chain: any = {};
  ['select', 'order', 'limit'].forEach(m => { chain[m] = () => chain; });
  chain.then = (res: any, rej: any) => Promise.resolve(result).then(res, rej);
  chain.catch = (fn: any) => Promise.resolve(result).catch(fn);
  return chain;
};

const adminAuth = {
  usuario: { id: 'usr-1', nome: 'Admin', tipo: 'admin' },
  isAdmin: true,
  signOut: vi.fn(),
};

const mockContas = [
  { id: '1', valor: 500, status: 'Paga', categoria: 'Marketing', data_vencimento: '2026-05-01', criado_por: 'usr-1', pago_por: 'usr-1', aprovado_por: 'usr-1', descricao: 'Conta 1', criado_em: '2026-05-01T10:00:00Z' },
  { id: '2', valor: 300, status: 'Lancada', categoria: 'RH', data_vencimento: '2026-04-01', criado_por: 'usr-1', pago_por: null, aprovado_por: null, descricao: 'Conta 2', criado_em: '2026-04-01T10:00:00Z' },
];

const renderPage = () =>
  render(<MemoryRouter><AdminDashboard /></MemoryRouter>);

describe('AdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(adminAuth);
    mockFrom.mockImplementation(() => makeChain({ data: mockContas, error: null }));
  });

  it('renderiza título Dashboard Admin', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Dashboard Admin')).toBeInTheDocument());
  });

  it('exibe card Total lançado', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/total lançado/i)).toBeInTheDocument());
  });

  it('exibe card Total pago', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/total pago/i)).toBeInTheDocument());
  });

  it('exibe card Em aberto', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/em aberto/i)).toBeInTheDocument());
  });

  it('exibe card Vencido', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/vencido/i)).toBeInTheDocument());
  });

  it('exibe acesso restrito para não-admin', () => {
    mockUseAuth.mockReturnValue({ ...adminAuth, isAdmin: false });
    renderPage();
    expect(screen.getByText(/acesso restrito a administradores/i)).toBeInTheDocument();
  });
});
