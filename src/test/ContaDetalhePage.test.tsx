import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---- mocks ----------------------------------------------------------------
vi.mock('@/components/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() }, Toaster: () => null }));
vi.mock('@/components/FileUpload', () => ({
  default: () => <div data-testid="file-upload" />,
}));
vi.mock('@/components/UserSelect', () => ({
  default: () => <div data-testid="user-select" />,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'conta-id-001' }),
  };
});

const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }));

const mockFrom = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));
// ---------------------------------------------------------------------------

import ContaDetalhePage from '@/pages/ContaDetalhePage';
import { toast } from 'sonner';

const adminAuth = {
  user: { id: 'u1' } as any,
  usuario: { id: 'usr-admin', auth_user_id: 'u1', nome: 'Admin', tipo: 'admin' },
  loading: false,
  isAdmin: true,
  signInByNome: vi.fn(),
  signOut: vi.fn(),
};

const regularAuth = { ...adminAuth, isAdmin: false };

const mockLogs = [
  {
    id: 'log-1', acao: 'CRIADA', status_anterior: null, status_novo: 'Lancada',
    observacao: null, criado_em: '2026-03-01T10:00:00Z', usuario_id: 'usr-1',
  },
];

const buildConta = (status: string) => ({
  id: 'conta-id-001', descricao: 'Impressão de panfletos', categoria: 'Material gráfico',
  valor: 1200, data_vencimento: '2026-04-15', data_emissao: null, status,
  motivo: 'Necessário para campanha no bairro X', observacoes: null, comprovante_url: null,
  criado_em: '2026-03-10T08:00:00Z', criado_por: 'usr-1', aprovado_por: null,
  pago_por: null, data_pagamento: null, forma_pagamento: null, atualizado_em: null,
  chave_pix: null, recorrente: false, dia_vencimento_recorrente: null,
  fornecedor_id: null, fornecedor_nome_livre: null, subcategoria: null,
});

const setupFrom = (status: string) => {
  const conta = buildConta(status);
  const contaChain: any = {
    select: vi.fn(() => contaChain),
    eq: vi.fn(() => contaChain),
    order: vi.fn(() => Promise.resolve({ data: mockLogs, error: null })),
    single: vi.fn(() => Promise.resolve({ data: conta, error: null })),
    update: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  };
  const logChain: any = {
    select: vi.fn(() => logChain),
    eq: vi.fn(() => logChain),
    order: vi.fn(() => Promise.resolve({ data: mockLogs, error: null })),
    insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
  };
  const usuariosChain: any = {
    select: vi.fn(() => Promise.resolve({ data: [{ id: 'usr-1', nome: 'João' }, { id: 'usr-admin', nome: 'Admin' }], error: null })),
  };
  mockFrom.mockImplementation((table: string) => {
    if (table === 'contas_pagar') return contaChain;
    if (table === 'usuarios') return usuariosChain;
    return logChain;
  });
  return { contaChain, logChain };
};

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/conta/conta-id-001']}>
        <ContaDetalhePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('ContaDetalhePage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renderiza a descrição da conta', async () => {
    mockUseAuth.mockReturnValue(adminAuth);
    setupFrom('Lancada');
    renderPage();
    await waitFor(() =>
      expect(screen.getAllByText('Impressão de panfletos').length).toBeGreaterThan(0),
    );
  });

  it('renderiza o valor formatado', async () => {
    mockUseAuth.mockReturnValue(adminAuth);
    setupFrom('Lancada');
    renderPage();
    await waitFor(() =>
      expect(screen.getAllByText(/R\$\s*1\.200/)[0]).toBeInTheDocument(),
    );
  });

  it('renderiza step "Registrada" na barra de progresso', async () => {
    mockUseAuth.mockReturnValue(adminAuth);
    setupFrom('Lancada');
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Registrada')).toBeInTheDocument(),
    );
  });

  it('renderiza o motivo da despesa', async () => {
    mockUseAuth.mockReturnValue(adminAuth);
    setupFrom('Lancada');
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Necessário para campanha no bairro X')).toBeInTheDocument(),
    );
  });

  it('admin com status Lancada vê seção "Registrar pagamento"', async () => {
    mockUseAuth.mockReturnValue(adminAuth);
    setupFrom('Lancada');
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Registrar pagamento/)).toBeInTheDocument(),
    );
  });

  it('admin com status Lancada vê botão "Confirmar pagamento"', async () => {
    mockUseAuth.mockReturnValue(adminAuth);
    setupFrom('Lancada');
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /confirmar pagamento/i })).toBeInTheDocument(),
    );
  });

  it('admin com status Lancada vê botão "Cancelar conta"', async () => {
    mockUseAuth.mockReturnValue(adminAuth);
    setupFrom('Lancada');
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /cancelar conta/i })).toBeInTheDocument(),
    );
  });

  it('admin com status Paga NÃO vê botões de ação', async () => {
    mockUseAuth.mockReturnValue(adminAuth);
    setupFrom('Paga');
    renderPage();
    await waitFor(() => expect(screen.getByText('Paga')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /confirmar pagamento/i })).not.toBeInTheDocument();
  });

  it('usuário comum NÃO vê seção de ações', async () => {
    mockUseAuth.mockReturnValue(regularAuth);
    setupFrom('Lancada');
    renderPage();
    await waitFor(() => expect(screen.getByText('Registrada')).toBeInTheDocument());
    expect(screen.queryByText(/Registrar pagamento/)).not.toBeInTheDocument();
  });

  it('renderiza o histórico de logs', async () => {
    mockUseAuth.mockReturnValue(adminAuth);
    setupFrom('Lancada');
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/Conta registrada/)).toBeInTheDocument(),
    );
  });

  it('botão voltar navega de volta', async () => {
    mockUseAuth.mockReturnValue(adminAuth);
    setupFrom('Lancada');
    renderPage();
    await waitFor(() => expect(screen.getByText('Registrada')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Voltar'));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
