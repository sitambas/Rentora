'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { initials, type Invoice, type TicketStatus, TICKET_STATUS_LABEL, daysBetween } from '@rentora/shared';

/* ---------- icons ---------- */
const P = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  building: 'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M2 21h20M8 7h2M8 11h2M8 15h2',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  card: 'M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM2 10h20M6 15h4',
  user: 'M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10',
  bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.3-4.3',
  plus: 'M12 5v14M5 12h14',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  back: 'M19 12H5M11 6l-6 6 6 6',
  check: 'M20 6 9 17l-5-5',
  wrench: 'M14.7 6.3a4 4 0 0 0 5 5l-9.4 9.4a2.1 2.1 0 0 1-3-3zM14.7 6.3 18 3l3 3-3.3 3.3',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
  chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  box: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  cal: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 2v4M8 2v4M3 10h18',
  bolt: 'M13 2 3 14h9l-1 8 10-12h-9z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  wallet: 'M20 7V5a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-4a2 2 0 0 0 0 4h4v2a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V6',
  alert: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0M12 9v4M12 17h0',
  trend: 'M22 7l-8.5 8.5-5-5L2 17M16 7h6v6',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  pin: 'M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5',
  x: 'M18 6 6 18M6 6l12 12',
  copy: 'M9 9h11v11H9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  megaphone: 'M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1M16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14',
  clipboard: 'M9 4h6v3H9zM9 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-3M9 12h6M9 16h4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  refresh: 'M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M3 21v-5h5'
} as const;
export type IconName = keyof typeof P;

export const Icon = ({ name, size = 18 }: { name: IconName; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={P[name]} />
  </svg>
);

export const LogoMark = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ flex: 'none' }}>
    <rect width="32" height="32" rx="9" fill="var(--brand)" />
    <path d="M8 15.2 16 8.6l8 6.6V23.6H8z" fill="none" stroke="var(--brand-ink)" strokeWidth="2.3" strokeLinejoin="round" />
    <circle cx="16" cy="16.6" r="2.3" fill="var(--brand-ink)" />
    <path d="M16 18v3" stroke="var(--brand-ink)" strokeWidth="2.3" strokeLinecap="round" />
  </svg>
);

const AV = ['#1F4FD8', '#0E9A63', '#B8579B', '#D9792B', '#6A4BD6', '#2A8AA8', '#C0443F'];
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const c = AV[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AV.length];
  return <span className="avatar" style={{ background: c, width: size, height: size, fontSize: size * 0.36 }}>{initials(name)}</span>;
}

/* ---------- status pills ---------- */
export function InvoicePill({ inv }: { inv: Invoice }) {
  if (inv.status === 'PAID') return <span className="pill dot p-good">Paid</span>;
  if (inv.status === 'OVERDUE') {
    const d = daysBetween(inv.dueDate, new Date());
    return <span className="pill dot p-bad">Overdue {d} day{d === 1 ? '' : 's'}</span>;
  }
  const d = daysBetween(new Date(), inv.dueDate);
  return <span className="pill dot p-warn">{d <= 0 ? 'Due today' : `Due in ${d} day${d === 1 ? '' : 's'}`}</span>;
}

export function TicketPill({ status }: { status: TicketStatus }) {
  const cls = status === 'RESOLVED' ? 'p-good' : status === 'SCHEDULED' ? 'p-warn' : status === 'IN_PROGRESS' ? 'p-info' : 'p-bad';
  return <span className={`pill ${cls}`}>{TICKET_STATUS_LABEL[status]}</span>;
}

/* ---------- feedback ---------- */
export const Skeleton = ({ h = 90 }: { h?: number }) => <div className="skeleton" style={{ minHeight: h }} />;

export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card" role="alert">
      <div className="row"><span className="tile-ic" style={{ background: 'var(--bad-soft)', color: 'var(--bad)' }}><Icon name="alert" /></span>
        <div className="grow">{message}</div>
        {onRetry && <button className="btn btn-line btn-sm" onClick={onRetry}>Try again</button>}
      </div>
    </div>
  );
}

type ToastFn = (msg: string, tone?: 'ok' | 'bad') => void;
const ToastCtx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ msg: string; tone: 'ok' | 'bad' } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback<ToastFn>((msg, tone = 'ok') => {
    setT({ msg, tone });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setT(null), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t && <div className={`toast ${t.tone === 'bad' ? 'bad' : ''}`} role="status"><Icon name={t.tone === 'bad' ? 'alert' : 'check'} size={16} />{t.msg}</div>}
    </ToastCtx.Provider>
  );
}

/* ---------- sheet (modal) ---------- */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row between">
          <h2 className="h2">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, id, hint, children }: { label: string; id: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

/* ---------- art ---------- */
/** Dusk-lit residential towers, deterministic per seed string. */
export function BuildingArt({ seed, tall = false }: { seed: string; tall?: boolean }) {
  let r = [...seed].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 233280;
  const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  const hue = [218, 196, 248, 172, 26, 205, 232, 186][Math.floor(rnd() * 8)];
  const id = `b${seed.replace(/\W/g, '').slice(-8)}${tall ? 't' : ''}`;
  const H = 180, G = 160;
  const far: ReactNode[] = [];
  for (let x = 0, i = 0; x < 380; i++) { const w = 14 + rnd() * 26, h = 30 + rnd() * 50; far.push(<rect key={i} x={x} y={G - h} width={w} height={h} />); x += w + 2; }
  const towers = tall ? [[24, 58, 62], [96, 18, 84], [192, 40, 74], [278, 78, 70]] : [[34, 62, 80], [128, 26, 104], [246, 70, 84]];
  const body: ReactNode[] = [];
  towers.forEach(([tx, ty, tw], i) => {
    const side = Math.round(tw * 0.22), front = tw - side;
    body.push(<rect key={`f${i}`} x={tx} y={ty} width={front} height={G - ty} fill={`url(#f${id})`} />);
    body.push(<path key={`s${i}`} d={`M${tx + front} ${ty} l${side} 7 V${G} H${tx + front}z`} fill={`hsl(${hue} 32% ${14 + (i % 2) * 3}%)`} />);
    for (let fy = ty + 10; fy < G - 10; fy += 13) {
      for (let fx = tx + 6; fx < tx + front - 9; fx += 12) {
        const lit = rnd() > 0.58;
        body.push(<rect key={`w${i}-${fx}-${fy}`} x={fx} y={fy} width={8} height={8} rx={1} fill={lit ? `hsl(${38 + rnd() * 12} 95% ${68 + rnd() * 12}%)` : `hsl(${hue} 40% ${30 + rnd() * 10}%)`} />);
      }
      body.push(<rect key={`b${i}-${fy}`} x={tx + 3} y={fy + 9} width={front - 6} height={1.6} fill="#fff" opacity={0.28} />);
    }
  });
  const trees = Array.from({ length: 9 }, (_, i) => { const cx = rnd() * 380, rr = 9 + rnd() * 11; return <circle key={i} cx={cx} cy={G + 4 - rr * 0.4} r={rr} fill={`hsl(${140 + rnd() * 20} ${30 + rnd() * 15}% ${18 + rnd() * 10}%)`} />; });
  return (
    <svg viewBox={`0 0 380 ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={`hsl(${hue + 15} 55% 34%)`} /><stop offset=".6" stopColor={`hsl(${hue + 40} 55% 62%)`} /><stop offset="1" stopColor="hsl(28 85% 78%)" /></linearGradient>
        <linearGradient id={`f${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={`hsl(${hue} 30% 30%)`} /><stop offset="1" stopColor={`hsl(${hue} 32% 22%)`} /></linearGradient>
      </defs>
      <rect width="380" height={H} fill={`url(#s${id})`} />
      <g fill={`hsl(${hue + 20} 30% 45%)`} opacity={0.55}>{far}</g>
      {body}
      <rect y={G} width="380" height={H - G} fill={`hsl(${hue} 20% 14%)`} />
      {trees}
    </svg>
  );
}

/* ---------- chart ---------- */
export function FlowChart({ points }: { points: { label: string; value: number }[] }) {
  const W = 340, H = 150, pl = 40, pr = 12, pt = 12, pb = 24;
  const vals = points.map(p => p.value);
  const maxV = Math.max(...vals, 1);
  const step = maxV > 400000 ? 200000 : maxV > 100000 ? 100000 : 50000;
  const max = Math.ceil(maxV / step) * step || step;
  const x = (i: number) => pl + (i * (W - pl - pr)) / Math.max(1, vals.length - 1);
  const y = (v: number) => pt + ((max - v) / max) * (H - pt - pb);
  const pts = vals.map((v, i) => [x(i), y(v)] as const);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], cx = (x0 + x1) / 2; d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`; }
  const ticks = [0, max / 2, max];
  const [lx, ly] = pts[pts.length - 1];
  const fmt = (v: number) => (v >= 100000 ? `${(v / 100000).toFixed(v % 100000 ? 1 : 0)}L` : v >= 1000 ? `${Math.round(v / 1000)}K` : '0');
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Rent collected by month: ${points.map(p => `${p.label} ${p.value}`).join(', ')}`}>
      <defs><linearGradient id="flowfill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--brand)" stopOpacity=".22" /><stop offset="1" stopColor="var(--brand)" stopOpacity="0" /></linearGradient></defs>
      {ticks.map(t => (
        <g key={t}><line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="var(--line)" /><text x={pl - 6} y={y(t) + 3} textAnchor="end">₹{fmt(t)}</text></g>
      ))}
      <path d={`${d} L${lx},${H - pb} L${pl},${H - pb} Z`} fill="url(#flowfill)" />
      <path d={d} fill="none" stroke="var(--brand)" strokeWidth={2.5} />
      {pts.slice(0, -1).map(([a, b], i) => <circle key={i} cx={a} cy={b} r={3} fill="var(--surface)" stroke="var(--brand)" strokeWidth={1.5} />)}
      <circle cx={lx} cy={ly} r={5} fill="var(--brand)" stroke="var(--surface)" strokeWidth={2} />
      {points.map((p, i) => (
        <text key={p.label} x={x(i)} y={H - 6} textAnchor="middle" style={i === points.length - 1 ? { fill: 'var(--brand)', fontWeight: 600 } : undefined}>{p.label}</text>
      ))}
    </svg>
  );
}
