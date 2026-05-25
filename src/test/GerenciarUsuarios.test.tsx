import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Hoisted mocks to avoid initialization order errors
const { mockInvoke, mockFrom } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/components/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    functions: { invoke: mockInvoke },
  },
}));

import GerenciarUsuarios from '@/pages/GerenciarUsuarios';
import { toast } from 'sonner';

const makeChain = (result: any) => {
  const chain: any = {};
  ['select', 'order', 'eq', 'single'].forEach(m => { chain[m] = () => chain; });
  chain.then = (res: any, rej: any) => Promise.resolve(result).then(res, rej);
  chain.catch = (fn: any) => Promise.resolve(result).catch(fn);
  return chain;
};

const mockUsuarios = [
  { id: 'u1', nome: 'Admin Teste', tipo: 'admin', criado_em: '2026-01-01T00:00:00Z', auth_user_id: 'auth-1' },
  { id: 'u2', nome: 'Agente Teste', tipo: 'agente', criado_em: '2026-02-01T00:00:00Z', auth_user_id: 'auth-2' },
];

const adminAuth = {
  usuario: { id: 'u1', nome: 'Admin Teste', tipo: 'admin' },
  isAdmin: true,
  signOut: vi.fn(),
};

const renderPage = () =>
  render(<MemoryRouter><GerenciarUsuarios /></MemoryRouter>);

describe('GerenciarUsuarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(adminAuth);
    mockFrom.mockImplementation(() => makeChain({ data: mockUsuarios, error: null }));
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
  });

  it('renderiza lista de usuários', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Admin Teste')).toBeInTheDocument();
      expect(screen.getByText('Agente Teste')).toBeInTheDocument();
    });
  });

  it('exibe badge Administrador para admin', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Administrador')).toBeInTheDocument());
  });

  it('abre formulário ao clicar em Criar novo usuário', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Admin Teste'));
    fireEvent.click(screen.getByText(/criar novo usuário/i));
    await waitFor(() => expect(screen.getByText('Novo Usuário')).toBeInTheDocument());
  });

  it('chama contas-criar-usuario ao submeter formulário', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Admin Teste'));
    fireEvent.click(screen.getByText(/criar novo usuário/i));
    await waitFor(() => screen.getByPlaceholderText('Ex.: Ana Paula'));

    fireEvent.change(screen.getByPlaceholderText('Ex.: Ana Paula'), { target: { value: 'Novo User' } });
    fireEvent.change(screen.getByPlaceholderText('Mínimo 6 caracteres'), { target: { value: 'senha123' } });
    fireEvent.click(screen.getByText(/✓ Criar usuário/i));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('contas-criar-usuario', expect.objectContaining({
        body: expect.objectContaining({ nome: 'Novo User', senha: 'senha123', tipo: 'agente' }),
      }));
      expect(toast.success).toHaveBeenCalled();
    });
  });

  it('exibe erro se nome ou senha vazios', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Admin Teste'));
    fireEvent.click(screen.getByText(/criar novo usuário/i));
    await waitFor(() => screen.getByText('Novo Usuário'));
    // Submit form via the form element directly (bypasses multi-match issue)
    const form = document.querySelector('form')!;
    fireEvent.submit(form);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Preencha nome e senha'));
  });

  it('exibe erro se senha menor que 6 caracteres', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Admin Teste'));
    fireEvent.click(screen.getByText(/criar novo usuário/i));
    await waitFor(() => screen.getByPlaceholderText('Ex.: Ana Paula'));

    fireEvent.change(screen.getByPlaceholderText('Ex.: Ana Paula'), { target: { value: 'Teste' } });
    fireEvent.change(screen.getByPlaceholderText('Mínimo 6 caracteres'), { target: { value: '123' } });
    fireEvent.click(screen.getByText(/✓ Criar usuário/i));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Senha deve ter pelo menos 6 caracteres'));
  });
});
