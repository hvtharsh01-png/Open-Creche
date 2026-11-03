import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Baby, Briefcase, ChevronDown, Compass, Home as HomeIcon, LogOut } from 'lucide-react';
import type { Role } from '../shared/types';
import Home from './pages/Home';
import Explore from './pages/Explore';
import OpportunityPage from './pages/Opportunity';
import Workspace from './pages/Workspace';
import Impact from './pages/Impact';
import Login from './pages/Login';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PartnerLogos } from './components/PartnerLogos';
import { NotificationBell } from './components/NotificationBell';
import { RoleInfo } from './components/RoleInfo';
import { ROLE_ICON, ROLE_TONE } from './components/roleUi';
import { api } from './lib/api';
import { ROLE_META, useRole } from './lib/role';
import { useToast } from './lib/toast';
import { useT } from './lib/i18n';
import { cn } from './components/ui';

function LogoMark() {
  return (
    <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-gradient text-white shadow-lg shadow-brand-600/30">
      <Baby className="h-5 w-5" strokeWidth={2.4} />
    </div>
  );
}

function Logo() {
  const { tr } = useT();
  return (
    <Link to="/" className="flex items-center gap-3" aria-label="Open Creche Network">
      <LogoMark />
      <div className="leading-tight">
        <div className="text-[15px] font-extrabold tracking-tight text-ink">
          Open <span className="text-gradient">Creche</span> Network
        </div>
        <div className="text-[11px] font-medium text-muted">{tr('One open marketplace for quality childcare')}</div>
      </div>
    </Link>
  );
}

/** role menu: NGOs are split into an already-empanelled operator and a brand-new registrant */
type MenuItem = { key: string; role: Role; mode?: 'empanelled' | 'register'; title: string; sub: string };
const MENU: MenuItem[] = (Object.keys(ROLE_META) as Role[]).flatMap((r): MenuItem[] =>
  r === 'nfp'
    ? [
        { key: 'nfp-emp', role: r, mode: 'empanelled' as const, title: 'NFP / NGO · Empanelled', sub: 'See best matches and bid' },
        { key: 'nfp-new', role: r, mode: 'register' as const, title: 'NFP / NGO · New, register', sub: 'Apply for empanelment in one click' },
      ]
    : [{ key: r, role: r, title: ROLE_META[r].short, sub: ROLE_META[r].verb }],
);

/** Shows who you are signed in as. Switching role is a demo convenience; it takes you through the same permissions a real user would have. */
function RoleSwitcher() {
  const { role, setRole, signOut, state, persona, setNfpId } = useRole();
  const { tr } = useT();
  const toast = useToast();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  if (!role) return null;
  const Icon = ROLE_ICON[role];
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-brand-200 bg-white py-1 pl-1 pr-3 transition hover:border-brand-400 hover:shadow-md"
      >
        <span className={cn('grid h-8 w-8 place-items-center rounded-full', ROLE_TONE[role])}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-[10px] font-semibold text-muted">{tr('Signed in as')}</span>
          <span className="block max-w-[130px] truncate text-xs font-extrabold">{tr(ROLE_META[role].short)}{role === 'state' ? ` · ${state}` : ''}</span>
        </span>
        <ChevronDown className={cn('h-4 w-4 text-muted transition', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute right-0 top-[calc(100%+8px)] z-[1100] w-72 rounded-2xl border border-brand-100 bg-white p-2 shadow-2xl"
          >
            <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted">{tr('Switch role (demo)')}</div>
            {MENU.map((m) => {
              const I = ROLE_ICON[m.role];
              const on = m.role === role && (m.role !== 'nfp' || (m.mode === 'empanelled') === (persona?.nfp?.status === 'certified'));
              return (
                <button
                  key={m.key}
                  role="menuitem"
                  onClick={async () => {
                    setOpen(false);
                    if (m.role === 'nfp') {
                      if (m.mode === 'register') {
                        try {
                          const n = await api.registerNfp({});
                          setNfpId(n.id);
                          toast(tr('Registered. Your application is sent to the Ministry for empanelment.'));
                        } catch (e) {
                          toast(e instanceof Error ? e.message : tr('Failed'), 'error');
                          return;
                        }
                      } else setNfpId(persona?.empanelledNfp?.id ?? null);
                    }
                    setRole(m.role);
                    nav(m.mode === 'register' ? '/workspace' : '/');
                  }}
                  className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-brand-50', on && 'bg-brand-50')}
                >
                  <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full', ROLE_TONE[m.role])}>
                    <I className="h-4 w-4" />
                  </span>
                  <span className="leading-tight">
                    <span className="block text-sm font-bold text-ink">{tr(m.title)}</span>
                    <span className="block text-[11px] text-muted">{tr(m.sub)}</span>
                  </span>
                </button>
              );
            })}
            <button role="menuitem" onClick={() => { setOpen(false); signOut(); nav('/login'); }} className="mt-1 flex w-full items-center gap-3 rounded-xl border-t border-brand-50 px-3 py-2 text-left text-sm font-semibold text-muted hover:bg-brand-50">
              <LogOut className="h-4 w-4" /> {tr('Sign out')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LangToggle() {
  const { lang, setLang } = useT();
  return (
    <div className="flex rounded-full bg-brand-100/70 p-0.5 text-xs font-bold" role="group" aria-label="Language">
      {(['en', 'hi'] as const).map((l) => (
        <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l} className={cn('rounded-full px-2.5 py-1 transition', lang === l ? 'bg-white text-brand-800 shadow' : 'text-brand-700 hover:text-brand-900')}>
          {l === 'en' ? 'EN' : 'हिं'}
        </button>
      ))}
    </div>
  );
}

function Nav() {
  const { t } = useT();
  const { role } = useRole();
  const NAV = [
    { to: '/', label: t('nav.home'), icon: HomeIcon },
    { to: '/explore', label: t('nav.explore'), icon: Compass },
    { to: '/workspace', label: t('nav.workspace'), icon: Briefcase },
    { to: '/impact', label: t('nav.impact'), icon: BarChart3 },
  ];
  return (
    <header className="sticky top-0 z-[1000] border-b border-brand-100 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="hidden lg:block"><Logo /></div>
        <Link to="/" className="lg:hidden" aria-label="Home"><LogoMark /></Link>
        <nav className="flex gap-1 rounded-full bg-brand-50 p-1" aria-label="Main">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className="relative">
              {({ isActive }) => (
                <span className={cn('relative flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-colors sm:px-4', isActive ? 'text-white' : 'text-brand-800 hover:text-blush-600')}>
                  {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-brand-gradient shadow-md shadow-brand-600/30" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                  <Icon className="relative z-10 h-4 w-4" />
                  <span className="relative z-10 hidden md:inline">{label}</span>
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LangToggle />
          <NotificationBell />
          {role && <RoleInfo role={role} />}
          <RoleSwitcher />
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const { tr } = useT();
  return (
    <footer className="border-t border-brand-100 bg-white/60 py-4">
      <div className="mx-auto flex max-w-[1400px] flex-col items-center gap-2 px-4 text-center text-xs text-muted sm:px-6">
        <PartnerLogos variant="plain" className="flex flex-col items-center" />
        <p>{tr('Concept prototype · simulated data · not an official government portal')}</p>
      </div>
    </footer>
  );
}

export default function App() {
  const location = useLocation();
  // new page = start at the top (the layout keeps the scroll position otherwise)
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);
  const { entered, role } = useRole();

  // first visit goes through the login page; /login itself has no portal chrome
  if (location.pathname === '/login') return <Login />;
  if (!entered || !role) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;

  return (
    <div className="min-h-screen bg-[radial-gradient(1100px_480px_at_85%_-10%,#dfeaff_0%,transparent_60%),radial-gradient(900px_420px_at_0%_0%,#fde6f0_0%,transparent_55%)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[3000] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
      <Nav />
      <main id="main" className="mx-auto max-w-[1400px] px-4 pb-12 pt-6 sm:px-6">
        <AnimatePresence mode="wait">
          <motion.div key={location.pathname.split('/')[1]} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
            <ErrorBoundary resetKey={location.pathname}>
              <Routes location={location}>
                <Route path="/" element={<Home />} />
                <Route path="/explore" element={<Explore />} />
                <Route path="/opportunity/:id" element={<OpportunityPage />} />
                <Route path="/workspace" element={<Workspace />} />
                <Route path="/impact" element={<Impact />} />
                <Route path="*" element={<Home />} />
              </Routes>
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
}
