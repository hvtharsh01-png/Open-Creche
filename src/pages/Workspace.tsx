import { useMemo, useState } from 'react';
import { tr } from '../lib/i18n';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, BadgeCheck, CheckCircle2, FileUp, Play, Plus, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { CHECKLIST, CHILDREN_PER_UNIT, CRECHE_TYPES, STAGES, STATES, fmtLakh, stageIndex, type CrecheType, type Priority } from '../../shared/types';
import { placesIn } from '../../shared/geo';
import { api, type NewOpportunity } from '../lib/api';
import { useApi, timeAgo } from '../lib/hooks';
import { ROLE_META, useRole } from '../lib/role';
import { useToast } from '../lib/toast';
import {
  AnimatedNumber, Button, Card, Empty, Field, Input, Loading, Modal, PageHeader, Pill, PriorityDot, ProgressBar, Segmented, Select, SectionTitle, StageBadge, cn,
} from '../components/ui';
import { OpportunityCard } from '../components/OpportunityCard';
import { RoleInfo } from '../components/RoleInfo';
import Walkthrough from '../components/Walkthrough';

export default function Workspace() {
  const { role, state } = useRole();
  const [walk, setWalk] = useState(false);
  if (!role) return <Loading />;

  return (
    <div>
      <PageHeader
        eyebrow={`${tr('My workspace')} · ${tr(ROLE_META[role].verb)}${role === 'state' ? ` · ${state}` : ''}`}
        title={tr(ROLE_META[role].label)}
        sub={tr(ROLE_META[role].blurb)}
        right={
          <div className="flex items-center gap-2">
            {role === 'admin' && <Button variant="pink" size="sm" icon={<Play className="h-3.5 w-3.5 fill-white" />} onClick={() => setWalk(true)}>{tr('Platform walkthrough')}</Button>}
            <RoleInfo role={role} />
          </div>
        }
      />
      {role === 'state' && <StateWorkspace />}
      {role === 'nfp' && <NfpWorkspace />}
      {role === 'csr' && <CsrWorkspace />}
      {role === 'auditor' && <AuditorWorkspace />}
      {role === 'admin' && <AdminWorkspace />}
      {role === 'admin' && <Walkthrough open={walk} onClose={() => setWalk(false)} />}
    </div>
  );
}

function Kpi({ label, value, prefix, suffix, decimals, tone = 'brand' }: { label: string; value: number; prefix?: string; suffix?: string; decimals?: number; tone?: 'brand' | 'blush' }) {
  return (
    <Card className="!p-4">
      <div className={cn('text-2xl font-extrabold tracking-tight sm:text-3xl', tone === 'blush' ? 'text-blush-600' : 'text-brand-700')}>
        <AnimatedNumber value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
      </div>
      <div className="text-xs font-semibold text-muted">{tr(label)}</div>
    </Card>
  );
}

function NextAction({ title, text, to, cta }: { title: string; text: string; to?: string; cta?: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-gradient p-4 text-white shadow-lg shadow-brand-700/20">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-white/75">{tr('Next best action')}</div>
          <div className="text-sm font-extrabold">{tr(title)}</div>
          <div className="text-xs text-white/80">{tr(text)}</div>
        </div>
      </div>
      {to && cta && (
        <Link to={to} className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-extrabold text-brand-800 hover:bg-blush-50">
          {cta} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

/* ---------------------------------- State ---------------------------------- */

const TAGS = ['Rural stunting hotspot', 'Rural wasting hotspot', 'Tribal / PVTG habitation', 'Urban slum cluster', 'Migrant construction labour', 'Industrial belt', 'Working-mother density'];

function StateWorkspace() {
  const { state, setState, version, bump } = useRole();
  const toast = useToast();
  const nav = useNavigate();
  const opps = useApi(() => api.opportunities(), [version]);
  const [stageFilter, setStageFilter] = useState('');
  const [open, setOpen] = useState(false);

  const mine = useMemo(() => (opps.data ?? []).filter((o) => o.state === state), [opps.data, state]);
  const shown = mine.filter((o) => !stageFilter || o.stage === stageFilter);
  const bidding = mine.filter((o) => o.stage === 'bidding');

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Field label={tr('Managing state')}><Select value={state} onChange={(e) => setState(e.target.value)} className="!w-56">{STATES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <div className="flex-1" />
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>{tr('Create opportunity')}</Button>
      </div>

      {bidding.length > 0 ? (
        <NextAction title={`${bidding.length} opportunit${bidding.length > 1 ? 'ies have' : 'y has'} bids waiting`} text="Review operators ranked by transparent score and award one." to={`/opportunity/${bidding[0].id}`} cta="Review bids" />
      ) : (
        <NextAction title={tr('Define where creches are needed')} text="Add a priority location with a model and a fixed unit cost. CSR funders and operators will see it immediately." />
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={tr('Opportunities')} value={mine.length} />
        <Kpi label={tr('Awaiting bids / award')} value={mine.filter((o) => o.stage === 'open' || o.stage === 'bidding').length} tone="blush" />
        <Kpi label={tr('Funded or running')} value={mine.filter((o) => stageIndex(o.stage) >= stageIndex('funded')).length} />
        <Kpi label={tr('Children planned')} value={mine.reduce((s, o) => s + o.children, 0)} tone="blush" />
      </div>

      <Card>
        <SectionTitle
          title={`${state}: Priority creche opportunities pipeline`}
          sub={tr('States define locations, units and standardised costs. NFPs can only bid, never create custom locations or costs.')}
          right={
            <Select aria-label={tr('Filter by stage')} value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="!w-40 !py-1.5 text-xs">
              <option value="">{tr('All stages')}</option>
              {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          }
        />
        {opps.loading ? <Loading /> : shown.length === 0 ? (
          <Empty title={tr('Nothing here yet')} sub={tr('Create the first opportunity for this state.')} action={<Button size="sm" onClick={() => setOpen(true)}>{tr('Create opportunity')}</Button>} />
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-brand-100 text-[11px] font-bold uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3">{tr('Location')}</th><th className="pr-3">{tr('Type')}</th><th className="pr-3">{tr('Units')}</th><th className="pr-3">{tr('Unit cost')}</th><th className="pr-3">{tr('Stage')}</th><th className="pr-3">{tr('Priority')}</th><th className="pr-3">{tr('Bids')}</th><th />
                </tr>
              </thead>
              <tbody>
                {shown.map((o) => (
                  <tr key={o.id} className="border-b border-brand-50 transition hover:bg-brand-50/60">
                    <td className="py-2.5 pr-3">
                      <button onClick={() => nav(`/opportunity/${o.id}`)} className="text-left font-bold text-ink hover:text-brand-700">{o.name}</button>
                      <div className="text-[11px] text-muted">{o.district}</div>
                    </td>
                    <td className="pr-3 font-semibold">{o.type} · {tr(CRECHE_TYPES.find((t) => t.id === o.type)!.short)}</td>
                    <td className="pr-3 font-semibold">{o.units}</td>
                    <td className="pr-3 font-semibold">{fmtLakh(o.unitCostLakh)}</td>
                    <td className="pr-3"><StageBadge stage={o.stage} /></td>
                    <td className="pr-3"><PriorityDot priority={o.priority} /></td>
                    <td className="pr-3 font-semibold">{o.bidCount}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => nav(`/opportunity/${o.id}`)}>{o.stage === 'bidding' ? 'Review bids' : tr('Open')}</Button>
                        {o.bidCount === 0 && o.committedLakh === 0 && (
                          <button aria-label={`${tr('Delete')} ${o.name}`} onClick={async () => { try { await api.remove(o.id); toast(tr('Opportunity deleted')); bump(); } catch (e) { toast(e instanceof Error ? e.message : tr('Failed'), 'error'); } }} className="rounded-full p-2 text-bad hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CreateModal open={open} onClose={() => setOpen(false)} state={state} onCreated={(id) => { setOpen(false); bump(); toast(tr('Opportunity published to the marketplace')); nav(`/opportunity/${id}`); }} />
    </>
  );
}

function CreateModal({ open, onClose, state, onCreated }: { open: boolean; onClose: () => void; state: string; onCreated: (id: string) => void }) {
  const toast = useToast();
  const master = useApi(() => api.master(), [open]);
  const places = placesIn(state);
  const [form, setForm] = useState<NewOpportunity>({ name: '', state, district: places[0]?.name ?? '', type: 'B', units: 15, unitCostLakh: 15, priority: 'medium', poshanTag: TAGS[0] });
  const [busy, setBusy] = useState(false);

  // keep district valid when the managed state changes
  const district = places.some((p) => p.name === form.district) ? form.district : places[0]?.name ?? '';
  const set = (p: Partial<NewOpportunity>) => setForm((f) => ({ ...f, ...p }));
  const total = form.units * form.unitCostLakh;

  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.create({ ...form, state, district });
      onCreated(r.opportunity.id);
      setForm((f) => ({ ...f, name: '' }));
    } catch (e) {
      toast(e instanceof Error ? e.message : tr('Could not create'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={tr('New opportunity in {state}', { state })} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={tr('Creche location / cluster name')}><Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder={tr('e.g. Keonjhar Block-7 villages')} maxLength={60} /></Field>
        <Field label={tr('District')}><Select value={district} onChange={(e) => set({ district: e.target.value })}>{places.map((p) => <option key={p.name}>{p.name}</option>)}</Select></Field>
        <Field label={tr('Creche model')} hint={tr(CRECHE_TYPES.find((t) => t.id === form.type)?.hint ?? '')}>
          <Select value={form.type} onChange={(e) => { const t = e.target.value as CrecheType; set({ type: t, unitCostLakh: master.data?.find((x) => x.id === t)?.standardCostLakh ?? CRECHE_TYPES.find((x) => x.id === t)!.standardCostLakh }); }}>
            {CRECHE_TYPES.map((t) => <option key={t.id} value={t.id}>{tr('Type')} {t.id} · {tr(t.label)}</option>)}
          </Select>
        </Field>
        <Field label={tr('POSHAN tag')}><Select value={form.poshanTag} onChange={(e) => set({ poshanTag: e.target.value })}>{TAGS.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label={tr('Number of creches')}><Input type="number" min={1} max={100} value={form.units} onChange={(e) => set({ units: Number(e.target.value) })} /></Field>
        <Field label={tr('Unit cost (₹ lakh per creche)')} hint={tr('Standard cost for the model is pre-filled')}><Input type="number" min={5} max={40} step={0.5} value={form.unitCostLakh} onChange={(e) => set({ unitCostLakh: Number(e.target.value) })} /></Field>
        <Field label={tr('Priority')}>
          <Select value={form.priority} onChange={(e) => set({ priority: e.target.value as Priority })}>
            <option value="high">{tr('High')}</option><option value="medium">{tr('Medium')}</option><option value="low">{tr('Low')}</option>
          </Select>
        </Field>
        <div className="rounded-2xl bg-brand-50 p-3 text-sm">
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted">{tr('Total CSR funding required')}</div>
          <div className="text-xl font-extrabold text-brand-800">{fmtLakh(total || 0)}</div>
          <div className="text-[11px] text-muted">{(form.units * CHILDREN_PER_UNIT).toLocaleString('en-IN')} children</div>
        </div>
      </div>
      <Button className="mt-4 w-full" loading={busy} disabled={!form.name.trim()} onClick={submit}>{tr('Publish to marketplace')}</Button>
    </Modal>
  );
}

/* ----------------------------------- NFP ----------------------------------- */

function NfpWorkspace() {
  const { persona, version, bump } = useRole();
  const toast = useToast();
  const prof = useApi(() => (persona ? api.nfp(persona.nfpId) : Promise.resolve(null)), [persona?.nfpId, version]);
  const rec = useApi(() => (persona ? api.matchNfp(persona.nfpId) : Promise.resolve([])), [persona?.nfpId, version]);
  const [busy, setBusy] = useState(false);

  if (!persona || prof.loading || !prof.data) return <Loading />;
  const { nfp, bids, awarded } = prof.data;
  const done = CHECKLIST.filter((c) => nfp.checklist[c.key]).length;
  const certified = nfp.status === 'certified';
  const review = nfp.status === 'under_review';
  const picks = (rec.data ?? []).filter((r) => r.match.eligible).slice(0, 6);

  const toggle = async (key: string, on: boolean) => {
    try {
      await api.checklist(nfp.id, key, on);
      bump();
    } catch (e) {
      toast(e instanceof Error ? e.message : tr('Failed'), 'error');
    }
  };
  const submit = async (all = false) => {
    setBusy(true);
    try {
      // demo shortcut: mark every missing document as uploaded, then send the application
      if (all) for (const c of CHECKLIST) if (!nfp.checklist[c.key]) await api.checklist(nfp.id, c.key, true);
      await api.submitNfp(nfp.id);
      toast('Application submitted. The Ministry will review it.');
      bump();
    } catch (e) {
      toast(e instanceof Error ? e.message : tr('Failed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {certified ? (
        picks[0] ? <NextAction title={tr('Bid on your best-matching opportunity')} text={`${picks[0].opportunity.name}, ${picks[0].opportunity.state}: ${picks[0].match.score}/100 match`} to={`/opportunity/${picks[0].opportunity.id}`} cta="Review and bid" /> : <NextAction title={tr('No open opportunities match right now')} text="New ones appear as States publish them." />
      ) : review ? (
        <NextAction title={tr('Waiting for the Ministry to review your application')} text="You can bid as soon as it is approved. Switch to Ministry admin to approve it in this demo." />
      ) : (
        <NextAction title={tr('Get empanelled to start bidding')} text="Apply once as a Certified Childcare Operator, then bid in every state." />
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <Card>
          <SectionTitle title={tr('Empanelment')} sub={nfp.name} right={certified ? <Pill tone="ok"><BadgeCheck className="h-3.5 w-3.5" /> {tr('Certified')}</Pill> : review ? <Pill tone="blush">{tr('Under review')}</Pill> : <Pill tone="blush">{done}/4 done</Pill>} />
          <ProgressBar value={certified || review ? 4 : done} max={4} tone={certified ? 'ok' : 'gradient'} />
          {certified && <p className="mt-3 rounded-2xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">{tr('You are an empanelled NGO. Your best matches are on the right and you can bid in every state.')}</p>}
          {!certified && !review && (
            <Button className="mt-4 w-full" variant="pink" loading={busy} icon={<FileUp className="h-4 w-4" />} onClick={() => submit(true)}>{tr('Register in one click (demo)')}</Button>
          )}
          <ul className="mt-4 space-y-2">
            {CHECKLIST.map((c) => {
              const on = nfp.checklist[c.key];
              return (
                <li key={c.key} className="flex items-center justify-between gap-2 rounded-2xl border border-brand-100 p-3">
                  <span className="flex items-center gap-2.5">
                    {on ? <CheckCircle2 className="h-5 w-5 text-ok" /> : <span className="h-5 w-5 rounded-full border-2 border-brand-200" />}
                    <span className="leading-tight">
                      <span className="block text-sm font-bold text-ink">{tr(c.label)}</span>
                      <span className="block text-[11px] text-muted">{tr(c.hint)}</span>
                    </span>
                  </span>
                  {!certified && !review && <Button size="sm" variant={on ? 'ghost' : 'primary'} icon={on ? undefined : <FileUp className="h-3.5 w-3.5" />} onClick={() => toggle(c.key, !on)}>{on ? tr('Undo') : tr('Upload')}</Button>}
                </li>
              );
            })}
          </ul>
          {!certified && !review && <Button className="mt-2 w-full" variant="ghost" loading={busy} disabled={done < 4} onClick={() => submit()}>{tr('Submit for empanelment')}</Button>}
          {review && <Button className="mt-4 w-full" variant="ghost" disabled>{tr('Submitted. Waiting for the Ministry')}</Button>}
          <p className="mt-2 text-[11px] text-muted">{certified ? 'Your certification works in all states.' : review ? 'The Ministry (platform owner) checks your documents. In production an independent audit firm also verifies the NFP.' : tr('Upload all four items, then submit. The Ministry approves operators before they can bid.')}</p>
        </Card>

        <div className="space-y-5">
          <Card>
            <SectionTitle title={tr('Recommended for you')} sub={tr('Ranked by area, model experience, track record, capacity and cost fit')} right={<Link to="/explore" className="text-xs font-bold text-brand-700 hover:text-blush-600">{tr('Browse all')}</Link>} />
            {!certified ? <Empty title={review ? tr('Matches unlock once the Ministry approves you') : tr('Get empanelled to see matches')} sub={review ? tr('Your application is with the Ministry. Switch to Ministry admin to approve it in this demo.') : undefined} /> : rec.loading ? <Loading /> : picks.length === 0 ? <Empty title={tr('No open opportunities right now')} /> : (
              <div className="grid gap-3 md:grid-cols-2">{picks.slice(0, 4).map((r, i) => <OpportunityCard key={r.opportunity.id} opp={r.opportunity} match={r.match} index={i} />)}</div>
            )}
          </Card>

          <Card>
            <SectionTitle title={tr('My bids and creches')} />
            {bids.length === 0 && awarded.length === 0 ? <Empty title={tr('No bids yet')} sub={tr('Open a recommended opportunity and submit a quote.')} /> : (
              <ul className="divide-y divide-brand-50">
                {bids.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div>
                      <Link to={`/opportunity/${b.opportunity.id}`} className="text-sm font-bold text-ink hover:text-brand-700">{b.opportunity.name}</Link>
                      <div className="text-[11px] text-muted">{fmtLakh(b.quoteLakh)} per creche · {timeAgo(b.createdAt)}</div>
                    </div>
                    <div className="flex items-center gap-2"><Pill tone={b.status === 'awarded' ? 'ok' : b.status === 'declined' ? 'neutral' : 'brand'} className="capitalize">{b.status}</Pill><StageBadge stage={b.opportunity.stage} /></div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

/* ----------------------------------- CSR ----------------------------------- */

function CsrWorkspace() {
  const { persona, version, bump } = useRole();
  const toast = useToast();
  const prof = useApi(() => (persona ? api.donor(persona.donorId) : Promise.resolve(null)), [persona?.donorId, version]);
  const rec = useApi(() => (persona ? api.matchDonor(persona.donorId) : Promise.resolve([])), [persona?.donorId, version]);
  const [state, setState] = useState<string>('Odisha');
  const [budget, setBudget] = useState('800');
  const [basket, setBasket] = useState<Awaited<ReturnType<typeof api.basket>> | null>(null);
  const [busy, setBusy] = useState(false);

  if (!persona || prof.loading || !prof.data) return <Loading />;
  const { donor, commitments, committedLakh, children } = prof.data;
  const picks = (rec.data ?? []).filter((r) => r.match.eligible).slice(0, 4);

  const propose = async () => {
    setBusy(true);
    try {
      setBasket(await api.basket(donor.id, state, Number(budget) || 0));
    } catch (e) {
      toast(e instanceof Error ? e.message : tr('Failed'), 'error');
    } finally {
      setBusy(false);
    }
  };
  const commit = async () => {
    setBusy(true);
    try {
      const r = await api.commitBasket(donor.id, state, Number(budget) || 0);
      toast(tr('Committed {amount} across {n} opportunities', { amount: fmtLakh(r.totalLakh), n: r.items.length }));
      setBasket(null);
      bump();
    } catch (e) {
      toast(e instanceof Error ? e.message : tr('Failed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {picks[0] ? <NextAction title={tr('Fund a verified, high-need opportunity')} text={`${picks[0].opportunity.name}, ${picks[0].opportunity.state}: ${picks[0].match.score}/100 fit. ${picks[0].match.reasons[0] ?? ''}`} to={`/opportunity/${picks[0].opportunity.id}`} cta="View and fund" /> : <NextAction title={tr('Browse the pipeline')} text="Government-validated demand is waiting for funding." to="/explore" cta="Explore" />}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={tr('CSR budget left')} value={donor.budgetLakh / 100} prefix="₹" suffix=" Cr" decimals={1} />
        <Kpi label={tr('Committed so far')} value={committedLakh / 100} prefix="₹" suffix=" Cr" decimals={2} tone="blush" />
        <Kpi label={tr('Children reached')} value={children} />
        <Kpi label={tr('Opportunities funded')} value={commitments.length} tone="blush" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card>
          <SectionTitle title={tr('Fund a state programme')} sub={tr('Set a budget. The platform picks the best-fit opportunities that fit it, using the same transparent score.')} />
          <div className="space-y-3">
            <Field label={tr('State')}><Select value={state} onChange={(e) => { setState(e.target.value); setBasket(null); }}>{STATES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
            <Field label={tr('Budget (₹ lakh)')} hint={tr('You have {amount} left', { amount: fmtLakh(donor.budgetLakh) })}><Input type="number" min={50} step={50} value={budget} onChange={(e) => { setBudget(e.target.value); setBasket(null); }} /></Field>
            <Button className="w-full" variant="ghost" loading={busy} onClick={propose}>{tr('Propose a matched basket')}</Button>
          </div>
          {basket && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
              {basket.items.length === 0 ? <Empty title={tr('Nothing fits that budget in this state')} sub={tr('Try a larger budget or another state.')} /> : (
                <>
                  <ul className="space-y-2">
                    {basket.items.map((i) => (
                      <li key={i.opportunity.id} className="flex items-center justify-between gap-2 rounded-xl bg-brand-50 px-3 py-2 text-xs">
                        <span className="min-w-0"><span className="block truncate font-extrabold text-ink">{i.opportunity.name}</span><span className="text-muted">{i.match.score}/100 fit · {i.opportunity.children} children</span></span>
                        <span className="shrink-0 font-extrabold text-blush-600">{fmtLakh(i.fundLakh)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-center justify-between text-sm font-extrabold text-ink"><span>{fmtLakh(basket.totalLakh)} · {basket.children.toLocaleString('en-IN')} children</span></div>
                  <Button className="mt-3 w-full" variant="pink" loading={busy} onClick={commit}>{tr('Commit this basket')}</Button>
                </>
              )}
            </motion.div>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <SectionTitle title={tr('Best fits for your CSR priorities')} right={<Link to="/explore" className="text-xs font-bold text-brand-700 hover:text-blush-600">{tr('Browse all')}</Link>} />
            {rec.loading ? <Loading /> : <div className="grid gap-3 md:grid-cols-2">{picks.map((r, i) => <OpportunityCard key={r.opportunity.id} opp={r.opportunity} match={r.match} index={i} />)}</div>}
          </Card>
          <Card>
            <SectionTitle title={tr('My commitments')} />
            {commitments.length === 0 ? <Empty title={tr('No commitments yet')} /> : (
              <ul className="divide-y divide-brand-50">
                {commitments.slice(0, 8).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div><Link to={`/opportunity/${c.opportunity.id}`} className="text-sm font-bold text-ink hover:text-brand-700">{c.opportunity.name}</Link><div className="text-[11px] text-muted">{c.opportunity.state} · {timeAgo(c.createdAt)}</div></div>
                    <div className="flex items-center gap-2"><span className="text-sm font-extrabold text-blush-600">{fmtLakh(c.amountLakh)}</span><StageBadge stage={c.opportunity.stage} /></div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

/* ---------------------------------- Auditor --------------------------------- */

function AuditorWorkspace() {
  const { persona, version, bump } = useRole();
  const toast = useToast();
  const q = useApi(() => api.auditQueue(), [version]);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!persona || q.loading || !q.data) return <Loading />;
  const { awaiting, upcoming, audited } = q.data;

  const run = async (id: string, atRisk: boolean) => {
    setBusyId(id);
    try {
      await api.audit(id, { auditorId: persona.auditorId, atRisk });
      toast(atRisk ? tr('Flagged at risk') : tr('Verified assurance issued'));
      bump();
    } catch (e) {
      toast(e instanceof Error ? e.message : tr('Failed'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      {awaiting[0] ? <NextAction title={tr(awaiting.length > 1 ? '{n} creche clusters are awaiting audit' : '{n} creche cluster is awaiting audit', { n: awaiting.length })} text={tr('Start with {name}, {state}.', { name: awaiting[0].name, state: awaiting[0].state })} to={`/opportunity/${awaiting[0].id}`} cta="Open" /> : <NextAction title={tr('Audit queue is clear')} text="New audits appear once funded creches start operating." />}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={tr('Awaiting audit')} value={awaiting.length} tone="blush" />
        <Kpi label={tr('Funded, starting soon')} value={upcoming.length} />
        <Kpi label={tr('Reports issued')} value={audited.length} />
        <Kpi label={tr('At-risk flagged')} value={audited.filter((a) => a.audit.finding === 'at_risk').length} tone="blush" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle title={tr('Audit queue')} sub={tr('Operating creches without an assurance note')} />
          {awaiting.length === 0 ? <Empty title={tr('Nothing waiting')} sub={tr('Run the Guided demo to push a creche through to audit.')} /> : (
            <ul className="space-y-2">
              {awaiting.map((o) => (
                <li key={o.id} className="rounded-2xl border border-brand-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link to={`/opportunity/${o.id}`} className="text-sm font-extrabold text-ink hover:text-brand-700">{o.name}</Link>
                    <span className="text-[11px] font-semibold text-muted">{o.state} · {o.units} creches</span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" icon={<ShieldCheck className="h-3.5 w-3.5" />} loading={busyId === o.id} onClick={() => run(o.id, false)}>{tr('Verify')}</Button>
                    <Button size="sm" variant="danger" icon={<AlertTriangle className="h-3.5 w-3.5" />} loading={busyId === o.id} onClick={() => run(o.id, true)}>{tr('Flag at-risk')}</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <SectionTitle title={tr('Recent assurance notes')} />
          {audited.length === 0 ? <Empty title={tr('No reports yet')} /> : (
            <ul className="divide-y divide-brand-50">
              {audited.slice(0, 7).map(({ opportunity: o, audit: a }) => (
                <li key={a.id} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <Link to={`/opportunity/${o.id}`} className="text-sm font-bold text-ink hover:text-brand-700">{o.name}</Link>
                    {a.finding === 'verified' ? <Pill tone="ok">{tr('Verified')}</Pill> : <Pill className="bg-amber-100 text-amber-800">{tr('At risk')}</Pill>}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted">Enrolment {a.enrolmentPct}% · Attendance {a.attendancePct}% · Malnutrition ↓{a.malnutritionReductionPct}% · {timeAgo(a.issuedAt)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

/* --------------------------------- Ministry admin --------------------------------- */

function AdminWorkspace() {
  const { version, bump } = useRole();
  const toast = useToast();
  const ov = useApi(() => api.adminOverview(), [version]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [costs, setCosts] = useState<Record<string, string>>({});

  if (ov.loading || !ov.data) return <Loading />;
  const d = ov.data;

  const act = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusyId(id);
    try {
      await fn();
      toast(ok);
      bump();
    } catch (e) {
      toast(e instanceof Error ? e.message : tr('Failed'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      {d.pending.length > 0 ? (
        <NextAction title={tr(d.pending.length > 1 ? '{n} operator applications are waiting for empanelment' : '{n} operator application is waiting for empanelment', { n: d.pending.length })} text={tr('Start with {name}. Approved operators can bid in every state.', { name: d.pending[0].name })} />
      ) : (
        <NextAction title={tr('Nothing is waiting for you')} text="New operator applications appear here once NFPs submit their documents." />
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={tr('Applications to review')} value={d.pending.length} tone="blush" />
        <Kpi label={tr('Certified operators')} value={d.certified} />
        <Kpi label={tr('Opportunities on the platform')} value={d.opportunities} />
        <Kpi label={tr('At-risk audit flags')} value={d.atRisk} tone="blush" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card>
            <SectionTitle title={tr('Empanelment queue')} sub={tr('Operators who submitted all four documents')} />
            {d.pending.length === 0 ? (
              <Empty title={tr('No applications waiting')} sub={tr('Run the Guided demo, or switch to NFP / NGO and submit an application.')} />
            ) : (
              <ul className="space-y-3">
                {d.pending.map((n) => (
                  <li key={n.id} className="rounded-2xl border border-brand-100 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-extrabold text-ink">{n.name}</div>
                        <div className="text-[11px] text-muted">{n.district}, {n.state} · serves {n.servesStates.join(', ')}</div>
                      </div>
                      <Pill tone="blush">Audit score {n.auditScore}</Pill>
                    </div>
                    <p className="mt-2 text-xs text-muted">{n.about}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">
                      <Pill>{n.crechesRun} creches run</Pill>
                      <Pill>{n.childrenServed.toLocaleString('en-IN')} children</Pill>
                      {CHECKLIST.map((c) => (
                        <Pill key={c.key} tone="ok"><CheckCircle2 className="h-3 w-3" /> {tr(c.label)}</Pill>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" icon={<BadgeCheck className="h-3.5 w-3.5" />} loading={busyId === n.id} onClick={() => act(n.id, () => api.approveNfp(n.id), `${n.name} is now a Certified Childcare Operator`)}>{tr('Approve and certify')}</Button>
                      <Button size="sm" variant="ghost" loading={busyId === n.id} onClick={() => act(n.id, () => api.returnNfp(n.id), 'Returned for corrected documents')}>{tr('Return for changes')}</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionTitle title={tr('Platform activity')} sub={tr('Everything happening across all states')} right={<Link to="/impact" className="text-xs font-bold text-brand-700 hover:text-blush-600">{tr('Impact dashboard')}</Link>} />
            <ol className="relative space-y-3 border-l-2 border-brand-100 pl-5">
              {d.activity.map((a, i) => (
                <li key={i} className="relative">
                  <span className={cn('absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white', a.tone === 'pink' ? 'bg-blush-500' : a.tone === 'green' ? 'bg-ok' : 'bg-brand-500')} />
                  {a.opportunityId ? <Link to={`/opportunity/${a.opportunityId}`} className="text-sm font-semibold text-ink hover:text-brand-700">{a.text}</Link> : <span className="text-sm font-semibold text-ink">{a.text}</span>}
                  <div className="text-[11px] text-muted">{timeAgo(a.at)}</div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <Card className="h-fit">
          <SectionTitle title={tr('Master data')} sub={tr('Standard cost per creche model. States start from these when they create an opportunity.')} />
          <ul className="space-y-3">
            {d.master.map((m) => {
              const val = costs[m.id] ?? String(m.standardCostLakh);
              const changed = Number(val) !== m.standardCostLakh;
              return (
                <li key={m.id} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Field label={`${tr('Type')} ${m.id} · ${tr(m.label)} (₹ lakh)`}>
                      <Input type="number" min={5} max={40} step={0.5} value={val} onChange={(e) => setCosts((c) => ({ ...c, [m.id]: e.target.value }))} />
                    </Field>
                  </div>
                  <Button size="sm" variant={changed ? 'primary' : 'ghost'} disabled={!changed || !(Number(val) >= 5 && Number(val) <= 40)} loading={busyId === `m-${m.id}`} onClick={() => act(`m-${m.id}`, () => api.setMasterCost(m.id, Number(val)), tr('Type {id} standard cost updated', { id: m.id }))}>{tr('Save')}</Button>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-[11px] text-muted">{tr('Changing a standard cost affects new opportunities only. Existing ones keep the cost their State published.')}</p>
        </Card>
      </div>
    </>
  );
}
