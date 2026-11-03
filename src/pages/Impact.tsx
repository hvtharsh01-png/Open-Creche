import { useMemo } from 'react';
import { tr } from '../lib/i18n';
import { BadgeCheck, CheckCircle2, Clock, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useRole } from '../lib/role';
import { AnimatedNumber, Card, Chart, DemoNote, Loading, PageHeader, Pill, ProgressBar, SectionTitle } from '../components/ui';
import type { Highcharts } from '../lib/charts';

const PHASES = [
  { p: 'Phase 1 · T+12', districts: 3, states: 1, creches: 100, children: '2,000', csr: '₹4 Cr' },
  { p: 'Phase 2 · T+18', districts: 10, states: 1, creches: 1000, children: '20,000', csr: '₹40 Cr' },
  { p: 'Phase 3 · T+30', districts: 50, states: 5, creches: 5000, children: '1 lakh', csr: '₹200 Cr' },
  { p: 'Phase 4 · T+42', districts: 80, states: 8, creches: 8000, children: '1.6 lakh', csr: '₹320 Cr' },
  { p: 'Phase 5 · T+54', districts: 100, states: 10, creches: 10000, children: '2 lakh', csr: '₹400 Cr' },
];

const MODULES: { name: string; status: 'built' | 'simulated' }[] = [
  { name: 'Creche location identification', status: 'built' },
  { name: 'CSR registration & onboarding', status: 'built' },
  { name: 'NFP due diligence & empanelment', status: 'built' },
  { name: 'Marketplace: location finalisation & matching', status: 'built' },
  { name: 'Day-to-day monitoring', status: 'built' },
  { name: 'User / role management, master data, dashboard', status: 'built' },
  { name: 'Audit-firm empanelment', status: 'simulated' },
  { name: 'Contract signing & management', status: 'simulated' },
  { name: 'Payment module (milestones)', status: 'simulated' },
  { name: 'Independent audit / impact assessment', status: 'built' },
  { name: 'Notifications (SMS / WhatsApp)', status: 'simulated' },
  { name: 'Aadhaar enablement / e-KYC', status: 'simulated' },
];

export default function Impact() {
  const { version, role, state } = useRole();
  const mine = useApi(() => api.insights(), [role, state, version]);
  const { data: s, loading } = useApi(() => api.stats(), [version]);

  const charts = useMemo(() => {
    if (!s) return null;
    const funnel: Highcharts.Options = {
      chart: { type: 'bar' },
      legend: { enabled: false },
      xAxis: { categories: s.funnel.map((f) => tr(f.label)) },
      yAxis: { allowDecimals: false },
      tooltip: { pointFormat: '<b>{point.y}</b> opportunities reached this stage' },
      plotOptions: { bar: { borderRadius: 6, colorByPoint: true, dataLabels: { enabled: true, style: { fontWeight: '700' } } } },
      colors: ['#93b6fb', '#5f90ef', '#2f6fdb', '#e5408a', '#1f9d6b', '#0f766e'],
      series: [{ type: 'bar', name: tr('Opportunities'), data: s.funnel.map((f) => f.count) }],
    };
    const states = s.stateDemand.slice(0, 8);
    const demand: Highcharts.Options = {
      chart: { type: 'column' },
      xAxis: { categories: states.map((x) => (role === 'state' && x.state === state ? `★ ${x.state}` : x.state)) },
      yAxis: { title: { text: tr('Creches') }, stackLabels: { enabled: false } },
      tooltip: { shared: true },
      plotOptions: { column: { stacking: 'normal', borderRadius: 4 } },
      series: [
        { type: 'column', name: tr('Funded or running'), color: '#e5408a', data: states.map((x) => x.funded) },
        { type: 'column', name: tr('Still needed'), color: '#93b6fb', data: states.map((x) => x.required - x.funded) },
      ],
    };
    const types: Highcharts.Options = {
      chart: { type: 'pie' },
      tooltip: { pointFormat: '<b>{point.y}</b> creches ({point.percentage:.0f}%)' },
      plotOptions: { pie: { innerSize: '62%', borderRadius: 6, dataLabels: { enabled: true, format: '{point.name}', style: { fontWeight: '600' } } } },
      colors: ['#2f6fdb', '#e5408a', '#1d4ba3', '#f8a6cb'],
      series: [{ type: 'pie', name: tr('Creches'), data: s.byType.map((t) => ({ name: tr(t.label), y: t.count })) }],
    };
    const pilot: Highcharts.Options = {
      chart: { type: 'column' },
      xAxis: { categories: s.pilot.map((p) => p.district) },
      yAxis: { title: { text: '% of children under 5' }, max: 45 },
      tooltip: { shared: true, valueSuffix: '%' },
      plotOptions: { column: { borderRadius: 5, dataLabels: { enabled: true, format: '{y}', style: { fontSize: '10px' } } } },
      series: [
        { type: 'column', name: tr('Stunted'), color: '#2f6fdb', data: s.pilot.map((p) => p.stunted) },
        { type: 'column', name: tr('Wasted'), color: '#e5408a', data: s.pilot.map((p) => p.wasted) },
        { type: 'column', name: tr('Underweight'), color: '#93b6fb', data: s.pilot.map((p) => p.underweight) },
      ],
    };
    const trend: Highcharts.Options = {
      chart: { type: 'areaspline' },
      xAxis: { categories: s.monthly.map((m) => m.month) },
      tooltip: { shared: true },
      series: [
        { type: 'areaspline', name: tr('CSR committed (₹ Cr)'), color: '#e5408a', fillOpacity: 0.12, data: s.monthly.map((m) => m.committedCr) },
        { type: 'areaspline', name: tr('Opportunities listed'), color: '#2f6fdb', fillOpacity: 0.1, data: s.monthly.map((m) => m.opportunities) },
      ],
    };
    return { funnel, demand, types, pilot, trend };
  }, [s, role, state]);

  if (loading || !s || !charts) return <Loading label={tr('Building the dashboard')} />;
  const n = s.national;
  const pct = s.demo.requiredCr ? (s.demo.committedCr / s.demo.requiredCr) * 100 : 0;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={tr('Impact')} title={tr('Network impact dashboard')} sub={tr('Public transparency: where creches are needed, how much is funded, and what independent audits found.')} />

      {role && (
        <Card className="!p-4">
          <SectionTitle title={tr('Your numbers')} sub={tr(role === 'state' ? 'How your state is doing on the network' : role === 'nfp' ? 'Your organisation on the network' : role === 'csr' ? 'Your portfolio on the network' : role === 'auditor' ? 'Your audit work on the network' : 'The platform as the Ministry sees it')} />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(mine.data ?? []).map((k) => (
              <div key={k.label} className="rounded-2xl bg-brand-50/70 p-3">
                <div className={k.tone === 'blush' ? 'text-2xl font-extrabold text-blush-600' : 'text-2xl font-extrabold text-brand-700'}><AnimatedNumber value={k.value} prefix={k.prefix} suffix={k.suffix} decimals={k.decimals} /></div>
                <div className="text-[11px] font-semibold text-muted">{tr(k.label)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { l: 'Opportunities', v: s.demo.opportunities },
          { l: 'Creches planned', v: s.demo.units },
          { l: 'Children covered', v: s.demo.children },
          { l: 'Certified operators', v: s.demo.nfps },
          { l: 'Audits issued', v: s.demo.audits },
        ].map((k, i) => (
          <Card key={k.l} delay={i * 0.05} className="!p-4">
            <div className="text-2xl font-extrabold tracking-tight text-brand-700 sm:text-3xl"><AnimatedNumber value={k.v} /></div>
            <div className="text-xs font-semibold text-muted">{tr(k.l)}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <SectionTitle title={tr('Funding in this demo')} sub={`₹${s.demo.committedCr.toFixed(1)} Cr committed of ₹${s.demo.requiredCr.toFixed(1)} Cr required`} right={<Pill tone="blush">{Math.round(pct)}% funded</Pill>} />
          <ProgressBar value={s.demo.committedCr} max={s.demo.requiredCr} />
          <div className="mt-5 rounded-2xl bg-brand-50/70 p-4">
            <div className="mb-2 flex items-center justify-between"><span className="text-xs font-extrabold text-ink">{tr('Illustrative national projection')}</span><Pill tone="neutral">{tr('From proposal')}</Pill></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Committed', `₹${n.csrCommittedCr.toLocaleString('en-IN')} Cr`],
                ['Allocated', `₹${n.fundedCr.toLocaleString('en-IN')} Cr`],
                ['Pending bids', `₹${n.pendingCr} Cr`],
                ['Budget left', `₹${n.remainingCr} Cr`],
              ].map(([a, b]) => (
                <div key={a}><div className="text-[10px] font-bold uppercase tracking-wide text-muted">{a}</div><div className="text-lg font-extrabold text-ink">{b}</div></div>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <SectionTitle title={tr('Independent assurance')} sub={`${s.audits.reports} audit reports`} right={<ShieldCheck className="h-5 w-5 text-ok" />} />
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              ['Enrolment', s.audits.enrolmentPct, '%'],
              ['Attendance', s.audits.attendancePct, '%'],
              ['Malnutrition ↓', s.audits.malnutritionReductionPct, '%'],
            ].map(([l, v, u]) => (
              <div key={l as string} className="rounded-2xl bg-brand-50/70 p-3">
                <div className="text-2xl font-extrabold text-gradient"><AnimatedNumber value={v as number} suffix={u as string} /></div>
                <div className="text-[11px] font-semibold text-muted">{l}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2 text-xs font-bold"><Pill tone="ok"><BadgeCheck className="h-3.5 w-3.5" /> {s.audits.verified} verified</Pill><Pill className="bg-amber-100 text-amber-800">{s.audits.atRisk} at risk</Pill></div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card><SectionTitle title={tr('From need to verified impact')} sub={tr('Opportunities that reached each stage')} /><Chart options={charts.funnel} height={260} /></Card>
        <Card><SectionTitle title={tr('State-wise demand and funding')} sub={tr('Creches funded vs still needed')} /><Chart options={charts.demand} height={260} /></Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Card><SectionTitle title={tr('Creche models')} sub={tr('Share of planned creches')} /><Chart options={charts.types} height={260} /></Card>
        <Card>
          <SectionTitle title={tr('State demand table')} sub={tr('Government-validated need')} />
          <div className="scroll-thin max-h-[260px] overflow-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead><tr className="border-b border-brand-100 text-[11px] font-bold uppercase tracking-wide text-muted"><th className="py-2">{tr('State')}</th><th>{tr('Creches')}</th><th>{tr('Capital')}</th><th>{tr('Children')}</th><th>{tr('Open')}</th></tr></thead>
              <tbody>
                {s.stateDemand.map((r) => (
                  <tr key={r.state} className="border-b border-brand-50"><td className="py-2 font-bold text-ink">{r.state}</td><td>{r.required}</td><td>₹{r.capitalCr} Cr</td><td>{r.children.toLocaleString('en-IN')}</td><td>{r.open}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle title={tr('Odisha pilot: the need it addresses')} sub={tr('% of children under 5 (Keonjhar, Sundargarh, Jajpur)')} />
          <Chart options={charts.pilot} height={260} />
          <p className="mt-1 text-xs font-semibold text-brand-800">{tr('Pilot result: 25% fewer underweight and 64% fewer wasted children, at about ₹42 per child per day.')}</p>
          <DemoNote>{tr('Stunted and underweight follow the slide\'s column order. The written proposal lists them the other way round, so confirm with the source before publishing.')}</DemoNote>
        </Card>
        <Card><SectionTitle title={tr('Growth (illustrative)')} sub={tr('Monthly opportunities listed and CSR committed')} /><Chart options={charts.trend} height={260} /><DemoNote>{tr('Trend is simulated for the prototype.')}</DemoNote></Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <SectionTitle title={tr('Rollout phases')} sub={tr('Indicative scale-up from the proposal. Please verify figures against the source deck.')} />
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead><tr className="border-b border-brand-100 text-[11px] font-bold uppercase tracking-wide text-muted"><th className="py-2">{tr('Phase')}</th><th>{tr('States')}</th><th>{tr('Districts')}</th><th>{tr('Creches')}</th><th>{tr('Children')}</th><th>CSR</th></tr></thead>
              <tbody>
                {PHASES.map((p) => (
                  <tr key={p.p} className="border-b border-brand-50"><td className="py-2 font-bold text-ink">{tr(p.p)}</td><td>{p.states}</td><td>{p.districts}</td><td>{p.creches.toLocaleString('en-IN')}</td><td>{p.children}</td><td className="font-bold text-blush-600">{p.csr}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <SectionTitle title={tr('Platform modules in this demo')} />
          <ul className="space-y-1.5">
            {MODULES.map((m) => (
              <li key={m.name} className="flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-2 font-semibold text-ink">{m.status === 'built' ? <CheckCircle2 className="h-4 w-4 text-ok" /> : <Clock className="h-4 w-4 text-amber-500" />}{tr(m.name)}</span>
                <span className={m.status === 'built' ? 'font-bold text-ok' : 'font-bold text-amber-600'}>{m.status === 'built' ? tr('Working') : tr('Simulated')}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
