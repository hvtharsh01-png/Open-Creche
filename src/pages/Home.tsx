import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Bell, CheckCircle2, Clock, MapPinned, Play, Search, Sparkles } from 'lucide-react';
import type { Role } from '../../shared/types';
import { api } from '../lib/api';
import { timeAgo, useApi } from '../lib/hooks';
import { useT } from '../lib/i18n';
import { ROLE_GUIDE, ROLE_META, useRole } from '../lib/role';
import { AnimatedNumber, Button, Card, Empty, Loading, Pill, SectionTitle, cn } from '../components/ui';
import { RoleInfo } from '../components/RoleInfo';
import Walkthrough from '../components/Walkthrough';

const EXAMPLES = ['rural creches in Keonjhar under ₹20 lakh', 'high priority urban slum Maharashtra', 'industrial near me within 100 km'];

/** one line under the headline, and the main button, for each role */
const ROLE_HOME: Record<Role, { sub: string; cta: string; to: string }> = {
  state: { sub: 'Publish where creches are needed in your state, then award the best-ranked operator.', cta: 'Publish an opportunity', to: '/workspace' },
  nfp: { sub: 'See opportunities that fit your strengths, bid, and start once the funding is in.', cta: 'Find opportunities for me', to: '/explore' },
  csr: { sub: 'Fund government-validated demand near your sites and receive independent assurance.', cta: 'Browse fundable projects', to: '/explore' },
  auditor: { sub: 'See which creches are running and due for audit, and issue assurance notes.', cta: 'Open my audit queue', to: '/workspace' },
  admin: { sub: 'Approve operators, keep master data current and oversee every state.', cta: 'Review applications', to: '/workspace' },
};

/** the whole journey; the steps a role takes part in are highlighted for it */
const FLOW: { title: string; who: Role[]; text: string }[] = [
  { title: 'Define where', who: ['state'], text: 'State publishes priority locations' },
  { title: 'Get empanelled', who: ['nfp', 'admin'], text: 'NGO applies, Ministry certifies' },
  { title: 'Bid and award', who: ['nfp', 'state'], text: 'Operators bid, State awards' },
  { title: 'Fund', who: ['csr'], text: 'CSR funders commit capital' },
  { title: 'Operate', who: ['nfp'], text: 'Operator starts the creches' },
  { title: 'Verify', who: ['auditor'], text: 'Auditor issues assurance' },
];

const TONE = {
  action: { icon: ArrowRight, cls: 'bg-blush-100 text-blush-700' },
  info: { icon: Clock, cls: 'bg-brand-100 text-brand-700' },
  alert: { icon: AlertTriangle, cls: 'bg-amber-100 text-amber-700' },
} as const;

export default function Home() {
  const { tr, t } = useT();
  const nav = useNavigate();
  const { role, state, version } = useRole();
  const [q, setQ] = useState('');
  const [walk, setWalk] = useState(false);
  const insights = useApi(() => api.insights(), [role, state, version]);
  const tasks = useApi(() => api.tasks(), [role, state, version]);
  const notes = useApi(() => api.notifications(), [role, state, version]);

  if (!role) return <Loading />;
  const home = ROLE_HOME[role];
  const go = (text: string) => nav(`/explore${text ? `?q=${encodeURIComponent(text)}` : ''}`);

  return (
    <div className="space-y-8">
      {/* hero */}
      <section className="relative overflow-hidden rounded-[2rem] bg-brand-gradient p-6 text-white shadow-xl shadow-brand-700/25 sm:p-9">
        <motion.div aria-hidden className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-blush-400/30 blur-2xl" animate={{ y: [0, 14, 0], x: [0, -10, 0] }} transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }} />
        <motion.div aria-hidden className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-brand-300/25 blur-2xl" animate={{ y: [0, -16, 0] }} transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }} />
        <svg aria-hidden className="absolute right-6 top-6 hidden h-40 w-40 text-white/10 lg:block" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.2">
          <circle cx="50" cy="50" r="46" />
          <circle cx="50" cy="50" r="8" />
          {Array.from({ length: 24 }).map((_, i) => (
            <line key={i} x1="50" y1="50" x2={50 + 46 * Math.cos((i * Math.PI) / 12)} y2={50 + 46 * Math.sin((i * Math.PI) / 12)} />
          ))}
        </svg>

        <div className="relative max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> {tr(ROLE_META[role].label)}{role === 'state' ? ` · ${state}` : ''}
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mt-4 text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
            {t('hero.title')}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="mt-4 max-w-2xl text-base text-white/85 sm:text-lg">
            {tr(home.sub)}
          </motion.p>

          <motion.form
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
            onSubmit={(e) => {
              e.preventDefault();
              go(q.trim());
            }}
            className="mt-6 flex max-w-2xl items-center gap-2 rounded-full bg-white p-1.5 shadow-2xl shadow-brand-950/30"
            role="search"
          >
            <Search className="ml-3 h-5 w-5 shrink-0 text-brand-600" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('hero.search')} aria-label={tr('Search creche opportunities')} className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm font-medium text-ink placeholder:text-slate-400 focus:outline-none" />
            <Button type="submit" className="shrink-0">{tr('Search')}</Button>
          </motion.form>
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <button key={e} onClick={() => go(e)} className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/25">
                {tr(e)}
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to={home.to} className="inline-flex items-center gap-2 rounded-full bg-blush-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blush-900/30 transition hover:bg-blush-600">
              <MapPinned className="h-4 w-4" /> {tr(home.cta)}
            </Link>
            {role === 'admin' ? (
              <button onClick={() => setWalk(true)} className="inline-flex items-center gap-2 rounded-full border border-white/40 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15">
                <Play className="h-4 w-4 fill-white" /> {tr('Platform walkthrough')}
              </button>
            ) : (
              <Link to="/impact" className="inline-flex items-center gap-2 rounded-full border border-white/40 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15">
                {t('hero.cta2')} <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* your numbers */}
      <section aria-label={tr('Your numbers')}>
        {!insights.data ? <Loading /> : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {insights.data.map((s, i) => (
              <Card key={s.label} delay={i * 0.05} className="!p-4">
                <div className={cn('text-2xl font-extrabold tracking-tight sm:text-3xl', s.tone === 'blush' ? 'text-blush-600' : 'text-brand-700')}>
                  <AnimatedNumber value={s.value} prefix={s.prefix} suffix={s.suffix} decimals={s.decimals} />
                </div>
                <div className="text-xs font-semibold text-muted">{tr(s.label)}</div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* work handed to you */}
      <section className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle title={tr('Needs your action')} sub={tr('Work other roles have handed to you')} right={<RoleInfo role={role} align="right" />} />
          {!tasks.data ? <Loading /> : tasks.data.length === 0 ? (
            <Empty title={tr('You are all caught up')} sub={tr('New tasks appear here when another role hands work to you.')} />
          ) : (
            <ul className="space-y-2">
              {tasks.data.map((t2) => {
                const tone = TONE[t2.tone];
                const I = tone.icon;
                return (
                  <li key={t2.id}>
                    <Link to={t2.link} className="flex items-start gap-3 rounded-2xl border border-brand-100 p-3 transition hover:border-brand-300 hover:bg-brand-50/60">
                      <span className={cn('mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full', tone.cls)}><I className="h-3.5 w-3.5" /></span>
                      <span className="min-w-0 leading-tight">
                        <span className="block truncate text-sm font-extrabold text-ink">{tr(t2.title)}</span>
                        <span className="block text-xs text-muted">{tr(t2.text)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle title={tr('Latest hand-overs')} sub={tr('What other roles just did that affects you')} />
          {!notes.data ? <Loading /> : notes.data.items.length === 0 ? (
            <Empty title={tr('Nothing yet')} sub={tr('When another role acts on your work you will see it here.')} />
          ) : (
            <ul className="space-y-2">
              {notes.data.items.slice(0, 6).map((n) => (
                <li key={n.id}>
                  <Link to={n.link ?? '/'} className="flex items-start gap-3 rounded-2xl p-2.5 transition hover:bg-brand-50">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700"><Bell className="h-3.5 w-3.5" /></span>
                    <span className="min-w-0 leading-tight">
                      <span className="block text-[10px] font-bold uppercase tracking-wide text-blush-600">{tr('From')} {tr(ROLE_META[n.from].short)} · {timeAgo(n.at)}</span>
                      <span className="block text-xs font-semibold text-ink">{n.text}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* where you fit */}
      <section aria-label={tr('Where you fit')}>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-extrabold tracking-tight text-ink">{tr('Where you fit in the journey')}</h2>
          <Pill tone="blush">{tr('Matching is rule-based: every score shows its parts')}</Pill>
        </div>
        <div className="grid gap-3 md:grid-cols-6">
          {FLOW.map((s, i) => {
            const mine = s.who.includes(role);
            return (
              <div key={s.title} className={cn('relative rounded-2xl border p-3 transition', mine ? 'border-transparent bg-brand-gradient text-white shadow-lg shadow-brand-600/25' : 'border-brand-100 bg-white')}>
                <div className="flex items-center justify-between">
                  <span className={cn('grid h-6 w-6 place-items-center rounded-full text-[11px] font-extrabold', mine ? 'bg-white/25' : 'bg-brand-100 text-brand-700')}>{i + 1}</span>
                  {mine && <span className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-bold">{tr('You')}</span>}
                </div>
                <div className={cn('mt-2 text-sm font-extrabold', mine ? 'text-white' : 'text-ink')}>{tr(s.title)}</div>
                <div className={cn('text-[11px] leading-snug', mine ? 'text-white/85' : 'text-muted')}>{tr(s.text)}</div>
              </div>
            );
          })}
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {ROLE_GUIDE[role].hands.map((h) => (
            <li key={h} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-ink shadow-[0_0_0_1px_rgba(20,48,107,0.08)]"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" />{tr(h)}</li>
          ))}
        </ul>
      </section>

      {/* pilot proof */}
      <section>
        <Card className="!p-0 overflow-hidden">
          <div className="grid gap-0 md:grid-cols-[1.4fr_1fr]">
            <div className="bg-brand-950 p-5 text-white sm:p-6">
              <Pill tone="blush">{tr('Proven in the Odisha pilot')}</Pill>
              <p className="mt-2 text-sm text-white/80">{tr('Keonjhar, Sundargarh and Jajpur: 1,747 creches, 28,000+ children, 11 NFP partners, about ₹42 per child per day.')}</p>
            </div>
            <div className="grid grid-cols-2 gap-px bg-brand-100">
              <div className="grid place-items-center bg-white p-4 text-center"><div className="text-3xl font-extrabold text-gradient">25%</div><div className="text-[11px] font-semibold text-muted">{tr('fewer underweight children')}</div></div>
              <div className="grid place-items-center bg-white p-4 text-center"><div className="text-3xl font-extrabold text-gradient">64%</div><div className="text-[11px] font-semibold text-muted">{tr('fewer wasted children')}</div></div>
            </div>
          </div>
        </Card>
      </section>

      {role === 'admin' && <Walkthrough open={walk} onClose={() => setWalk(false)} />}
    </div>
  );
}
