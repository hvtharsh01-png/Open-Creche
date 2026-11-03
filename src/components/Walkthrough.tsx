import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, BadgeCheck, Bell, Check, ChevronLeft, ChevronRight, Play, RotateCcw } from 'lucide-react';
import { CHECKLIST, fmtLakh, type Note, type OpportunityDetail, type Role } from '../../shared/types';
import { api, asRole } from '../lib/api';
import { ROLE_META, useRole } from '../lib/role';
import { useT } from '../lib/i18n';
import { useToast } from '../lib/toast';
import { Button, Modal, ProgressBar, ScoreRing, cn } from './ui';
import { ROLE_ICON, ROLE_TONE } from './roleUi';

interface Ctx {
  oppId: string | null;
  detail: OpportunityDetail | null;
  summary: string;
}

interface Step {
  actor: Role;
  title: string;
  does: string;
  notifies: string[];
  run: (c: Ctx, persona: { nfpId: string; donorId: string; auditorId: string; donorBudget: number }) => Promise<void>;
}

const STATE = 'Odisha';

async function ensureOpp(c: Ctx) {
  if (c.oppId) return c.oppId;
  const r = await asRole('state', STATE, () =>
    api.create({ name: 'Keonjhar Block-7 villages (demo)', state: STATE, district: 'Keonjhar', type: 'B', units: 12, unitCostLakh: 15, priority: 'high', poshanTag: 'Tribal / PVTG habitation' }),
  );
  c.oppId = r.opportunity.id;
  return c.oppId;
}

async function ensureCertified(nfpId: string) {
  const prof = await api.nfp(nfpId);
  let status = prof.nfp.status;
  if (status === 'applied') {
    for (const k of CHECKLIST) await asRole('nfp', STATE, () => api.checklist(nfpId, k.key, true));
    await asRole('nfp', STATE, () => api.submitNfp(nfpId));
    status = 'under_review';
  }
  if (status === 'under_review') await asRole('admin', STATE, () => api.approveNfp(nfpId));
}

const STEPS: Step[] = [
  {
    actor: 'state',
    title: 'State defines where',
    does: 'Odisha publishes a priority location: 12 rural creches in a Keonjhar tribal block, at the standard unit cost.',
    notifies: ['NFP / NGO: a new opportunity is open for bids', 'CSR funder: a new fundable opportunity'],
    run: async (c) => {
      const id = await ensureOpp(c);
      c.summary = `${id} · 12 creches · ${fmtLakh(180)}`;
    },
  },
  {
    actor: 'nfp',
    title: 'An NGO gets empanelled',
    does: 'Nanhe Kadam Foundation uploads the four documents and submits its application. The Ministry reviews it and certifies the operator.',
    notifies: ['Ministry admin: an application is waiting', 'NFP / NGO: approved, can bid in every state'],
    run: async (c, p) => {
      await ensureOpp(c);
      await ensureCertified(p.nfpId);
      c.summary = 'Nanhe Kadam Foundation is a Certified Childcare Operator';
    },
  },
  {
    actor: 'nfp',
    title: 'Operators bid, the platform ranks',
    does: 'Two certified operators bid. The platform scores each one on area, model experience, audit record, capacity and cost, the same rules for everyone.',
    notifies: ['State: new bids are waiting to be reviewed'],
    run: async (c, p) => {
      const id = await ensureOpp(c);
      await ensureCertified(p.nfpId);
      const d0 = await api.opportunity(id);
      if (!d0.bids.some((b) => b.nfpId === p.nfpId)) await asRole('nfp', STATE, () => api.bid(id, { nfpId: p.nfpId, quoteLakh: 15, note: 'Standard design, local women trained as creche workers.' }));
      if (!d0.bids.some((b) => b.nfpId === 'nfp-disha')) await asRole('nfp', STATE, () => api.bid(id, { nfpId: 'nfp-disha', quoteLakh: 14.5, note: 'Existing network of 240 village creches nearby.' }));
      c.detail = await api.opportunity(id);
      c.summary = `${c.detail.bids.length} bids ranked`;
    },
  },
  {
    actor: 'state',
    title: 'State awards',
    does: 'The State reviews the ranked bids and awards the best-matched operator.',
    notifies: ['Winner: you won, funding comes next', 'Other bidders: not selected', 'CSR funder: the project has an operator and is ready for funds'],
    run: async (c, p) => {
      const id = await ensureOpp(c);
      let d = await api.opportunity(id);
      if (d.opportunity.stage === 'open') {
        await ensureCertified(p.nfpId);
        await asRole('nfp', STATE, () => api.bid(id, { nfpId: p.nfpId, quoteLakh: 15, note: '' }));
        d = await api.opportunity(id);
      }
      if (d.opportunity.stage === 'bidding') {
        const best = d.bids.find((b) => b.best) ?? d.bids[0];
        await asRole('state', STATE, () => api.award(id, best.id));
      }
      c.detail = await api.opportunity(id);
      c.summary = `Awarded to ${c.detail.awarded?.name ?? 'the best operator'}`;
    },
  },
  {
    actor: 'csr',
    title: 'A CSR funder commits capital',
    does: 'Meridian Steel & Mining, with plants nearby, funds the whole opportunity. Payments will follow milestones.',
    notifies: ['State: money is committed', 'Operator: the project is fully funded, you can start'],
    run: async (c, p) => {
      const id = await ensureOpp(c);
      const d = await api.opportunity(id);
      const remaining = d.opportunity.totalLakh - d.opportunity.committedLakh;
      if (d.opportunity.stage === 'matched' && remaining > 0) await asRole('csr', STATE, () => api.fund(id, { donorId: p.donorId, amountLakh: Math.min(remaining, p.donorBudget) }));
      c.detail = await api.opportunity(id);
      c.summary = `${fmtLakh(c.detail.opportunity.committedLakh)} committed (${Math.round((c.detail.opportunity.committedLakh / c.detail.opportunity.totalLakh) * 100)}%)`;
    },
  },
  {
    actor: 'auditor',
    title: 'Creches run, the auditor verifies',
    does: 'The operator starts the creches, which triggers the auditor. The auditor checks utilisation and outcomes and issues the assurance note funders need.',
    notifies: ['Auditor: an audit is due', 'State, operator and CSR funder: the assurance note'],
    run: async (c, p) => {
      const id = await ensureOpp(c);
      const d = await api.opportunity(id);
      if (d.opportunity.stage === 'funded') await asRole('nfp', STATE, () => api.operate(id));
      const d2 = await api.opportunity(id);
      if (d2.opportunity.stage === 'operating') await asRole('auditor', STATE, () => api.audit(id, { auditorId: p.auditorId }));
      c.detail = await api.opportunity(id);
      c.summary = c.detail.audit ? `Assurance note: ${c.detail.audit.finding === 'verified' ? 'verified' : 'at risk'}` : 'Operating';
    },
  },
];

export default function Walkthrough({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tr } = useT();
  const nav = useNavigate();
  const toast = useToast();
  const { persona, bump } = useRole();
  const [i, setI] = useState(0);
  const [done, setDone] = useState<boolean[]>(STEPS.map(() => false));
  const [busy, setBusy] = useState(false);
  const [triggers, setTriggers] = useState<Record<number, Note[]>>({});
  const [summary, setSummary] = useState<Record<number, string>>({});
  const [detail, setDetail] = useState<OpportunityDetail | null>(null);
  const ctx = useRef<Ctx>({ oppId: null, detail: null, summary: '' });

  const step = STEPS[i];
  const Icon = ROLE_ICON[step.actor];

  const runOne = async (idx: number) => {
    if (!persona) return;
    const t0 = Date.now() - 50;
    ctx.current.summary = '';
    await STEPS[idx].run(ctx.current, { nfpId: persona.nfpId, donorId: persona.donorId, auditorId: persona.auditorId, donorBudget: persona.donor.budgetLakh });
    const all = await asRole('admin', STATE, () => api.allNotifications());
    setTriggers((t) => ({ ...t, [idx]: all.filter((n) => new Date(n.at).getTime() >= t0).reverse() }));
    setSummary((s) => ({ ...s, [idx]: ctx.current.summary }));
    if (ctx.current.detail) setDetail(ctx.current.detail);
    setDone((d) => d.map((x, k) => (k === idx ? true : x)));
    bump();
  };

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Step failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const runStep = () => guard(() => runOne(i));
  const runAll = () =>
    guard(async () => {
      for (let k = 0; k < STEPS.length; k++) {
        if (!done[k]) {
          setI(k);
          await runOne(k);
          await new Promise((r) => setTimeout(r, 450));
        }
      }
      setI(STEPS.length - 1);
    });

  const reset = async () => {
    await api.reset();
    ctx.current = { oppId: null, detail: null, summary: '' };
    setDone(STEPS.map(() => false));
    setTriggers({});
    setSummary({});
    setDetail(null);
    setI(0);
    bump();
    toast(tr('Demo data reset'));
  };

  const doneCount = done.filter(Boolean).length;

  return (
    <Modal open={open} onClose={onClose} title={tr('Platform walkthrough')} xl>
      <p className="-mt-2 mb-4 text-sm text-muted">{tr('See how one role\'s action triggers the next. Each step runs the real actions, as that role, and shows who got notified.')}</p>
      <ProgressBar value={doneCount} max={STEPS.length} />

      <div className="mt-4 grid gap-4 md:grid-cols-[15rem_minmax(0,1fr)]">
        <ol className="space-y-1.5">
          {STEPS.map((s, k) => {
            const I = ROLE_ICON[s.actor];
            const active = k === i;
            return (
              <li key={s.title}>
                <button
                  onClick={() => setI(k)}
                  className={cn('flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition', active ? 'border-brand-400 bg-brand-50' : 'border-brand-100 hover:border-brand-300')}
                >
                  <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-extrabold', done[k] ? 'bg-ok text-white' : ROLE_TONE[s.actor])}>
                    {done[k] ? <Check className="h-4 w-4" strokeWidth={3} /> : <I className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-blush-600">{k + 1} · {tr(ROLE_META[s.actor].short)}</span>
                    <span className="block truncate text-xs font-extrabold text-ink">{tr(s.title)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="min-h-[22rem] rounded-2xl border border-brand-100 p-4">
          <AnimatePresence mode="wait">
            <motion.div key={i} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}>
              <div className="flex items-center gap-3">
                <span className={cn('grid h-10 w-10 place-items-center rounded-full', ROLE_TONE[step.actor])}><Icon className="h-5 w-5" /></span>
                <div className="leading-tight">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-blush-600">{tr('Step {n} of {total}', { n: i + 1, total: STEPS.length })}</div>
                  <div className="text-base font-extrabold text-ink">{tr(step.title)}</div>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted">{tr(step.does)}</p>

              <div className="mt-3 rounded-2xl bg-brand-50/70 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-800"><Bell className="h-3 w-3" /> {tr('Who gets notified')}</div>
                <ul className="space-y-1">
                  {step.notifies.map((n) => (
                    <li key={n} className="flex items-start gap-2 text-xs font-semibold text-ink"><ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-blush-500" />{tr(n)}</li>
                  ))}
                </ul>
              </div>

              {done[i] && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-ok"><BadgeCheck className="h-4 w-4" /> {summary[i] ?? tr('Done')}</div>

                  {i === 2 && detail && (
                    <ul className="space-y-1.5">
                      {detail.bids.map((b) => (
                        <li key={b.id} className="flex items-center gap-3 rounded-xl border border-brand-100 px-3 py-2">
                          <ScoreRing score={b.match.score} size={38} />
                          <span className="min-w-0 flex-1 truncate text-xs font-bold text-ink">{b.nfp.name}</span>
                          <span className="text-[11px] font-semibold text-muted">{fmtLakh(b.quoteLakh)} {tr('per creche')}</span>
                          {b.best && <span className="rounded-full bg-blush-100 px-2 py-0.5 text-[10px] font-bold text-blush-700">{tr('Best match')}</span>}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div>
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">{tr('Triggered just now')}</div>
                    <ul className="space-y-1">
                      {(triggers[i] ?? []).map((n) => (
                        <li key={n.id} className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] text-ink shadow-[0_0_0_1px_rgba(20,48,107,0.08)]">
                          <span className="mr-1 font-extrabold text-blush-600">{tr(ROLE_META[n.from].short)} → {tr(ROLE_META[n.to].short)}:</span>
                          {n.text}
                        </li>
                      ))}
                      {(triggers[i] ?? []).length === 0 && <li className="text-[11px] text-muted">{tr('Already done earlier, so nothing new was triggered.')}</li>}
                    </ul>
                  </div>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" disabled={i === 0 || busy} onClick={() => setI(i - 1)} icon={<ChevronLeft className="h-3.5 w-3.5" />}>{tr('Back')}</Button>
          <Button size="sm" variant="ghost" disabled={i === STEPS.length - 1 || busy} onClick={() => setI(i + 1)}>{tr('Next')} <ChevronRight className="h-3.5 w-3.5" /></Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" loading={busy} disabled={!persona || done[i]} onClick={runStep} icon={<Play className="h-3.5 w-3.5" />}>{done[i] ? tr('Done') : tr('Run this step')}</Button>
          <Button size="sm" variant="pink" loading={busy} disabled={!persona || doneCount === STEPS.length} onClick={runAll}>{tr('Run all steps')}</Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-brand-100 pt-3 text-xs">
        <button onClick={reset} className="inline-flex items-center gap-1.5 font-bold text-muted hover:text-brand-700"><RotateCcw className="h-3.5 w-3.5" /> {tr('Reset demo data')}</button>
        {ctx.current.oppId && doneCount > 0 && (
          <button onClick={() => { onClose(); nav(`/opportunity/${ctx.current.oppId}`); }} className="inline-flex items-center gap-1 font-extrabold text-brand-700 hover:text-blush-600">
            {tr('Open this opportunity')} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </Modal>
  );
}
