import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays, startOfDay, addDays } from 'date-fns';

/**
 * Hook de notificações de vencimento.
 * - Solicita permissão do browser na primeira vez
 * - Verifica contas a vencer em até 3 dias (uma vez por dia)
 * - Dispara notificações browser quando o app está aberto
 */
export function useNotifications(userId: string | null | undefined) {
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  const checkDueBills = useCallback(async () => {
    if (!userId) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    // Verifica uma vez por dia
    const lastCheck = localStorage.getItem('notif_last_check');
    const today = format(new Date(), 'yyyy-MM-dd');
    if (lastCheck === today) return;

    const now = new Date();
    const horizon = addDays(now, 3);
    const todayStr = format(startOfDay(now), 'yyyy-MM-dd');
    const horizonStr = format(horizon, 'yyyy-MM-dd');

    const { data } = await supabase
      .from('contas_pagar')
      .select('id, descricao, valor, data_vencimento, status')
      .in('status', ['Lancada', 'Aprovada'])
      .gte('data_vencimento', todayStr)
      .lte('data_vencimento', horizonStr)
      .order('data_vencimento');

    if (!data || data.length === 0) {
      localStorage.setItem('notif_last_check', today);
      return;
    }

    localStorage.setItem('notif_last_check', today);

    // Também verificar vencidas
    const { data: vencidas } = await supabase
      .from('contas_pagar')
      .select('id, descricao, valor, data_vencimento')
      .in('status', ['Lancada', 'Aprovada'])
      .lt('data_vencimento', todayStr);

    // Notificação de vencidas
    if (vencidas && vencidas.length > 0) {
      const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
      const total = vencidas.reduce((s, c) => s + Number(c.valor), 0);
      showNotification(
        `🚨 ${vencidas.length} conta${vencidas.length > 1 ? 's' : ''} vencida${vencidas.length > 1 ? 's' : ''}!`,
        `Total: ${fmt(total)} — toque para ver`,
        '/',
        'vencidas'
      );
    }

    // Notificação de contas próximas do vencimento
    data.forEach(conta => {
      const days = differenceInDays(
        startOfDay(new Date(conta.data_vencimento + 'T00:00:00')),
        startOfDay(now)
      );
      const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
      let msg = '';
      if (days === 0) msg = `Vence HOJE · ${fmt(Number(conta.valor))}`;
      else if (days === 1) msg = `Vence amanhã · ${fmt(Number(conta.valor))}`;
      else msg = `Vence em ${days} dias · ${fmt(Number(conta.valor))}`;

      showNotification(
        `⚠️ ${conta.descricao}`,
        msg,
        `/conta/${conta.id}`,
        `conta-${conta.id}`
      );
    });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    requestPermission().then(checkDueBills);
    // Re-verificar quando o usuário volta para a aba
    const handleVisibilityChange = () => {
      if (!document.hidden) checkDueBills();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [userId, requestPermission, checkDueBills]);
}

function showNotification(title: string, body: string, url: string, tag: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag,
        data: { url },
        vibrate: [100, 50, 100],
      } as NotificationOptions);
    });
  } else {
    new Notification(title, { body, icon: '/icon-192.png', tag });
  }
}

/** Retorna o número de contas a vencer nos próximos N dias (para badge na UI) */
export async function getUpcomingCount(days = 3): Promise<{ upcoming: number; overdue: number }> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const horizon = format(addDays(new Date(), days), 'yyyy-MM-dd');

  const [upRes, ovRes] = await Promise.all([
    supabase.from('contas_pagar').select('id', { count: 'exact' })
      .in('status', ['Lancada', 'Aprovada'])
      .gte('data_vencimento', today)
      .lte('data_vencimento', horizon),
    supabase.from('contas_pagar').select('id', { count: 'exact' })
      .in('status', ['Lancada', 'Aprovada'])
      .lt('data_vencimento', today),
  ]);

  return { upcoming: upRes.count ?? 0, overdue: ovRes.count ?? 0 };
}
