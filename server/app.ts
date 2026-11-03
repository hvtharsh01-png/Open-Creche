import express from 'express';
import cors from 'cors';
import { CHECKLIST, CHILDREN_PER_UNIT, CRECHE_TYPES, STAGES, STATES, stageIndex } from '../shared/types.js';
import type {
  AdminOverview, Nfp, BidView, CommitmentView, CrecheType, Insight, Note, Opportunity, OpportunityDetail, OpportunityView, Priority, Role, Stage, Stats, Task,
} from '../shared/types.js';
import { PLACES, findPlace } from '../shared/geo.js';
import { PERSONA, db, h01, makeAudit, masterCost, seed } from './data.js';
import { proposeBasket, scoreForDonor, scoreForNfp } from './matching.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// NOTE: prototype. There is no authentication; in production every write below sits behind role-based login (e-KYC).

// ---- derived views --------------------------------------------------------------------------

const totalOf = (o: Opportunity) => o.units * o.unitCostLakh;
const committedOf = (id: string) => db.commitments.filter((c) => c.opportunityId === id).reduce((s, c) => s + c.amountLakh, 0);

function stageOf(o: Opportunity): Stage {
  if (db.audits.some((a) => a.opportunityId === o.id)) return 'audited';
  if (o.operating) return 'operating';
  const funded = committedOf(o.id) >= totalOf(o) - 1e-6;
  if (o.nfpId && funded) return 'funded';
  if (o.nfpId) return 'matched';
  if (db.bids.some((b) => b.opportunityId === o.id)) return 'bidding';
  return 'open';
}

function view(o: Opportunity): OpportunityView {
  return {
    ...o,
    stage: stageOf(o),
    totalLakh: totalOf(o),
    committedLakh: committedOf(o.id),
    children: o.units * CHILDREN_PER_UNIT,
    bidCount: db.bids.filter((b) => b.opportunityId === o.id).length,
    nfpName: db.nfps.find((n) => n.id === o.nfpId)?.name ?? null,
  };
}

const find = (id: string | string[]) => db.opportunities.find((o) => o.id === String(id));
const fail = (res: express.Response, code: number, error: string) => res.status(code).json({ error });

// ---- role permissions and triggers -------------------------------------------------------------
// Demo-level RBAC: the web app sends x-role (and x-state for a State user) with every request and the server checks it.
// Real deployments replace this with e-KYC / OTP login and signed sessions.

const ROLE_NAME: Record<Role, string> = { state: 'State Govt', nfp: 'NFP / NGO', csr: 'CSR funder', auditor: 'Auditor', admin: 'Ministry admin' };

function allow(...roles: Role[]): express.RequestHandler {
  return (req, res, next) => {
    const r = req.header('x-role') as Role | undefined;
    if (!r || !roles.includes(r)) return fail(res, 403, `Not allowed: ${r ? ROLE_NAME[r] : 'your role'} cannot do this. It needs ${roles.map((x) => ROLE_NAME[x]).join(' or ')}.`);
    next();
  };
}

/** a State user can only change opportunities of the state they sign in for */
function ownState(req: express.Request, res: express.Response, o: Opportunity): boolean {
  const s = req.header('x-state');
  if (s && s !== o.state) {
    fail(res, 403, `Not allowed: you manage ${s}, this opportunity belongs to ${o.state}.`);
    return false;
  }
  return true;
}

/** One role's action creates a notification for the role it hands work to. */
function notify(from: Role, to: Role, text: string, opts: { scope?: Note['scope']; link?: string } = {}) {
  db.notes.unshift({ id: `n-${++db.seq.note}`, from, to, scope: opts.scope, text, link: opts.link, at: new Date().toISOString(), read: false });
  db.notes.length = Math.min(db.notes.length, 80);
}
const donorsOf = (oppId: string) => [...new Set(db.commitments.filter((c) => c.opportunityId === oppId).map((c) => c.donorId))];
const oppLink = (o: Opportunity) => `/opportunity/${o.id}`;

/** which operator an NGO user is acting as: the x-nfp header if it names a real one, else the empanelled demo operator; other roles get the applicant persona */
function nfpOf(req: express.Request): string {
  const id = req.header('x-nfp');
  if (id && db.nfps.some((n) => n.id === id)) return id;
  return req.header('x-role') === 'nfp' ? PERSONA.empanelledNfpId : PERSONA.nfpId;
}

function forViewer(n: Note, role: Role, state: string | undefined, nfpId: string): boolean {
  if (n.to !== role) return false;
  const s = n.scope;
  if (!s) return true;
  if (s.state && s.state !== state) return false;
  if (s.nfpId && s.nfpId !== nfpId) return false;
  if (s.donorId && s.donorId !== PERSONA.donorId) return false;
  return true;
}

function detail(o: Opportunity, as?: string, nfpId: string = PERSONA.nfpId): OpportunityDetail {
  const v = view(o);
  const bids: BidView[] = db.bids
    .filter((b) => b.opportunityId === o.id)
    .map((b) => {
      const nfp = db.nfps.find((n) => n.id === b.nfpId)!;
      return { ...b, nfp, match: scoreForNfp(nfp, o, 'bidding', false), best: false };
    })
    .sort((a, b) => b.match.score - a.match.score);
  const open = bids.filter((b) => b.status !== 'declined');
  if (open.length && v.stage === 'bidding') open[0].best = true;

  const commitments: CommitmentView[] = db.commitments
    .filter((c) => c.opportunityId === o.id)
    .map((c) => ({ ...c, donorName: db.donors.find((d) => d.id === c.donorId)?.name ?? c.donorId }));
  const audit = db.audits.find((a) => a.opportunityId === o.id) ?? null;
  const awarded = db.nfps.find((n) => n.id === o.nfpId) ?? null;

  const timeline: OpportunityDetail['timeline'] = [{ at: o.createdAt, text: `${o.createdBy} defined this opportunity`, tone: 'blue' }];
  bids.forEach((b) => timeline.push({ at: b.createdAt, text: `${b.nfp.name} bid ${b.quoteLakh} lakh per creche`, tone: 'blue' }));
  if (awarded) timeline.push({ at: bids.find((b) => b.status === 'awarded')?.createdAt ?? o.createdAt, text: `Awarded to ${awarded.name}`, tone: 'blue' });
  commitments.forEach((c) => timeline.push({ at: c.createdAt, text: `${c.donorName} committed ${c.amountLakh} lakh`, tone: 'pink' }));
  if (o.operatingAt) timeline.push({ at: o.operatingAt, text: 'Creches started operating, daily monitoring on', tone: 'green' });
  if (audit) timeline.push({ at: audit.issuedAt, text: `${audit.auditor} issued a ${audit.finding === 'verified' ? 'verified' : 'at-risk'} assurance note`, tone: 'green' });
  timeline.sort((a, b) => a.at.localeCompare(b.at));

  let myMatch = null;
  if (as === 'nfp') {
    const nfp = db.nfps.find((n) => n.id === nfpId)!;
    myMatch = scoreForNfp(nfp, o, v.stage, db.bids.some((b) => b.opportunityId === o.id && b.nfpId === nfp.id));
  } else if (as === 'csr') {
    const donor = db.donors.find((d) => d.id === PERSONA.donorId)!;
    myMatch = scoreForDonor(donor, o, v.totalLakh - v.committedLakh, v.stage, !!o.nfpId, v.bidCount > 0);
  }

  return {
    opportunity: v,
    bids,
    commitments,
    audit,
    awarded,
    myMatch,
    myBid: db.bids.find((b) => b.opportunityId === o.id && b.nfpId === nfpId) ?? null,
    myCommittedLakh: db.commitments.filter((c) => c.opportunityId === o.id && c.donorId === PERSONA.donorId).reduce((s, c) => s + c.amountLakh, 0),
    timeline,
  };
}

// ---- reference data -------------------------------------------------------------------------

app.get('/api/persona', (req, res) => {
  const nfpId = nfpOf(req);
  res.json({
    ...PERSONA,
    nfpId,
    nfp: db.nfps.find((n) => n.id === nfpId),
    empanelledNfp: db.nfps.find((n) => n.id === PERSONA.empanelledNfpId),
    donor: db.donors.find((d) => d.id === PERSONA.donorId),
    auditor: db.auditors.find((a) => a.id === PERSONA.auditorId),
  });
});

app.get('/api/places', (_req, res) => res.json(PLACES));

app.post('/api/reset', allow('admin'), (_req, res) => {
  seed();
  res.json({ ok: true });
});

// ---- opportunities --------------------------------------------------------------------------

app.get('/api/opportunities', (_req, res) => {
  res.json(db.opportunities.map(view));
});

app.get('/api/opportunities/:id', (req, res) => {
  const o = find(req.params.id);
  if (!o) return fail(res, 404, 'Opportunity not found');
  res.json(detail(o, String(req.query.as ?? ''), nfpOf(req)));
});

/** State defines a new opportunity (the "where"). */
app.post('/api/opportunities', allow('state'), (req, res) => {
  const b = req.body as { name?: string; state?: string; district?: string; type?: CrecheType; units?: number; unitCostLakh?: number; priority?: Priority; poshanTag?: string };
  const place = b.district ? findPlace(b.district) : undefined;
  const units = Math.round(Number(b.units));
  const unitCostLakh = Number(b.unitCostLakh);
  if (!b.name?.trim() || !b.state || !(STATES as readonly string[]).includes(b.state)) return fail(res, 400, 'Name and state are required');
  if (req.header('x-state') && req.header('x-state') !== b.state) return fail(res, 403, `Not allowed: you manage ${req.header('x-state')}, not ${b.state}.`);
  if (!place || place.state !== b.state) return fail(res, 400, 'Choose a district in that state');
  if (!CRECHE_TYPES.some((t) => t.id === b.type)) return fail(res, 400, 'Choose a creche type');
  if (!(units >= 1 && units <= 100)) return fail(res, 400, 'Units must be between 1 and 100');
  if (!(unitCostLakh >= 5 && unitCostLakh <= 40)) return fail(res, 400, 'Unit cost must be between 5 and 40 lakh');
  const priority: Priority = b.priority === 'high' || b.priority === 'low' ? b.priority : 'medium';
  const id = `OC-${String(++db.seq.opp).padStart(3, '0')}`;
  const o: Opportunity = {
    id,
    name: b.name.trim().slice(0, 60),
    state: b.state,
    district: place.name,
    lat: place.lat + (h01(id + 'lat') - 0.5) * 0.3,
    lng: place.lng + (h01(id + 'lng') - 0.5) * 0.3,
    type: b.type!,
    units,
    unitCostLakh,
    priority,
    poshanTag: (b.poshanTag ?? 'POSHAN priority location').slice(0, 60),
    need: Math.min(98, { high: 75, medium: 58, low: 42 }[priority] + Math.round(h01(b.name) * 18)),
    createdBy: `${b.state} Women & Child Development Dept.`,
    createdAt: new Date().toISOString(),
    nfpId: null,
    operating: false,
    operatingAt: null,
  };
  db.opportunities.unshift(o);
  notify('state', 'nfp', `${b.state} published "${o.name}": ${units} creches, ${o.priority} priority. Open for bids.`, { link: oppLink(o) });
  notify('state', 'csr', `New fundable opportunity in ${b.state}: "${o.name}" (${units} creches).`, { link: oppLink(o) });
  res.status(201).json(detail(o));
});

app.patch('/api/opportunities/:id', allow('state'), (req, res) => {
  const o = find(req.params.id);
  if (!o) return fail(res, 404, 'Opportunity not found');
  if (!ownState(req, res, o)) return;
  const v = view(o);
  if (stageIndex(v.stage) >= stageIndex('matched')) return fail(res, 409, 'Terms are locked once an operator is awarded');
  const b = req.body as { units?: number; unitCostLakh?: number; priority?: Priority };
  const units = b.units === undefined ? o.units : Math.round(Number(b.units));
  const cost = b.unitCostLakh === undefined ? o.unitCostLakh : Number(b.unitCostLakh);
  if (!(units >= 1 && units <= 100) || !(cost >= 5 && cost <= 40)) return fail(res, 400, 'Check units and unit cost');
  if (units * cost < v.committedLakh) return fail(res, 409, 'Total cannot drop below what CSR has already committed');
  o.units = units;
  o.unitCostLakh = cost;
  if (b.priority === 'high' || b.priority === 'medium' || b.priority === 'low') o.priority = b.priority;
  res.json(detail(o));
});

app.delete('/api/opportunities/:id', allow('state'), (req, res) => {
  const o = find(req.params.id);
  if (!o) return fail(res, 404, 'Opportunity not found');
  if (!ownState(req, res, o)) return;
  const v = view(o);
  if (v.bidCount > 0 || v.committedLakh > 0) return fail(res, 409, 'Cannot delete: operators have bid or CSR has committed');
  db.opportunities.splice(db.opportunities.indexOf(o), 1);
  res.json({ ok: true });
});

// ---- NFP: bid -------------------------------------------------------------------------------

app.post('/api/opportunities/:id/bids', allow('nfp'), (req, res) => {
  const o = find(req.params.id);
  if (!o) return fail(res, 404, 'Opportunity not found');
  const { nfpId, quoteLakh, note } = req.body as { nfpId?: string; quoteLakh?: number; note?: string };
  const nfp = db.nfps.find((n) => n.id === nfpId);
  if (!nfp) return fail(res, 400, 'Unknown operator');
  if (nfp.status !== 'certified') return fail(res, 403, 'Only certified operators can bid. Complete empanelment first.');
  const stage = stageOf(o);
  if (stage !== 'open' && stage !== 'bidding') return fail(res, 409, 'Bidding is closed for this opportunity');
  if (db.bids.some((b) => b.opportunityId === o.id && b.nfpId === nfp.id)) return fail(res, 409, 'You have already bid on this opportunity');
  const quote = Number(quoteLakh);
  if (!(quote >= 5 && quote <= 40)) return fail(res, 400, 'Quote must be between 5 and 40 lakh per creche');
  db.bids.push({
    id: `bid-${++db.seq.bid}`,
    opportunityId: o.id,
    nfpId: nfp.id,
    quoteLakh: Math.round(quote * 10) / 10,
    note: String(note ?? '').slice(0, 280),
    status: 'submitted',
    createdAt: new Date().toISOString(),
  });
  notify('nfp', 'state', `${nfp.name} bid on "${o.name}". Review bids and award an operator.`, { scope: { state: o.state }, link: oppLink(o) });
  res.status(201).json(detail(o, 'nfp', nfp.id));
});

// ---- State: award ---------------------------------------------------------------------------

app.post('/api/opportunities/:id/award', allow('state'), (req, res) => {
  const o = find(req.params.id);
  if (!o) return fail(res, 404, 'Opportunity not found');
  if (!ownState(req, res, o)) return;
  if (stageOf(o) !== 'bidding') return fail(res, 409, 'Awarding needs at least one bid and no awarded operator yet');
  const bid = db.bids.find((b) => b.id === (req.body as { bidId?: string }).bidId && b.opportunityId === o.id);
  if (!bid) return fail(res, 400, 'Choose a bid to award');
  db.bids.filter((b) => b.opportunityId === o.id).forEach((b) => (b.status = b.id === bid.id ? 'awarded' : 'declined'));
  o.nfpId = bid.nfpId;
  const winner = db.nfps.find((n) => n.id === bid.nfpId)!;
  notify('state', 'nfp', `You won "${o.name}". Funding comes next, then you can start.`, { scope: { nfpId: bid.nfpId }, link: oppLink(o) });
  db.bids.filter((b) => b.opportunityId === o.id && b.id !== bid.id).forEach((b) => notify('state', 'nfp', `"${o.name}" went to ${winner.name}. Your bid was not selected.`, { scope: { nfpId: b.nfpId }, link: oppLink(o) }));
  notify('state', 'csr', `"${o.name}" now has an operator (${winner.name}). Ready for your funding.`, { link: oppLink(o) });
  res.json(detail(o));
});

// ---- CSR: fund ------------------------------------------------------------------------------

app.post('/api/opportunities/:id/fund', allow('csr'), (req, res) => {
  const o = find(req.params.id);
  if (!o) return fail(res, 404, 'Opportunity not found');
  const { donorId, amountLakh } = req.body as { donorId?: string; amountLakh?: number };
  const donor = db.donors.find((d) => d.id === donorId);
  if (!donor) return fail(res, 400, 'Unknown CSR donor');
  const v = view(o);
  const remaining = v.totalLakh - v.committedLakh;
  const amount = Math.round(Number(amountLakh) * 10) / 10;
  if (stageIndex(v.stage) >= stageIndex('operating') || remaining <= 0) return fail(res, 409, 'This opportunity is already fully funded');
  if (!(amount > 0)) return fail(res, 400, 'Enter an amount to commit');
  if (amount > remaining + 1e-6) return fail(res, 400, `Only ${remaining} lakh is still needed`);
  if (amount > donor.budgetLakh) return fail(res, 400, 'Amount exceeds your remaining CSR budget');
  donor.budgetLakh -= amount;
  db.commitments.push({ id: `com-${++db.seq.com}`, opportunityId: o.id, donorId: donor.id, amountLakh: amount, createdAt: new Date().toISOString() });
  notify('csr', 'state', `${donor.name} committed ${amount} lakh to "${o.name}".`, { scope: { state: o.state }, link: oppLink(o) });
  if (o.nfpId) {
    const fullyFunded = committedOf(o.id) >= totalOf(o) - 1e-6;
    notify('csr', 'nfp', fullyFunded ? `"${o.name}" is fully funded. You can start the creches now.` : `${donor.name} committed ${amount} lakh to "${o.name}".`, { scope: { nfpId: o.nfpId }, link: oppLink(o) });
  }
  res.status(201).json(detail(o, 'csr'));
});

// ---- NFP: start operating / Auditor: audit --------------------------------------------------

app.post('/api/opportunities/:id/operate', allow('nfp'), (req, res) => {
  const o = find(req.params.id);
  if (!o) return fail(res, 404, 'Opportunity not found');
  if (stageOf(o) !== 'funded') return fail(res, 409, 'Creches can start only after an operator is awarded and funding is complete');
  o.operating = true;
  o.operatingAt = new Date().toISOString();
  notify('nfp', 'auditor', `"${o.name}" is operating. First assurance audit is due.`, { link: oppLink(o) });
  notify('nfp', 'state', `"${o.name}" creches started operating.`, { scope: { state: o.state }, link: oppLink(o) });
  donorsOf(o.id).forEach((d) => notify('nfp', 'csr', `"${o.name}", which you funded, started operating.`, { scope: { donorId: d }, link: oppLink(o) }));
  res.json(detail(o));
});

app.post('/api/opportunities/:id/audit', allow('auditor'), (req, res) => {
  const o = find(req.params.id);
  if (!o) return fail(res, 404, 'Opportunity not found');
  if (stageOf(o) !== 'operating') return fail(res, 409, 'Only operating creches can be audited');
  const body = req.body as { auditorId?: string; atRisk?: boolean };
  const auditor = db.auditors.find((a) => a.id === body.auditorId) ?? db.auditors[0];
  const report = makeAudit(o, auditor, new Date().toISOString(), !!body.atRisk);
  db.audits.push(report);
  const word = report.finding === 'verified' ? 'verified' : 'AT RISK';
  donorsOf(o.id).forEach((d) => notify('auditor', 'csr', `Assurance note for "${o.name}": ${word}. Utilisation certificate available.`, { scope: { donorId: d }, link: oppLink(o) }));
  notify('auditor', 'state', `"${o.name}" audited: ${word}.`, { scope: { state: o.state }, link: oppLink(o) });
  if (o.nfpId) notify('auditor', 'nfp', `Your creches at "${o.name}" were audited: ${word}.`, { scope: { nfpId: o.nfpId }, link: oppLink(o) });
  if (report.finding === 'at_risk') notify('auditor', 'admin', `At-risk flag on "${o.name}" (${o.state}). Follow up with the State and operator.`, { link: oppLink(o) });
  res.status(201).json(detail(o));
});

// ---- NFP profile / empanelment --------------------------------------------------------------

app.get('/api/nfps', (_req, res) => res.json(db.nfps));

app.get('/api/nfps/:id', (req, res) => {
  const nfp = db.nfps.find((n) => n.id === req.params.id);
  if (!nfp) return fail(res, 404, 'Operator not found');
  const bids = db.bids
    .filter((b) => b.nfpId === nfp.id)
    .map((b) => ({ ...b, opportunity: view(find(b.opportunityId)!) }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ nfp, bids, awarded: db.opportunities.filter((o) => o.nfpId === nfp.id).map(view) });
});

app.patch('/api/nfps/:id/checklist', allow('nfp'), (req, res) => {
  const nfp = db.nfps.find((n) => n.id === req.params.id);
  if (!nfp) return fail(res, 404, 'Operator not found');
  const { key, done } = req.body as { key?: string; done?: boolean };
  const item = CHECKLIST.find((c) => c.key === key);
  if (!item) return fail(res, 400, 'Unknown checklist item');
  if (nfp.status !== 'applied') return fail(res, 409, nfp.status === 'certified' ? 'Already certified' : 'Application already submitted');
  nfp.checklist[item.key] = done !== false;
  res.json(nfp);
});

/** NFP submits a complete application; it then waits for the Ministry admin (in production an audit firm verifies it too). */
app.post('/api/nfps/:id/submit', allow('nfp'), (req, res) => {
  const nfp = db.nfps.find((n) => n.id === req.params.id);
  if (!nfp) return fail(res, 404, 'Operator not found');
  if (nfp.status !== 'applied') return fail(res, 409, 'Application already submitted');
  if (!CHECKLIST.every((c) => nfp.checklist[c.key])) return fail(res, 400, 'Complete all four checklist items first');
  nfp.status = 'under_review';
  notify('nfp', 'admin', `${nfp.name} submitted an empanelment application. Review and certify.`, { link: '/workspace' });
  res.json(nfp);
});

/**
 * Self-registration of a new NGO. Demo shortcut: every field is optional and anything left blank is filled in,
 * the four documents are marked uploaded and the application goes straight to the Ministry for empanelment.
 */
app.post('/api/nfps/register', (req, res) => {
  const b = req.body as { name?: string; state?: string };
  const state = (STATES as readonly string[]).includes(String(b.state)) ? String(b.state) : 'Odisha';
  const place = PLACES.find((p) => p.state === state) ?? PLACES[0];
  const n = ++db.seq.nfp;
  const name = String(b.name ?? '').trim().slice(0, 60) || `Demo NGO ${n} (${state})`;
  const nfp: Nfp = {
    id: `nfp-reg-${n}`,
    name,
    about: 'New NGO that registered on the network and applied for empanelment.',
    state,
    district: place.name,
    lat: place.lat,
    lng: place.lng,
    servesStates: [state],
    types: ['A', 'B'],
    costBandLakh: [14, 18],
    crechesRun: 12,
    childrenServed: 300,
    auditScore: 70,
    freeCapacityUnits: 20,
    status: 'under_review',
    checklist: { org: true, work: true, finance: true, staff: true },
  };
  db.nfps.push(nfp);
  notify('nfp', 'admin', `${nfp.name} registered and applied for empanelment. Review and certify.`, { link: '/workspace' });
  res.status(201).json(nfp);
});

/** Ministry admin: certify an operator after review. */
app.post('/api/nfps/:id/approve', allow('admin'), (req, res) => {
  const nfp = db.nfps.find((n) => n.id === req.params.id);
  if (!nfp) return fail(res, 404, 'Operator not found');
  if (nfp.status !== 'under_review') return fail(res, 409, 'Only submitted applications can be approved');
  nfp.status = 'certified';
  notify('admin', 'nfp', 'The Ministry approved your empanelment. You are a Certified Childcare Operator and can bid in every state.', { scope: { nfpId: nfp.id }, link: '/explore' });
  res.json(nfp);
});

/** Ministry admin: send an application back so the NFP can fix its documents. */
app.post('/api/nfps/:id/return', allow('admin'), (req, res) => {
  const nfp = db.nfps.find((n) => n.id === req.params.id);
  if (!nfp) return fail(res, 404, 'Operator not found');
  if (nfp.status !== 'under_review') return fail(res, 409, 'Only submitted applications can be returned');
  nfp.status = 'applied';
  nfp.checklist.finance = false;
  notify('admin', 'nfp', 'The Ministry returned your application: please re-upload the financial statements.', { scope: { nfpId: nfp.id }, link: '/workspace' });
  res.json(nfp);
});

// ---- Ministry admin ---------------------------------------------------------------------------

app.get('/api/admin/overview', allow('admin'), (_req, res) => {
  const views = db.opportunities.map(view);
  const activity: AdminOverview['activity'] = [];
  views.forEach((v) => {
    activity.push({ at: v.createdAt, text: `${v.createdBy} published "${v.name}"`, tone: 'blue', opportunityId: v.id });
    if (v.operatingAt) activity.push({ at: v.operatingAt, text: `"${v.name}" started operating`, tone: 'green', opportunityId: v.id });
  });
  db.bids.forEach((b) => {
    const o = find(b.opportunityId);
    const n = db.nfps.find((x) => x.id === b.nfpId);
    if (o && n) activity.push({ at: b.createdAt, text: `${n.name} bid on "${o.name}"`, tone: 'blue', opportunityId: o.id });
  });
  db.commitments.forEach((c) => {
    const o = find(c.opportunityId);
    const d = db.donors.find((x) => x.id === c.donorId);
    if (o && d) activity.push({ at: c.createdAt, text: `${d.name} committed ${c.amountLakh} lakh to "${o.name}"`, tone: 'pink', opportunityId: o.id });
  });
  db.audits.forEach((a) => {
    const o = find(a.opportunityId);
    if (o) activity.push({ at: a.issuedAt, text: `${a.auditor} issued a ${a.finding === 'verified' ? 'verified' : 'at-risk'} note for "${o.name}"`, tone: 'green', opportunityId: o.id });
  });
  activity.sort((a, b) => b.at.localeCompare(a.at));
  const out: AdminOverview = {
    pending: db.nfps.filter((n) => n.status === 'under_review'),
    certified: db.nfps.filter((n) => n.status === 'certified').length,
    opportunities: views.length,
    atRisk: db.audits.filter((a) => a.finding === 'at_risk').length,
    master: CRECHE_TYPES.map((t) => ({ id: t.id, label: t.label, standardCostLakh: masterCost[t.id] ?? t.standardCostLakh })),
    activity: activity.slice(0, 14),
  };
  res.json(out);
});

app.patch('/api/admin/master/:type', allow('admin'), (req, res) => {
  const t = CRECHE_TYPES.find((x) => x.id === req.params.type);
  const cost = Number((req.body as { standardCostLakh?: number }).standardCostLakh);
  if (!t) return fail(res, 404, 'Unknown creche model');
  if (!(cost >= 5 && cost <= 40)) return fail(res, 400, 'Standard cost must be between 5 and 40 lakh');
  masterCost[t.id] = cost;
  res.json({ id: t.id, standardCostLakh: cost });
});

app.get('/api/master', (_req, res) => {
  res.json(CRECHE_TYPES.map((t) => ({ id: t.id, standardCostLakh: masterCost[t.id] ?? t.standardCostLakh })));
});

// ---- CSR donor ------------------------------------------------------------------------------

app.get('/api/donors', (_req, res) => res.json(db.donors));

app.get('/api/donors/:id', (req, res) => {
  const donor = db.donors.find((d) => d.id === req.params.id);
  if (!donor) return fail(res, 404, 'Donor not found');
  const commitments = db.commitments
    .filter((c) => c.donorId === donor.id)
    .map((c) => ({ ...c, opportunity: view(find(c.opportunityId)!) }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const committedLakh = commitments.reduce((s, c) => s + c.amountLakh, 0);
  res.json({ donor, commitments, committedLakh, children: commitments.reduce((s, c) => s + Math.round((c.amountLakh / c.opportunity.totalLakh) * c.opportunity.children), 0) });
});

/** Ranked opportunities for an operator / donor (the matching engine). */
app.get('/api/match/nfp/:id', (req, res) => {
  const nfp = db.nfps.find((n) => n.id === req.params.id);
  if (!nfp) return fail(res, 404, 'Operator not found');
  const out = db.opportunities.map((o) => {
    const v = view(o);
    return { opportunity: v, match: scoreForNfp(nfp, o, v.stage, db.bids.some((b) => b.opportunityId === o.id && b.nfpId === nfp.id)) };
  });
  res.json(out.sort((a, b) => Number(b.match.eligible) - Number(a.match.eligible) || b.match.score - a.match.score));
});

app.get('/api/match/donor/:id', (req, res) => {
  const donor = db.donors.find((d) => d.id === req.params.id);
  if (!donor) return fail(res, 404, 'Donor not found');
  const out = db.opportunities.map((o) => {
    const v = view(o);
    return { opportunity: v, match: scoreForDonor(donor, o, v.totalLakh - v.committedLakh, v.stage, !!o.nfpId, v.bidCount > 0) };
  });
  res.json(out.sort((a, b) => Number(b.match.eligible) - Number(a.match.eligible) || b.match.score - a.match.score));
});

function basketFor(donorId: string | string[], state: string | undefined, budgetLakh: number) {
  const donor = db.donors.find((d) => d.id === String(donorId));
  if (!donor) return null;
  const items = db.opportunities
    .filter((o) => !state || o.state === state)
    .map((o) => {
      const v = view(o);
      return { view: v, match: scoreForDonor(donor, o, v.totalLakh - v.committedLakh, v.stage, !!o.nfpId, v.bidCount > 0) };
    });
  return { donor, proposal: proposeBasket(items, Math.min(budgetLakh, donor.budgetLakh)) };
}

app.get('/api/donors/:id/basket', (req, res) => {
  const r = basketFor(req.params.id, (req.query.state as string) || undefined, Number(req.query.budgetLakh) || 0);
  if (!r) return fail(res, 404, 'Donor not found');
  res.json(r.proposal);
});

app.post('/api/donors/:id/basket', allow('csr'), (req, res) => {
  const { state, budgetLakh } = req.body as { state?: string; budgetLakh?: number };
  const r = basketFor(req.params.id, state || undefined, Number(budgetLakh) || 0);
  if (!r) return fail(res, 404, 'Donor not found');
  const now = new Date().toISOString();
  r.proposal.items.forEach((i) => {
    r.donor.budgetLakh -= i.fundLakh;
    db.commitments.push({ id: `com-${++db.seq.com}`, opportunityId: i.opportunity.id, donorId: r.donor.id, amountLakh: i.fundLakh, createdAt: now });
  });
  res.status(201).json(r.proposal);
});

// ---- auditor --------------------------------------------------------------------------------

app.get('/api/auditor/queue', (_req, res) => {
  const views = db.opportunities.map(view);
  res.json({
    awaiting: views.filter((v) => v.stage === 'operating'),
    audited: views
      .filter((v) => v.stage === 'audited')
      .map((v) => ({ opportunity: v, audit: db.audits.find((a) => a.opportunityId === v.id)! }))
      .sort((a, b) => b.audit.issuedAt.localeCompare(a.audit.issuedAt)),
    upcoming: views.filter((v) => v.stage === 'funded'),
  });
});


// ---- triggers: notifications, tasks and per-role numbers ---------------------------------------

const viewerRole = (req: express.Request): Role => ((req.query.role as Role) || (req.header('x-role') as Role) || 'state');
const viewerState = (req: express.Request) => (req.query.state as string) || req.header('x-state') || 'Odisha';

app.get('/api/notifications', (req, res) => {
  const role = viewerRole(req);
  const state = viewerState(req);
  const nfpId = nfpOf(req);
  const items = db.notes.filter((n) => forViewer(n, role, state, nfpId)).slice(0, 25);
  res.json({ items, unread: items.filter((n) => !n.read).length });
});

app.post('/api/notifications/read', (req, res) => {
  const role = viewerRole(req);
  const state = viewerState(req);
  const nfpId = nfpOf(req);
  db.notes.filter((n) => forViewer(n, role, state, nfpId)).forEach((n) => (n.read = true));
  res.json({ ok: true });
});

/** Everything that was triggered, with who caused it and who it went to (Ministry walkthrough). */
app.get('/api/notifications/all', allow('admin'), (_req, res) => {
  res.json(db.notes.slice(0, 40));
});

/** What is waiting for this role right now: work handed over by another role. */
app.get('/api/tasks', (req, res) => {
  const role = viewerRole(req);
  const state = viewerState(req);
  const views = db.opportunities.map(view);
  const tasks: Task[] = [];
  const link = (v: OpportunityView) => `/opportunity/${v.id}`;

  if (role === 'state') {
    views.filter((v) => v.state === state && v.stage === 'bidding').slice(0, 4).forEach((v) =>
      tasks.push({ id: `t-${v.id}`, title: `Award an operator: ${v.name}`, text: `${v.bidCount} bid${v.bidCount === 1 ? '' : 's'} waiting, ranked by score`, link: link(v), tone: 'action' }));
    views.filter((v) => v.state === state && v.stage === 'open').slice(0, 2).forEach((v) =>
      tasks.push({ id: `t-${v.id}`, title: `Waiting for bids: ${v.name}`, text: 'No operator has bid yet. You can adjust the terms.', link: link(v), tone: 'info' }));
    views.filter((v) => v.state === state && db.audits.some((a) => a.opportunityId === v.id && a.finding === 'at_risk')).slice(0, 2).forEach((v) =>
      tasks.push({ id: `t-r-${v.id}`, title: `At-risk audit: ${v.name}`, text: 'Follow up with the operator.', link: link(v), tone: 'alert' }));
  }

  if (role === 'nfp') {
    const nfp = db.nfps.find((n) => n.id === nfpOf(req))!;
    if (nfp.status === 'applied') tasks.push({ id: 't-emp', title: 'Complete your empanelment', text: 'Upload the four documents and submit to the Ministry.', link: '/workspace', tone: 'action' });
    if (nfp.status === 'under_review') tasks.push({ id: 't-emp', title: 'Application with the Ministry', text: 'You can bid once it is approved.', link: '/workspace', tone: 'info' });
    views.filter((v) => v.nfpId === nfp.id && v.stage === 'funded').forEach((v) =>
      tasks.push({ id: `t-${v.id}`, title: `Start the creches: ${v.name}`, text: 'Fully funded. The auditor is triggered when you start.', link: link(v), tone: 'action' }));
    views.filter((v) => v.nfpId === nfp.id && v.stage === 'matched').slice(0, 2).forEach((v) =>
      tasks.push({ id: `t-${v.id}`, title: `Won: ${v.name}`, text: 'Waiting for CSR funding to complete.', link: link(v), tone: 'info' }));
    if (nfp.status === 'certified') {
      views
        .map((v) => ({ v, m: scoreForNfp(nfp, find(v.id)!, v.stage, db.bids.some((b) => b.opportunityId === v.id && b.nfpId === nfp.id)) }))
        .filter((x) => x.m.eligible)
        .sort((a, b) => b.m.score - a.m.score)
        .slice(0, 3)
        .forEach(({ v, m }) => tasks.push({ id: `t-${v.id}`, title: `Bid on ${v.name}`, text: `${m.score}/100 match · ${v.district}, ${v.state}`, link: link(v), tone: 'action' }));
    }
  }

  if (role === 'csr') {
    const donor = db.donors.find((d) => d.id === PERSONA.donorId)!;
    views
      .filter((v) => v.stage === 'matched' || v.stage === 'bidding' || v.stage === 'open')
      .map((v) => ({ v, m: scoreForDonor(donor, find(v.id)!, v.totalLakh - v.committedLakh, v.stage, !!v.nfpId, v.bidCount > 0) }))
      .filter((x) => x.m.eligible)
      .sort((a, b) => Number(!!b.v.nfpId) - Number(!!a.v.nfpId) || b.m.score - a.m.score)
      .slice(0, 3)
      .forEach(({ v, m }) => tasks.push({ id: `t-${v.id}`, title: `${v.nfpId ? 'Fund' : 'Consider'}: ${v.name}`, text: `${m.score}/100 fit${v.nfpId ? ' · operator ready' : ''}`, link: link(v), tone: v.nfpId ? 'action' : 'info' }));
    const mine = new Set(db.commitments.filter((c) => c.donorId === donor.id).map((c) => c.opportunityId));
    db.audits.filter((a) => mine.has(a.opportunityId) && a.finding === 'at_risk').slice(0, 2).forEach((a) => {
      const v = views.find((x) => x.id === a.opportunityId)!;
      tasks.push({ id: `t-r-${v.id}`, title: `At-risk audit on a project you funded: ${v.name}`, text: 'Ask the Ministry for a corrective plan.', link: link(v), tone: 'alert' });
    });
  }

  if (role === 'auditor') {
    views.filter((v) => v.stage === 'operating').slice(0, 5).forEach((v) =>
      tasks.push({ id: `t-${v.id}`, title: `Audit due: ${v.name}`, text: `${v.state} · ${v.units} creches · started by ${v.nfpName}`, link: link(v), tone: 'action' }));
    views.filter((v) => v.stage === 'funded').slice(0, 2).forEach((v) =>
      tasks.push({ id: `t-${v.id}`, title: `Starting soon: ${v.name}`, text: 'Funded. Audit is triggered once the operator starts.', link: link(v), tone: 'info' }));
  }

  if (role === 'admin') {
    db.nfps.filter((n) => n.status === 'under_review').forEach((n) =>
      tasks.push({ id: `t-${n.id}`, title: `Review application: ${n.name}`, text: `${n.district}, ${n.state} · audit score ${n.auditScore}`, link: '/workspace', tone: 'action' }));
    db.audits.filter((a) => a.finding === 'at_risk').slice(0, 3).forEach((a) => {
      const v = views.find((x) => x.id === a.opportunityId);
      if (v) tasks.push({ id: `t-r-${v.id}`, title: `At-risk flag: ${v.name}`, text: `${v.state} · ${a.auditor}`, link: link(v), tone: 'alert' });
    });
  }

  res.json(tasks.slice(0, 8));
});

/** The few numbers that matter to this role (Home and Impact). */
app.get('/api/insights', (req, res) => {
  const role = viewerRole(req);
  const state = viewerState(req);
  const views = db.opportunities.map(view);
  const out: Insight[] = [];
  const cr = (l: number) => Math.round(l) / 100;

  if (role === 'state') {
    const mine = views.filter((v) => v.state === state);
    out.push(
      { label: 'Opportunities in your state', value: mine.length },
      { label: 'Waiting for bids or award', value: mine.filter((v) => v.stage === 'open' || v.stage === 'bidding').length, tone: 'blush' },
      { label: 'Funded or running', value: mine.filter((v) => stageIndex(v.stage) >= stageIndex('funded')).length },
      { label: 'Children planned', value: mine.reduce((x, v) => x + v.children, 0), tone: 'blush' },
    );
  } else if (role === 'nfp') {
    const nfp = db.nfps.find((n) => n.id === nfpOf(req))!;
    const bids = db.bids.filter((b) => b.nfpId === nfp.id);
    const won = views.filter((v) => v.nfpId === nfp.id);
    out.push(
      { label: 'Bids submitted', value: bids.length },
      { label: 'Opportunities won', value: won.length, tone: 'blush' },
      { label: 'Creches awarded', value: won.reduce((x, v) => x + v.units, 0) },
      { label: 'Audit score', value: nfp.auditScore, suffix: '/100', tone: 'blush' },
    );
  } else if (role === 'csr') {
    const donor = db.donors.find((d) => d.id === PERSONA.donorId)!;
    const mine = db.commitments.filter((c) => c.donorId === donor.id);
    const committed = mine.reduce((x, c) => x + c.amountLakh, 0);
    const kids = mine.reduce((x, c) => { const v = views.find((y) => y.id === c.opportunityId); return x + (v ? Math.round((c.amountLakh / v.totalLakh) * v.children) : 0); }, 0);
    out.push(
      { label: 'CSR budget left', value: cr(donor.budgetLakh), prefix: '₹', suffix: ' Cr', decimals: 1 },
      { label: 'Committed so far', value: cr(committed), prefix: '₹', suffix: ' Cr', decimals: 2, tone: 'blush' },
      { label: 'Children reached', value: kids },
      { label: 'Projects funded', value: new Set(mine.map((c) => c.opportunityId)).size, tone: 'blush' },
    );
  } else if (role === 'auditor') {
    const reports = db.audits;
    out.push(
      { label: 'Audits due', value: views.filter((v) => v.stage === 'operating').length, tone: 'blush' },
      { label: 'Reports issued', value: reports.length },
      { label: 'At-risk flagged', value: reports.filter((a) => a.finding === 'at_risk').length, tone: 'blush' },
      { label: 'Average attendance', value: reports.length ? Math.round(reports.reduce((x, a) => x + a.attendancePct, 0) / reports.length) : 0, suffix: '%' },
    );
  } else {
    out.push(
      { label: 'Applications to review', value: db.nfps.filter((n) => n.status === 'under_review').length, tone: 'blush' },
      { label: 'Certified operators', value: db.nfps.filter((n) => n.status === 'certified').length },
      { label: 'Opportunities on the platform', value: views.length },
      { label: 'At-risk audit flags', value: db.audits.filter((a) => a.finding === 'at_risk').length, tone: 'blush' },
    );
  }
  res.json(out);
});

// ---- impact dashboard -----------------------------------------------------------------------

app.get('/api/stats', (_req, res) => {
  const views = db.opportunities.map(view);
  const required = views.reduce((s, v) => s + v.totalLakh, 0);
  const committed = views.reduce((s, v) => s + v.committedLakh, 0);

  const funnel = STAGES.map((s, i) => ({ stage: s.id, label: s.label, count: views.filter((v) => stageIndex(v.stage) >= i).length }));

  const stateDemand = STATES.map((state) => {
    const vs = views.filter((v) => v.state === state);
    return {
      state,
      required: vs.reduce((s, v) => s + v.units, 0),
      funded: vs.filter((v) => stageIndex(v.stage) >= stageIndex('funded')).reduce((s, v) => s + v.units, 0),
      capitalCr: Math.round((vs.reduce((s, v) => s + v.totalLakh, 0) / 100) * 10) / 10,
      children: vs.reduce((s, v) => s + v.children, 0),
      open: vs.filter((v) => stageIndex(v.stage) < stageIndex('funded')).length,
    };
  })
    .filter((r) => r.required > 0)
    .sort((a, b) => b.required - a.required);

  const reports = db.audits;
  const avg = (f: (a: (typeof reports)[number]) => number) => (reports.length ? Math.round(reports.reduce((s, a) => s + f(a), 0) / reports.length) : 0);

  const months = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
  const monthly = months.map((month, i) => ({
    month,
    opportunities: Math.round(60 + i * 38 + Math.sin(i * 1.2) * 14),
    committedCr: Math.round(40 + i * i * 2.6 + i * 18),
  }));

  const out: Stats = {
    asOf: new Date().toISOString(),
    national: { activeOpportunities: 12450, csrCommittedCr: 1820, childrenLakh: 4.3, verifiedNfps: 410, fundedCr: 1355, pendingCr: 465, remainingCr: 575 },
    demo: {
      opportunities: views.length,
      nfps: db.nfps.filter((n) => n.status === 'certified').length,
      donors: db.donors.length,
      units: views.reduce((s, v) => s + v.units, 0),
      children: views.reduce((s, v) => s + v.children, 0),
      committedCr: Math.round(committed) / 100,
      requiredCr: Math.round(required) / 100,
      audits: reports.length,
    },
    funnel,
    stateDemand,
    byType: CRECHE_TYPES.map((t) => ({ type: t.id, label: t.label, count: views.filter((v) => v.type === t.id).reduce((s, v) => s + v.units, 0) })),
    audits: {
      enrolmentPct: avg((a) => a.enrolmentPct),
      attendancePct: avg((a) => a.attendancePct),
      malnutritionReductionPct: avg((a) => a.malnutritionReductionPct),
      verified: reports.filter((a) => a.finding === 'verified').length,
      atRisk: reports.filter((a) => a.finding === 'at_risk').length,
      reports: reports.length,
    },
    // Odisha pilot districts, % of children under 5 (proposal deck)
    pilot: [
      { district: 'Keonjhar', stunted: 36.2, wasted: 23.8, underweight: 37.1 },
      { district: 'Sundargarh', stunted: 32.9, wasted: 21, underweight: 34.7 },
      { district: 'Jajpur', stunted: 25.8, wasted: 15.9, underweight: 21.8 },
    ],
    monthly,
  };
  res.json(out);
});

export default app;
