import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---- mocks ----------------------------------------------------------------
vi.mock('@/components/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockSignOut = vi.fn();
const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }));
// ---------------------------------------------------------------------------

import PerfilPage from '@/pages/PerfilPage';

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <PerfilPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('PerfilPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renderiza o nome do usuário', () => {
    mockUseAuth.mockReturnValue({
      usuario: { id: 'abcdefgh-1234', nome: 'Fernanda', tipo: 'admin' },
      signOut: mockSignOut,
    });
    renderPage();
    expect(screen.getByText('Fernanda')).toBeInTheDocument();
  });

  it('admin exibe label "Administrador Financeiro"', () => {
    mockUseAuth.mockReturnValue({
      usuario: { id: 'abcdefgh-1234', nome: 'Fernanda', tipo: 'admin' },
      signOut: mockSignOut,
    });
    renderPage();
    expect(screen.getByText('Administrador Financeiro')).toBeInTheDocument();
  });

  it('usuário comum exibe label "Lançador"', () => {
    mockUseAuth.mockReturnValue({
      usuario: { id: 'xyz-5678', nome: 'João', tipo: 'lancador' },
      signOut: mockSignOut,
    });
    renderPage();
    expect(screen.getByText('Lançador')).toBeInTheDocument();
  });

  it('renderiza o ID truncado do usuário', () => {
    mockUseAuth.mockReturnValue({
      usuario: { id: 'abc12345-rest', nome: 'Maria', tipo: 'lancador' },
      signOut: mockSignOut,
    });
    renderPage();
    expect(screen.getByText(/abc12345/)).toBeInTheDocument();
  });

  it('renderiza o botão Sair', () => {
    mockUseAuth.mockReturnValue({
      usuario: { id: 'u1', nome: 'Admin', tipo: 'admin' },
      signOut: mockSignOut,
    });
    renderPage();
    expect(screen.getByRole('button', { name: /sair/i })).toBeInTheDocument();
  });

  it('clicar em Sair chama signOut', async () => {
    mockSignOut.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      usuario: { id: 'u1', nome: 'Admin', tipo: 'admin' },
      signOut: mockSignOut,
    });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /sair/i }));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  });

  it('após Sair navega para /login', async () => {
    mockSignOut.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      usuario: { id: 'u1', nome: 'Admin', tipo: 'admin' },
      signOut: mockSignOut,
    });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /sair/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'));
  });
});
