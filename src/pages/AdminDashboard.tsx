import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  format, subMonths, startOfMonth, endOfMonth, parseISO
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  TrendingUp, Users, AlertTriangle, CheckCircle2,
  Clock, ChevronRight, History, DollarSign
} from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { cn } from '@/lib/utils';

const CORES = ['#ec4899', '#f43f5e', '#a855f7', '#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#14b8a6'];

interface ContaRaw {
  id: string;
  valor: number;
  status: string;
  categoria: string | null;
  data_vencimento: string;
  criado_por: string | null;
  pago_por: string | null;
  aprovado_por: string | null;
  descricao: string;
  criado_em: string;
}

interface LogRaw {
  id: string;
  acao: string | null;
  status_novo: string | null;
  criado_em: string;
  usuario_id: string | null;
  conta_id: string | null;
}

interface UsuarioSimples { id: string; nome: string; }

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtDT = (d: string) => {
  try { return format(parseISO(d), "dd/MM 'às' HH:mm", { locale: ptBR }); }
  catch { return d; }
};

export default function AdminDashboard() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [contas, setContas] = useState<ContaRaw[]>([]);
  const [logs, setLogs] = useState<LogRaw[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioSimples[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    fetchAll();
  }, [isAdmin]);

  const fetchAll = async () => {
    setLoading(true);
    const [contasRes, logsRes, usersRes] = await Promise.all([
      supabase.from('contas_pagar').select(
        'id, valor, status, categoria, data_vencimento, criado_por, pago_por, aprovado_por, descricao, criado_em'
      ).order('criado_em', { ascending: false }),
      supabase.from('contas_pagar_logs').select('*').order('criado_em', { ascending: false }).limit(50),
      supabase.from('usuarios').select('id, nome').order('nome'),
    ]);
    if (contasRes.data) setContas(contasRes.data as ContaRaw[]);
    if (logsRes.data) setLogs(logsRes.data as LogRaw[]);
    if (usersRes.data) setUsuarios(usersRes.data as UsuarioSimples[]);
    setLoading(false);
  };

  const getNome = (id: string | null) =>
    id ? (usuarios.find(u => u.id === id)?.nome ?? 'Usuário') : '—';

  // --- Dados para gráfico de últimos 6 meses ---
  const dadosMensais = Array.from({ length: 6 }, (_, i) => {
    const mes = subMonths(new Date(), 5 - i);
    const inicio = format(startOfMonth(mes), 'yyyy-MM-dd');
    const fim = format(endOfMonth(mes), 'yyyy-MM-dd');
    const doMes = contas.filter(c =>
      c.data_vencimento >= inicio && c.data_vencimento <= fim
    );
    const pago = doMes.filter(c => c.status === 'Paga').reduce((s, c) => s + Number(c.valor), 0);
    const aberto = doMes.filter(c => c.status !== 'Paga' && c.status !== 'Cancelada').reduce((s, c) => s + Number(c.valor), 0);
    return {
      mes: format(mes, 'MMM', { locale: ptBR }),
      Pago: pago,
      Aberto: aberto,
    };
  });

  // --- Dados por categoria ---
  const porCategoria: Record<string, number> = {};
  contas.filter(c => c.status !== 'Cancelada').forEach(c => {
    const cat = c.categoria || 'Sem categoria';
    porCategoria[cat] = (porCategoria[cat] || 0) + Number(c.valor);
  });
  const dadosCat = Object.entries(porCategoria)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }));

  // --- Estatísticas gerais ---
  const hoje = format(new Date(), 'yyyy-MM-dd');
  const totalGeral = contas.filter(c => c.status !== 'Cancelada').reduce((s, c) => s + Number(c.valor), 0);
  const totalPago = contas.filter(c => c.status === 'Paga').reduce((s, c) => s + Number(c.valor), 0);
  const totalAberto = contas.filter(c => c.status === 'Lancada' || c.status === 'Aprovada').reduce((s, c) => s + Number(c.valor), 0);
  const totalVencido = contas.filter(c =>
    (c.status === 'Lancada' || c.status === 'Aprovada') && c.data_vencimento < hoje
  ).reduce((s, c) => s + Number(c.valor), 0);
  const qtdVencidas = contas.filter(c =>
    (c.status === 'Lancada' || c.status === 'Aprovada') && c.data_vencimento < hoje
  ).length;

  // --- Atividade por usuário ---
  const atividadeUsuario: Record<string, { lancou: number; aprovou: number; pagou: number }> = {};
  contas.forEach(c => {
    const uid = c.criado_por || '';
    if (!atividadeUsuario[uid]) atividadeUsuario[uid] = { lancou: 0, aprovou: 0, pagou: 0 };
    atividadeUsuario[uid].lancou++;
    if (c.aprovado_por) {
      if (!atividadeUsuario[c.aprovado_por]) atividadeUsuario[c.aprovado_por] = { lancou: 0, aprovou: 0, pagou: 0 };
      atividadeUsuario[c.aprovado_por].aprovou++;
    }
    if (c.pago_por) {
      if (!atividadeUsuario[c.pago_por]) atividadeUsuario[c.pago_por] = { lancou: 0, aprovou: 0, pagou: 0 };
      atividadeUsuario[c.pago_por].pagou++;
    }
  });

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="text-center py-20 space-y-3">
          <p className="text-4xl">🔒</p>
          <p className="text-muted-foreground font-medium">Acesso restrito a administradores</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-5 animate-fade-in pb-6">

        {/* Header */}
        <div>
          <h2 className="page-title flex items-center gap-2">
            <TrendingUp size={22} className="text-primary" /> Dashboard Admin
          </h2>
          <p className="page-subtitle">Visão completa · todos os dados</p>
        </div>

        {/* Cards de KPI */}
        <div className="grid grid-cols-2 gap-3">
          <div className="section-card !p-4 !space-y-1">
            <div className="flex items-center gap-1.5">
              <DollarSign size={14} className="text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Total lançado</span>
            </div>
            <p className="text-lg font-bold tabular-nums">{fmt(totalGeral)}</p>
          </div>
          <div className="section-card !p-4 !space-y-1">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-green-500" />
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Total pago</span>
            </div>
            <p className="text-lg font-bold text-green-600 tabular-nums">{fmt(totalPago)}</p>
          </div>
          <div className="section-card !p-4 !space-y-1">
            <div className="flex items-center gap-1.5">
              <Clock size={14} className="text-yellow-500" />
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Em aberto</span>
            </div>
            <p className="text-lg font-bold text-yellow-600 tabular-nums">{fmt(totalAberto)}</p>
          </div>
          <div
            className={cn(
              'section-card !p-4 !space-y-1 cursor-pointer active:scale-95 transition-transform',
              qtdVencidas > 0 && 'border-red-200 bg-red-50/40'
            )}
            onClick={() => navigate('/')}
          >
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-red-500" />
              <span className="text-[10px] font-bold uppercase tracking-wide text-red-500">Vencido</span>
            </div>
            <p className="text-lg font-bold text-red-500 tabular-nums">{fmt(totalVencido)}</p>
            {qtdVencidas > 0 && (
              <p className="text-[10px] text-red-400">{qtdVencidas} conta{qtdVencidas > 1 ? 's' : ''}</p>
            )}
          </div>
        </div>

        {/* Gráfico — 6 meses */}
        <div className="section-card !space-y-3">
          <p className="section-title">Últimos 6 Meses</p>
          {loading ? (
            <div className="h-40 bg-muted animate-pulse rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dadosMensais} barCategoryGap="30%">
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={(v: number) => fmt(v)}
                  contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #e5e7eb' }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Pago" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Aberto" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Gráfico — Por categoria */}
        {dadosCat.length > 0 && (
          <div className="section-card !space-y-3">
            <p className="section-title">Por Categoria</p>
            {loading ? (
              <div className="h-40 bg-muted animate-pulse rounded-xl" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={dadosCat}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      paddingAngle={2}
                    >
                      {dadosCat.map((_, idx) => (
                        <Cell key={idx} fill={CORES[idx % CORES.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {dadosCat.map((item, idx) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: CORES[idx % CORES.length] }} />
                        <span className="text-muted-foreground truncate max-w-[160px]">{item.name}</span>
                      </div>
                      <span className="font-semibold tabular-nums">{fmt(item.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Atividade por usuário */}
        <div className="section-card !space-y-3">
          <div className="flex items-center justify-between">
            <p className="section-title flex items-center gap-2"><Users size={14} /> Atividade da Equipe</p>
            <button
              onClick={() => navigate('/admin/usuarios')}
              className="text-xs text-primary font-semibold flex items-center gap-1"
            >
              Gerenciar <ChevronRight size={13} />
            </button>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : Object.entries(atividadeUsuario).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem atividade registrada</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(atividadeUsuario)
                .filter(([uid]) => uid)
                .sort((a, b) => (b[1].lancou + b[1].aprovou + b[1].pagou) - (a[1].lancou + a[1].aprovou + a[1].pagou))
                .map(([uid, stats]) => (
                  <div key={uid} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-white">
                          {getNome(uid).substring(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm font-medium">{getNome(uid)}</span>
                    </div>
                    <div className="flex gap-3 text-[10px] text-muted-foreground">
                      {stats.lancou > 0 && <span>📝 {stats.lancou}</span>}
                      {stats.aprovou > 0 && <span>✅ {stats.aprovou}</span>}
                      {stats.pagou > 0 && <span>💰 {stats.pagou}</span>}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Auditoria — últimas ações */}
        <div className="section-card !space-y-3">
          <p className="section-title flex items-center gap-2"><History size={14} /> Auditoria Recente</p>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem registros</p>
          ) : (
            <div className="space-y-2">
              {logs.slice(0, 20).map(log => {
                const conta = contas.find(c => c.id === log.conta_id);
                const acaoLabel =
                  log.acao === 'CRIADA' ? '📝 Lançou' :
                  log.status_novo === 'Aprovada' ? '✅ Aprovou' :
                  log.status_novo === 'Paga' ? '💰 Pagou' :
                  log.status_novo === 'Cancelada' ? '❌ Cancelou' :
                  '🔄 Alterou';
                return (
                  <div
                    key={log.id}
                    className="text-xs border-l-2 border-primary/20 pl-3 py-1.5 cursor-pointer active:opacity-70"
                    onClick={() => log.conta_id && navigate(`/conta/${log.conta_id}`)}
                  >
                    <p className="text-muted-foreground">{fmtDT(log.criado_em)}</p>
                    <p className="font-medium">
                      <span className="text-foreground">{getNome(log.usuario_id)}</span>
                      {' '}{acaoLabel}
                    </p>
                    {conta && (
                      <p className="text-muted-foreground truncate">{conta.descricao} · {fmt(Number(conta.valor))}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </AppLayout>
  );
}
