import { CRECHE_TYPES, STATES, STAGES } from '../../shared/types';
import type { CrecheType, Priority, Stage } from '../../shared/types';
import { PLACES } from '../../shared/geo';

export interface Filters {
  text: string;
  state: string;
  district: string;
  types: CrecheType[];
  stage: Stage | '';
  priority: Priority | '';
  maxCostLakh: number | null;
  /** "near me": radius in km around `origin` */
  radiusKm: number | null;
}

export const EMPTY_FILTERS: Filters = { text: '', state: '', district: '', types: [], stage: '', priority: '', maxCostLakh: null, radiusKm: null };

const TYPE_WORDS: [CrecheType, RegExp][] = [
  ['A', /\b(urban|slum|slums|city)\b/],
  ['B', /\b(rural|village|villages|tribal|hamlet|hamlets)\b/],
  ['C', /\b(construction|migrant|site|sites)\b/],
  ['D', /\b(industrial|industry|factory|mining|mine|garment)\b/],
];

/**
 * "Smart search": turns a sentence like "rural creches in Keonjhar under 20 lakh" into filters.
 * Plain keyword parsing, no AI call, so it is instant, free and predictable.
 */
export function parseQuery(q: string): { filters: Partial<Filters>; chips: string[] } {
  const raw = q.toLowerCase().replace(/[èé]/g, 'e').replace(/₹/g, ' ');
  const f: Partial<Filters> = {};
  const chips: string[] = [];
  let rest = raw;

  const state = STATES.find((s) => raw.includes(s.toLowerCase()));
  if (state) {
    f.state = state;
    chips.push(state);
    rest = rest.replace(state.toLowerCase(), ' ');
  }
  const place = PLACES.filter((p) => raw.includes(p.name.toLowerCase())).sort((a, b) => b.name.length - a.name.length)[0];
  if (place) {
    f.district = place.name;
    f.state = place.state;
    chips.push(place.name);
    rest = rest.replace(place.name.toLowerCase(), ' ');
    if (!state) chips.unshift(place.state);
  }

  const types = TYPE_WORDS.filter(([, re]) => re.test(raw)).map(([t]) => t);
  if (types.length) {
    f.types = types;
    chips.push(types.map((t) => CRECHE_TYPES.find((x) => x.id === t)!.label).join(' / '));
  }

  const cost = raw.match(/(?:under|below|less than|upto|up to|within|max|<=?)\s*(\d+(?:\.\d+)?)\s*(lakh|lakhs|l|cr|crore)?/);
  if (cost && !/km/.test(raw.slice(cost.index! + cost[0].length, cost.index! + cost[0].length + 4))) {
    const n = Number(cost[1]);
    f.maxCostLakh = /cr/.test(cost[2] ?? '') ? n * 100 : n;
    chips.push(`≤ ₹${n} ${/cr/.test(cost[2] ?? '') ? 'Cr' : 'lakh'} per creche`);
  }

  const km = raw.match(/(?:within|inside|around)?\s*(\d+)\s*km/);
  if (km) {
    f.radiusKm = Math.min(500, Number(km[1]));
    chips.push(`within ${km[1]} km`);
  }
  if (/\bnear me\b|\bnearby\b/.test(raw) && !km) {
    f.radiusKm = 50;
    chips.push('near me (50 km)');
  }

  if (/\bhigh priority\b|\burgent\b/.test(raw)) {
    f.priority = 'high';
    chips.push('High priority');
  }
  const stage = STAGES.find((s) => new RegExp(`\\b${s.id}\\b`).test(raw) && s.id !== 'open') ?? (/\bopen\b/.test(raw) ? STAGES[0] : undefined);
  if (stage) {
    f.stage = stage.id;
    chips.push(stage.label);
  }

  return { filters: f, chips };
}

export const hasFilters = (f: Filters) =>
  !!(f.text || f.state || f.district || f.types.length || f.stage || f.priority || f.maxCostLakh !== null || f.radiusKm !== null);
