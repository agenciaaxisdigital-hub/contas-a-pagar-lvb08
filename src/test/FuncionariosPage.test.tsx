import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/components/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/lib/dexieDb', () => ({ db: {} }));
vi.mock('@/lib/offlineStore', () => ({
  fetchAndCacheContas: vi.fn().mockResolvedValue([]),
  getLocalContas: vi.fn().mockResolvedValue([]),
  hasLocalData: vi.fn().mockResolvedValue(false),
  getMonthKey: vi.fn().mockReturnValue('2026-05'),
  addSyncOperation: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockFrom = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));

vi.mock('@/contexts/EmpresaContext', () => {
  // Stable reference — prevents useEffect from re-running on every render.
  const empresaAtiva = { id: 'e1', nome: 'Empresa A' };
  return { useEmpresa: () => ({ empresaAtiva }) };
});

import FuncionariosPage from '@/pages/rh/FuncionariosPage';

// Plain functions (no vi.fn inside) so vi.clearAllMocks() cannot break the chain.
const makeChain = (result: any): any => ({
  select: () => makeChain(result),
  eq: () => makeChain(result),
  gte: () => Promise.resolve(result),
  lte: () => Promise.resolve(result),
  order: () => Promise.resolve(result),
  then: (onfulfilled: any, onrejected?: any) => Promise.resolve(result).then(onfulfilled, onrejected),
  catch: (onrejected: any) => Promise.resolve(result).catch(onrejected),
});

const funcionarios = [
  { id: 'f1', nome: 'Ana Silva', cargo: 'Recepcionista', salario: 2500, data_admissao: '2024-01-01', ativo: true },
  { id: 'f2', nome: 'Bruno Costa', cargo: 'Assistente', salario: 2000, data_admissao: '2023-06-01', ativo: false },
];

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <FuncionariosPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('FuncionariosPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'funcionarios') return makeChain({ data: funcionarios, error: null });
      return makeChain({ data: [], error: null });
    });
  });

  it('exibe lista de funcionários ativos por padrão', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Ana Silva')).toBeInTheDocument());
    // Bruno Costa is inactive — hidden by the default "Ativos" filter
    expect(screen.queryByText('Bruno Costa')).toBeNull();
  });

  it('exibe cargo e salário formatado', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Recepcionista')).toBeInTheDocument();
      expect(screen.getByText(/R\$\s*2\.500/)).toBeInTheDocument();
    });
  });

  it('exibe badge Pendente para ativo sem pagamento no mês', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Pendente')).toBeInTheDocument();
    });
  });

  it('exibe badge Inativo ao filtrar por Inativos', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Ana Silva'));
    fireEvent.click(screen.getByText('Inativos'));
    await waitFor(() => expect(screen.getByText('Inativo')).toBeInTheDocument());
  });

  it('filtra por busca de nome', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Ana Silva'));
    // Switch to "Todos" so Bruno Costa (inactive) is also visible
    fireEvent.click(screen.getByText('Todos'));
    await waitFor(() => screen.getByText('Bruno Costa'));
    fireEvent.change(screen.getByPlaceholderText('Buscar por nome...'), {
      target: { value: 'Bruno' },
    });
    expect(screen.queryByText('Ana Silva')).toBeNull();
    expect(screen.getByText('Bruno Costa')).toBeInTheDocument();
  });

  it('filtra apenas inativos', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Ana Silva'));
    fireEvent.click(screen.getByText('Inativos'));
    await waitFor(() => {
      expect(screen.queryByText('Ana Silva')).toBeNull();
      expect(screen.getByText('Bruno Costa')).toBeInTheDocument();
    });
  });

  it('exibe estado vazio quando não há funcionários', async () => {
    mockFrom.mockReturnValue(makeChain({ data: [], error: null }));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Nenhum funcionário encontrado')).toBeInTheDocument(),
    );
  });

  it('navega para /rh/funcionarios/novo ao clicar em Novo', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Novo'));
    fireEvent.click(screen.getByText('Novo'));
    expect(mockNavigate).toHaveBeenCalledWith('/rh/funcionarios/novo');
  });
});
