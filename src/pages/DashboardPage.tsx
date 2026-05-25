import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Plus, AlertTriangle, ChevronLeft, ChevronRight,
  Clock, CheckCircle2, RefreshCw, ChevronRight as Arrow, Search, X, WifiOff, CloudOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  format, startOfMonth, endOfMonth,
  addMonths, subMonths, differenceInDays, startOfDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import AppLayout from '@/components/AppLayout';
import { useNotifications } from '@/hooks/useNotifications';
import {
  fetchAndCacheContas, getLocalContas, getMonthKey
} from '@/lib/offlineStore';
import { getPendingCount } from '@/lib/offlineFallback';
import type { LocalConta } from '@/lib/dexieDb';

type Aba = 'pendente' | 'pago' | 'vencida';

export default function DashboardPage() {
  const { usuario, isAdmin } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const navigate = useNavigate();
  const [contas, setContas] = useState<LocalConta[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesAtual, setMesAtual] = useState(new Date());
  const [aba, setAba] = useState<Aba>('pendente');
  const [busca, setBusca] = useState('');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingSync, setPendingSync] = useState(0);

  const queryClient = useQueryClient();

  useNotifications(usuario?.id);

  // Track online/offline status
  useEffect(() => {
    const goOnline = () => {
      setIsOffline(false);
      // Re-fetch when coming back online
      fetchContas();
    };
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [usuario, mesAtual]);

  useEffect(() => { fetchContas(); }, [usuario, mesAtual]);
  useEffect(() => { setBusca(''); }, [aba, mesAtual]);

  useEffect(() => {
    if (!empresaAtiva) return;

    const channel = supabase
      .channel(`contas_realtime_${empresaAtiva.id}`)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'contas_pagar',
          filter: `empresa_id=eq.${empresaAtiva.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['contas'] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [empresaAtiva?.id, queryClient]);

  // Check pending sync count periodically
  useEffect(() => {
    const check = () => getPendingCount().then(setPendingSync);
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchContas = useCallback(async () => {
    if (!usuario) return;
    setLoading(true);
    const fetchStart = performance.now();

    try {
      if (navigator.onLine) {
        // Online: fetch from Supabase and cache
        const data = await fetchAndCacheContas(mesAtual, empresaAtiva?.id ?? '');
        setContas(data);
        console.log(`[PERF] Dashboard fetch (online): ${Math.round(performance.now() - fetchStart)}ms, ${data.length} contas`);
      } else {
        // Offline: load from IndexedDB
        const data = await getLocalContas(mesAtual, empresaAtiva?.id);
        setContas(data);
        console.log(`[PERF] Dashboard fetch (offline): ${Math.round(performance.now() - fetchStart)}ms, ${data.length} contas`);
      }
    } catch (err) {
      console.warn('[DASH] Fetch error, trying local cache:', err);
      // Fallback to local cache on any error
      try {
        const data = await getLocalContas(mesAtual, empresaAtiva?.id);
        setContas(data);
      } catch {
        setContas([]);
      }
    }

    setLoading(false);
  }, [usuario, mesAtual]);

  const isVencida = (c: LocalConta) => {
    if (c.status === 'Paga' || c.status === 'Cancelada') return false;
    return new Date(c.data_vencimento + 'T00:00:00') < startOfDay(new Date());
  };

  const diasAteVencer = (c: LocalConta) =>
    differenceInDays(
      startOfDay(new Date(c.data_vencimento + 'T00:00:00')),
      startOfDay(new Date())
    );

  const pendentes = useMemo(() =>
    contas.filter(c => (c.status === 'Lancada' || c.status === 'Aprovada') && !isVencida(c)),
    [contas]
  );
  const vencidas = useMemo(() => contas.filter(c => isVencida(c)), [contas]);
  const pagas = useMemo(() => contas.filter(c => c.status === 'Paga'), [contas]);

  const lista = aba === 'pendente' ? pendentes : aba === 'pago' ? pagas : vencidas;

  const listaFiltrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(c =>
      c.descricao.toLowerCase().includes(q) ||
      (c.categoria?.toLowerCase().includes(q))
    );
  }, [lista, busca]);

  const totalPendentes = pendentes.reduce((s, c) => s + Number(c.valor), 0);
  const totalVencidas = vencidas.reduce((s, c) => s + Number(c.valor), 0);
  const totalPago = pagas.reduce((s, c) => s + Number(c.valor), 0);
  const totalGeral = totalPendentes + totalVencidas + totalPago;
  const percPago = totalGeral > 0 ? (totalPago / totalGeral) * 100 : 0;

  const minhasContas = useMemo(() =>
    contas.filter(c => c.criado_por === usuario?.id && c.status !== 'Cancelada'),
    [contas, usuario]
  );
  const totalMinhas = minhasContas.reduce((s, c) => s + Number(c.valor), 0);

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const fmtData = (d: string) => {
    try { return format(new Date(d + 'T00:00:00'), 'dd/MM', { locale: ptBR }); }
    catch { return d; }
  };

  const mesLabel = format(mesAtual, "MMMM yyyy", { locale: ptBR });
  const ehMesAtual = format(mesAtual, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

  const getLabelVencimento = (c: LocalConta) => {
    const days = diasAteVencer(c);
    if (days < 0) return { text: `Venceu ${fmtData(c.data_vencimento)}`, color: 'text-red-500' };
    if (days === 0) return { text: 'Vence hoje!', color: 'text-orange-500' };
    if (days === 1) return { text: 'Vence amanhã', color: 'text-yellow-600' };
    return { text: `Vence ${fmtData(c.data_vencimento)}`, color: 'text-muted-foreground' };
  };

  return (
    <AppLayout>
      <div className="space-y-4 animate-fade-in">

        {/* Offline / Sync indicator */}
        {(isOffline || pendingSync > 0) && (
          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium',
            isOffline
              ? 'bg-amber-50 border border-amber-200 text-amber-700'
              : 'bg-blue-50 border border-blue-200 text-blue-700'
          )}>
            {isOffline ? (
              <>
                <WifiOff size={14} className="shrink-0" />
                <span>Modo offline — dados locais</span>
              </>
            ) : pendingSync > 0 ? (
              <>
                <RefreshCw size={14} className="shrink-0 animate-spin" />
                <span>Sincronizando {pendingSync} registro{pendingSync > 1 ? 's' : ''}...</span>
              </>
            ) : null}
          </div>
        )}

        {/* Boas-vindas */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">
              Olá, {usuario?.nome?.split(' ')[0] || 'Usuário'} 👋
            </h2>
            <p className="text-[12px] text-muted-foreground">
              {ehMesAtual ? 'Visão do mês atual' : `Visualizando ${mesLabel}`}
            </p>
          </div>
        </div>

        {/* Banner de alerta para contas vencidas */}
        {vencidas.length > 0 && aba !== 'vencida' && (
          <button
            onClick={() => setAba('vencida')}
            className="w-full flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-300 rounded-xl text-left active:scale-[0.98] transition-transform"
          >
            <AlertTriangle size={18} className="text-red-500 shrink-0 animate-pulse" />
            <div className="flex-1">
              <p className="text-sm font-bold text-red-700">
                {vencidas.length} conta{vencidas.length > 1 ? 's vencidas' : ' vencida'} sem pagamento
              </p>
              <p className="text-xs text-red-500 mt-0.5">
                Total: {fmt(totalVencidas)} · Toque para ver
              </p>
            </div>
            <Arrow size={16} className="text-red-400 shrink-0" />
          </button>
        )}

        {/* Seletor de mês */}
        <div className="section-card !p-3 flex items-center justify-between !space-y-0">
          <button
            onClick={() => setMesAtual(subMonths(mesAtual, 1))}
            className="p-2 rounded-xl text-muted-foreground hover:bg-muted active:scale-90 transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="text-center">
            <span className="text-sm font-bold capitalize">{mesLabel}</span>
            {!ehMesAtual && (
              <button
                onClick={() => setMesAtual(new Date())}
                className="block text-[10px] text-primary font-medium mx-auto mt-0.5"
              >
                Ir para hoje
              </button>
            )}
          </div>
          <button
            onClick={() => setMesAtual(addMonths(mesAtual, 1))}
            className="p-2 rounded-xl text-muted-foreground hover:bg-muted active:scale-90 transition-all"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Barra de progresso mensal */}
        {totalGeral > 0 && (
          <div className="section-card !py-3 !px-4 !space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-medium">Progresso do mês</span>
              <span className="font-bold text-primary">{percPago.toFixed(0)}% pago</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full gradient-primary rounded-full transition-all duration-700"
                style={{ width: `${percPago}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Total: {fmt(totalGeral)}</span>
              <span className="text-green-600 font-medium">Pago: {fmt(totalPago)}</span>
            </div>
          </div>
        )}

        {/* Resumo do usuário não-admin */}
        {!isAdmin && minhasContas.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-50/60 border border-blue-100 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-xs font-black text-primary">
                {usuario?.nome?.substring(0, 1).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-800">
                Suas contribuições este mês
              </p>
              <p className="text-[11px] text-blue-600">
                {minhasContas.length} conta{minhasContas.length !== 1 ? 's' : ''} registrada{minhasContas.length !== 1 ? 's' : ''} · {fmt(totalMinhas)}
              </p>
            </div>
          </div>
        )}

        {/* Cards de resumo — 3 abas */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setAba('pendente')}
            className={cn(
              'section-card !p-3 !space-y-1 text-left transition-all',
              aba === 'pendente' && 'ring-2 ring-primary/30'
            )}
          >
            <div className="flex items-center gap-1">
              <Clock size={12} className="text-yellow-500" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">A pagar</span>
            </div>
            <p className="text-base font-bold text-yellow-600 tabular-nums leading-tight">{fmt(totalPendentes)}</p>
            <p className="text-[10px] text-muted-foreground">{pendentes.length} conta{pendentes.length !== 1 ? 's' : ''}</p>
          </button>

          <button
            onClick={() => setAba('vencida')}
            className={cn(
              'section-card !p-3 !space-y-1 text-left transition-all',
              aba === 'vencida' && 'ring-2 ring-red-400/40',
              vencidas.length > 0 && 'border-red-200 bg-red-50/30'
            )}
          >
            <div className="flex items-center gap-1">
              <AlertTriangle size={12} className="text-red-500" />
              <span className="text-[10px] font-semibold text-red-500 uppercase">Vencidas</span>
            </div>
            <p className="text-base font-bold text-red-500 tabular-nums leading-tight">
              {fmt(totalVencidas)}
            </p>
            <p className="text-[10px] text-muted-foreground">{vencidas.length} conta{vencidas.length !== 1 ? 's' : ''}</p>
          </button>

          <button
            onClick={() => setAba('pago')}
            className={cn(
              'section-card !p-3 !space-y-1 text-left transition-all',
              aba === 'pago' && 'ring-2 ring-primary/30'
            )}
          >
            <div className="flex items-center gap-1">
              <CheckCircle2 size={12} className="text-green-500" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Pago</span>
            </div>
            <p className="text-base font-bold text-green-600 tabular-nums leading-tight">{fmt(totalPago)}</p>
            <p className="text-[10px] text-muted-foreground">{pagas.length} conta{pagas.length !== 1 ? 's' : ''}</p>
          </button>
        </div>

        {/* Título da lista */}
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {aba === 'pendente' && '📋 Contas a pagar'}
          {aba === 'vencida' && '🚨 Contas vencidas'}
          {aba === 'pago' && '✅ Pagamentos realizados'}
        </p>

        {/* Campo de busca */}
        {!loading && lista.length > 2 && (
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar por nome ou categoria..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="form-input pl-8 pr-8 text-sm"
            />
            {busca && (
              <button
                onClick={() => setBusca('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="section-card animate-pulse !space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : listaFiltrada.length === 0 && busca ? (
          <div className="section-card text-center py-8 space-y-2">
            <p className="text-2xl">🔍</p>
            <p className="text-sm font-semibold">Nenhum resultado para "{busca}"</p>
            <button onClick={() => setBusca('')} className="text-xs text-primary font-medium">
              Limpar busca
            </button>
          </div>
        ) : lista.length === 0 ? (
          <div className="section-card text-center py-10 space-y-3">
            <p className="text-4xl">
              {aba === 'pendente' ? '🎉' : aba === 'vencida' ? '✅' : '📋'}
            </p>
            <p className="text-sm font-semibold">
              {aba === 'pendente' && 'Tudo em dia neste período!'}
              {aba === 'vencida' && 'Sem contas vencidas!'}
              {aba === 'pago' && 'Nenhum pagamento neste mês'}
            </p>
            <p className="text-[12px] text-muted-foreground">
              {aba === 'pendente' && 'Não há contas pendentes neste mês'}
              {aba === 'vencida' && 'Ótimo! Todas as contas estão em dia'}
              {aba === 'pago' && 'Quando uma conta for paga, aparecerá aqui'}
            </p>
            {aba === 'pendente' && (
              <button
                onClick={() => navigate('/nova-conta')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary mt-2"
              >
                <Plus size={16} /> Registrar novo gasto
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2 pb-6">
            {busca && listaFiltrada.length < lista.length && (
              <p className="text-[11px] text-muted-foreground px-1">
                {listaFiltrada.length} de {lista.length} resultado{lista.length !== 1 ? 's' : ''}
              </p>
            )}
            {listaFiltrada.map((conta, i) => {
              const vencida = isVencida(conta);
              const vencInfo = getLabelVencimento(conta);
              const dias = diasAteVencer(conta);
              const urgente = dias >= 0 && dias <= 1 && aba === 'pendente';
              const isPending = conta._syncStatus === 'pending';

              return (
                <button
                  key={conta.id}
                  onClick={() => navigate(`/conta/${conta.id}`)}
                  className={cn(
                    'section-card w-full text-left active:scale-[0.98] transition-transform !p-4 !space-y-0',
                    vencida && 'border-red-300 bg-red-50/40',
                    urgente && !vencida && 'border-yellow-300 bg-yellow-50/30',
                    isPending && 'border-blue-200 bg-blue-50/20',
                  )}
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        {isPending && <CloudOff size={11} className="text-blue-500 shrink-0" />}
                        {vencida && <AlertTriangle size={12} className="text-red-500 shrink-0" />}
                        {urgente && !vencida && <Clock size={12} className="text-yellow-600 shrink-0" />}
                        {conta.recorrente && <RefreshCw size={10} className="text-blue-500 shrink-0" />}
                        {conta.status === 'Aprovada' && (
                          <span className="text-[9px] bg-green-100 text-green-700 font-bold px-1.5 rounded-full uppercase">
                            Aprovada
                          </span>
                        )}
                        <p className="font-semibold text-sm truncate">{conta.descricao}</p>
                      </div>
                      <p className={cn('text-[11px] mt-0', vencInfo.color)}>
                        {isPending && '⏳ Pendente de sync · '}
                        {aba === 'pago' ? '✓ Pago' : vencInfo.text}
                        {conta.categoria && ` · ${conta.categoria}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className={cn(
                        'text-sm font-bold tabular-nums',
                        aba === 'pago' ? 'text-green-600' : vencida ? 'text-red-500' : urgente ? 'text-yellow-600' : 'text-foreground'
                      )}>
                        {fmt(Number(conta.valor))}
                      </p>
                      <Arrow size={15} className="text-muted-foreground/40" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Botão flutuante Nova Conta */}
      <button
        onClick={() => navigate('/nova-conta')}
        className="fixed bottom-20 z-40 gradient-primary shadow-lg flex items-center gap-2 px-5 h-12 rounded-full active:scale-95 transition-transform text-primary-foreground font-semibold text-sm"
        style={{ right: 'max(1rem, calc((100vw - 672px) / 2 + 1rem))' }}
      >
        <Plus size={20} />
        Nova conta
      </button>
    </AppLayout>
  );
}
