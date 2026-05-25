import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmpresaProvider, useEmpresa } from '@/contexts/EmpresaContext';

const mockUnsubscribe = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({
          data: [{ id: 'e1', nome: 'Empresa A', cnpj: null, logo_url: null, criado_em: '' }],
          error: null,
        }),
      }),
    }),
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: { user: { id: 'u1' } } } }),
      onAuthStateChange: (_: any, cb: any) => {
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      },
    },
  },
}));

function TestConsumer() {
  const { empresaAtiva, empresas, loading } = useEmpresa();
  if (loading) return <div>loading</div>;
  return (
    <div>
      <span data-testid="count">{empresas.length}</span>
      <span data-testid="ativa">{empresaAtiva?.nome ?? 'none'}</span>
    </div>
  );
}

describe('EmpresaContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('carrega empresas do Supabase após sessão auth', async () => {
    render(<EmpresaProvider><TestConsumer /></EmpresaProvider>);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
  });

  it('restaura empresa ativa do localStorage', async () => {
    const empresa = { id: 'e1', nome: 'Empresa A', cnpj: null, logo_url: null, criado_em: '' };
    localStorage.setItem('sarelli_empresa_ativa', JSON.stringify(empresa));
    render(<EmpresaProvider><TestConsumer /></EmpresaProvider>);
    await waitFor(() => expect(screen.getByTestId('ativa').textContent).toBe('Empresa A'));
  });

  it('persiste empresa ativa no localStorage ao chamar setEmpresaAtiva', async () => {
    function Setter() {
      const { setEmpresaAtiva, loading } = useEmpresa();
      if (loading) return <div>loading</div>;
      return (
        <button
          onClick={() =>
            setEmpresaAtiva({ id: 'e2', nome: 'Empresa B', cnpj: null, logo_url: null, criado_em: '' })
          }
        >
          selecionar
        </button>
      );
    }
    render(<EmpresaProvider><Setter /></EmpresaProvider>);
    await waitFor(() => screen.getByText('selecionar'));
    screen.getByText('selecionar').click();
    const stored = JSON.parse(localStorage.getItem('sarelli_empresa_ativa') ?? 'null');
    expect(stored?.nome).toBe('Empresa B');
  });

  it('retorna loading=false se não há sessão', async () => {
    vi.doMock('@/integrations/supabase/client', () => ({
      supabase: {
        from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
        auth: {
          getSession: () => Promise.resolve({ data: { session: null } }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
        },
      },
    }));
    render(<EmpresaProvider><TestConsumer /></EmpresaProvider>);
    await waitFor(() => expect(screen.queryByText('loading')).toBeNull());
  });
});
