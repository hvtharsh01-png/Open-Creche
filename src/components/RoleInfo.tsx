import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Bell, Info, MousePointerClick } from 'lucide-react';
import type { Role } from '../../shared/types';
import { ROLE_GUIDE, ROLE_META } from '../lib/role';
import { useT } from '../lib/i18n';
import { cn } from './ui';
import { ROLE_ICON, ROLE_TONE } from './roleUi';

/** The (i) button: what this role can do, what notifies it, and who it notifies. */
export function RoleInfo({ role, className, align = 'right' }: { role: Role; className?: string; align?: 'left' | 'right' }) {
  const { tr } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, []);
  const g = ROLE_GUIDE[role];
  const Icon = ROLE_ICON[role];
  const sections = [
    { title: 'What you can do', items: g.does, icon: MousePointerClick },
    { title: 'What notifies you', items: g.gets, icon: Bell },
    { title: 'Who you notify', items: g.hands, icon: ArrowRight },
  ];
  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={tr('What can I do as {role}?', { role: tr(ROLE_META[role].short) })}
        title={tr('What can I do here?')}
        className="grid h-9 w-9 place-items-center rounded-full border border-brand-200 bg-white text-brand-700 transition hover:border-brand-400 hover:bg-brand-50"
      >
        <Info className="h-4 w-4" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            className={cn('absolute top-[calc(100%+8px)] z-[1200] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-brand-100 bg-white p-4 shadow-2xl', align === 'right' ? 'right-0' : 'left-0')}
          >
            <div className="mb-3 flex items-center gap-3">
              <span className={cn('grid h-9 w-9 place-items-center rounded-full', ROLE_TONE[role])}><Icon className="h-4 w-4" /></span>
              <div className="leading-tight">
                <div className="text-sm font-extrabold text-ink">{tr(ROLE_META[role].label)}</div>
                <div className="text-[11px] text-muted">{tr(ROLE_META[role].blurb)}</div>
              </div>
            </div>
            <div className="space-y-3">
              {sections.map((s) => (
                <div key={s.title}>
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blush-600"><s.icon className="h-3 w-3" /> {tr(s.title)}</div>
                  <ul className="space-y-1">
                    {s.items.map((i) => (
                      <li key={i} className="flex gap-2 text-xs text-ink"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-400" />{tr(i)}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
