import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { animate, AnimatePresence, motion } from 'framer-motion';
import HighchartsReactModule from 'highcharts-react-official';
import { Check, Loader2, X } from 'lucide-react';
import { STAGES, stageIndex, type Priority, type Stage } from '../../shared/types';
import { Highcharts } from '../lib/charts';
import { PRIORITY_COLOR, STAGE_COLOR } from '../lib/stage';
import { useT } from '../lib/i18n';

// the package is CommonJS; depending on the bundler the default import is either the component or the module object
const HighchartsReact = ((HighchartsReactModule as unknown as { default?: typeof HighchartsReactModule }).default ?? HighchartsReactModule);

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Card({ children, className, delay = 0, id }: { children: ReactNode; className?: string; delay?: number; id?: string }) {
  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, delay, ease: 'easeOut' }}
      className={cn('rounded-2xl border border-brand-100 bg-white p-5 shadow-[0_1px_0_rgba(20,48,107,0.04),0_8px_24px_-12px_rgba(20,48,107,0.16)]', className)}
    >
      {children}
    </motion.div>
  );
}

export function SectionTitle({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-[15px] font-bold text-ink">{title}</h3>
        {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function PageHeader({ eyebrow, title, sub, right }: { eyebrow?: string; title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-blush-600">{eyebrow}</div>}
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 0, className }: { value: number; prefix?: string; suffix?: string; decimals?: number; className?: string }) {
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [shown, setShown] = useState(reduce ? value : 0);
  const from = useRef(reduce ? value : 0);
  useEffect(() => {
    // count up from wherever the number currently is, so data refreshes do not flash back to 0
    const controls = animate(from.current, value, {
      duration: reduce ? 0 : 1.1,
      ease: 'easeOut',
      onUpdate: (v) => {
        from.current = v;
        setShown(v);
      },
      onComplete: () => {
        from.current = value;
        setShown(value);
      },
    });
    return () => controls.stop();
  }, [value, reduce]);
  return (
    <span className={className}>
      {prefix}
      {shown.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

export function Chart({ options, height = 280 }: { options: Highcharts.Options; height?: number }) {
  return <HighchartsReact highcharts={Highcharts} options={{ ...options, chart: { ...options.chart, height } }} containerProps={{ style: { width: '100%' } }} />;
}

export function StageBadge({ stage, className }: { stage: Stage; className?: string }) {
  const { tr } = useT();
  const c = STAGE_COLOR[stage];
  const label = STAGES.find((s) => s.id === stage)!.label;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold', className)} style={{ background: `${c}1a`, color: c }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {tr(label)}
    </span>
  );
}

export function PriorityDot({ priority }: { priority: Priority }) {
  const { tr } = useT();
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold capitalize text-muted">
      <span className="h-2 w-2 rounded-full" style={{ background: PRIORITY_COLOR[priority] }} />
      {tr(priority === 'high' ? 'High priority' : priority === 'medium' ? 'Medium priority' : 'Low priority')}
    </span>
  );
}

export function Pill({ children, tone = 'brand', className }: { children: ReactNode; tone?: 'brand' | 'blush' | 'neutral' | 'ink' | 'ok'; className?: string }) {
  const tones = {
    brand: 'bg-brand-100 text-brand-800',
    blush: 'bg-blush-100 text-blush-700',
    neutral: 'bg-slate-100 text-slate-600',
    ink: 'bg-ink text-white',
    ok: 'bg-emerald-50 text-emerald-700',
  };
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold', tones[tone], className)}>{children}</span>;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  id,
  size = 'md',
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  id: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="scroll-thin inline-flex max-w-full overflow-x-auto rounded-full bg-brand-100/70 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'relative shrink-0 whitespace-nowrap rounded-full font-semibold transition-colors',
            size === 'md' ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-xs',
            value === o.value ? 'text-white' : 'text-brand-800 hover:text-brand-600',
          )}
        >
          {value === o.value && (
            <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-full bg-brand-gradient shadow-md" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
          )}
          <span className="relative z-10 flex items-center gap-1.5">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function ScoreRing({ score, size = 52 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const color = score >= 75 ? '#2f6fdb' : score >= 55 ? '#e5408a' : '#b7c3de';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Match score ${score} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e3ecff" strokeWidth={5} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: score / 100 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-[13px] font-extrabold text-ink">{score}</div>
    </div>
  );
}

export function ProgressBar({ value, max, tone = 'gradient' }: { value: number; max: number; tone?: 'gradient' | 'ok' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-brand-100" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div
        className={cn('h-full rounded-full', tone === 'gradient' ? 'bg-brand-gradient' : 'bg-ok')}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </div>
  );
}

/** The six-step lifecycle every opportunity moves through. */
export function Stepper({ stage, compact = false }: { stage: Stage; compact?: boolean }) {
  const { tr } = useT();
  const cur = stageIndex(stage);
  return (
    <ol className="flex w-full items-start" aria-label="Opportunity lifecycle">
      {STAGES.map((s, i) => {
        const done = i < cur;
        const active = i === cur;
        return (
          <li key={s.id} className="relative flex min-w-0 flex-1 flex-col items-center text-center">
            {i > 0 && (
              <span className="absolute left-0 right-1/2 top-[15px] h-0.5 bg-brand-100" aria-hidden>
                <motion.span className="block h-full bg-brand-gradient" initial={{ width: 0 }} animate={{ width: i <= cur ? '100%' : 0 }} transition={{ duration: 0.5, delay: i * 0.08 }} />
              </span>
            )}
            {i < STAGES.length - 1 && <span className="absolute left-1/2 right-0 top-[15px] h-0.5 bg-brand-100" aria-hidden />}
            <motion.span
              initial={{ scale: 0.7 }}
              animate={{ scale: active ? 1.08 : 1 }}
              className={cn(
                'relative z-10 grid h-[31px] w-[31px] place-items-center rounded-full border-2 text-xs font-extrabold',
                done && 'border-transparent bg-brand-gradient text-white',
                active && 'border-blush-500 bg-white text-blush-600 shadow-[0_0_0_4px_rgba(229,64,138,0.15)]',
                !done && !active && 'border-brand-100 bg-white text-slate-400',
              )}
            >
              {done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
            </motion.span>
            <span className={cn('mt-1.5 text-[11px] font-bold leading-tight', active ? 'text-blush-700' : done ? 'text-brand-800' : 'text-slate-400')}>{tr(s.label)}</span>
            {!compact && <span className="hidden text-[10px] leading-tight text-muted sm:block">{tr(s.who)}</span>}
          </li>
        );
      })}
    </ol>
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'pink' | 'ghost' | 'dark' | 'danger'; size?: 'sm' | 'md'; loading?: boolean; icon?: ReactNode }) {
  const v = {
    primary: 'bg-brand-gradient text-white shadow-md shadow-brand-600/25 hover:brightness-110',
    pink: 'bg-blush-600 text-white shadow-md shadow-blush-600/25 hover:bg-blush-700',
    ghost: 'border border-brand-200 bg-white text-brand-800 hover:border-brand-400 hover:bg-brand-50',
    dark: 'bg-ink text-white hover:bg-brand-900',
    danger: 'border border-red-200 bg-white text-bad hover:bg-red-50',
  }[variant];
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-bold transition disabled:cursor-not-allowed disabled:opacity-50',
        size === 'md' ? 'px-5 py-2.5 text-sm' : 'px-3.5 py-1.5 text-xs',
        v,
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

const fieldCls = 'w-full rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-sm font-medium text-ink placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cn(fieldCls, p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cn(fieldCls, 'pr-8', p.className)} />;

export function Modal({ open, onClose, title, children, wide, xl }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; xl?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[2000] grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-brand-950/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 24, scale: 0.97 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 12, scale: 0.98 }}
            className={cn('scroll-thin relative max-h-[90vh] w-full overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl', xl ? 'max-w-4xl' : wide ? 'max-w-2xl' : 'max-w-md')}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-lg font-extrabold text-ink">{title}</h2>
              <button onClick={onClose} aria-label="Close dialog" className="rounded-full p-1.5 text-muted hover:bg-brand-50">
                <X className="h-5 w-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Empty({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 px-6 py-10 text-center">
      <div className="text-sm font-bold text-ink">{title}</div>
      {sub && <div className="mt-1 max-w-sm text-xs text-muted">{sub}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  const { tr } = useT();
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-muted" role="status">
      <Loader2 className="h-4 w-4 animate-spin" /> {tr(label)}…
    </div>
  );
}

export function DemoNote({ children }: { children?: ReactNode }) {
  return <p className="text-[11px] leading-snug text-muted">{children}</p>;
}
