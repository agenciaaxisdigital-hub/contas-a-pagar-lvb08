import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockSetEmpresaAtiva = vi.fn();
const mockUseEmpresa = vi.fn();

vi.mock('@/contexts/EmpresaContext', () => ({
  useEmpresa: () => mockUseEmpresa(),
}));

vi.mock('@/components/NovaEmpresaDialog', () => ({
  NovaEmpresaDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import CompanySelectorPage from '@/pages/CompanySelectorPage';

const empresaA = { id: 'e1', nome: 'Empresa A', cnpj: '00.000.000/0001-00', logo_url: null, criado_em: '' };
const empresaB = { id: 'e2', nome: 'Empresa B', cnpj: null, logo_url: null, criado_em: '' };

describe('CompanySelectorPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exibe cards de empresas', async () => {
    mockUseEmpresa.mockReturnValue({
      empresas: [empresaA, empresaB],
      loading: false,
      setEmpresaAtiva: mockSetEmpresaAtiva,
    });
    render(<MemoryRouter><CompanySelectorPage /></MemoryRouter>);
    expect(screen.getByText('Empresa A')).toBeInTheDocument();
    expect(screen.getByText('Empresa B')).toBeInTheDocument();
  });

  it('exibe CNPJ quando disponível', () => {
    mockUseEmpresa.mockReturnValue({
      empresas: [empresaA],
      loading: false,
      setEmpresaAtiva: mockSetEmpresaAtiva,
    });
    render(<MemoryRouter><CompanySelectorPage /></MemoryRouter>);
    expect(screen.getByText('00.000.000/0001-00')).toBeInTheDocument();
  });

  it('exibe botão Nova Empresa', () => {
    mockUseEmpresa.mockReturnValue({ empresas: [empresaA, empresaB], loading: false, setEmpresaAtiva: mockSetEmpresaAtiva });
    render(<MemoryRouter><CompanySelectorPage /></MemoryRouter>);
    expect(screen.getByText('Nova Empresa')).toBeInTheDocument();
  });

  it('auto-redireciona para / quando há exatamente 1 empresa', async () => {
    mockUseEmpresa.mockReturnValue({
      empresas: [empresaA],
      loading: false,
      setEmpresaAtiva: mockSetEmpresaAtiva,
    });
    render(<MemoryRouter><CompanySelectorPage /></MemoryRouter>);
    await waitFor(() => {
      expect(mockSetEmpresaAtiva).toHaveBeenCalledWith(empresaA);
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('seleciona empresa e navega ao clicar no card', async () => {
    mockUseEmpresa.mockReturnValue({
      empresas: [empresaA, empresaB],
      loading: false,
      setEmpresaAtiva: mockSetEmpresaAtiva,
    });
    render(<MemoryRouter><CompanySelectorPage /></MemoryRouter>);
    fireEvent.click(screen.getByText('Empresa A').closest('button')!);
    expect(mockSetEmpresaAtiva).toHaveBeenCalledWith(empresaA);
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('exibe spinner durante loading', () => {
    mockUseEmpresa.mockReturnValue({ empresas: [], loading: true, setEmpresaAtiva: mockSetEmpresaAtiva });
    render(<MemoryRouter><CompanySelectorPage /></MemoryRouter>);
    expect(screen.queryByText('Selecione uma empresa')).toBeNull();
  });

  it('exibe inicial do nome quando empresa não tem logo', () => {
    mockUseEmpresa.mockReturnValue({ empresas: [empresaA], loading: false, setEmpresaAtiva: mockSetEmpresaAtiva });
    render(<MemoryRouter><CompanySelectorPage /></MemoryRouter>);
    expect(screen.getByText('E')).toBeInTheDocument();
  });
});
