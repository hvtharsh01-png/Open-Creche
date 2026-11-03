import { Briefcase, Building2, Landmark, ShieldCheck, Wallet } from 'lucide-react';
import type { Role } from '../../shared/types';

export const ROLE_ICON: Record<Role, typeof Landmark> = { state: Landmark, nfp: Briefcase, csr: Wallet, auditor: ShieldCheck, admin: Building2 };

export const ROLE_TONE: Record<Role, string> = {
  state: 'bg-brand-600 text-white',
  nfp: 'bg-brand-800 text-white',
  csr: 'bg-blush-600 text-white',
  auditor: 'bg-brand-950 text-white',
  admin: 'bg-ink text-white',
};
