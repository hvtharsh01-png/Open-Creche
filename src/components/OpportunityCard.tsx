import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, Baby, MapPin, Navigation } from 'lucide-react';
import { fmtLakh, typeLabel, type MatchResult, type OpportunityView } from '../../shared/types';
import { Pill, PriorityDot, ProgressBar, ScoreRing, StageBadge, cn } from './ui';
import { useT } from '../lib/i18n';

export function OpportunityCard({
  opp,
  match,
  distanceKm,
  selected,
  onSelect,
  index = 0,
}: {
  opp: OpportunityView;
  match?: MatchResult;
  distanceKm?: number | null;
  selected?: boolean;
  onSelect?: () => void;
  index?: number;
}) {
  const { tr } = useT();
  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.03 }}
      onMouseEnter={onSelect}
      onFocus={onSelect}
      className={cn(
        'group rounded-2xl border bg-white p-4 shadow-[0_8px_24px_-14px_rgba(20,48,107,0.2)] transition',
        selected ? 'border-brand-500 ring-2 ring-brand-200' : 'border-brand-100 hover:border-brand-300',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StageBadge stage={opp.stage} />
            <PriorityDot priority={opp.priority} />
            {opp.pilot && <Pill tone="blush">{tr('Odisha pilot')}</Pill>}
          </div>
          <Link to={`/opportunity/${opp.id}`} className="mt-2 block truncate text-[15px] font-extrabold text-ink hover:text-brand-700">
            {opp.name}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {opp.district}, {opp.state}
            </span>
            {distanceKm != null && (
              <span className="inline-flex items-center gap-1 font-semibold text-blush-700">
                <Navigation className="h-3.5 w-3.5" />
                {tr('{n} km away', { n: Math.round(distanceKm) })}
              </span>
            )}
          </div>
        </div>
        {match && <ScoreRing score={match.score} />}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label={tr('Type')} value={`${opp.type} · ${tr(typeLabel(opp.type)).split(' ')[0]}`} />
        <Stat label={tr('Creches')} value={`${opp.units} × ${fmtLakh(opp.unitCostLakh)}`} />
        <Stat label={tr('Children')} value={<span className="inline-flex items-center gap-1"><Baby className="h-3.5 w-3.5 text-blush-500" />{opp.children}</span>} />
      </div>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[11px] font-semibold text-muted">
          <span>{tr('CSR funding')}</span>
          <span>
            {fmtLakh(opp.committedLakh)} {tr('of')} {fmtLakh(opp.totalLakh)}
          </span>
        </div>
        <ProgressBar value={opp.committedLakh} max={opp.totalLakh} />
      </div>

      {match && (match.reasons[0] || match.warnings[0]) && (
        <p className={cn('mt-3 rounded-xl px-3 py-2 text-xs font-semibold', match.eligible ? 'bg-brand-50 text-brand-800' : 'bg-slate-50 text-slate-500')}>
          {match.eligible ? match.reasons.slice(0, 2).join(' · ') || match.warnings[0] : match.warnings[0]}
        </p>
      )}

      <div className="mt-3 flex items-center justify-end">
        <Link to={`/opportunity/${opp.id}`} className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-blush-600">
          {tr('View details')} <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>
    </motion.article>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-brand-50/70 px-2 py-1.5">
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className="truncate text-xs font-extrabold text-ink">{value}</div>
    </div>
  );
}
