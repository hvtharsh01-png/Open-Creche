import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell } from 'lucide-react';
import { api } from '../lib/api';
import { timeAgo, useApi } from '../lib/hooks';
import { ROLE_META, useRole } from '../lib/role';
import { useT } from '../lib/i18n';
import { cn } from './ui';

/** Hand-overs from other roles: "one submits, the other gets notified". */
export function NotificationBell() {
  const { tr } = useT();
  const { role, state, version } = useRole();
  const loc = useLocation();
  const { data, setData } = useApi(() => api.notifications(), [role, state, version, loc.pathname]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const unread = data?.unread ?? 0;
  const toggle = () => {
    setOpen((o) => !o);
    if (!open && unread > 0) {
      api.markRead().then(() => setData((d) => (d ? { ...d, unread: 0 } : d)));
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        aria-label={tr('Notifications') + (unread ? ` (${unread})` : '')}
        aria-expanded={open}
        className="relative grid h-9 w-9 place-items-center rounded-full border border-brand-200 bg-white text-brand-700 transition hover:border-brand-400 hover:bg-brand-50"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-blush-600 px-1 text-[10px] font-extrabold text-white">{unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute right-0 top-[calc(100%+8px)] z-[1200] w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-brand-100 bg-white p-2 shadow-2xl"
          >
            <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted">{tr('Hand-overs to you')}</div>
            <ul className="scroll-thin max-h-80 overflow-y-auto">
              {(data?.items ?? []).length === 0 && <li className="px-3 py-6 text-center text-xs text-muted">{tr('Nothing yet. When another role acts on your work you will see it here.')}</li>}
              {(data?.items ?? []).slice(0, 10).map((n) => (
                <li key={n.id}>
                  <Link to={n.link ?? '/'} onClick={() => setOpen(false)} className={cn('block rounded-xl px-3 py-2 transition hover:bg-brand-50', !n.read && 'bg-brand-50/60')}>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-blush-600">{tr('From')} {tr(ROLE_META[n.from].short)}</div>
                    <div className="text-xs font-semibold text-ink">{n.text}</div>
                    <div className="text-[10px] text-muted">{timeAgo(n.at)}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
