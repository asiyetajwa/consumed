// Paper confetti on a canvas over the app. Respects reduced motion.

const COLORS = ['#f6b52a', '#e8432e', '#2f6b2a', '#3c6fd8', '#f3a0b5', '#fcf9ec'];

export function confetti(originX: number, originY: number, count = 120, spread = 1): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas');
  c.className = 'confetti';
  const dpr = Math.min(2, devicePixelRatio || 1);
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  document.body.appendChild(c);
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  const parts = Array.from({ length: count }, (_, i) => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3 * spread;
    const v = 7 + Math.random() * 9;
    return { x: originX, y: originY, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4, w: 6 + Math.random() * 7, h: 9 + Math.random() * 9, color: COLORS[i % COLORS.length]! };
  });
  const t0 = performance.now();
  const frame = (t: number) => {
    g.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.32;
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.r);
      g.scale(1, Math.cos(p.r * 2));
      g.fillStyle = p.color;
      g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      g.restore();
    }
    if (t - t0 < 3200) requestAnimationFrame(frame);
    else c.remove();
  };
  requestAnimationFrame(frame);
}
