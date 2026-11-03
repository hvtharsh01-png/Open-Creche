import type { BasketItem, BasketProposal, Donor, MatchResult, Nfp, OpportunityView, Opportunity, ScoreBreakdown, Stage } from '../shared/types.js';
import { CHILDREN_PER_UNIT, fmtLakh, typeLabel } from '../shared/types.js';
import { haversineKm } from '../shared/geo.js';

/**
 * Explainable matching: hard filters first, then a weighted score whose parts are returned to the UI as a
 * breakdown ("why this match"). Deterministic and auditable, no black box decides where public/CSR money goes.
 * Mirrored on the How-it-works strip of the Home page.
 */
export const NFP_WEIGHTS = { area: 0.3, model: 0.25, track: 0.2, capacity: 0.15, cost: 0.1 } as const;
export const DONOR_WEIGHTS = { location: 0.3, model: 0.2, budget: 0.2, need: 0.2, ready: 0.1 } as const;

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function scoreForNfp(nfp: Nfp, opp: Opportunity, stage: Stage, alreadyBid: boolean): MatchResult {
  const reasons: string[] = [];
  const warnings: string[] = [];

  const d = haversineKm(nfp, opp);
  const serves = nfp.servesStates.includes(opp.state);
  const proximity = 1 / (1 + (d / 120) ** 2);
  const area = serves ? Math.max(proximity, 0.65) : proximity * 0.5;
  if (serves && d < 80) reasons.push(`Already works ${Math.round(d)} km away in ${opp.state}`);
  else if (serves) reasons.push(`Empanelled to serve ${opp.state}`);
  else warnings.push(`Not yet operating in ${opp.state}`);

  const hasModel = nfp.types.includes(opp.type);
  const model = hasModel ? 1 : 0.3;
  if (hasModel) reasons.push(`Has run ${typeLabel(opp.type)} creches before`);
  else warnings.push(`No past ${typeLabel(opp.type)} creches`);

  const track = clamp01(nfp.auditScore / 100);
  if (nfp.auditScore >= 85) reasons.push(`Strong audit record (${nfp.auditScore}/100)`);
  else if (nfp.auditScore < 75) warnings.push(`Audit record still building (${nfp.auditScore}/100)`);

  const capacity = clamp01(nfp.freeCapacityUnits / opp.units);
  if (capacity >= 1) reasons.push(`Capacity for all ${opp.units} creches`);
  else warnings.push(`Can take ${nfp.freeCapacityUnits} of ${opp.units} creches now`);

  const [lo] = nfp.costBandLakh;
  // paying above their band is fine for the operator; paying below it is a risk to quality
  const gap = Math.max(0, lo - opp.unitCostLakh);
  const cost = gap === 0 ? 1 : Math.max(0.3, 1 - gap / 10);
  if (gap === 0) reasons.push(`Standard cost ${fmtLakh(opp.unitCostLakh)} is within their usual band`);
  else warnings.push(`State cost ${fmtLakh(opp.unitCostLakh)} is below their usual ${fmtLakh(lo)}+`);

  // fairness boost: remote / high-malnutrition places get up to +5 points so they do not stay unfunded
  const boost = round((5 * opp.need) / 100, 1);
  if (opp.need >= 80) reasons.push('High-need location (fairness boost applied)');

  const parts: ScoreBreakdown['parts'] = [
    { label: 'Area & reach', weight: NFP_WEIGHTS.area, value: round(area, 2) },
    { label: 'Creche model experience', weight: NFP_WEIGHTS.model, value: round(model, 2) },
    { label: 'Audit track record', weight: NFP_WEIGHTS.track, value: round(track, 2) },
    { label: 'Free capacity', weight: NFP_WEIGHTS.capacity, value: round(capacity, 2) },
    { label: 'Cost fit', weight: NFP_WEIGHTS.cost, value: round(cost, 2) },
  ];
  const score = Math.min(100, Math.round(parts.reduce((s, p) => s + 100 * p.weight * p.value, 0) + boost));

  let eligible = true;
  if (nfp.status !== 'certified') {
    eligible = false;
    warnings.unshift('Complete empanelment to bid');
  } else if (stage !== 'open' && stage !== 'bidding') {
    eligible = false;
    warnings.unshift('Bidding is closed');
  } else if (alreadyBid) {
    eligible = false;
    warnings.unshift('Bid already submitted');
  }

  return { opportunityId: opp.id, score, eligible, breakdown: { parts, boost }, reasons, warnings, distanceKm: round(d, 0) };
}

export function scoreForDonor(donor: Donor, opp: Opportunity, remainingLakh: number, stage: Stage, hasNfp: boolean, hasBids: boolean): MatchResult {
  const reasons: string[] = [];
  const warnings: string[] = [];

  const nearest = donor.sites.reduce(
    (best, s) => {
      const d = haversineKm(s, opp);
      return d < best.d ? { d, label: s.label } : best;
    },
    { d: Infinity, label: '' },
  );
  const near = 1 / (1 + (nearest.d / 150) ** 2);
  const inState = donor.prefStates.includes(opp.state);
  const location = Math.max(near, inState ? 0.7 : 0);
  if (nearest.d < 150) reasons.push(`${Math.round(nearest.d)} km from ${nearest.label}`);
  else if (inState) reasons.push(`In your preferred state, ${opp.state}`);
  else warnings.push('Outside your usual areas');

  const hasModel = donor.prefTypes.includes(opp.type);
  const model = hasModel ? 1 : 0.4;
  if (hasModel) reasons.push(`Matches your ${typeLabel(opp.type)} preference`);

  const budget = remainingLakh <= 0 ? 0 : clamp01(donor.budgetLakh / remainingLakh);
  if (remainingLakh > 0 && budget >= 1) reasons.push(`Fits your budget (${fmtLakh(remainingLakh)} to fund)`);
  else if (remainingLakh > 0) warnings.push(`Needs ${fmtLakh(remainingLakh)}, you have ${fmtLakh(donor.budgetLakh)} left; co-fund`);

  const pr = opp.priority === 'high' ? 1 : opp.priority === 'medium' ? 0.6 : 0.3;
  const need = clamp01(0.7 * (opp.need / 100) + 0.3 * pr);
  if (opp.need >= 80) reasons.push(`High malnutrition need (${opp.poshanTag})`);

  const ready = hasNfp ? 1 : hasBids ? 0.6 : 0.25;
  if (hasNfp) reasons.push('Operator already awarded, ready to start');
  else if (hasBids) reasons.push('Operators are bidding');

  const parts: ScoreBreakdown['parts'] = [
    { label: 'Location', weight: DONOR_WEIGHTS.location, value: round(location, 2) },
    { label: 'Creche model', weight: DONOR_WEIGHTS.model, value: round(model, 2) },
    { label: 'Budget fit', weight: DONOR_WEIGHTS.budget, value: round(budget, 2) },
    { label: 'Need & priority', weight: DONOR_WEIGHTS.need, value: round(need, 2) },
    { label: 'Readiness', weight: DONOR_WEIGHTS.ready, value: round(ready, 2) },
  ];
  const score = Math.min(100, Math.round(parts.reduce((s, p) => s + 100 * p.weight * p.value, 0)));

  let eligible = true;
  if (remainingLakh <= 0) {
    eligible = false;
    warnings.unshift('Fully funded');
  } else if (stage === 'audited') {
    eligible = false;
    warnings.unshift('Already audited');
  }

  return { opportunityId: opp.id, score, eligible, breakdown: { parts, boost: 0 }, reasons, warnings, distanceKm: Number.isFinite(nearest.d) ? round(nearest.d, 0) : null };
}

/**
 * Batch matching for "fund a state programme / cluster": greedy pick by score until the budget is used.
 * (Production could swap this for an assignment / stable-matching solver without changing the API.)
 */
export function proposeBasket(items: { view: OpportunityView; match: MatchResult }[], budgetLakh: number, maxItems = 12): BasketProposal {
  const ranked = items.filter((i) => i.match.eligible).sort((a, b) => b.match.score - a.match.score);
  const chosen: BasketItem[] = [];
  let left = budgetLakh;
  for (const { view, match } of ranked) {
    const need = view.totalLakh - view.committedLakh;
    if (need <= 0 || need > left || chosen.length >= maxItems) continue;
    chosen.push({ opportunity: view, match, fundLakh: need });
    left -= need;
  }
  return {
    items: chosen,
    totalLakh: budgetLakh - left,
    children: chosen.reduce((s, c) => s + c.opportunity.units * CHILDREN_PER_UNIT, 0),
    budgetLakh,
  };
}
