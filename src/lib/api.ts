import type {
  Insight, Note, Role, Task, AdminOverview, AuditReport, Bid, BasketProposal, Donor, MatchResult, Nfp, OpportunityDetail, OpportunityView, Priority, CrecheType, Stats, Auditor, CommitmentView,
} from '../../shared/types';
import type { Place } from '../../shared/geo';

/** who is acting: sent with every request so the server can enforce role permissions */
let identity: { role: Role | null; state: string } = { role: null, state: 'Odisha' };
export function setIdentity(role: Role | null, state: string) {
  identity = { role, state };
}
/** run calls on behalf of another role (the Ministry walkthrough acts as each stakeholder in turn) */
export async function asRole<T>(role: Role, state: string, fn: () => Promise<T>): Promise<T> {
  const prev = identity;
  identity = { role, state };
  try {
    return await fn();
  } finally {
    identity = prev;
  }
}

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'x-state': identity.state };
  if (identity.role) headers['x-role'] = identity.role;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}
const get = <T,>(url: string) => req<T>('GET', url);
const post = <T,>(url: string, body?: unknown) => req<T>('POST', url, body ?? {});

export interface Persona {
  nfpId: string;
  donorId: string;
  auditorId: string;
  state: string;
  nfp: Nfp;
  donor: Donor;
  auditor: Auditor;
}

export interface Ranked {
  opportunity: OpportunityView;
  match: MatchResult;
}

export interface NfpProfile {
  nfp: Nfp;
  bids: (Bid & { opportunity: OpportunityView })[];
  awarded: OpportunityView[];
}

export interface DonorProfile {
  donor: Donor;
  commitments: (CommitmentView & { opportunity: OpportunityView })[];
  committedLakh: number;
  children: number;
}

export interface AuditQueue {
  awaiting: OpportunityView[];
  upcoming: OpportunityView[];
  audited: { opportunity: OpportunityView; audit: AuditReport }[];
}

export interface NewOpportunity {
  name: string;
  state: string;
  district: string;
  type: CrecheType;
  units: number;
  unitCostLakh: number;
  priority: Priority;
  poshanTag?: string;
}

export const api = {
  persona: () => get<Persona>('/api/persona'),
  places: () => get<Place[]>('/api/places'),
  stats: () => get<Stats>('/api/stats'),
  opportunities: () => get<OpportunityView[]>('/api/opportunities'),
  opportunity: (id: string, as?: 'nfp' | 'csr') => get<OpportunityDetail>(`/api/opportunities/${id}${as ? `?as=${as}` : ''}`),
  create: (b: NewOpportunity) => post<OpportunityDetail>('/api/opportunities', b),
  edit: (id: string, b: Partial<Pick<NewOpportunity, 'priority'>> & { units?: number; unitCostLakh?: number }) => req<OpportunityDetail>('PATCH', `/api/opportunities/${id}`, b),
  remove: (id: string) => req<{ ok: true }>('DELETE', `/api/opportunities/${id}`),
  bid: (id: string, b: { nfpId: string; quoteLakh: number; note: string }) => post<OpportunityDetail>(`/api/opportunities/${id}/bids`, b),
  award: (id: string, bidId: string) => post<OpportunityDetail>(`/api/opportunities/${id}/award`, { bidId }),
  fund: (id: string, b: { donorId: string; amountLakh: number }) => post<OpportunityDetail>(`/api/opportunities/${id}/fund`, b),
  operate: (id: string) => post<OpportunityDetail>(`/api/opportunities/${id}/operate`),
  audit: (id: string, b: { auditorId: string; atRisk?: boolean }) => post<OpportunityDetail>(`/api/opportunities/${id}/audit`, b),
  nfp: (id: string) => get<NfpProfile>(`/api/nfps/${id}`),
  checklist: (id: string, key: string, done: boolean) => req<Nfp>('PATCH', `/api/nfps/${id}/checklist`, { key, done }),
  submitNfp: (id: string) => post<Nfp>(`/api/nfps/${id}/submit`),
  approveNfp: (id: string) => post<Nfp>(`/api/nfps/${id}/approve`),
  returnNfp: (id: string) => post<Nfp>(`/api/nfps/${id}/return`),
  adminOverview: () => get<AdminOverview>('/api/admin/overview'),
  setMasterCost: (type: string, standardCostLakh: number) => req<{ id: string; standardCostLakh: number }>('PATCH', `/api/admin/master/${type}`, { standardCostLakh }),
  master: () => get<{ id: CrecheType; standardCostLakh: number }[]>('/api/master'),
  donor: (id: string) => get<DonorProfile>(`/api/donors/${id}`),
  matchNfp: (id: string) => get<Ranked[]>(`/api/match/nfp/${id}`),
  matchDonor: (id: string) => get<Ranked[]>(`/api/match/donor/${id}`),
  basket: (id: string, state: string, budgetLakh: number) => get<BasketProposal>(`/api/donors/${id}/basket?state=${encodeURIComponent(state)}&budgetLakh=${budgetLakh}`),
  commitBasket: (id: string, state: string, budgetLakh: number) => post<BasketProposal>(`/api/donors/${id}/basket`, { state, budgetLakh }),
  auditQueue: () => get<AuditQueue>('/api/auditor/queue'),
  reset: () => post<{ ok: true }>('/api/reset'),
  notifications: () => get<{ items: Note[]; unread: number }>('/api/notifications'),
  markRead: () => post<{ ok: true }>('/api/notifications/read'),
  allNotifications: () => get<Note[]>('/api/notifications/all'),
  tasks: () => get<Task[]>('/api/tasks'),
  insights: () => get<Insight[]>('/api/insights'),
};
