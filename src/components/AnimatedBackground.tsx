import { useEffect, useRef } from 'react';

interface Orb {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  radius: number;
  hue: number;
  saturation: number;
  lightness: number;
  opacity: number;
  speed: number;
  drift: number;
  phase: number;
}

interface MeshPoint {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  hue: number;
  phase: number;
  speed: number;
}

export default function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false })!;

    let w = window.innerWidth;
    let h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio, 2);

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // Luxurious orbs — large, soft, slow-moving gradient spheres
    const orbs: Orb[] = [
      { x: w * 0.2, y: h * 0.3, targetX: 0, targetY: 0, radius: w * 0.45, hue: 340, saturation: 82, lightness: 25, opacity: 0.3, speed: 0.00006, drift: 20, phase: 0 },
      { x: w * 0.8, y: h * 0.7, targetX: 0, targetY: 0, radius: w * 0.38, hue: 320, saturation: 70, lightness: 20, opacity: 0.22, speed: 0.00008, drift: 15, phase: 2 },
      { x: w * 0.5, y: h * 0.15, targetX: 0, targetY: 0, radius: w * 0.32, hue: 350, saturation: 80, lightness: 22, opacity: 0.18, speed: 0.00007, drift: 18, phase: 4 },
      { x: w * 0.3, y: h * 0.8, targetX: 0, targetY: 0, radius: w * 0.35, hue: 310, saturation: 60, lightness: 18, opacity: 0.14, speed: 0.00005, drift: 22, phase: 1 },
      { x: w * 0.7, y: h * 0.4, targetX: 0, targetY: 0, radius: w * 0.28, hue: 345, saturation: 75, lightness: 30, opacity: 0.1, speed: 0.0001, drift: 12, phase: 3 },
    ];

    // Mesh gradient control points
    const meshCols = 5;
    const meshRows = 5;
    const meshPoints: MeshPoint[] = [];
    for (let r = 0; r < meshRows; r++) {
      for (let c = 0; c < meshCols; c++) {
        const bx = (c / (meshCols - 1)) * w;
        const by = (r / (meshRows - 1)) * h;
        meshPoints.push({
          x: bx, y: by,
          baseX: bx, baseY: by,
          hue: 330 + Math.random() * 30,
          phase: Math.random() * Math.PI * 2,
          speed: 0.001 + Math.random() * 0.002,
        });
      }
    }

    // Grain overlay (pre-rendered)
    const grainCanvas = document.createElement('canvas');
    grainCanvas.width = 256;
    grainCanvas.height = 256;
    const grainCtx = grainCanvas.getContext('2d')!;
    const grainData = grainCtx.createImageData(256, 256);
    for (let i = 0; i < grainData.data.length; i += 4) {
      const v = Math.random() * 255;
      grainData.data[i] = v;
      grainData.data[i + 1] = v;
      grainData.data[i + 2] = v;
      grainData.data[i + 3] = 12;
    }
    grainCtx.putImageData(grainData, 0, 0);

    let animId: number;
    let time = 0;

    const draw = () => {
      animId = requestAnimationFrame(draw);
      time += 1;
      const t = time * 0.016; // ~seconds

      // Deep dark base
      ctx.fillStyle = '#070510';
      ctx.fillRect(0, 0, w, h);

      // Animate mesh points
      for (const mp of meshPoints) {
        mp.x = mp.baseX + Math.sin(t * mp.speed * 60 + mp.phase) * 40;
        mp.y = mp.baseY + Math.cos(t * mp.speed * 45 + mp.phase * 1.3) * 30;
      }

      // Draw orbs with ultra-smooth radial gradients
      ctx.globalCompositeOperation = 'screen';

      for (const orb of orbs) {
        orb.phase += orb.speed;
        const ox = orb.x + Math.sin(orb.phase * 1000) * orb.drift;
        const oy = orb.y + Math.cos(orb.phase * 800 + 1) * orb.drift * 0.7;
        const pulseR = orb.radius * (0.95 + 0.05 * Math.sin(orb.phase * 600));

        const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, pulseR);
        const h = orb.hue + Math.sin(orb.phase * 400) * 8;
        grad.addColorStop(0, `hsla(${h}, ${orb.saturation}%, ${orb.lightness + 10}%, ${orb.opacity})`);
        grad.addColorStop(0.3, `hsla(${h}, ${orb.saturation}%, ${orb.lightness}%, ${orb.opacity * 0.6})`);
        grad.addColorStop(0.6, `hsla(${h}, ${orb.saturation - 10}%, ${orb.lightness - 5}%, ${orb.opacity * 0.2})`);
        grad.addColorStop(1, 'hsla(0, 0%, 0%, 0)');

        ctx.fillStyle = grad;
        ctx.fillRect(ox - pulseR, oy - pulseR, pulseR * 2, pulseR * 2);
      }

      // Secondary layer — smaller accent highlights
      const accents = [
        { x: w * 0.15, y: h * 0.5, r: w * 0.12, h: 340, o: 0.08 },
        { x: w * 0.85, y: h * 0.25, r: w * 0.1, h: 350, o: 0.06 },
        { x: w * 0.6, y: h * 0.85, r: w * 0.08, h: 330, o: 0.05 },
      ];
      for (const a of accents) {
        const ax = a.x + Math.sin(t * 0.3 + a.h) * 25;
        const ay = a.y + Math.cos(t * 0.25 + a.h * 0.5) * 20;
        const ag = ctx.createRadialGradient(ax, ay, 0, ax, ay, a.r);
        ag.addColorStop(0, `hsla(${a.h}, 80%, 50%, ${a.o})`);
        ag.addColorStop(1, 'hsla(0, 0%, 0%, 0)');
        ctx.fillStyle = ag;
        ctx.fillRect(ax - a.r, ay - a.r, a.r * 2, a.r * 2);
      }

      ctx.globalCompositeOperation = 'source-over';

      // Subtle noise/grain texture overlay for premium feel
      ctx.globalAlpha = 0.35;
      const pattern = ctx.createPattern(grainCanvas, 'repeat');
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.globalAlpha = 1;

      // Vignette
      const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.15, w / 2, h / 2, w * 0.75);
      vig.addColorStop(0, 'rgba(7, 5, 16, 0)');
      vig.addColorStop(0.6, 'rgba(7, 5, 16, 0.15)');
      vig.addColorStop(1, 'rgba(7, 5, 16, 0.6)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 z-0" />;
}
