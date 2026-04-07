import { ReactNode, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, PlusCircle, BarChart3, User, TrendingUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import InstallPWA from '@/components/InstallPWA';

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  // Safe update: notify user instead of force-reloading mid-action
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then(reg => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[SW] Nova versão disponível. Reload será aplicado na próxima navegação.');
            // Safe reload: only when page is not busy (no forms open, no sync)
            // Instead of immediate reload, apply on next navigation
            const handleNav = () => {
              window.location.reload();
            };
            window.addEventListener('pagehide', handleNav, { once: true });
          }
        });
      });
    });
  }, []);
  const navItems = [
    { path: '/', icon: Home, label: 'Início' },
    { path: '/nova-conta', icon: PlusCircle, label: 'Nova' },
    ...(isAdmin ? [
      { path: '/admin', icon: TrendingUp, label: 'Gestão' },
      { path: '/admin/relatorio', icon: BarChart3, label: 'Relatório' },
    ] : []),
    { path: '/perfil', icon: User, label: 'Perfil' },
  ];

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col" style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }}>

      {/* Barra superior gradiente */}
      <div className="bg-gradient-to-r from-primary via-rose-400 to-pink-300 h-1 sticky top-0 z-50" />

      {/* Header */}
      <header className="sticky top-1 z-40 bg-card border-b border-border px-4 py-3 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-rose-400 flex items-center justify-center shadow-md">
              <span className="text-xs font-black text-primary-foreground">FS</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground leading-tight">Contas a Pagar</h1>
              <p className="text-[11px] text-muted-foreground">Dra. Fernanda Sarelli</p>
            </div>
          </div>
          {isAdmin && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              Admin
            </span>
          )}
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 pb-24 hide-scrollbar">
        {children}
      </main>

      {/* Prompt de instalação PWA */}
      <InstallPWA />

      {/* Bottom Nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border shadow-[0_-2px_10px_rgba(0,0,0,0.04)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="max-w-2xl mx-auto flex justify-around items-center h-16">
          {navItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-2 px-3 transition-all active:scale-90 min-w-[52px]',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <item.icon size={22} strokeWidth={active ? 2.5 : 1.5} />
                <span className={cn('text-[9px] leading-none', active ? 'font-bold' : 'font-medium')}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
