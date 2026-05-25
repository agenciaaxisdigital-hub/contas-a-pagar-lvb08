import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmpresaProvider, useEmpresa } from '@/contexts/EmpresaContext';

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
  beforeEach(() => localStorage.clear());

  it('loads companies from Supabase', async () => {
    render(<EmpresaProvider><TestConsumer /></EmpresaProvider>);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
  });

  it('restores empresa ativa from localStorage', async () => {
    const empresa = { id: 'e1', nome: 'Empresa A', cnpj: null, logo_url: null, criado_em: '' };
    localStorage.setItem('sarelli_empresa_ativa', JSON.stringify(empresa));
    render(<EmpresaProvider><TestConsumer /></EmpresaProvider>);
    await waitFor(() => expect(screen.getByTestId('ativa').textContent).toBe('Empresa A'));
  });
});
