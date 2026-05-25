import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, UserCircle } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';

interface Funcionario {
  id: string;
  nome: string;
  cargo: string;
  salario: number;
  data_admissao: string;
  ativo: boolean;
}

export default function FuncionariosPage() {
  const { empresaAtiva } = useEmpresa();
  const navigate = useNavigate();
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [pagosEsteMes, setPagosEsteMes] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState<'todos' | 'ativo' | 'inativo'>('ativo');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!empresaAtiva) return;
    const fetchData = async () => {
      setLoading(true);
      const { data: funcs } = await supabase
        .from('funcionarios')
        .select('id, nome, cargo, salario, data_admissao, ativo')
        .eq('empresa_id', empresaAtiva.id)
        .order('nome');

      const mesAtual = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const { data: pagamentos } = await supabase
        .from('pagamentos_funcionarios')
        .select('funcionario_id')
        .eq('empresa_id', empresaAtiva.id)
        .gte('mes_referencia', mesAtual);

      setFuncionarios((funcs ?? []) as Funcionario[]);
      setPagosEsteMes(new Set((pagamentos ?? []).map((p: any) => p.funcionario_id)));
      setLoading(false);
    };
    fetchData();
  }, [empresaAtiva]);

  const filtered = funcionarios.filter(f => {
    const matchBusca = f.nome.toLowerCase().includes(busca.toLowerCase());
    const matchAtivo = filtroAtivo === 'todos' ? true :
      filtroAtivo === 'ativo' ? f.ativo : !f.ativo;
    return matchBusca && matchAtivo;
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Funcionários</h1>
          <Button size="sm" onClick={() => navigate('/rh/funcionarios/novo')}>
            <Plus className="w-4 h-4 mr-1" /> Novo
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2">
          {(['ativo', 'inativo', 'todos'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFiltroAtivo(f)}
              className={cn(
                'text-xs px-3 py-1 rounded-full border transition-colors',
                filtroAtivo === f
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40'
              )}
            >
              {f === 'ativo' ? 'Ativos' : f === 'inativo' ? 'Inativos' : 'Todos'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <UserCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum funcionário encontrado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(f => {
              const pendente = !pagosEsteMes.has(f.id) && f.ativo;
              return (
                <button
                  key={f.id}
                  onClick={() => navigate(`/rh/funcionarios/${f.id}`)}
                  className="w-full border rounded-xl p-4 flex items-center justify-between hover:border-primary/40 transition-colors bg-card text-left"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{f.nome}</p>
                      {pendente && (
                        <Badge variant="destructive" className="text-[10px] h-4">
                          Pendente
                        </Badge>
                      )}
                      {!f.ativo && (
                        <Badge variant="secondary" className="text-[10px] h-4">
                          Inativo
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{f.cargo}</p>
                  </div>
                  <p className="text-sm font-medium text-primary">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(f.salario)}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
