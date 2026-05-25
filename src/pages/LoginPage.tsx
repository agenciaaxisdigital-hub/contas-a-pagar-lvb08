import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import logoAxis from '@/assets/logo-axis.png';

/* ── Animated Network Background (silver/charcoal) ── */
interface Node { x: number; y: number; vx: number; vy: number }

function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const rafRef = useRef(0);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);

  const init = useCallback((w: number, h: number) => {
    const count = Math.min(50, Math.max(20, Math.floor((w * h) / 15000)));
    nodesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
    }));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.scale(dpr, dpr);
      init(window.innerWidth, window.innerHeight);
    };
    resize();
    window.addEventListener('resize', resize);
    const onMouseMove = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    const onMouseLeave = () => { mouseRef.current = null; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseleave', onMouseLeave);
    let isHidden = false;
    const onVisibility = () => { isHidden = document.hidden; };
    document.addEventListener('visibilitychange', onVisibility);

    const draw = () => {
      if (isHidden) { rafRef.current = requestAnimationFrame(draw); return; }
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.save();
      ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const nodes = nodesRef.current;
      const maxDist = 150;
      const mouse = mouseRef.current;
      const mouseMaxDist = 200;

      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
        n.x = Math.max(0, Math.min(w, n.x));
        n.y = Math.max(0, Math.min(h, n.y));
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < maxDist) {
            const alpha = (1 - d / maxDist) * 0.2;
            ctx.strokeStyle = `rgba(150,155,165,${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      if (mouse) {
        for (const n of nodes) {
          const dx = n.x - mouse.x;
          const dy = n.y - mouse.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < mouseMaxDist) {
            const alpha = (1 - d / mouseMaxDist) * 0.25;
            ctx.strokeStyle = `rgba(156,163,175,${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }
      }

      for (const n of nodes) {
        const size = 2;
        const gradient = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, size * 4);
        gradient.addColorStop(0, 'rgba(156,163,175,0.25)');
        gradient.addColorStop(1, 'rgba(156,163,175,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(n.x, n.y, size * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(156,163,175,0.55)';
        ctx.beginPath();
        ctx.arc(n.x, n.y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [init]);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0" />;
}


/* ── Main Login Page ── */
export default function LoginPage() {
  const [nome, setNome] = useState(() => localStorage.getItem('saved_user') || '');
  const [password, setPassword] = useState(() => localStorage.getItem('saved_pass') || '');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(() => !!localStorage.getItem('saved_user'));
  const { signInByNome } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        console.log(`[LOGIN] Service Workers registrados: ${regs.length}`);
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !password.trim()) {
      toast.error('Preencha nome e senha');
      return;
    }
    setLoading(true);
    const loginStart = performance.now();
    const { error } = await signInByNome(nome.trim(), password);
    const loginEnd = performance.now();
    console.log(`[PERF] Login duration: ${Math.round(loginEnd - loginStart)}ms${error ? ' (FAILED)' : ' (OK)'}`);
    setLoading(false);
    if (error) {
      const msg = error?.message || String(error);
      if (msg.includes('não encontrado') || msg.includes('not found')) {
        toast.error('Usuário não encontrado. Verifique o nome digitado.');
      } else if (msg.includes('Senha incorreta') || msg.includes('Invalid login')) {
        toast.error('Senha incorreta. Tente novamente.');
      } else {
        toast.error('Erro ao entrar. Verifique seus dados e tente novamente.');
      }
    } else {
      if (remember) {
        localStorage.setItem('saved_user', nome);
        localStorage.setItem('saved_pass', password);
      } else {
        localStorage.removeItem('saved_user');
        localStorage.removeItem('saved_pass');
      }
      navigate('/');
    }
  };

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-start sm:justify-center overflow-y-auto relative"
      style={{ background: 'linear-gradient(160deg, #0F1115 0%, #1A1D24 50%, #0F1215 100%)' }}
    >
      <NetworkBackground />

      <div className="w-full max-w-md relative z-10 px-4 py-8 sm:py-0">
        {/* Identity */}
        <div className="flex flex-col items-center mb-7">
          <img
            src={logoAxis}
            alt="Agência Axis"
            className="mb-1 drop-shadow-2xl"
            style={{ width: 'clamp(90px, 24vw, 130px)', height: 'clamp(90px, 24vw, 130px)', objectFit: 'contain' }}
          />

          <p
            className="font-bold tracking-widest uppercase text-[13px]"
            style={{ color: '#D1D5DB', letterSpacing: '0.25em' }}
          >
            Agência Axis
          </p>
          <p
            className="text-[10px] uppercase tracking-[0.32em] font-medium mt-1"
            style={{ color: '#6B7280' }}
          >
            Contas a Pagar
          </p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-6 sm:p-8 space-y-5"
          style={{
            background: 'rgba(20, 23, 28, 0.75)',
            backdropFilter: 'blur(16px)',
            border: '1.5px solid rgba(150, 155, 165, 0.15)',
            boxShadow: '0 8px 40px rgba(0, 0, 0, 0.4)',
          }}
        >
          {/* Username */}
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.18em] font-semibold block" style={{ color: '#9CA3AF' }}>
              Usuário
            </label>
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px]" style={{ color: '#6B7280' }} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <input
                type="text"
                placeholder="Ex: Administrador"
                value={nome}
                onChange={e => setNome(e.target.value)}
                autoComplete="username"
                required
                className="w-full text-white placeholder:text-gray-500 h-12 pl-11 pr-4 rounded-xl text-sm outline-none transition-all"
                style={{
                  fontSize: '16px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1.5px solid rgba(150,155,165,0.2)',
                }}
                onFocus={e => { e.target.style.borderColor = '#8A8F98'; e.target.style.boxShadow = '0 0 0 3px rgba(138,143,152,0.15)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(150,155,165,0.2)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="text-[11px] uppercase tracking-[0.18em] font-semibold block" style={{ color: '#9CA3AF' }}>
              Senha
            </label>
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px]" style={{ color: '#6B7280' }} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full text-white placeholder:text-gray-600 h-12 pl-11 pr-11 rounded-xl text-sm outline-none transition-all"
                style={{
                  fontSize: '16px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1.5px solid rgba(150,155,165,0.2)',
                }}
                onFocus={e => { e.target.style.borderColor = '#8A8F98'; e.target.style.boxShadow = '0 0 0 3px rgba(138,143,152,0.15)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(150,155,165,0.2)'; e.target.style.boxShadow = 'none'; }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors" style={{ color: '#6B7280' }} tabIndex={-1}>
                {showPassword
                  ? <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" /></svg>
                  : <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                }
              </button>
            </div>
          </div>

          {/* Remember */}
          <div className="flex items-center gap-2.5">
            <input
              type="checkbox"
              id="remember"
              checked={remember}
              onChange={e => setRemember(e.target.checked)}
              className="w-4 h-4 rounded cursor-pointer"
              style={{ accentColor: '#8A8F98' }}
            />
            <label htmlFor="remember" className="text-[13px] cursor-pointer select-none" style={{ color: '#6B7280' }}>
              Lembrar meus dados
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-[52px] rounded-xl font-bold text-[15px] text-white transition-all active:scale-[0.98] disabled:opacity-60 tracking-wide flex items-center justify-center gap-2.5"
            style={{
              background: 'linear-gradient(135deg, #3A3D42 0%, #6B7280 60%, #9CA3AF 100%)',
              boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
            }}
          >
            {loading ? (
              <>
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                Entrando...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Entrar
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center pt-5 pb-4">
          <p className="text-[11px]" style={{ color: '#4B5563' }}>Agência Axis Digital</p>
        </div>
      </div>
    </div>
  );
}

