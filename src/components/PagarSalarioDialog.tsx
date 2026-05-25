import { useState, ReactNode } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, startOfMonth } from 'date-fns';

interface Props {
  funcionarioId: string;
  nomeFuncionario: string;
  salarioPadrao: number;
  onPago: () => void;
  children: ReactNode;
}

export function PagarSalarioDialog({ funcionarioId, nomeFuncionario, salarioPadrao, onPago, children }: Props) {
  const [open, setOpen] = useState(false);
  const [valor, setValor] = useState(String(salarioPadrao));
  const [forma, setForma] = useState('PIX');
  const [dataPagamento, setDataPagamento] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [mesRef, setMesRef] = useState(format(startOfMonth(new Date()), 'yyyy-MM'));
  const [loading, setLoading] = useState(false);
  const { empresaAtiva } = useEmpresa();
  const { usuario } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaAtiva) return;
    setLoading(true);

    const valorNum = parseFloat(valor);
    const usuarioId = usuario?.id ?? null;

    const { error: errPag } = await supabase.from('pagamentos_funcionarios').insert({
      funcionario_id: funcionarioId,
      empresa_id: empresaAtiva.id,
      mes_referencia: `${mesRef}-01`,
      valor_pago: valorNum,
      forma_pagamento: forma,
      data_pagamento: dataPagamento,
      status: 'Pago',
      pago_por: usuarioId,
    });
    if (errPag) { toast.error('Erro ao registrar pagamento.'); setLoading(false); return; }

    // Cria conta paga para controle de caixa
    await supabase.from('contas_pagar').insert({
      empresa_id: empresaAtiva.id,
      descricao: `Salário - ${nomeFuncionario} (${mesRef})`,
      valor: valorNum,
      categoria: 'Folha de Pagamento',
      motivo: 'Pagamento de salário',
      data_vencimento: dataPagamento,
      data_pagamento: dataPagamento,
      forma_pagamento: forma,
      status: 'Paga',
      criado_por: usuarioId,
      aprovado_por: usuarioId,
      pago_por: usuarioId,
    });

    toast.success('Pagamento registrado!');
    setOpen(false);
    onPago();
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Mês de Referência</Label>
              <Input
                type="month"
                value={mesRef}
                onChange={(e) => setMesRef(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data do Pagamento</Label>
              <Input
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Valor (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Forma de Pagamento</Label>
            <Select value={forma} onValueChange={setForma}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PIX">PIX</SelectItem>
                <SelectItem value="Transferência">Transferência</SelectItem>
                <SelectItem value="Dinheiro">Dinheiro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Salvando...' : 'Confirmar Pagamento'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
