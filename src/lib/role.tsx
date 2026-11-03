import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Role } from '../../shared/types';
import { api, setIdentity, type Persona } from './api';

interface RoleCtx {
  role: Role | null;
  setRole: (r: Role | null) => void;
  /** state the "State Govt" persona manages */
  state: string;
  setState: (s: string) => void;
  persona: Persona | null;
  /** which operator an NGO user acts as: the empanelled demo NGO or one that just registered (null = server default) */
  nfpId: string | null;
  setNfpId: (id: string | null) => void;
  /** bumps after every write so lists refetch */
  version: number;
  bump: () => void;
  /** has this browser been through the login page yet (first visit is sent there) */
  entered: boolean;
  enter: (role: Role | null) => void;
  signOut: () => void;
}

const Ctx = createContext<RoleCtx | null>(null);

const read = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* storage can be unavailable (private window); the portal works without it */
  }
};

export const ROLE_META: Record<Role, { label: string; short: string; verb: string; blurb: string }> = {
  state: { label: 'State Government', short: 'State', verb: 'Define where', blurb: 'Set priority locations, creche models and unit costs' },
  nfp: { label: 'Childcare Operator (NFP / NGO)', short: 'NFP / NGO', verb: 'Deliver how', blurb: 'Empanelled NGOs see their best matches and bid. New NGOs register and wait for the Ministry' },
  csr: { label: 'CSR Funder', short: 'CSR funder', verb: 'Fund what', blurb: 'Browse verified demand and commit capital' },
  auditor: { label: 'Independent Auditor', short: 'Auditor', verb: 'Verify impact', blurb: 'Audit utilisation and issue assurance notes' },
  admin: { label: 'Ministry Platform Admin', short: 'Ministry admin', verb: 'Govern the platform', blurb: 'Approve operators, manage master data and oversee all activity' },
};

/** What each role can do and how roles hand work to each other. Shown by the (i) button. */
export const ROLE_GUIDE: Record<Role, { does: string[]; gets: string[]; hands: string[] }> = {
  state: {
    does: ['Publish priority locations with a creche model and unit cost', 'Review ranked bids and award an operator', 'Edit terms until an operator is awarded'],
    gets: ['An operator bids on your opportunity', 'A CSR funder commits money', 'Creches start operating', 'An audit result for your state'],
    hands: ['Operators and CSR funders are told about every new opportunity', 'The winner, the other bidders and CSR funders are told when you award'],
  },
  nfp: {
    does: ['Empanelled NGO: see your best matches and bid in every state', 'New NGO: register in one click and send it for empanelment', 'Start the creches once they are funded'],
    gets: ['The Ministry approves your application', 'A new opportunity is published', 'You win a bid, or lose one', 'Funding completes'],
    hands: ['The Ministry is told when you submit your application', 'The State is told when you bid', 'The auditor, State and funders are told when you start'],
  },
  csr: {
    does: ['Browse government-validated demand near your sites', 'Fund one creche, a cluster, or a state programme', 'Track utilisation and audit notes'],
    gets: ['A new opportunity fits your priorities', 'An operator is awarded and the project is ready for funds', 'Creches start operating', 'An assurance note is issued'],
    hands: ['The State and the awarded operator are told when you commit'],
  },
  auditor: {
    does: ['See which creches are operating and due for audit', 'Verify, or flag at risk, with an assurance note'],
    gets: ['An operator starts a funded creche'],
    hands: ['Funders, the State and the operator get your note', 'The Ministry is flagged if you mark a project at risk'],
  },
  admin: {
    does: ['Approve or return operator applications', 'Set the standard cost per creche model', 'Oversee all activity and run the platform walkthrough'],
    gets: ['An operator submits an application', 'An auditor flags a project at risk'],
    hands: ['Operators are told when you approve or return an application'],
  },
};

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(() => {
    const r = read('oc-role');
    return r === 'state' || r === 'nfp' || r === 'csr' || r === 'auditor' || r === 'admin' ? r : null;
  });
  const [state, setStateState] = useState<string>(() => read('oc-state') ?? 'Odisha');
  const [nfpId, setNfpIdState] = useState<string | null>(() => read('oc-nfp'));
  const [persona, setPersona] = useState<Persona | null>(null);
  const [version, setVersion] = useState(0);
  // keep the API client in step with who is signed in (set during render so child requests never go out without it)
  setIdentity(role, state, nfpId);

  useEffect(() => {
    api.persona().then(setPersona).catch(() => setPersona(null));
  }, [version, role, nfpId]);

  const setNfpId = useCallback((id: string | null) => {
    setNfpIdState(id);
    write('oc-nfp', id);
  }, []);

  const setRole = useCallback((r: Role | null) => {
    setRoleState(r);
    write('oc-role', r);
  }, []);
  const setState = useCallback((s: string) => {
    setStateState(s);
    write('oc-state', s);
  }, []);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const [entered, setEntered] = useState(() => read('oc-entered') === '1');
  const enter = useCallback((r: Role | null) => {
    setRole(r);
    setEntered(true);
    write('oc-entered', '1');
  }, [setRole]);
  const signOut = useCallback(() => {
    setRole(null);
    setEntered(false);
    write('oc-entered', null);
  }, [setRole]);

  const value = useMemo(
    () => ({ role, setRole, state, setState, persona, nfpId, setNfpId, version, bump, entered, enter, signOut }),
    [role, setRole, state, setState, persona, nfpId, setNfpId, version, bump, entered, enter, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRole() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useRole must be used inside RoleProvider');
  return c;
}
