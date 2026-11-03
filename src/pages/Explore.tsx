import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LocateFixed, Map as MapIcon, MapPin, Rows3, Search, SlidersHorizontal, X } from 'lucide-react';
import { CRECHE_TYPES, STAGES, STATES, fmtLakh, type LatLng, type OpportunityView, type Role } from '../../shared/types';
import { PLACES, haversineKm, placesIn } from '../../shared/geo';
import { api, type Ranked } from '../lib/api';
import { useApi, useMediaQuery } from '../lib/hooks';
import { useRole } from '../lib/role';
import { useT } from '../lib/i18n';
import { useToast } from '../lib/toast';
import { EMPTY_FILTERS, hasFilters, parseQuery, type Filters } from '../lib/search';
import MapView, { type FlyTarget } from '../components/MapView';
import { OpportunityCard } from '../components/OpportunityCard';
import { Button, Card, Empty, Field, Loading, PageHeader, Pill, Segmented, Select, cn } from '../components/ui';

type Sort = 'match' | 'need' | 'near' | 'cost' | 'children';

const INDIA_CENTER: LatLng = { lat: 22.5, lng: 80.5 };

export default function Explore() {
  const [params, setParams] = useSearchParams();
  const { role, persona, state, version } = useRole();
  const { tr } = useT();
  const toast = useToast();
  const [presetId, setPresetId] = useState<string | null>(null);
  const presetInit = useRef(false);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [text, setText] = useState(params.get('q') ?? '');
  const [chips, setChips] = useState<string[]>([]);
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [originLabel, setOriginLabel] = useState('');
  const [pickMode, setPickMode] = useState(false);
  const [sort, setSort] = useState<Sort | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [fly, setFly] = useState<FlyTarget | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [showFilters, setShowFilters] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1024);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const opps = useApi(() => api.opportunities(), [version]);
  const ranked = useApi<Ranked[] | null>(async () => {
    if (role === 'nfp' && persona) return api.matchNfp(persona.nfpId);
    if (role === 'csr' && persona) return api.matchDonor(persona.donorId);
    return null;
  }, [role, persona?.nfpId, version]);

  // which opportunities are "mine" for this role (bids, wins, funded projects, at-risk flags)
  const mine = useApi<Record<string, Set<string>> | null>(async (): Promise<Record<string, Set<string>> | null> => {
    if (role === 'nfp' && persona) {
      const p = await api.nfp(persona.nfpId);
      return { bids: new Set(p.bids.map((b) => b.opportunityId)), won: new Set(p.awarded.map((o) => o.id)) };
    }
    if (role === 'csr' && persona) {
      const d = await api.donor(persona.donorId);
      return { funded: new Set(d.commitments.map((c) => c.opportunity.id)) };
    }
    if (role === 'admin' || role === 'auditor') {
      const q = await api.auditQueue();
      return { atRisk: new Set(q.audited.filter((a) => a.audit.finding === 'at_risk').map((a) => a.opportunity.id)) };
    }
    return null;
  }, [role, persona?.nfpId, version]);

  const matchById = useMemo(() => Object.fromEntries((ranked.data ?? []).map((r) => [r.opportunity.id, r.match])), [ranked.data]);
  const canMatch = !!ranked.data;
  const activeSort: Sort = sort ?? (canMatch ? 'match' : 'need');

  type Preset = { id: string; label: string; test: (o: OpportunityView) => boolean };
  const presets: Preset[] = useMemo(() => {
    const m = mine.data ?? {};
    const has = (k: string, id: string) => !!m[k]?.has(id);
    const byRole: Record<Role, Preset[]> = {
      state: [
        { id: 'my', label: 'My state', test: (o) => o.state === state },
        { id: 'award', label: 'Ready to award', test: (o) => o.state === state && o.stage === 'bidding' },
        { id: 'wait', label: 'Waiting for bids', test: (o) => o.state === state && o.stage === 'open' },
        { id: 'run', label: 'Running', test: (o) => o.state === state && o.stage === 'operating' },
      ],
      nfp: [
        { id: 'elig', label: 'Open for my bid', test: (o) => !!matchById[o.id]?.eligible },
        { id: 'bids', label: 'My bids', test: (o) => has('bids', o.id) },
        { id: 'won', label: 'Won by me', test: (o) => has('won', o.id) },
      ],
      csr: [
        { id: 'elig', label: 'Fundable now', test: (o) => !!matchById[o.id]?.eligible },
        { id: 'ready', label: 'Operator ready', test: (o) => o.stage === 'matched' },
        { id: 'mine', label: 'Projects I funded', test: (o) => has('funded', o.id) },
      ],
      auditor: [
        { id: 'due', label: 'Audit due', test: (o) => o.stage === 'operating' },
        { id: 'soon', label: 'Starting soon', test: (o) => o.stage === 'funded' },
        { id: 'done', label: 'Audited', test: (o) => o.stage === 'audited' },
      ],
      admin: [
        { id: 'risk', label: 'At risk', test: (o) => has('atRisk', o.id) },
        { id: 'wait', label: 'Waiting for bids', test: (o) => o.stage === 'open' },
        { id: 'run', label: 'Running', test: (o) => o.stage === 'operating' },
      ],
    };
    return role ? byRole[role] : [];
  }, [role, state, mine.data, matchById]);
  const preset = presets.find((p) => p.id === presetId) ?? null;

  // start each role on the view that matters most to it (unless a search came in from Home)
  useEffect(() => {
    if (presetInit.current || !role || !opps.data) return;
    if (role === 'nfp' || role === 'csr') {
      if (!ranked.data) return;
    }
    presetInit.current = true;
    if (params.get('q')) return;
    const first = { state: 'my', nfp: 'elig', csr: 'elig', auditor: 'due', admin: null }[role];
    setPresetId(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, opps.data, ranked.data]);

  const applyQuery = (q: string) => {
    setPresetId(null);
    const { filters: f, chips: c } = parseQuery(q);
    const next = { ...EMPTY_FILTERS, ...f };
    if (!c.length) next.text = q.trim();
    setFilters(next);
    setChips(c);
    if (f.radiusKm && !origin) {
      setOrigin({ lat: 20.3, lng: 85.8 });
      setOriginLabel(tr('Bhubaneswar (demo location)'));
      toast(tr('Using a demo location. Set yours with "Use my location" or the map.'), 'ok');
    }
    if (!f.radiusKm) setOrigin(null);
  };

  // run the query that came from the Home search box once
  useEffect(() => {
    const q = params.get('q');
    if (q) applyQuery(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patch = (p: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...p }));
    setChips([]);
  };

  const setNearPlace = (name: string) => {
    const p = PLACES.find((x) => x.name === name);
    if (!p) {
      setOrigin(null);
      patch({ radiusKm: null });
      return;
    }
    setOrigin({ lat: p.lat, lng: p.lng });
    setOriginLabel(`${p.name}, ${p.state}`);
    patch({ radiusKm: filters.radiusKm ?? 100 });
    setFly({ lat: p.lat, lng: p.lng, zoom: 7, key: Date.now() });
  };

  const locate = () => {
    if (!navigator.geolocation) return toast(tr('Location is not available in this browser. Pick a city or click the map.'), 'error');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setOrigin(p);
        setOriginLabel(tr('Your location'));
        patch({ radiusKm: filters.radiusKm ?? 100 });
        setFly({ ...p, zoom: 8, key: Date.now() });
      },
      () => toast(tr('Could not get your location. Pick a city or click the map instead.'), 'error'),
      { timeout: 8000 },
    );
  };

  const filtered = useMemo(() => {
    const f = filters;
    const t = f.text.toLowerCase();
    return (opps.data ?? [])
      .map((o) => ({ o, d: origin ? haversineKm(origin, o) : null }))
      .filter(({ o, d }) => {
        if (preset && !preset.test(o)) return false;
        if (f.state && o.state !== f.state) return false;
        if (f.district && o.district !== f.district) return false;
        if (f.types.length && !f.types.includes(o.type)) return false;
        if (f.stage && o.stage !== f.stage) return false;
        if (f.priority && o.priority !== f.priority) return false;
        if (f.maxCostLakh !== null && o.unitCostLakh > f.maxCostLakh) return false;
        if (f.radiusKm !== null && origin && d! > f.radiusKm) return false;
        if (t && !`${o.name} ${o.district} ${o.state} ${o.poshanTag}`.toLowerCase().includes(t)) return false;
        return true;
      });
  }, [opps.data, filters, origin, preset]);

  const sorted = useMemo(() => {
    const s = [...filtered];
    const score = (o: OpportunityView) => matchById[o.id]?.score ?? 0;
    s.sort((a, b) => {
      switch (activeSort) {
        case 'match':
          return Number(matchById[b.o.id]?.eligible ?? 0) - Number(matchById[a.o.id]?.eligible ?? 0) || score(b.o) - score(a.o);
        case 'near':
          return (a.d ?? 1e9) - (b.d ?? 1e9);
        case 'cost':
          return a.o.unitCostLakh - b.o.unitCostLakh;
        case 'children':
          return b.o.children - a.o.children;
        default:
          return b.o.need - a.o.need;
      }
    });
    return s;
  }, [filtered, activeSort, matchById]);

  const rankById = useMemo(() => {
    if (activeSort !== 'match') return undefined;
    return Object.fromEntries(sorted.filter((x) => matchById[x.o.id]?.eligible).slice(0, 5).map((x, i) => [x.o.id, i + 1]));
  }, [sorted, activeSort, matchById]);

  // keep the map pointed at what the filters select
  const filterKey = `${filters.state}|${filters.district}`;
  useEffect(() => {
    if (!opps.data) return;
    const pool = opps.data.filter((o) => (!filters.state || o.state === filters.state) && (!filters.district || o.district === filters.district));
    if (!pool.length) return;
    if (!filters.state && !filters.district) return setFly({ ...INDIA_CENTER, zoom: 5, key: Date.now() });
    const c = { lat: pool.reduce((s, o) => s + o.lat, 0) / pool.length, lng: pool.reduce((s, o) => s + o.lng, 0) / pool.length };
    setFly({ ...c, zoom: filters.district ? 9 : 7, key: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, !!opps.data]);

  const select = (id: string, scroll = false) => {
    setSelected(id);
    if (scroll) {
      setMobileView('list');
      setTimeout(() => cardRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
    }
  };

  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    setChips([]);
    setText('');
    setOrigin(null);
    setPresetId(null);
    setParams({});
  };

  const sortOptions: { value: Sort; label: string }[] = [
    ...(canMatch ? [{ value: 'match' as const, label: tr('Best match') }] : []),
    { value: 'need', label: tr('Highest need') },
    ...(origin ? [{ value: 'near' as const, label: tr('Nearest') }] : []),
    { value: 'cost', label: tr('Lowest cost') },
    { value: 'children', label: tr('Most children') },
  ];

  const stateOptions = STATES;
  const districtOptions = filters.state ? placesIn(filters.state) : [];

  return (
    <div>
      <PageHeader
        eyebrow={tr('Explore')}
        title={tr(role === 'state' ? 'Your state pipeline' : role === 'nfp' ? 'Find opportunities to bid on' : role === 'csr' ? 'Find projects to fund' : role === 'auditor' ? 'Creches to audit' : 'Every opportunity on the platform')}
        sub={tr(
          role === 'state'
            ? 'Your opportunities first. Switch the quick view to see where bids are waiting.'
            : role === 'nfp'
              ? 'Ranked by how well each one fits your organisation. Open ones you can bid on come first.'
              : role === 'csr'
                ? 'Ranked by fit with your sites, budget and priorities. Projects with an operator are ready for funds.'
                : role === 'auditor'
                  ? 'Operating creches are due for assurance. Pick one to verify.'
                  : 'Oversight view across all states, with at-risk projects one tap away.',
        )}
        right={
          <Button variant="ghost" size="sm" icon={<SlidersHorizontal className="h-4 w-4" />} onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
            {showFilters ? tr('Hide filters') : tr('Show filters')}
          </Button>
        }
      />

      {presets.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label={tr('Quick views')}>
          <span className="text-xs font-bold text-muted">{tr('Quick views')}:</span>
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={presetId === p.id}
              onClick={() => setPresetId(presetId === p.id ? null : p.id)}
              className={cn('rounded-full border px-3.5 py-1.5 text-xs font-bold transition', presetId === p.id ? 'border-transparent bg-brand-gradient text-white shadow' : 'border-brand-200 bg-white text-brand-800 hover:border-brand-400')}
            >
              {tr(p.label)}
            </button>
          ))}
          <button type="button" onClick={() => setPresetId(null)} aria-pressed={presetId === null} className={cn('rounded-full border px-3.5 py-1.5 text-xs font-bold transition', presetId === null ? 'border-transparent bg-ink text-white' : 'border-brand-200 bg-white text-brand-800 hover:border-brand-400')}>
            {tr('Everything')}
          </button>
        </div>
      )}

      {showFilters && (
        <Card className="mb-4 !p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              applyQuery(text);
            }}
            className="flex flex-col gap-2 sm:flex-row"
            role="search"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-600" />
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-label={tr('Smart search')}
                placeholder={tr('Type like you talk: rural creches in Keonjhar under ₹20 lakh')}
                className="w-full rounded-full border border-brand-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit">{tr('Search')}</Button>
              {(hasFilters(filters) || text) && (
                <Button type="button" variant="ghost" onClick={clearAll} icon={<X className="h-4 w-4" />}>
                  {tr('Clear')}
                </Button>
              )}
            </div>
          </form>

          {chips.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-semibold text-muted">{tr('Understood')}:</span>
              {chips.map((c) => (
                <Pill key={c} tone="blush">{c}</Pill>
              ))}
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field label={tr('State')}>
              <Select value={filters.state} onChange={(e) => patch({ state: e.target.value, district: '' })}>
                <option value="">{tr('All states')}</option>
                {stateOptions.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label={tr('District')}>
              <Select value={filters.district} disabled={!filters.state} onChange={(e) => patch({ district: e.target.value })}>
                <option value="">{filters.state ? tr('All districts') : tr('Pick a state first')}</option>
                {districtOptions.map((p) => <option key={p.name}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label={tr('Stage')}>
              <Select value={filters.stage} onChange={(e) => patch({ stage: e.target.value as Filters['stage'] })}>
                <option value="">{tr('Any stage')}</option>
                {STAGES.map((s) => <option key={s.id} value={s.id}>{tr(s.label)}</option>)}
              </Select>
            </Field>
            <Field label={tr('Priority')}>
              <Select value={filters.priority} onChange={(e) => patch({ priority: e.target.value as Filters['priority'] })}>
                <option value="">{tr('Any priority')}</option>
                <option value="high">{tr('High')}</option>
                <option value="medium">{tr('Medium')}</option>
                <option value="low">{tr('Low')}</option>
              </Select>
            </Field>
            <Field label={`${tr('Max cost per creche')}: ${filters.maxCostLakh === null ? tr('any') : fmtLakh(filters.maxCostLakh)}`}>
              <input
                type="range"
                min={12}
                max={23}
                step={1}
                value={filters.maxCostLakh ?? 23}
                onChange={(e) => patch({ maxCostLakh: Number(e.target.value) >= 23 ? null : Number(e.target.value) })}
                className="mt-2 w-full accent-brand-600"
                aria-label={tr('Max cost per creche')}
              />
            </Field>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-ink">{tr('Creche model')}:</span>
            {CRECHE_TYPES.map((t) => {
              const on = filters.types.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  title={tr(t.hint)}
                  onClick={() => patch({ types: on ? filters.types.filter((x) => x !== t.id) : [...filters.types, t.id] })}
                  className={cn('rounded-full border px-3 py-1.5 text-xs font-bold transition', on ? 'border-transparent bg-brand-gradient text-white shadow' : 'border-brand-200 bg-white text-brand-800 hover:border-brand-400')}
                >
                  {t.id} · {tr(t.label)}
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl bg-brand-50/70 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-ink"><MapPin className="h-4 w-4 text-blush-600" /> {tr('Within an area of me')}</span>
              <Button size="sm" variant="ghost" onClick={locate} icon={<LocateFixed className="h-3.5 w-3.5" />}>{tr('Use my location')}</Button>
              <Button size="sm" variant={pickMode ? 'pink' : 'ghost'} onClick={() => { setPickMode((p) => !p); setMobileView('map'); }} icon={<MapIcon className="h-3.5 w-3.5" />}>
                {pickMode ? tr('Click the map…') : tr('Pick on map')}
              </Button>
              <Select aria-label={tr('Choose a city')} className="!w-auto !py-1.5 text-xs" value="" onChange={(e) => setNearPlace(e.target.value)}>
                <option value="">{tr('or choose a city…')}</option>
                {PLACES.map((p) => <option key={p.name} value={p.name}>{p.name}, {p.state}</option>)}
              </Select>
              {origin && (
                <button onClick={() => { setOrigin(null); patch({ radiusKm: null }); }} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-blush-700 shadow-sm">
                  {originLabel || tr('Custom point')} <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {origin && (
              <div className="mt-3 flex items-center gap-3">
                <span className="w-28 text-xs font-bold text-ink">{tr('Within {n} km', { n: filters.radiusKm ?? 100 })}</span>
                <input type="range" min={10} max={500} step={10} value={filters.radiusKm ?? 100} onChange={(e) => patch({ radiusKm: Number(e.target.value) })} className="flex-1 accent-blush-600" aria-label={tr('Search radius in kilometres')} />
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-bold text-ink">
          {opps.data ? tr('{n} of {m} opportunities', { n: sorted.length, m: opps.data.length }) : `${tr('Loading')}…`}
          {role && canMatch && <span className="ml-2 font-semibold text-blush-700">{tr('scored for you as {name}', { name: (role === 'nfp' ? persona?.nfp.name : persona?.donor.name) ?? '' })}</span>}
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-2">
          <Segmented id="sort" size="sm" value={activeSort} onChange={(v) => setSort(v)} options={sortOptions} />
          <div className="lg:hidden">
            <Segmented id="mobile-view" size="sm" value={mobileView} onChange={setMobileView} options={[{ value: 'list', label: <><Rows3 className="h-3.5 w-3.5" /> {tr('List')}</> }, { value: 'map', label: <><MapIcon className="h-3.5 w-3.5" /> {tr('Map')}</> }]} />
          </div>
        </div>
      </div>

      {opps.loading ? (
        <Loading label="Loading opportunities" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className={cn('space-y-3', mobileView === 'map' && 'hidden lg:block')}>
            {sorted.length === 0 ? (
              <Empty title={tr('No opportunities match this view')} sub={tr('Try Everything, a wider distance, a higher cost limit, or clear the filters.')} action={<Button variant="ghost" size="sm" onClick={clearAll}>{tr('Clear filters')}</Button>} />
            ) : (
              sorted.slice(0, 60).map(({ o, d }, i) => (
                <div key={o.id} ref={(el) => { cardRefs.current[o.id] = el; }}>
                  <OpportunityCard opp={o} match={matchById[o.id]} distanceKm={d} selected={selected === o.id} onSelect={() => setSelected(o.id)} index={i} />
                </div>
              ))
            )}
          </div>
          <div className={cn('lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]', mobileView === 'list' && 'hidden lg:block')}>
            <div className="h-[70vh] overflow-hidden rounded-2xl border border-brand-100 shadow-lg lg:h-full">
              {(isDesktop || mobileView === 'map') && <MapView
                items={sorted.map((x) => x.o)}
                selectedId={selected}
                onSelect={(id) => select(id, true)}
                rankById={rankById}
                you={origin}
                radius={origin && filters.radiusKm ? { center: origin, km: filters.radiusKm } : null}
                pickMode={pickMode}
                onPick={(p) => {
                  setOrigin(p);
                  setOriginLabel(tr('Point on map'));
                  setPickMode(false);
                  patch({ radiusKm: filters.radiusKm ?? 100 });
                }}
                fly={fly}
              />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
