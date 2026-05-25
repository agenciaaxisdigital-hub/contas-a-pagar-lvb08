import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/components/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockInsert = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({ insert: mockInsert }),
  },
}));

vi.mock('@/contexts/EmpresaContext', () => ({
  useEmpresa: () => ({ empresaAtiva: { id: 'e1', nome: 'Empresa A' } }),
}));

import NovoFuncionarioPage from '@/pages/rh/NovoFuncionarioPage';
import { toast } from 'sonner';

const renderPage = () =>
  render(<MemoryRouter><NovoFuncionarioPage /></MemoryRouter>);

describe('NovoFuncionarioPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
  });

  it('renderiza campos obrigatórios', () => {
    renderPage();
    expect(screen.getByText('Nome *')).toBeInTheDocument();
    expect(screen.getByText('Cargo *')).toBeInTheDocument();
    expect(screen.getByText('Salário (R$) *')).toBeInTheDocument();
    expect(screen.getByText('Data Admissão *')).toBeInTheDocument();
  });

  it('renderiza campos opcionais', () => {
    renderPage();
    expect(screen.getByText('CPF')).toBeInTheDocument();
    expect(screen.getByText('PIX')).toBeInTheDocument();
    expect(screen.getByText('Banco')).toBeInTheDocument();
    expect(screen.getByText('Agência')).toBeInTheDocument();
    expect(screen.getByText('Conta')).toBeInTheDocument();
  });

  it('exibe erros de validação ao submeter vazio', async () => {
    renderPage();
    fireEvent.click(screen.getByText('Cadastrar Funcionário'));
    await waitFor(() => {
      expect(screen.getByText('Nome obrigatório')).toBeInTheDocument();
      expect(screen.getByText('Cargo obrigatório')).toBeInTheDocument();
    });
  });

  const fillValidForm = (container: HTMLElement) => {
    fireEvent.change(screen.getByPlaceholderText('Nome completo'), { target: { value: 'Maria Santos' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: Assistente'), { target: { value: 'Dentista' } });
    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '5000' } });
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2024-01-15' } });
  };

  it('submete com dados válidos e navega para lista', async () => {
    const { container } = renderPage();
    fillValidForm(container);
    fireEvent.click(screen.getByText('Cadastrar Funcionário'));
    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        nome: 'Maria Santos',
        cargo: 'Dentista',
        salario: 5000,
        empresa_id: 'e1',
      }));
      expect(mockNavigate).toHaveBeenCalledWith('/rh/funcionarios');
    });
  });

  it('exibe toast de erro quando insert falha', async () => {
    mockInsert.mockResolvedValue({ error: { message: 'DB error' } });
    const { container } = renderPage();
    fillValidForm(container);
    fireEvent.click(screen.getByText('Cadastrar Funcionário'));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});
