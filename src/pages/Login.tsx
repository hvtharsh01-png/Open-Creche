import { useState, type FormEvent } from 'react';
import { tr } from '../lib/i18n';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Baby, Eye, EyeOff, Heart, Info, Lock, User } from 'lucide-react';
import { STATES, type Role } from '../../shared/types';
import { ROLE_META, useRole } from '../lib/role';
import { useT } from '../lib/i18n';
import { Button, Field, Input, Select, cn } from '../components/ui';
import { PartnerLogos } from '../components/PartnerLogos';
import { ROLE_ICON, ROLE_TONE } from '../components/roleUi';

const DEMO_ID: Record<Role, string> = {
  state: 'state.odisha.demo',
  nfp: 'ngo.nanhekadam.demo',
  csr: 'csr.meridian.demo',
  auditor: 'auditor.assurance.demo',
  admin: 'admin.mwcd.demo',
};

/** the four stakeholders in the proposal, then the Ministry (platform owner) */
const ORDER: Role[] = ['state', 'nfp', 'csr', 'auditor', 'admin'];

/** Hero illustration, used when no photo is dropped into public/login-hero.jpg */
function Illustration() {
  return (
    <svg viewBox="0 0 600 700" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#14306b" />
          <stop offset="55%" stopColor="#2f6fdb" />
          <stop offset="100%" stopColor="#e5408a" />
        </linearGradient>
        <linearGradient id="hill1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5f90ef" />
          <stop offset="100%" stopColor="#2358b8" />
        </linearGradient>
        <linearGradient id="hill2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f272a8" />
          <stop offset="100%" stopColor="#ae1859" />
        </linearGradient>
      </defs>
      <rect width="600" height="700" fill="url(#sky)" />
      <motion.circle cx="460" cy="150" r="70" fill="#fde6f0" opacity="0.9" animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 6, repeat: Infinity }} style={{ transformOrigin: '460px 150px' }} />
      <circle cx="460" cy="150" r="110" fill="#fde6f0" opacity="0.12" />
      {[[80, 120, 5], [180, 70, 3], [310, 140, 4], [120, 230, 3], [540, 260, 3]].map(([x, y, r], i) => (
        <motion.circle key={i} cx={x} cy={y} r={r} fill="#fff" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 3 + i, repeat: Infinity }} />
      ))}
      <path d="M0 470 Q150 380 300 450 T600 430 L600 700 L0 700 Z" fill="url(#hill1)" />
      <path d="M0 540 Q200 470 380 540 T600 520 L600 700 L0 700 Z" fill="url(#hill2)" />

      {/* the creche */}
      <g transform="translate(150 360)">
        <rect x="0" y="70" width="300" height="150" rx="14" fill="#fff" />
        <path d="M-18 78 L150 -10 L318 78 Z" fill="#14306b" />
        <rect x="120" y="130" width="60" height="90" rx="10" fill="#e5408a" />
        <circle cx="168" cy="178" r="4" fill="#fff" />
        <rect x="26" y="110" width="64" height="56" rx="8" fill="#c3d7ff" />
        <rect x="210" y="110" width="64" height="56" rx="8" fill="#c3d7ff" />
        <path d="M150 20 c-10 -14 -30 -2 -18 14 l18 16 l18 -16 c12 -16 -8 -28 -18 -14z" fill="#fbcde2" />
      </g>

      {/* children */}
      {[
        { x: 120, c: '#e5408a', d: 0 },
        { x: 300, c: '#2f6fdb', d: 0.4 },
        { x: 470, c: '#f8a6cb', d: 0.8 },
      ].map((k) => (
        <motion.g key={k.x} animate={{ y: [0, -10, 0] }} transition={{ duration: 2.4, delay: k.d, repeat: Infinity, ease: 'easeInOut' }}>
          <circle cx={k.x} cy="590" r="22" fill="#ffd9c2" />
          <path d={`M${k.x - 28} 650 q28 -52 56 0 z`} fill={k.c} />
          <circle cx={k.x - 8} cy="586" r="2.4" fill="#14213d" />
          <circle cx={k.x + 8} cy="586" r="2.4" fill="#14213d" />
          <path d={`M${k.x - 7} 597 q7 6 14 0`} stroke="#14213d" strokeWidth="2" fill="none" strokeLinecap="round" />
        </motion.g>
      ))}
    </svg>
  );
}

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const { t, lang, setLang } = useT();
  const { role: savedRole, enter, setState, state, persona } = useRole();
  const from = (loc.state as { from?: string } | null)?.from ?? '/';

  const [choice, setChoice] = useState<Role>(savedRole ?? 'state');
  const [uid, setUid] = useState('');
  const [pwd, setPwd] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState(true);

  const label = (c: Role) => tr(ROLE_META[c].short);
  const identity = (c: Role) =>
    c === 'state'
      ? `${state} Women & Child Development Dept.`
      : c === 'nfp'
        ? persona?.nfp.name
        : c === 'csr'
          ? persona?.donor.name
          : c === 'auditor'
            ? persona?.auditor.name
            : tr('Ministry of Women & Child Development, platform team');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    // demo sign-in: nothing is checked. A real deployment would use OTP / e-KYC per role.
    setTimeout(() => {
      enter(choice);
      nav(from, { replace: true });
    }, 650);
  };

  return (
    <div className="grid min-h-screen bg-brand-50 lg:grid-cols-[1.05fr_1fr]">
      {/* left: photo / illustration */}
      {/* fixed to the viewport height so the picture never resizes when the form on the right grows or shrinks */}
      <section className="relative isolate hidden h-screen self-start overflow-hidden lg:sticky lg:top-0 lg:block" aria-label={tr('About the network')}>
        {photo && <img src="/login-hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" onError={() => setPhoto(false)} />}
        {!photo && <Illustration />}
        <div className="absolute inset-0 bg-gradient-to-b from-brand-950/75 via-brand-950/20 to-brand-950/40" />
        <div className="relative z-10 flex h-full flex-col p-10 text-white">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/20 backdrop-blur"><Baby className="h-6 w-6" /></div>
            <div className="leading-tight">
              <div className="text-lg font-extrabold">{tr('Open Creche Network')}</div>
              <div className="text-xs font-medium text-white/75">{tr('A Digital Public Good for childcare')}</div>
            </div>
          </div>

          <div className="mt-12">
            <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="max-w-md text-4xl font-extrabold leading-tight tracking-tight">
              {tr('Every child\'s first 1,000 days deserve quality care.')}
            </motion.h1>
            <p className="mt-3 max-w-md text-sm text-white/80">{tr('Governments define where. Certified NGOs deliver. CSR funders commit. Independent auditors verify.')}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {[['1,747', 'creches in the Odisha pilot'], ['25%', 'fewer underweight children'], ['₹42', 'per child per day']].map(([a, b]) => (
                <div key={b} className="rounded-2xl bg-white/15 px-4 py-2.5 backdrop-blur">
                  <div className="text-lg font-extrabold">{a}</div>
                  <div className="text-[11px] font-semibold text-white/75">{b}</div>
                </div>
              ))}
            </div>
            {/* shows only when permitted logo files exist in public/partners/ */}
            <PartnerLogos className="mt-6" />
          </div>

          <p className="mt-auto text-[11px] text-white/70">{tr('Concept prototype. Not an official government portal. All data is simulated.')}</p>
        </div>
      </section>

      {/* right: sign in */}
      <section className="relative flex min-h-screen flex-col justify-center px-5 py-10 sm:px-10">
        <div className="absolute right-5 top-5 flex items-center gap-2 sm:right-8 sm:top-6">
          <div className="flex rounded-full bg-brand-100/70 p-0.5 text-xs font-bold" role="group" aria-label={tr('Language')}>
            {(['en', 'hi'] as const).map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l} className={cn('rounded-full px-2.5 py-1', lang === l ? 'bg-white text-brand-800 shadow' : 'text-brand-700')}>
                {l === 'en' ? 'EN' : 'हिं'}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-gradient text-white shadow-lg shadow-brand-600/30"><Baby className="h-6 w-6" /></div>
            <div className="leading-tight">
              <div className="text-base font-extrabold text-ink">{tr('Open')} <span className="text-gradient">{tr('Creche')}</span> {tr('Network')}</div>
              <div className="text-[11px] text-muted">{tr('A Digital Public Good for childcare')}</div>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-blush-600">{t('login.eyebrow')}</div>
            <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-ink">{t('login.title')}</h2>
            <p className="mt-1 text-sm text-muted">{t('login.sub')}</p>
          </motion.div>

          <form onSubmit={submit} className="mt-6">
            <fieldset>
              <legend className="mb-2 text-xs font-bold text-ink">{t('login.role')}</legend>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={tr('Sign in as')}>
                {ORDER.map((c, i) => {
                  const Icon = ROLE_ICON[c];
                  const on = choice === c;
                  return (
                    <motion.button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setChoice(c)}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * i }}
                      whileTap={{ scale: 0.97 }}
                      className={cn(
                        'relative flex items-center gap-3 rounded-2xl border bg-white p-3 text-left transition',
                        i === ORDER.length - 1 && 'col-span-2',
                        on ? 'border-transparent shadow-lg shadow-brand-600/15' : 'border-brand-100 hover:border-brand-300',
                      )}
                    >
                      {on && <motion.span layoutId="login-ring" className="absolute inset-0 rounded-2xl ring-2 ring-brand-500" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                      <span className={cn('relative grid h-9 w-9 shrink-0 place-items-center rounded-full', ROLE_TONE[c])}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="relative leading-tight">
                        <span className="block text-sm font-extrabold text-ink">{label(c)}</span>
                        <span className="block text-[11px] text-muted">{tr(ROLE_META[c].verb)}</span>
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </fieldset>

            <AnimatePresence initial={false} mode="wait">
              {
                <motion.div key="creds" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="space-y-3 pt-5">
                    <div className="rounded-2xl bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800">
                      {tr('Signing in as')} <span className="font-extrabold">{identity(choice) ? tr(identity(choice)!) : tr(ROLE_META[choice].label)}</span>
                    </div>
                    {choice === 'state' && (
                      <Field label={tr('State')}>
                        <Select value={state} onChange={(e) => setState(e.target.value)}>{STATES.map((s) => <option key={s}>{s}</option>)}</Select>
                      </Field>
                    )}
                    <Field label={tr('User ID or registered mobile')}>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                        <Input value={uid} onChange={(e) => setUid(e.target.value)} placeholder={DEMO_ID[choice]} autoComplete="username" className="!pl-9" />
                      </div>
                    </Field>
                    <Field label={tr('Password')}>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                        <Input type={show ? 'text' : 'password'} value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder={tr('Any password works in the demo')} autoComplete="current-password" className="!pl-9 !pr-10" />
                        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? tr('Hide password') : tr('Show password')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted hover:bg-brand-50">
                          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </Field>
                    <p className="flex items-start gap-2 text-[11px] text-muted"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {tr('Demo sign-in: nothing is checked. A real deployment would verify each role with OTP and Aadhaar e-KYC.')}</p>
                  </div>
                </motion.div>
              }
            </AnimatePresence>

            <Button type="submit" loading={busy} className="mt-6 w-full !py-3.5 text-base">
              {tr('Enter as {role}', { role: label(choice) })} {!busy && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted">
            <Heart className="h-3.5 w-3.5 text-blush-500" /> {tr('Concept prototype · simulated data · not an official government portal')}
          </p>
        </div>
      </section>
    </div>
  );
}
