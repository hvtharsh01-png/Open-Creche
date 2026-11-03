import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { MatchResult } from '../../shared/types';
import { ScoreRing } from './ui';
import { useT } from '../lib/i18n';

/** "Why this match": the score broken into its weighted parts, plus plain-language reasons. */
export function MatchBreakdown({ match, title = 'Why this match' }: { match: MatchResult; title?: string }) {
  const { tr } = useT();
  return (
    <div>
      <div className="flex items-center gap-3">
        <ScoreRing score={match.score} size={60} />
        <div>
          <div className="text-sm font-extrabold text-ink">{tr(title)}</div>
          <div className="text-xs text-muted">
            {match.eligible ? tr('Weighted score out of 100. The same rules apply to everyone.') : tr('Not eligible right now, but here is how it scores.')}
          </div>
        </div>
      </div>

      <ul className="mt-4 space-y-2.5">
        {match.breakdown.parts.map((p, i) => (
          <li key={p.label}>
            <div className="mb-1 flex justify-between text-[11px] font-bold text-ink">
              <span>
                {tr(p.label)} <span className="font-semibold text-muted">· {Math.round(p.weight * 100)}%</span>
              </span>
              <span className="text-brand-700">{Math.round(p.value * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-brand-100">
              <motion.div
                className="h-full rounded-full bg-brand-gradient"
                initial={{ width: 0 }}
                animate={{ width: `${p.value * 100}%` }}
                transition={{ duration: 0.7, delay: i * 0.06, ease: 'easeOut' }}
              />
            </div>
          </li>
        ))}
        {match.breakdown.boost > 0 && (
          <li className="flex justify-between rounded-xl bg-blush-50 px-3 py-2 text-[11px] font-bold text-blush-700">
            <span>{tr('Fairness boost for high-need locations')}</span>
            <span>+{match.breakdown.boost}</span>
          </li>
        )}
      </ul>

      {(match.reasons.length > 0 || match.warnings.length > 0) && (
        <ul className="mt-4 space-y-1.5 text-xs">
          {match.reasons.map((r) => (
            <li key={r} className="flex items-start gap-2 font-semibold text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {r}
            </li>
          ))}
          {match.warnings.map((w) => (
            <li key={w} className="flex items-start gap-2 font-semibold text-amber-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
