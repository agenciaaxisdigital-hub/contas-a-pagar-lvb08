import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { PagarSalarioDialog } from '@/components/PagarSalarioDialog';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ArrowLeft, DollarSign, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Funcionario {
  id: string;
  nome: string;
  cpf: string | null;
  cargo: string;
  salario: number;
  data_admissao: string;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  pix: string | null;
  contrato_url: string | null;
  ativo: boolean;
}

interface Pagamento {
  id: string;
  mes_referencia: string;
  valor_pago: number;
  forma_pagamento: string;
  data_pagamento: string;
  status: string;
  comprovante_url: string | null;
}

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function FuncionarioDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [func, setFunc] = useState<Funcionario | null>(null);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!id) return;
    const [{ data: f }, { data: p }] = await Promise.all([
      supabase.from('funcionarios').select('*').eq('id', id).single(),
      supabase
        .from('pagamentos_funcionarios')
        .select('*')
        .eq('funcionario_id', id)
        .order('mes_referencia', { ascending: false }),
    ]);
    setFunc(f as Funcionario);
    setPagamentos((p ?? []) as Pagamento[]);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDesativar = async () => {
    if (!func) return;
    const { error } = await supabase
      .from('funcionarios')
      .update({ ativo: !func.ativo })
      .eq('id', func.id);
    if (error) { toast.error('Erro ao atualizar.'); return; }
    toast.success(func.ativo ? 'Funcionário desativado.' : 'Funcionário reativado.');
    fetchData();
  };

  if (loading || !func) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl bg-muted" />)}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{func.nome}</h1>
              <Badge variant={func.ativo ? 'default' : 'secondary'}>
                {func.ativo ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{func.cargo}</p>
          </div>
        </div>

        <div className="border rounded-xl p-4 space-y-2 bg-card">
          <InfoRow label="Salário" value={brl(func.salario)} highlight />
          {func.cpf && <InfoRow label="CPF" value={func.cpf} />}
          <InfoRow label="Admissão" value={format(new Date(func.data_admissao + 'T12:00:00'), 'dd/MM/yyyy')} />
          {func.pix && <InfoRow label="PIX" value={func.pix} />}
          {func.banco && (
            <InfoRow label="Banco" value={`${func.banco} | Ag: ${func.agencia} | Cc: ${func.conta}`} />
          )}
          {func.contrato_url && (
            <a
              href={func.contrato_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-sm text-primary hover:underline mt-1"
            >
              <FileText className="w-4 h-4" /> Ver contrato
            </a>
          )}
        </div>

        <div className="flex gap-2">
          <PagarSalarioDialog funcionarioId={func.id} nomeFuncionario={func.nome} salarioPadrao={func.salario} onPago={fetchData}>
            <Button className="flex-1" disabled={!func.ativo}>
              <DollarSign className="w-4 h-4 mr-1" /> Registrar Pagamento
            </Button>
          </PagarSalarioDialog>
          <Button variant="outline" onClick={handleDesativar}>
            {func.ativo ? 'Desativar' : 'Reativar'}
          </Button>
        </div>

        <Separator />

        <div>
          <h2 className="text-sm font-semibold mb-3">Histórico de Pagamentos</h2>
          {pagamentos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum pagamento registrado.
            </p>
          ) : (
            <div className="space-y-2">
              {pagamentos.map(p => (
                <div key={p.id} className="border rounded-xl p-3 bg-card flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {format(new Date(p.mes_referencia + 'T12:00:00'), 'MMMM yyyy', { locale: ptBR })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.forma_pagamento} • {format(new Date(p.data_pagamento + 'T12:00:00'), 'dd/MM/yyyy')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-primary">{brl(p.valor_pago)}</p>
                    <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? 'font-bold text-primary' : 'font-medium'}>{value}</span>
    </div>
  );
}
