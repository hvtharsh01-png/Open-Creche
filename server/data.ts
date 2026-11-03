import { CHILDREN_PER_UNIT, CRECHE_TYPES } from '../shared/types.js';
import type { Auditor, AuditReport, Bid, Commitment, CrecheType, Donor, Nfp, Note, Opportunity, Priority, Stage } from '../shared/types.js';
import { findPlace } from '../shared/geo.js';

/**
 * In-memory demo registry. Every record here is SYNTHETIC. Only the Odisha pilot district figures
 * (see stats in app.ts) and the headline scale numbers come from the Open Creche proposal deck.
 * Replace with PostgreSQL + PostGIS behind the same API for anything real.
 */

/** Master data the Ministry can edit: standard cost per creche model (lakh). Reset with the demo data. */
export const masterCost: Record<string, number> = {};

export interface DB {
  opportunities: Opportunity[];
  bids: Bid[];
  commitments: Commitment[];
  audits: AuditReport[];
  nfps: Nfp[];
  donors: Donor[];
  auditors: Auditor[];
  notes: Note[];
  seq: { opp: number; bid: number; com: number; aud: number; note: number; nfp: number };
}

export const db: DB = { opportunities: [], bids: [], commitments: [], audits: [], nfps: [], donors: [], auditors: [], notes: [], seq: { opp: 0, bid: 0, com: 0, aud: 0, note: 0, nfp: 0 } };

/** nfpId is the new-applicant persona (also used by the Ministry walkthrough); empanelledNfpId is the already-certified operator */
export const PERSONA = { nfpId: 'nfp-nanhe', empanelledNfpId: 'nfp-disha', donorId: 'donor-meridian', auditorId: 'aud-1', state: 'Odisha' } as const;

/** Deterministic 0..1 pseudo-random from a string, so reseeding always gives the same demo. */
export function h01(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

type Row = [name: string, state: string, district: string, type: CrecheType, units: number, cost: number, priority: Priority, need: number, tag: string, stage?: Stage, pilot?: boolean];

const ROWS: Row[] = [
  // Maharashtra (State interface screen)
  ['Pune W12', 'Maharashtra', 'Pune', 'A', 20, 16, 'high', 74, 'Working-mother density', 'bidding'],
  ['Nashik R', 'Maharashtra', 'Nashik', 'B', 15, 15, 'medium', 61, 'Rural stunting hotspot'],
  ['Mumbra S', 'Maharashtra', 'Thane', 'C', 20, 22, 'high', 70, 'Migrant construction labour', 'funded'],
  ['Aurangabad V', 'Maharashtra', 'Chhatrapati Sambhajinagar', 'D', 30, 16, 'medium', 58, 'Industrial belt', 'funded'],
  ['Ratnagiri C', 'Maharashtra', 'Ratnagiri', 'D', 16, 19, 'medium', 52, 'Coastal industrial cluster'],
  ['Pune W8', 'Maharashtra', 'Pune', 'A', 12, 17, 'medium', 66, 'Urban slum cluster', 'matched'],
  ['Aurangabad VV', 'Maharashtra', 'Chhatrapati Sambhajinagar', 'B', 15, 15, 'high', 77, 'Rural wasting hotspot', 'funded'],
  ['Nashik S', 'Maharashtra', 'Nashik', 'C', 20, 20, 'medium', 55, 'Construction labour'],
  ['Nagpur Mihan Zone', 'Maharashtra', 'Nagpur', 'D', 14, 18, 'low', 44, 'Industrial estate', 'bidding'],
  // Uttar Pradesh
  ['Lucknow Aliganj Slums', 'Uttar Pradesh', 'Lucknow', 'A', 18, 16, 'high', 72, 'Urban slum cluster', 'bidding'],
  ['Kanpur Panki Industrial', 'Uttar Pradesh', 'Kanpur Nagar', 'D', 22, 17, 'medium', 60, 'Industrial belt'],
  ['Varanasi Rohania Block', 'Uttar Pradesh', 'Varanasi', 'B', 20, 15, 'medium', 64, 'Rural stunting hotspot', 'matched'],
  ['Gorakhpur Campierganj', 'Uttar Pradesh', 'Gorakhpur', 'B', 25, 15, 'high', 83, 'Rural wasting hotspot', 'bidding'],
  ['Agra Trans-Yamuna', 'Uttar Pradesh', 'Agra', 'C', 10, 21, 'low', 46, 'Construction labour'],
  ['Bahraich Nanpara', 'Uttar Pradesh', 'Bahraich', 'B', 30, 14, 'high', 88, 'High malnutrition district'],
  // Madhya Pradesh
  ['Bhopal Govindpura', 'Madhya Pradesh', 'Bhopal', 'A', 14, 16, 'medium', 57, 'Urban slum cluster'],
  ['Indore Pithampur', 'Madhya Pradesh', 'Indore', 'D', 12, 17, 'medium', 50, 'Industrial belt', 'funded'],
  ['Rewa Mauganj', 'Madhya Pradesh', 'Rewa', 'B', 20, 15, 'high', 79, 'Rural stunting hotspot', 'bidding'],
  ['Sagar Bina Block', 'Madhya Pradesh', 'Sagar', 'B', 16, 15, 'medium', 63, 'Rural wasting hotspot'],
  ['Dindori Tribal Cluster', 'Madhya Pradesh', 'Dindori', 'B', 22, 15, 'high', 90, 'Tribal / PVTG habitation'],
  // West Bengal
  ['Kolkata Metiabruz', 'West Bengal', 'Kolkata', 'A', 20, 17, 'high', 75, 'Urban slum cluster', 'bidding'],
  ['Howrah Jute Belt', 'West Bengal', 'Howrah', 'D', 15, 16, 'medium', 56, 'Industrial belt'],
  ['Purulia Baghmundi', 'West Bengal', 'Purulia', 'B', 18, 15, 'high', 81, 'Rural stunting hotspot'],
  ['Murshidabad Domkal', 'West Bengal', 'Murshidabad', 'B', 24, 14, 'high', 84, 'Rural wasting hotspot', 'matched'],
  ['Darjeeling Tea Gardens', 'West Bengal', 'Darjeeling', 'B', 12, 15, 'medium', 62, 'Tea-garden workers'],
  // Karnataka
  ['Bengaluru Whitefield Sites', 'Karnataka', 'Bengaluru Urban', 'C', 16, 22, 'medium', 49, 'Construction labour', 'bidding'],
  ['Mysuru Slum Cluster', 'Karnataka', 'Mysuru', 'A', 8, 16, 'low', 42, 'Urban slum cluster'],
  ['Raichur Sindhanur', 'Karnataka', 'Raichur', 'B', 20, 15, 'high', 80, 'Rural stunting hotspot'],
  ['Kalaburagi Aland', 'Karnataka', 'Kalaburagi', 'B', 18, 15, 'medium', 68, 'Rural wasting hotspot'],
  ['Dharwad Industrial Estate', 'Karnataka', 'Dharwad', 'D', 10, 17, 'low', 40, 'Industrial estate'],
  // Tamil Nadu
  ['Chennai Ennore Slums', 'Tamil Nadu', 'Chennai', 'A', 15, 18, 'medium', 58, 'Urban slum cluster'],
  ['Madurai Periyar Wards', 'Tamil Nadu', 'Madurai', 'A', 10, 16, 'low', 45, 'Urban slum cluster'],
  ['Coimbatore SIDCO', 'Tamil Nadu', 'Coimbatore', 'D', 12, 17, 'low', 41, 'Industrial estate'],
  ['Tiruppur Garment Belt', 'Tamil Nadu', 'Tiruppur', 'D', 20, 17, 'high', 65, 'Garment workers, women-heavy', 'funded'],
  ['Salem Kolli Hills', 'Tamil Nadu', 'Salem', 'B', 14, 15, 'medium', 69, 'Tribal / hill habitation'],
  // Odisha: pilot (Keonjhar, Sundargarh, Jajpur)
  ['Keonjhar Joda Mining Belt', 'Odisha', 'Keonjhar', 'D', 12, 17, 'high', 91, 'Mining corridor, high wasting', 'operating', true],
  ['Keonjhar Ghatgaon Rural', 'Odisha', 'Keonjhar', 'B', 25, 15, 'high', 94, 'Tribal / PVTG habitation', 'audited', true],
  ['Sundargarh Lahunipara', 'Odisha', 'Sundargarh', 'B', 20, 15, 'high', 89, 'Tribal / PVTG habitation', 'audited', true],
  ['Sundargarh Rourkela Slums', 'Odisha', 'Sundargarh', 'A', 10, 16, 'medium', 63, 'Urban slum cluster', 'operating', true],
  ['Jajpur Korei Industrial', 'Odisha', 'Jajpur', 'D', 14, 17, 'medium', 62, 'Industrial belt', 'funded', true],
  ['Jajpur Dharmasala Rural', 'Odisha', 'Jajpur', 'B', 15, 15, 'medium', 71, 'Rural stunting hotspot', 'matched', true],
  ['Mayurbhanj Tribal Cluster', 'Odisha', 'Mayurbhanj', 'B', 18, 15, 'high', 92, 'Tribal / PVTG habitation', 'bidding'],
  ['Koraput Remote Hamlets', 'Odisha', 'Koraput', 'B', 16, 15, 'high', 93, 'Remote tribal hamlets'],
  ['Khordha Bhubaneswar Slums', 'Odisha', 'Khordha', 'A', 8, 17, 'medium', 55, 'Urban slum cluster'],
  ['Keonjhar Champua Block', 'Odisha', 'Keonjhar', 'B', 20, 15, 'high', 90, 'Rural wasting hotspot'],
  // Rajasthan
  ['Jaipur Mansarovar Sites', 'Rajasthan', 'Jaipur', 'C', 12, 21, 'medium', 51, 'Construction labour'],
  ['Udaipur Girwa Block', 'Rajasthan', 'Udaipur', 'B', 14, 15, 'medium', 70, 'Tribal / hill habitation'],
  ['Banswara Kushalgarh', 'Rajasthan', 'Banswara', 'B', 20, 15, 'high', 86, 'Tribal / PVTG habitation', 'bidding'],
  ['Jodhpur Basni Industrial', 'Rajasthan', 'Jodhpur', 'D', 10, 16, 'low', 43, 'Industrial estate'],
  // Gujarat
  ['Surat Sachin GIDC', 'Gujarat', 'Surat', 'D', 18, 17, 'high', 64, 'Migrant industrial workers'],
  ['Ahmedabad Naroda', 'Gujarat', 'Ahmedabad', 'A', 12, 17, 'medium', 52, 'Urban slum cluster'],
  ['Dahod Garbada Block', 'Gujarat', 'Dahod', 'B', 16, 15, 'high', 82, 'Tribal habitation'],
  // Bihar / Jharkhand
  ['Patna Digha Wards', 'Bihar', 'Patna', 'A', 14, 16, 'medium', 59, 'Urban slum cluster'],
  ['Gaya Bodh Gaya Block', 'Bihar', 'Gaya', 'B', 20, 14, 'high', 85, 'Rural stunting hotspot'],
  ['Ranchi Ormanjhi Sites', 'Jharkhand', 'Ranchi', 'C', 10, 20, 'medium', 54, 'Construction labour'],
  ['West Singhbhum Mining Belt', 'Jharkhand', 'West Singhbhum', 'D', 14, 17, 'high', 87, 'Mining corridor, tribal', 'matched'],
];

type NfpSeed = Omit<Nfp, 'lat' | 'lng' | 'checklist' | 'status'> & { status?: Nfp['status']; checklist?: Partial<Nfp['checklist']> };

const NFPS: NfpSeed[] = [
  { id: 'nfp-nanhe', name: 'Nanhe Kadam Foundation', about: 'Early-years centres for tribal and slum children across coastal and western Odisha.', state: 'Odisha', district: 'Khordha', servesStates: ['Odisha', 'Jharkhand'], types: ['A', 'B'], costBandLakh: [14, 18], crechesRun: 18, childrenServed: 450, auditScore: 72, freeCapacityUnits: 30, status: 'applied', checklist: { org: true, work: true } },
  { id: 'nfp-disha', name: 'Disha Bal Vikas Trust', about: 'Runs 240 village creches in the Keonjhar mining belt with Anganwadi convergence.', state: 'Odisha', district: 'Keonjhar', servesStates: ['Odisha'], types: ['B', 'D'], costBandLakh: [14, 18], crechesRun: 240, childrenServed: 6200, auditScore: 91, freeCapacityUnits: 40 },
  { id: 'nfp-aranya', name: 'Aranya Shishu Seva Sangh', about: 'Tribal-area childcare and growth monitoring in Sundargarh and Mayurbhanj.', state: 'Odisha', district: 'Sundargarh', servesStates: ['Odisha', 'Jharkhand'], types: ['A', 'B'], costBandLakh: [14, 17], crechesRun: 180, childrenServed: 4100, auditScore: 88, freeCapacityUnits: 28 },
  { id: 'nfp-kilkari', name: 'Kilkari Childcare Trust', about: 'Urban slum and construction-site creches in western India.', state: 'Maharashtra', district: 'Pune', servesStates: ['Maharashtra', 'Gujarat'], types: ['A', 'C', 'D'], costBandLakh: [15, 23], crechesRun: 160, childrenServed: 3900, auditScore: 94, freeCapacityUnits: 45 },
  { id: 'nfp-palna', name: 'Palna Mitra Samiti', about: 'Community-run creches with take-home ration support in the Gangetic plain.', state: 'Uttar Pradesh', district: 'Lucknow', servesStates: ['Uttar Pradesh', 'Bihar'], types: ['A', 'B'], costBandLakh: [13, 17], crechesRun: 210, childrenServed: 5200, auditScore: 86, freeCapacityUnits: 50 },
  { id: 'nfp-udaan', name: 'Udaan Early Years Society', about: 'Rural and tribal early-childhood centres across central India.', state: 'Madhya Pradesh', district: 'Bhopal', servesStates: ['Madhya Pradesh', 'Rajasthan', 'Uttar Pradesh'], types: ['B'], costBandLakh: [13, 16], crechesRun: 150, childrenServed: 3600, auditScore: 83, freeCapacityUnits: 36 },
  { id: 'nfp-jan', name: 'Jan Poshan Pratishthan', about: 'Nutrition-first creches in eastern India, strong on SAM identification.', state: 'West Bengal', district: 'Kolkata', servesStates: ['West Bengal', 'Jharkhand', 'Odisha'], types: ['A', 'B'], costBandLakh: [14, 18], crechesRun: 195, childrenServed: 4700, auditScore: 90, freeCapacityUnits: 34 },
  { id: 'nfp-sarthak', name: 'Sarthak Shishu Kendra', about: 'Construction-site and industrial creches in the south.', state: 'Karnataka', district: 'Bengaluru Urban', servesStates: ['Karnataka', 'Tamil Nadu'], types: ['A', 'C', 'D'], costBandLakh: [16, 23], crechesRun: 120, childrenServed: 2900, auditScore: 89, freeCapacityUnits: 26 },
  { id: 'nfp-ankur', name: 'Ankur Bal Seva', about: 'Garment-belt and urban creches for women workers.', state: 'Tamil Nadu', district: 'Chennai', servesStates: ['Tamil Nadu', 'Karnataka'], types: ['A', 'D'], costBandLakh: [15, 19], crechesRun: 98, childrenServed: 2400, auditScore: 85, freeCapacityUnits: 22 },
  { id: 'nfp-bal-jyoti', name: 'Bal Jyoti Sansthan', about: 'Tribal and construction-site childcare in Rajasthan and Gujarat.', state: 'Rajasthan', district: 'Jaipur', servesStates: ['Rajasthan', 'Gujarat', 'Madhya Pradesh'], types: ['B', 'C'], costBandLakh: [14, 22], crechesRun: 132, childrenServed: 3100, auditScore: 84, freeCapacityUnits: 30 },
  { id: 'nfp-sneh', name: 'Sneh Dhara Foundation', about: 'Rural creches and mother groups across Bihar and Jharkhand.', state: 'Bihar', district: 'Patna', servesStates: ['Bihar', 'Jharkhand', 'Uttar Pradesh'], types: ['A', 'B'], costBandLakh: [13, 16], crechesRun: 170, childrenServed: 4200, auditScore: 81, freeCapacityUnits: 38 },
  { id: 'nfp-mitra', name: 'Mitra Care Collective', about: 'Industrial-zone creches in Gujarat and Maharashtra.', state: 'Gujarat', district: 'Ahmedabad', servesStates: ['Gujarat', 'Maharashtra'], types: ['C', 'D'], costBandLakh: [16, 22], crechesRun: 88, childrenServed: 2100, auditScore: 87, freeCapacityUnits: 24 },
  { id: 'nfp-kopal', name: 'Kopal Shishu Trust', about: 'New operator running tribal-area creches in Mayurbhanj and Keonjhar, applied for empanelment.', state: 'Odisha', district: 'Mayurbhanj', servesStates: ['Odisha'], types: ['B'], costBandLakh: [13, 16], crechesRun: 24, childrenServed: 480, auditScore: 74, freeCapacityUnits: 20, status: 'under_review' },
  { id: 'nfp-aarambh', name: 'Aarambh Early Years Foundation', about: 'Urban-slum early learning centres in Patna and Gaya, applied for empanelment.', state: 'Bihar', district: 'Gaya', servesStates: ['Bihar'], types: ['A', 'B'], costBandLakh: [13, 17], crechesRun: 31, childrenServed: 620, auditScore: 77, freeCapacityUnits: 18, status: 'under_review' },
  { id: 'nfp-naya', name: 'Naya Savera Trust', about: 'Mining-belt and tribal childcare in Jharkhand and Odisha.', state: 'Jharkhand', district: 'Ranchi', servesStates: ['Jharkhand', 'Odisha', 'West Bengal'], types: ['B', 'D'], costBandLakh: [14, 18], crechesRun: 125, childrenServed: 3000, auditScore: 86, freeCapacityUnits: 32 },
];

const DONORS: Donor[] = [
  { id: 'donor-meridian', name: 'Meridian Steel & Mining Ltd', sector: 'Mining & metals', prefStates: ['Odisha', 'Jharkhand'], prefTypes: ['B', 'D'], sites: [{ label: 'Joda mine, Keonjhar', lat: 21.99, lng: 85.43 }, { label: 'Rourkela plant', lat: 22.26, lng: 84.86 }], budgetLakh: 4000 },
  { id: 'donor-kaveri', name: 'Kaveri Textiles Ltd', sector: 'Textiles', prefStates: ['Tamil Nadu', 'Karnataka'], prefTypes: ['A', 'D'], sites: [{ label: 'Tiruppur mills', lat: 11.11, lng: 77.34 }], budgetLakh: 2500 },
  { id: 'donor-ghats', name: 'Western Ghats Power Co.', sector: 'Energy', prefStates: ['Maharashtra', 'Gujarat'], prefTypes: ['A', 'C', 'D'], sites: [{ label: 'Nashik plant', lat: 20.0, lng: 73.79 }, { label: 'Pune office', lat: 18.52, lng: 73.86 }], budgetLakh: 3000 },
  { id: 'donor-gangetic', name: 'Gangetic Foods & Beverages', sector: 'FMCG', prefStates: ['Uttar Pradesh', 'Bihar'], prefTypes: ['A', 'B'], sites: [{ label: 'Lucknow factory', lat: 26.85, lng: 80.95 }], budgetLakh: 2000 },
  { id: 'donor-deccan', name: 'Deccan Infra & Housing', sector: 'Construction', prefStates: ['Karnataka', 'Tamil Nadu'], prefTypes: ['C'], sites: [{ label: 'Bengaluru HQ', lat: 12.97, lng: 77.59 }], budgetLakh: 1800 },
  { id: 'donor-bharat', name: 'Bharat Green Energy', sector: 'Renewables', prefStates: ['Rajasthan', 'Madhya Pradesh'], prefTypes: ['B'], sites: [{ label: 'Jodhpur solar park', lat: 26.24, lng: 73.02 }], budgetLakh: 2200 },
  { id: 'donor-eastern', name: 'Eastern Coal Logistics', sector: 'Logistics', prefStates: ['West Bengal', 'Jharkhand'], prefTypes: ['D', 'B'], sites: [{ label: 'Kolkata port office', lat: 22.55, lng: 88.32 }], budgetLakh: 1500 },
];

const AUDITORS: Auditor[] = [
  { id: 'aud-1', name: 'Independent Assurance LLP' },
  { id: 'aud-2', name: 'Veritas Impact Auditors' },
];

export function makeAudit(opp: Opportunity, auditor: Auditor, issuedAt: string, forceRisk?: boolean): AuditReport {
  const r = (salt: string) => h01(opp.id + salt);
  const children = opp.units * CHILDREN_PER_UNIT;
  const enrolmentPct = Math.round(84 + r('e') * 13);
  const attendancePct = Math.round(80 + r('a') * 15);
  const malnutritionReductionPct = Math.round(opp.pilot ? 22 + r('m') * 14 : 12 + r('m') * 22);
  const atRisk = forceRisk ?? (attendancePct < 83 && r('x') > 0.5);
  return {
    id: `aud-${++db.seq.aud}`,
    opportunityId: opp.id,
    auditorId: auditor.id,
    auditor: auditor.name,
    childrenEnrolled: Math.round((children * enrolmentPct) / 100),
    enrolmentPct,
    attendancePct,
    malnutritionReductionPct,
    finding: atRisk ? 'at_risk' : 'verified',
    note: atRisk
      ? 'Attendance below the quarterly target. Corrective plan requested from the operator before next milestone release.'
      : 'Utilisation verified against milestones. Enrolment, attendance and growth-monitoring records match field checks.',
    issuedAt,
  };
}

export function seed() {
  db.seq = { opp: 0, bid: 0, com: 0, aud: 0, note: 0, nfp: 0 };
  db.notes = [];
  CRECHE_TYPES.forEach((t) => (masterCost[t.id] = t.standardCostLakh));
  db.bids = [];
  db.commitments = [];
  db.audits = [];
  db.auditors = AUDITORS.map((a) => ({ ...a }));
  db.donors = DONORS.map((d) => ({ ...d, sites: d.sites.map((s) => ({ ...s })) }));
  db.nfps = NFPS.map((n) => {
    const p = findPlace(n.district)!;
    const certified = (n.status ?? 'certified') !== 'applied'; // submitted applications have a complete checklist
    return {
      ...n,
      status: n.status ?? 'certified',
      lat: p.lat,
      lng: p.lng,
      checklist: { org: certified, work: certified, finance: certified, staff: certified, ...n.checklist },
    } as Nfp;
  });

  const certified = db.nfps.filter((n) => n.status === 'certified');
  db.opportunities = ROWS.map((row, i): Opportunity => {
    const [name, state, district, type, units, unitCostLakh, priority, need, poshanTag, , pilot] = row;
    const place = findPlace(district)!;
    const id = `OC-${String(++db.seq.opp).padStart(3, '0')}`;
    const jitter = (s: string) => (h01(id + s) - 0.5) * 0.5; // ~ +-25 km
    return {
      id,
      name,
      state,
      district,
      lat: place.lat + jitter('lat'),
      lng: place.lng + jitter('lng'),
      type,
      units,
      unitCostLakh,
      priority,
      poshanTag,
      need,
      createdBy: `${state} Women & Child Development Dept.`,
      createdAt: daysAgo(10 + Math.round(h01(id) * 80)),
      nfpId: null,
      operating: false,
      operatingAt: null,
      pilot,
    };
  });

  db.opportunities.forEach((opp, i) => {
    const target = ROWS[i][9];
    if (!target) return;
    const idx = ['bidding', 'matched', 'funded', 'operating', 'audited'].indexOf(target);
    const total = opp.units * opp.unitCostLakh;
    const base = 8 + Math.round(h01(opp.id + 'd') * 30);

    // bids: certified operators that serve the state, best-effort
    const pool = certified.filter((n) => n.servesStates.includes(opp.state) && n.types.includes(opp.type));
    const bidders = (pool.length ? pool : certified.filter((n) => n.servesStates.includes(opp.state))).slice(0, 3);
    const chosen = bidders.length ? bidders : certified.slice(0, 2);
    chosen.forEach((n, k) => {
      const quote = Math.max(n.costBandLakh[0], Math.min(opp.unitCostLakh, n.costBandLakh[1])) - (k === 0 ? 0.5 : 0);
      db.bids.push({
        id: `bid-${++db.seq.bid}`,
        opportunityId: opp.id,
        nfpId: n.id,
        quoteLakh: Math.round(quote * 10) / 10,
        note: 'Standard creche design adopted; local women trained as creche workers.',
        status: 'submitted',
        createdAt: daysAgo(base - k),
      });
    });

    if (idx >= 1) {
      const winner = db.bids.filter((b) => b.opportunityId === opp.id)[0];
      winner.status = 'awarded';
      db.bids.filter((b) => b.opportunityId === opp.id && b.id !== winner.id).forEach((b) => (b.status = 'declined'));
      opp.nfpId = winner.nfpId;
    }
    if (idx >= 2) {
      const [d1, d2] = pickDonors(opp);
      const first = d2 ? Math.round(total * 0.6) : total;
      db.commitments.push({ id: `com-${++db.seq.com}`, opportunityId: opp.id, donorId: d1.id, amountLakh: first, createdAt: daysAgo(base - 4) });
      if (d2) db.commitments.push({ id: `com-${++db.seq.com}`, opportunityId: opp.id, donorId: d2.id, amountLakh: total - first, createdAt: daysAgo(base - 5) });
    }
    if (idx >= 3) {
      opp.operating = true;
      opp.operatingAt = daysAgo(Math.max(2, base - 8));
    }
    if (idx >= 4) db.audits.push(makeAudit(opp, db.auditors[0], daysAgo(Math.max(1, base - 14))));
  });

  // a few hand-overs already waiting so every role's inbox has something on first login
  const byName = (n: string) => db.opportunities.find((o) => o.name === n);
  const add = (from: Note['from'], to: Note['to'], text: string, o?: Opportunity, scope?: Note['scope']) =>
    db.notes.push({ id: `n-${++db.seq.note}`, from, to, scope, text, link: o ? `/opportunity/${o.id}` : '/workspace', at: daysAgo(0.1 * db.seq.note), read: false });
  const koraput = byName('Koraput Remote Hamlets');
  const mayur = byName('Mayurbhanj Tribal Cluster');
  const champua = byName('Keonjhar Champua Block');
  const joda = byName('Keonjhar Joda Mining Belt');
  if (joda) add('nfp', 'auditor', `"${joda.name}" is operating. First assurance audit is due.`, joda);
  if (mayur) add('nfp', 'state', `Disha Bal Vikas Trust bid on "${mayur.name}". Review bids and award an operator.`, mayur, { state: 'Odisha' });
  if (champua) add('state', 'csr', `Odisha published "${champua.name}": 20 creches, high priority.`, champua);
  if (koraput) add('state', 'nfp', `Odisha published "${koraput.name}": 16 creches, high priority. Open for bids.`, koraput);
  add('nfp', 'admin', 'Kopal Shishu Trust and Aarambh Early Years Foundation submitted empanelment applications. Review and certify.');
}

function pickDonors(opp: Opportunity): [Donor, Donor | null] {
  const local = db.donors.filter((d) => d.prefStates.includes(opp.state));
  const a = local[0] ?? db.donors[0];
  const b = db.donors.find((d) => d.id !== a.id && (d.prefTypes.includes(opp.type) || local.length > 1)) ?? null;
  return [a, local.length > 1 || opp.units > 18 ? b : null];
}

seed();
