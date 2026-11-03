import type { Priority, Stage } from '../../shared/types';

export const STAGE_COLOR: Record<Stage, string> = {
  open: '#5f90ef',
  bidding: '#2f6fdb',
  matched: '#1d4ba3',
  funded: '#e5408a',
  operating: '#1f9d6b',
  audited: '#0f766e',
};

export const PRIORITY_COLOR: Record<Priority, string> = { high: '#d64545', medium: '#e8a317', low: '#7a8aab' };

/** What the next step is, for the "next best action" hints. */
export const NEXT_STEP: Record<Stage, string> = {
  open: 'Waiting for a certified operator to bid',
  bidding: 'State can award an operator',
  matched: 'Waiting for CSR funding',
  funded: 'Operator can start the creches',
  operating: 'Waiting for independent audit',
  audited: 'Assurance issued',
};
