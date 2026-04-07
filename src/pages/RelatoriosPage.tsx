import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BarChart3 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import AppLayout from '@/components/AppLayout';

const categorias = [
  'Todas', 'Material gráfico', 'Combustível', 'Pessoal', 'Aluguel',
  'Mídia digital', 'Mídia tradicional (rádio/TV)', 'Eventos',
  'Serviços (jurídico, contábil, etc.)', 'Outros'
];

interface Conta {
  valor: number;
  status: string;
  categoria: string | null;
  data_vencimento: string;
}

export default function RelatoriosPage() {
  const { isAdmin } = useAuth();
  const [contas, setContas] = useState<Conta[]>([]);
  const [catFilter, setCatFilter] = useState('Todas');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContas();
  }, []);

  const fetchContas = async () => {
    const { data } = await supabase
      .from('contas_pagar')
      .select('valor, status, categoria, data_vencimento');
    if (data) setContas(data as Conta[]);
    setLoading(false);
  };

  const filtered = contas.filter(c => {
    if (catFilter !== 'Todas' && c.categoria !== catFilter) return false;
    if (statusFilter !== 'Todos' && c.status !== statusFilter) return false;
    return true;
  });

  const totalLancado = filtered.reduce((s, c) => s + Number(c.valor), 0);
  const totalPago = filtered.filter(c => c.status === 'Paga').reduce((s, c) => s + Number(c.valor), 0);
  const totalAberto = filtered.filter(c => c.status === 'Lancada' || c.status === 'Aprovada').reduce((s, c) => s + Number(c.valor), 0);
  const totalVencido = filtered.filter(c => {
    return (c.status === 'Lancada' || c.status === 'Aprovada') && new Date(c.data_vencimento) < new Date();
  }).reduce((s, c) => s + Number(c.valor), 0);

  const byCategory: Record<string, number> = {};
  filtered.forEach(c => {
    const cat = c.categoria || 'Sem categoria';
    byCategory[cat] = (byCategory[cat] || 0) + Number(c.valor);
  });
  const sortedCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const maxCatVal = sortedCats.length > 0 ? sortedCats[0][1] : 1;

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="text-center py-20 text-muted-foreground">
          Acesso restrito a administradores
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-5 animate-fade-in">
        <div>
          <h2 className="page-title flex items-center gap-2"><BarChart3 size={22} /> Relatórios</h2>
          <p className="page-subtitle">Visão geral financeira da campanha</p>
        </div>

        {/* Filters */}
        <div className="section-card">
          <p className="section-title">FILTROS</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="label-micro">Categoria</label>
              <Select value={catFilter} onValueChange={setCatFilter}>
                <SelectTrigger className="h-12 bg-background rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="label-micro">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-12 bg-background rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Todos', 'Lancada', 'Aprovada', 'Paga', 'Cancelada'].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total lançado', value: totalLancado, color: 'text-foreground' },
            { label: 'Total pago', value: totalPago, color: 'text-green-500' },
            { label: 'Em aberto', value: totalAberto, color: 'text-yellow-500' },
            { label: 'Vencido', value: totalVencido, color: 'text-red-500' },
          ].map(s => (
            <div key={s.label} className="section-card !p-4">
              <p className="label-micro">{s.label}</p>
              <p className={cn('text-lg font-bold tabular-nums', s.color)}>{fmt(s.value)}</p>
            </div>
          ))}
        </div>

        {/* By category */}
        <div className="section-card">
          <p className="section-title">POR CATEGORIA</p>
          {loading ? (
            <div className="animate-pulse space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-6 bg-muted rounded" />)}
            </div>
          ) : sortedCats.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados</p>
          ) : (
            <div className="space-y-3">
              {sortedCats.map(([cat, val]) => (
                <div key={cat}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{cat}</span>
                    <span className="font-medium tabular-nums">{fmt(val)}</span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full gradient-primary rounded-full transition-all duration-500"
                      style={{ width: `${(val / maxCatVal) * 100}%` }}
                    />
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
