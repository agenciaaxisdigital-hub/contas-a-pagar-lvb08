import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockInsert = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ insert: mockInsert }) },
}));

vi.mock('@/contexts/EmpresaContext', () => ({
  useEmpresa: () => ({ empresaAtiva: { id: 'e1', nome: 'Empresa A' } }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ usuario: { id: 'usr-1', nome: 'Admin', tipo: 'admin' } }),
}));

import { PagarSalarioDialog } from '@/components/PagarSalarioDialog';
import { toast } from 'sonner';

const renderDialog = (onPago = vi.fn()) =>
  render(
    <PagarSalarioDialog funcionarioId="f1" salarioPadrao={3500} onPago={onPago}>
      <button>Pagar</button>
    </PagarSalarioDialog>,
  );

describe('PagarSalarioDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
  });

  it('abre dialog ao clicar no trigger', async () => {
    renderDialog();
    fireEvent.click(screen.getByText('Pagar'));
    await waitFor(() =>
      expect(screen.getByText('Registrar Pagamento')).toBeInTheDocument(),
    );
  });

  it('pré-preenche valor com salarioPadrao', async () => {
    renderDialog();
    fireEvent.click(screen.getByText('Pagar'));
    await waitFor(() => screen.getByText('Registrar Pagamento'));
    const valorInput = screen.getByDisplayValue('3500');
    expect(valorInput).toBeInTheDocument();
  });

  it('exibe as 3 formas de pagamento no select', async () => {
    renderDialog();
    fireEvent.click(screen.getByText('Pagar'));
    await waitFor(() => screen.getByText('Registrar Pagamento'));
    expect(screen.getAllByText('PIX').length).toBeGreaterThan(0);
  });

  it('chama insert com dados corretos ao confirmar', async () => {
    const onPago = vi.fn();
    renderDialog(onPago);
    fireEvent.click(screen.getByText('Pagar'));
    await waitFor(() => screen.getByText('Confirmar Pagamento'));
    fireEvent.click(screen.getByText('Confirmar Pagamento'));
    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        funcionario_id: 'f1',
        empresa_id: 'e1',
        valor_pago: 3500,
        forma_pagamento: 'PIX',
        status: 'Pago',
      }));
      expect(toast.success).toHaveBeenCalled();
      expect(onPago).toHaveBeenCalled();
    });
  });

  it('exibe toast de erro quando insert falha', async () => {
    mockInsert.mockResolvedValue({ error: { message: 'DB error' } });
    renderDialog();
    fireEvent.click(screen.getByText('Pagar'));
    await waitFor(() => screen.getByText('Confirmar Pagamento'));
    fireEvent.click(screen.getByText('Confirmar Pagamento'));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});
