// Types and constants shared by the Express API (server/) and the React app (src/).

export interface LatLng {
  lat: number;
  lng: number;
}

/** state / nfp / csr / auditor are the four stakeholders in the proposal; admin is the Ministry (platform owner). */
export type Role = 'state' | 'nfp' | 'csr' | 'auditor' | 'admin';

// ---- creche models (Type A-D from the State interface) -------------------------------------

export type CrecheType = 'A' | 'B' | 'C' | 'D';

export const CRECHE_TYPES: { id: CrecheType; label: string; short: string; standardCostLakh: number; hint: string }[] = [
  { id: 'A', label: 'Urban slum', short: 'Urban slum', standardCostLakh: 16, hint: 'Dense settlements, working mothers nearby' },
  { id: 'B', label: 'Rural village', short: 'Rural village', standardCostLakh: 15, hint: 'Gram Panchayat clusters, tribal and remote areas' },
  { id: 'C', label: 'Construction site', short: 'Construction', standardCostLakh: 22, hint: 'Migrant families on building sites' },
  { id: 'D', label: 'Industrial zone', short: 'Industrial', standardCostLakh: 16, hint: 'Factory and mining belts' },
];

export const typeLabel = (t: CrecheType) => CRECHE_TYPES.find((x) => x.id === t)?.label ?? t;

/** Children served by one standard creche. The deck's own planning ratio: 100 creches = 2,000 children, 10,000 = 2 lakh, 50,000 = 10 lakh. */
export const CHILDREN_PER_UNIT = 20;

// ---- lifecycle -------------------------------------------------------------------------------

export type Stage = 'open' | 'bidding' | 'matched' | 'funded' | 'operating' | 'audited';

export const STAGES: { id: Stage; label: string; who: string; hint: string }[] = [
  { id: 'open', label: 'Open', who: 'State', hint: 'State has defined where a creche is needed' },
  { id: 'bidding', label: 'Bidding', who: 'NFP', hint: 'Certified operators are bidding to run it' },
  { id: 'matched', label: 'Matched', who: 'State + NFP', hint: 'An operator has been awarded' },
  { id: 'funded', label: 'Funded', who: 'CSR', hint: 'CSR capital fully committed' },
  { id: 'operating', label: 'Operating', who: 'NFP', hint: 'Creche is running, daily monitoring on' },
  { id: 'audited', label: 'Audited', who: 'Auditor', hint: 'Independent impact assurance issued' },
];

export const stageIndex = (s: Stage) => STAGES.findIndex((x) => x.id === s);

export type Priority = 'high' | 'medium' | 'low';

// ---- entities --------------------------------------------------------------------------------

export interface Opportunity {
  id: string;
  name: string; // creche location / cluster name
  state: string;
  district: string;
  lat: number;
  lng: number;
  type: CrecheType;
  units: number; // number of creches in this opportunity
  unitCostLakh: number; // per creche
  priority: Priority;
  poshanTag: string;
  /** 0-100 composite of malnutrition and working-mother density (synthetic). */
  need: number;
  createdBy: string;
  createdAt: string;
  nfpId: string | null; // awarded operator
  operating: boolean;
  operatingAt: string | null;
  pilot?: boolean;
}

export interface Bid {
  id: string;
  opportunityId: string;
  nfpId: string;
  quoteLakh: number; // per creche
  note: string;
  status: 'submitted' | 'awarded' | 'declined';
  createdAt: string;
}

export interface Commitment {
  id: string;
  opportunityId: string;
  donorId: string;
  amountLakh: number;
  createdAt: string;
}

export interface AuditReport {
  id: string;
  opportunityId: string;
  auditorId: string;
  auditor: string;
  childrenEnrolled: number;
  enrolmentPct: number;
  attendancePct: number;
  malnutritionReductionPct: number;
  finding: 'verified' | 'at_risk';
  note: string;
  issuedAt: string;
}

export const CHECKLIST = [
  { key: 'org', label: 'Organisation details', hint: 'Registration, PAN, 12A/80G, board' },
  { key: 'work', label: 'Past childcare work', hint: 'Track record in childcare / nutrition' },
  { key: 'finance', label: 'Financial statements', hint: 'Last 3 years audited accounts' },
  { key: 'staff', label: 'Staffing & training', hint: 'Creche worker training capability' },
] as const;
export type ChecklistKey = (typeof CHECKLIST)[number]['key'];

export interface Nfp {
  id: string;
  name: string;
  about: string;
  state: string; // base state
  district: string;
  lat: number;
  lng: number;
  servesStates: string[];
  types: CrecheType[]; // models it has run
  costBandLakh: [number, number]; // typical per-creche cost
  crechesRun: number;
  childrenServed: number;
  auditScore: number; // 0-100, from past independent audits
  freeCapacityUnits: number; // how many more creches it can take on now
  /** applied: still filling the checklist, under_review: submitted, waiting for the Ministry, certified: can bid */
  status: 'applied' | 'under_review' | 'certified';
  checklist: Record<ChecklistKey, boolean>;
}

export interface DonorSite {
  label: string;
  lat: number;
  lng: number;
}

export interface Donor {
  id: string;
  name: string;
  sector: string;
  prefStates: string[];
  prefTypes: CrecheType[];
  sites: DonorSite[]; // plants / offices: CSR firms usually prefer to fund near their operations
  budgetLakh: number; // remaining CSR budget for childcare
}

export interface Auditor {
  id: string;
  name: string;
}

// ---- derived views (computed by the server) --------------------------------------------------

export interface OpportunityView extends Opportunity {
  stage: Stage;
  totalLakh: number;
  committedLakh: number;
  children: number;
  bidCount: number;
  nfpName: string | null;
}

export interface ScoreBreakdown {
  /** label -> 0..1 */
  parts: { label: string; weight: number; value: number }[];
  /** extra points from the fairness boost (NFP side) */
  boost: number;
}

export interface MatchResult {
  opportunityId: string;
  score: number; // 0-100
  eligible: boolean;
  breakdown: ScoreBreakdown;
  reasons: string[]; // human-readable "why this match"
  warnings: string[];
  distanceKm: number | null;
}

export interface BidView extends Bid {
  nfp: Nfp;
  match: MatchResult;
  best: boolean;
}

export interface CommitmentView extends Commitment {
  donorName: string;
}

export interface OpportunityDetail {
  opportunity: OpportunityView;
  bids: BidView[];
  commitments: CommitmentView[];
  audit: AuditReport | null;
  awarded: Nfp | null;
  /** score of the demo NFP / donor persona for this opportunity, when requested with ?as=nfp|csr */
  myMatch: MatchResult | null;
  myBid: Bid | null;
  myCommittedLakh: number;
  timeline: { at: string; text: string; tone: 'blue' | 'pink' | 'green' }[];
}

export interface BasketItem {
  opportunity: OpportunityView;
  match: MatchResult;
  fundLakh: number;
}

export interface BasketProposal {
  items: BasketItem[];
  totalLakh: number;
  children: number;
  budgetLakh: number;
}

export interface Stats {
  asOf: string;
  national: { activeOpportunities: number; csrCommittedCr: number; childrenLakh: number; verifiedNfps: number; fundedCr: number; pendingCr: number; remainingCr: number };
  demo: { opportunities: number; nfps: number; donors: number; units: number; children: number; committedCr: number; requiredCr: number; audits: number };
  funnel: { stage: Stage; label: string; count: number }[];
  stateDemand: { state: string; required: number; funded: number; capitalCr: number; children: number; open: number }[];
  byType: { type: CrecheType; label: string; count: number }[];
  audits: { enrolmentPct: number; attendancePct: number; malnutritionReductionPct: number; verified: number; atRisk: number; reports: number };
  pilot: { district: string; stunted: number; wasted: number; underweight: number }[];
  monthly: { month: string; opportunities: number; committedCr: number }[];
}

export interface ActivityItem {
  at: string;
  text: string;
  tone: 'blue' | 'pink' | 'green';
  opportunityId?: string;
}

export interface AdminOverview {
  pending: Nfp[];
  certified: number;
  opportunities: number;
  atRisk: number;
  /** current standard cost per creche model, editable by the Ministry */
  master: { id: CrecheType; label: string; standardCostLakh: number }[];
  activity: ActivityItem[];
}

export const STATES = [
  'Maharashtra', 'Uttar Pradesh', 'Madhya Pradesh', 'West Bengal', 'Karnataka', 'Tamil Nadu', 'Odisha', 'Rajasthan', 'Gujarat', 'Bihar', 'Jharkhand',
] as const;

export const PRIORITY_LABEL: Record<Priority, string> = { high: 'High', medium: 'Medium', low: 'Low' };

/** 1 crore = 100 lakh. Shows ₹ lakh below one crore and ₹ Cr (trimmed decimals) above. */
export function fmtLakh(l: number): string {
  if (l < 100) return `₹${Math.round(l * 10) / 10} lakh`;
  const cr = l / 100;
  const s = cr >= 100 ? cr.toFixed(0) : cr >= 10 ? cr.toFixed(1) : cr.toFixed(2);
  return `₹${s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s} Cr`;
}

// ---- triggers, tasks and per-role numbers -----------------------------------------------------

export interface Note {
  id: string;
  /** who caused it */
  from: Role;
  /** audience: everyone in this role, optionally narrowed to one state / operator / funder */
  to: Role;
  scope?: { state?: string; nfpId?: string; donorId?: string };
  text: string;
  link?: string;
  at: string;
  read: boolean;
}

export interface Task {
  id: string;
  title: string;
  text: string;
  link: string;
  tone: 'action' | 'info' | 'alert';
}

export interface Insight {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  tone?: 'brand' | 'blush';
}
