import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ---- mocks ----------------------------------------------------------------
vi.mock('@/components/Hyperspeed', () => ({ default: () => <div data-testid="hyperspeed" /> }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() }, Toaster: () => null }));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockSignInByNome = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    usuario: null,
    loading: false,
    isAdmin: false,
    signInByNome: mockSignInByNome,
    signOut: vi.fn(),
  }),
}));
// ---------------------------------------------------------------------------

import LoginPage from '@/pages/LoginPage';
import { toast } from 'sonner';

const renderLogin = () =>
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renderiza os campos de usuário e senha', () => {
    renderLogin();
    expect(screen.getByPlaceholderText(/ex: administrador/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
  });

  it('renderiza o botão Entrar', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });

  it('renderiza o checkbox Lembrar meus dados', () => {
    renderLogin();
    expect(screen.getByLabelText(/lembrar meus dados/i)).toBeInTheDocument();
  });

  it('exibe toast de erro ao submeter com campos vazios', async () => {
    renderLogin();
    fireEvent.submit(screen.getByRole('button', { name: /entrar/i }).closest('form')!);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Preencha nome e senha'),
    );
  });

  it('chama signInByNome com nome e senha corretos', async () => {
    mockSignInByNome.mockResolvedValue({ error: null });
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText(/ex: administrador/i), {
      target: { value: 'Administrador' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'senha123' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /entrar/i }).closest('form')!);

    await waitFor(() =>
      expect(mockSignInByNome).toHaveBeenCalledWith('Administrador', 'senha123'),
    );
  });

  it('navega para / após login bem-sucedido', async () => {
    mockSignInByNome.mockResolvedValue({ error: null });
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText(/ex: administrador/i), {
      target: { value: 'Admin' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'pass' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /entrar/i }).closest('form')!);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'));
  });

  it('exibe toast de erro quando login falha', async () => {
    mockSignInByNome.mockResolvedValue({ error: new Error('invalid') });
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText(/ex: administrador/i), {
      target: { value: 'Admin' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'wrong' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /entrar/i }).closest('form')!);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Erro ao entrar. Verifique seus dados e tente novamente.'),
    );
  });

  it('alterna visibilidade da senha ao clicar no ícone de olho', () => {
    renderLogin();
    const senhaInput = screen.getByPlaceholderText('••••••••');
    expect(senhaInput).toHaveAttribute('type', 'password');

    const toggleBtn = senhaInput.parentElement!.querySelector('button')!;
    fireEvent.click(toggleBtn);
    expect(senhaInput).toHaveAttribute('type', 'text');

    fireEvent.click(toggleBtn);
    expect(senhaInput).toHaveAttribute('type', 'password');
  });

  it('salva credenciais no localStorage quando "Lembrar" está marcado', async () => {
    mockSignInByNome.mockResolvedValue({ error: null });
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText(/ex: administrador/i), {
      target: { value: 'João' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'abc123' },
    });

    const checkbox = screen.getByLabelText(/lembrar meus dados/i);
    fireEvent.click(checkbox); // marca
    fireEvent.submit(screen.getByRole('button', { name: /entrar/i }).closest('form')!);

    await waitFor(() => {
      expect(localStorage.getItem('saved_user')).toBe('João');
      expect(localStorage.getItem('saved_pass')).toBe('abc123');
    });
  });

  it('pré-preenche campos quando há dados salvos no localStorage', () => {
    localStorage.setItem('saved_user', 'Maria');
    localStorage.setItem('saved_pass', 'xyz');
    renderLogin();

    expect(screen.getByPlaceholderText(/ex: administrador/i)).toHaveValue('Maria');
    expect(screen.getByPlaceholderText('••••••••')).toHaveValue('xyz');
  });
});
