import { useState } from 'react';
import { tr } from '../lib/i18n';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, Baby, BadgeCheck, Clock, FileSignature, Flame, Handshake, Pencil, Play, ShieldCheck, Trash2, Trophy } from 'lucide-react';
import {
  CHILDREN_PER_UNIT, fmtLakh, typeLabel, CRECHE_TYPES,
  type BidView, type OpportunityDetail, type Role,
} from '../../shared/types';
import { api } from '../lib/api';
import { useApi, timeAgo } from '../lib/hooks';
import { ROLE_META, useRole } from '../lib/role';
import { useToast } from '../lib/toast';
import { NEXT_STEP } from '../lib/stage';
import { Button, Card, Empty, Field, Input, Loading, Modal, Pill, PriorityDot, ProgressBar, ScoreRing, SectionTitle, StageBadge, Stepper, cn } from '../components/ui';
import { MatchBreakdown } from '../components/MatchBreakdown';
import { ROLE_ICON, ROLE_TONE } from '../components/roleUi';
import MapView from '../components/MapView';

export default function OpportunityPage() {
  const { id = '' } = useParams();
  const { role, version, bump } = useRole();
  const as = role === 'nfp' ? 'nfp' : role === 'csr' ? 'csr' : undefined;
  const { data, error, loading, setData } = useApi(() => api.opportunity(id, as), [id, as, version]);

  if (loading && !data) return <Loading label={tr('Loading opportunity')} />;
  if (error || !data)
    return (
      <Empty
        title={tr('Opportunity not found')}
        sub={error ?? undefined}
        action={<Link to="/explore" className="text-sm font-bold text-brand-700">{tr('Back to Explore')}</Link>}
      />
    );

  const o = data.opportunity;
  const update = (d: OpportunityDetail) => {
    setData(d);
    bump();
  };

  return (
    <div>
      <Link to="/explore" className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:text-blush-600">
        <ArrowLeft className="h-4 w-4" /> {tr('All opportunities')}
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StageBadge stage={o.stage} />
            <PriorityDot priority={o.priority} />
            {o.pilot && <Pill tone="blush">{tr('Odisha pilot')}</Pill>}
            <span className="text-xs font-semibold text-muted">{o.id}</span>
          </div>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{o.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {o.district}, {o.state} · {tr('Type')} {o.type}, {tr(typeLabel(o.type))} · {tr(o.poshanTag)}
          </p>
        </div>
        <div className="rounded-2xl border border-brand-100 bg-white px-4 py-3 text-right shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted">{tr('Next step')}</div>
          <div className="text-sm font-extrabold text-brand-800">{NEXT_STEP[o.stage]}</div>
        </div>
      </div>

      <Card className="mb-5 !px-4 !py-5 sm:!px-8">
        <Stepper stage={o.stage} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Facts d={data} />
          <FundingCard d={data} />
          {data.awarded && <OperatorCard d={data} />}
          {data.opportunity.stage !== 'open' && data.opportunity.stage !== 'bidding' && <AgreementCard d={data} />}
          {data.audit && <AuditCard d={data} />}
          <Card>
            <SectionTitle title={tr('Activity')} sub={tr('Everything that happened on this opportunity')} />
            <ol className="relative space-y-4 border-l-2 border-brand-100 pl-5">
              {data.timeline.map((t, i) => (
                <motion.li key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="relative">
                  <span className={cn('absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white', t.tone === 'pink' ? 'bg-blush-500' : t.tone === 'green' ? 'bg-ok' : 'bg-brand-500')} />
                  <div className="text-sm font-semibold text-ink">{t.text}</div>
                  <div className="text-[11px] text-muted">{timeAgo(t.at)}</div>
                </motion.li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-5">
          <ActionPanel d={data} onUpdate={update} />
          <Card className="!p-2">
            <div className="h-56 overflow-hidden rounded-xl">
              <MapView items={[o]} selectedId={o.id} onSelect={() => {}} fly={{ lat: o.lat, lng: o.lng, zoom: 8, key: 1 }} showLegend={false} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ---------------- left column cards ---------------- */

function Facts({ d }: { d: OpportunityDetail }) {
  const o = d.opportunity;
  const facts = [
    { l: tr('Creches'), v: o.units, i: <Baby className="h-4 w-4" /> },
    { l: tr('Unit cost'), v: fmtLakh(o.unitCostLakh), i: <FileSignature className="h-4 w-4" /> },
    { l: tr('Total required'), v: fmtLakh(o.totalLakh), i: <Handshake className="h-4 w-4" /> },
    { l: tr('Children (0–6)'), v: o.children.toLocaleString('en-IN'), i: <Baby className="h-4 w-4" /> },
  ];
  return (
    <Card>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {facts.map((f) => (
          <div key={f.l} className="rounded-2xl bg-brand-50/70 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted"><span className="text-blush-500">{f.i}</span>{f.l}</div>
            <div className="mt-1 text-lg font-extrabold text-ink">{f.v}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-brand-100 p-3">
        <div className="flex items-center justify-between text-xs font-bold text-ink">
          <span className="inline-flex items-center gap-1.5"><Flame className="h-4 w-4 text-blush-500" /> {tr('Government-validated need')}</span>
          <span>{o.need} / 100</span>
        </div>
        <div className="mt-2"><ProgressBar value={o.need} max={100} /></div>
        <p className="mt-2 text-[11px] text-muted">
          Demand is defined by {o.createdBy} using POSHAN data ({o.poshanTag}), not by operators. {CHILDREN_PER_UNIT} children per standard creche, {CRECHE_TYPES.find((t) => t.id === o.type)?.hint.toLowerCase()}.
        </p>
      </div>
    </Card>
  );
}

function FundingCard({ d }: { d: OpportunityDetail }) {
  const o = d.opportunity;
  return (
    <Card>
      <SectionTitle title={tr('CSR funding')} sub={`${fmtLakh(o.committedLakh)} committed of ${fmtLakh(o.totalLakh)} · ${Math.round((o.committedLakh / o.totalLakh) * 100)}% funded`} />
      <ProgressBar value={o.committedLakh} max={o.totalLakh} />
      {d.commitments.length === 0 ? (
        <p className="mt-3 text-xs text-muted">{tr('No CSR commitments yet. Funders can fund this whole opportunity or co-fund it with others.')}</p>
      ) : (
        <ul className="mt-3 divide-y divide-brand-50">
          {d.commitments.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2 text-sm">
              <span className="font-semibold text-ink">{c.donorName}</span>
              <span className="font-extrabold text-blush-600">{fmtLakh(c.amountLakh)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function OperatorCard({ d }: { d: OpportunityDetail }) {
  const n = d.awarded!;
  return (
    <Card>
      <SectionTitle title={tr('Awarded operator')} right={<Pill tone="ok"><BadgeCheck className="h-3.5 w-3.5" /> {tr('Certified')}</Pill>} />
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-gradient text-white"><Trophy className="h-5 w-5" /></span>
        <div>
          <div className="text-sm font-extrabold text-ink">{n.name}</div>
          <p className="text-xs text-muted">{n.about}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">
            <Pill>{n.crechesRun} creches run</Pill>
            <Pill>{n.childrenServed.toLocaleString('en-IN')} children</Pill>
            <Pill tone="blush">Audit score {n.auditScore}</Pill>
          </div>
        </div>
      </div>
    </Card>
  );
}

function AgreementCard({ d }: { d: OpportunityDetail }) {
  const o = d.opportunity;
  const funded = o.committedLakh;
  const released = o.stage === 'audited' ? (d.audit?.finding === 'verified' ? 0.7 : 0.3) : o.stage === 'operating' ? 0.3 : 0;
  const ms = [
    { label: tr('On creche start'), pct: 0.3, done: o.operating },
    { label: tr('After first quarterly audit'), pct: 0.4, done: o.stage === 'audited' && d.audit?.finding === 'verified' },
    { label: tr('On year-end verification'), pct: 0.3, done: false },
  ];
  return (
    <Card>
      <SectionTitle title={tr('Tripartite agreement and milestone payments')} right={<Pill tone="neutral">{tr('Simulated')}</Pill>} />
      <div className="grid gap-2 sm:grid-cols-3">
        {[
          [tr('CSR → NFP'), tr('Funds, released by milestone')],
          [tr('Govt → NFP'), tr('Standards and creche model')],
          [tr('Auditor → all'), tr('Independent verification')],
        ].map(([a, b]) => (
          <div key={a} className="rounded-2xl bg-brand-50/70 p-3">
            <div className="text-xs font-extrabold text-brand-800">{a}</div>
            <div className="text-[11px] text-muted">{b}</div>
          </div>
        ))}
      </div>
      <ul className="mt-3 space-y-2">
        {ms.map((m) => (
          <li key={m.label} className="flex items-center justify-between rounded-xl border border-brand-100 px-3 py-2 text-xs">
            <span className="inline-flex items-center gap-2 font-semibold text-ink">
              {m.done ? <BadgeCheck className="h-4 w-4 text-ok" /> : <Clock className="h-4 w-4 text-slate-400" />}
              {tr(m.label)} · {Math.round(m.pct * 100)}%
            </span>
            <span className={cn('font-extrabold', m.done ? 'text-ok' : 'text-muted')}>
              {m.done ? 'Released ' : ''}
              {fmtLakh(funded * m.pct)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-muted">{Math.round(released * 100)}% of committed funds released so far. Payment gateway and contract e-signing are simulated in this prototype.</p>
    </Card>
  );
}

function AuditCard({ d }: { d: OpportunityDetail }) {
  const a = d.audit!;
  const ok = a.finding === 'verified';
  return (
    <Card className={ok ? '' : '!border-amber-300'}>
      <SectionTitle title={tr('Independent assurance note')} sub={`${a.auditor} · ${timeAgo(a.issuedAt)}`} right={ok ? <Pill tone="ok"><ShieldCheck className="h-3.5 w-3.5" /> {tr('Verified')}</Pill> : <Pill className="bg-amber-100 text-amber-800"><AlertTriangle className="h-3.5 w-3.5" /> {tr('At risk')}</Pill>} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [tr('Enrolled'), a.childrenEnrolled.toLocaleString('en-IN')],
          [tr('Enrolment'), `${a.enrolmentPct}%`],
          [tr('Attendance'), `${a.attendancePct}%`],
          [tr('Malnutrition ↓'), `${a.malnutritionReductionPct}%`],
        ].map(([l, v]) => (
          <div key={l} className="rounded-2xl bg-brand-50/70 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted">{l}</div>
            <div className="text-lg font-extrabold text-ink">{v}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">{a.note}</p>
    </Card>
  );
}

/* ---------------- right column: role action panel ---------------- */

function ActionPanel({ d, onUpdate }: { d: OpportunityDetail; onUpdate: (d: OpportunityDetail) => void }) {
  const { role, setRole } = useRole();
  if (!role)
    return (
      <Card>
        <SectionTitle title={tr('Take part in this opportunity')} sub={tr('Pick the role you want to act as. This is a demo, so you can switch any time.')} />
        <div className="grid gap-2">
          {(Object.keys(ROLE_META) as Role[]).map((r) => {
            const I = ROLE_ICON[r];
            return (
              <button key={r} onClick={() => setRole(r)} className="flex items-center gap-3 rounded-2xl border border-brand-100 p-3 text-left transition hover:border-brand-400 hover:bg-brand-50">
                <span className={cn('grid h-9 w-9 place-items-center rounded-full', ROLE_TONE[r])}><I className="h-4 w-4" /></span>
                <span className="leading-tight">
                  <span className="block text-sm font-bold text-ink">{tr(ROLE_META[r].short)}</span>
                  <span className="block text-[11px] text-muted">{tr(ROLE_META[r].blurb)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>
    );
  if (role === 'state') return <StatePanel d={d} onUpdate={onUpdate} />;
  if (role === 'nfp') return <NfpPanel d={d} onUpdate={onUpdate} />;
  if (role === 'csr') return <CsrPanel d={d} onUpdate={onUpdate} />;
  if (role === 'admin') return <AdminPanel d={d} />;
  return <AuditorPanel d={d} onUpdate={onUpdate} />;
}

function useAct(onUpdate: (d: OpportunityDetail) => void) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<OpportunityDetail>, ok: string) => {
    setBusy(true);
    try {
      onUpdate(await fn());
      toast(ok);
    } catch (e) {
      toast(e instanceof Error ? e.message : tr('Something went wrong'), 'error');
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

function StatePanel({ d, onUpdate }: { d: OpportunityDetail; onUpdate: (d: OpportunityDetail) => void }) {
  const o = d.opportunity;
  const { busy, run } = useAct(onUpdate);
  const { state } = useRole();
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const [units, setUnits] = useState(String(o.units));
  const [cost, setCost] = useState(String(o.unitCostLakh));
  const mine = o.state === state;
  const locked = o.stage !== 'open' && o.stage !== 'bidding';

  return (
    <Card>
      <SectionTitle title={tr('State Government')} sub={mine ? tr('You manage {state}', { state }) : tr('This opportunity belongs to {state}. You can only act on your own state.', { state: o.state })} />
      {o.stage === 'bidding' && (
        <>
          <div className="mb-2 text-xs font-bold text-ink">{tr('Bids, ranked by transparent score')}</div>
          <ul className="space-y-2">
            {d.bids.map((b) => (
              <BidRow key={b.id} b={b} units={o.units} canAward={mine} busy={busy} onAward={() => run(() => api.award(o.id, b.id), tr('Awarded to {name}', { name: b.nfp.name }))} />
            ))}
          </ul>
        </>
      )}
      {o.stage === 'open' && <Empty title={tr('No bids yet')} sub={tr('Certified operators will see this in their recommended list. You can still adjust terms.')} />}
      {!locked && mine && (
        <div className="mt-3 flex gap-2">
          <Button variant="ghost" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEdit(true)}>{tr('Edit terms')}</Button>
          {o.bidCount === 0 && o.committedLakh === 0 && (
            <Button variant="danger" size="sm" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={async () => { try { await api.remove(o.id); toast(tr('Opportunity deleted')); history.back(); } catch (e) { toast(e instanceof Error ? e.message : tr('Failed'), 'error'); } }}>{tr('Delete')}</Button>
          )}
        </div>
      )}
      {locked && <p className="text-xs text-muted">{tr('Terms are locked once an operator is awarded.')} {o.nfpName ? tr('Operator: {name}.', { name: o.nfpName }) : ''}</p>}

      <Modal open={edit} onClose={() => setEdit(false)} title={tr('Edit opportunity terms')}>
        <div className="space-y-3">
          <Field label={tr('Number of creches')}><Input type="number" min={1} max={100} value={units} onChange={(e) => setUnits(e.target.value)} /></Field>
          <Field label={tr('Unit cost per creche (₹ lakh)')} hint={tr('State-approved standard cost, published to CSR funders')}><Input type="number" min={5} max={40} step={0.5} value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
          <Button loading={busy} className="w-full" onClick={() => run(async () => { const r = await api.edit(o.id, { units: Number(units), unitCostLakh: Number(cost) }); setEdit(false); return r; }, tr('Terms updated'))}>{tr('Save terms')}</Button>
        </div>
      </Modal>
    </Card>
  );
}

function BidRow({ b, units, canAward, busy, onAward }: { b: BidView; units: number; canAward: boolean; busy: boolean; onAward: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={cn('rounded-2xl border p-3', b.best ? 'border-brand-400 bg-brand-50/60' : 'border-brand-100')}>
      <div className="flex items-center gap-3">
        <ScoreRing score={b.match.score} size={46} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-extrabold text-ink">{b.nfp.name}</span>
            {b.best && <Pill tone="blush">{tr('Best match')}</Pill>}
          </div>
          <div className="text-[11px] text-muted">Quote {fmtLakh(b.quoteLakh)} per creche · {fmtLakh(b.quoteLakh * units)} total</div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <button onClick={() => setOpen((x) => !x)} className="text-[11px] font-bold text-brand-700 hover:text-blush-600">{open ? tr('Hide') : tr('Why this score')}</button>
        {canAward && <Button size="sm" variant={b.best ? 'primary' : 'ghost'} loading={busy} onClick={onAward}>{tr('Award')}</Button>}
      </div>
      {open && <div className="mt-3 border-t border-brand-100 pt-3"><MatchBreakdown match={b.match} title={tr('Operator fit')} /></div>}
    </li>
  );
}

function NfpPanel({ d, onUpdate }: { d: OpportunityDetail; onUpdate: (d: OpportunityDetail) => void }) {
  const o = d.opportunity;
  const { persona } = useRole();
  const { busy, run } = useAct(onUpdate);
  const nfp = persona?.nfp;
  const [quote, setQuote] = useState(String(Math.max(nfp?.costBandLakh[0] ?? 0, Math.min(o.unitCostLakh, nfp?.costBandLakh[1] ?? o.unitCostLakh))));
  const [note, setNote] = useState('');
  const mineAwarded = o.nfpId === persona?.nfpId;

  return (
    <Card>
      <SectionTitle title={nfp?.name ?? tr('Your organisation')} sub={tr('Certified Childcare Operator view')} />
      {d.myMatch && <MatchBreakdown match={d.myMatch} title={tr('Your fit for this opportunity')} />}

      <div className="mt-4 border-t border-brand-100 pt-4">
        {nfp?.status !== 'certified' ? (
          <div className="rounded-2xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">
            {nfp?.status === 'under_review' ? tr('Your application is with the Ministry. You can bid once it is approved.') : tr('You need to be empanelled before you can bid.')}{' '}
            <Link to="/workspace" className="font-extrabold underline">{nfp?.status === 'under_review' ? tr('See status') : tr('Complete empanelment')}</Link>
          </div>
        ) : d.myBid ? (
          <div className="rounded-2xl bg-brand-50 p-3 text-sm font-semibold text-brand-800">
            Your bid: {fmtLakh(d.myBid.quoteLakh)} per creche · <span className="capitalize">{d.myBid.status}</span>
          </div>
        ) : d.myMatch?.eligible ? (
          <div className="space-y-3">
            <Field label={tr('Your quote per creche (₹ lakh)')} hint={tr('State unit cost is {cost}. Quote at or below it.', { cost: fmtLakh(o.unitCostLakh) })}>
              <Input type="number" min={5} max={40} step={0.5} value={quote} onChange={(e) => setQuote(e.target.value)} />
            </Field>
            <Field label={tr('Note to the State (optional)')}><Input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder={tr('Local staffing plan, convergence with Anganwadi…')} /></Field>
            <Button className="w-full" loading={busy} onClick={() => run(() => api.bid(o.id, { nfpId: persona!.nfpId, quoteLakh: Number(quote), note }), tr('Bid submitted'))}>{tr('Submit bid')}</Button>
          </div>
        ) : (
          <p className="text-xs text-muted">{d.myMatch?.warnings[0] ?? tr('Bidding is not open for you on this opportunity.')}</p>
        )}

        {mineAwarded && o.stage === 'matched' && <p className="mt-3 rounded-2xl bg-brand-50 p-3 text-xs font-semibold text-brand-800">{tr('You won this. Waiting for CSR funding to complete.')}</p>}
        {mineAwarded && o.stage === 'funded' && (
          <Button className="mt-3 w-full" variant="pink" icon={<Play className="h-4 w-4" />} loading={busy} onClick={() => run(() => api.operate(o.id), tr('Creches are now operating'))}>
            {tr('Start operating the creches')}
          </Button>
        )}
        {mineAwarded && o.stage === 'operating' && <p className="mt-3 rounded-2xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">{tr('Operating. Daily monitoring is on, the independent audit is next.')}</p>}
      </div>
    </Card>
  );
}

function CsrPanel({ d, onUpdate }: { d: OpportunityDetail; onUpdate: (d: OpportunityDetail) => void }) {
  const o = d.opportunity;
  const { persona } = useRole();
  const { busy, run } = useAct(onUpdate);
  const remaining = o.totalLakh - o.committedLakh;
  const budget = persona?.donor.budgetLakh ?? 0;
  const maxFund = Math.min(remaining, budget);
  const [amount, setAmount] = useState('');
  const amt = amount === '' ? Math.round(maxFund * 10) / 10 : Number(amount);

  return (
    <Card>
      <SectionTitle title={persona?.donor.name ?? tr('Your company')} sub={tr('CSR funder view · {amount} childcare budget left', { amount: fmtLakh(budget) })} />
      {d.myMatch && <MatchBreakdown match={d.myMatch} title={tr('Fit with your CSR priorities')} />}
      <div className="mt-4 border-t border-brand-100 pt-4">
        {d.myCommittedLakh > 0 && <p className="mb-3 rounded-2xl bg-blush-50 p-3 text-xs font-bold text-blush-700">You have committed {fmtLakh(d.myCommittedLakh)} here.</p>}
        {remaining <= 0 ? (
          <p className="text-xs font-semibold text-ok">{tr('Fully funded. Thank you to all funders.')}</p>
        ) : o.stage === 'operating' || o.stage === 'audited' ? (
          <p className="text-xs text-muted">{tr('Funding is closed for operating creches.')}</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {[0.25, 0.5, 1].map((f) => (
                <button key={f} onClick={() => setAmount(String(Math.round(maxFund * f * 10) / 10))} className="rounded-full border border-brand-200 px-3 py-1.5 text-xs font-bold text-brand-800 hover:border-blush-400 hover:bg-blush-50">
                  {f === 1 ? 'Fund the rest' : `${f * 100}%`}
                </button>
              ))}
            </div>
            <Field label={tr('Amount to commit (₹ lakh)')} hint={`${fmtLakh(remaining)} still needed. You can co-fund with other donors.`}>
              <Input type="number" min={1} max={maxFund} step={0.5} value={amount === '' ? String(amt) : amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Button variant="pink" className="w-full" loading={busy} disabled={!(amt > 0) || amt > maxFund + 1e-6} onClick={() => run(() => api.fund(o.id, { donorId: persona!.donorId, amountLakh: amt }), tr('Committed {amount}', { amount: fmtLakh(amt) }))}>
              {tr('Commit {amount}', { amount: fmtLakh(amt || 0) })}
            </Button>
            {amt > maxFund + 1e-6 && <p className="text-[11px] font-semibold text-bad">{tr('Above what is needed or what your budget allows.')}</p>}
          </div>
        )}
      </div>
    </Card>
  );
}

function AuditorPanel({ d, onUpdate }: { d: OpportunityDetail; onUpdate: (d: OpportunityDetail) => void }) {
  const o = d.opportunity;
  const { persona } = useRole();
  const { busy, run } = useAct(onUpdate);
  return (
    <Card>
      <SectionTitle title={persona?.auditor.name ?? 'Auditor'} sub={tr('Independent assurance')} />
      {o.stage === 'operating' ? (
        <div className="space-y-3">
          <p className="text-xs text-muted">{tr('Check utilisation against milestones and field records, then issue the assurance note CSR boards rely on.')}</p>
          <Button className="w-full" icon={<ShieldCheck className="h-4 w-4" />} loading={busy} onClick={() => run(() => api.audit(o.id, { auditorId: persona!.auditorId }), tr('Verified assurance issued'))}>{tr('Verify and issue assurance')}</Button>
          <Button className="w-full" variant="danger" icon={<AlertTriangle className="h-4 w-4" />} loading={busy} onClick={() => run(() => api.audit(o.id, { auditorId: persona!.auditorId, atRisk: true }), tr('Flagged at risk'))}>{tr('Flag as at-risk')}</Button>
        </div>
      ) : o.stage === 'audited' ? (
        <p className="text-xs font-semibold text-ok">{tr('Assurance already issued. See the note on the left.')}</p>
      ) : (
        <p className="text-xs text-muted">Audits start once the creches are operating. Current stage: {o.stage}.</p>
      )}
    </Card>
  );
}

function AdminPanel({ d }: { d: OpportunityDetail }) {
  const o = d.opportunity;
  return (
    <Card>
      <SectionTitle title={tr('Ministry platform admin')} sub={tr('Oversight view. Decisions on this opportunity belong to the State, operator, funder and auditor.')} />
      <ul className="space-y-2 text-sm">
        <li className="flex justify-between"><span className="text-muted">{tr('Stage')}</span><StageBadge stage={o.stage} /></li>
        <li className="flex justify-between"><span className="text-muted">{tr('Published by')}</span><span className="font-semibold text-ink">{o.createdBy}</span></li>
        <li className="flex justify-between"><span className="text-muted">{tr('Bids received')}</span><span className="font-semibold text-ink">{o.bidCount}</span></li>
        <li className="flex justify-between"><span className="text-muted">{tr('Operator')}</span><span className="font-semibold text-ink">{o.nfpName ?? tr('Not awarded')}</span></li>
        <li className="flex justify-between"><span className="text-muted">{tr('Funding')}</span><span className="font-semibold text-ink">{Math.round((o.committedLakh / o.totalLakh) * 100)}%</span></li>
        <li className="flex justify-between"><span className="text-muted">{tr('Assurance')}</span><span className="font-semibold text-ink">{d.audit ? (d.audit.finding === 'verified' ? tr('Verified') : tr('At risk')) : tr('Not yet audited')}</span></li>
      </ul>
      <Link to="/workspace" className="mt-4 inline-block text-xs font-bold text-brand-700 hover:text-blush-600">{tr('Open the admin workspace')}</Link>
    </Card>
  );
}
