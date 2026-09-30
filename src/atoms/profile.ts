import { atom } from 'jotai';

export interface Profile {
  name: string;
  role: string;
  organization: string;
  email: string;
  phone: string;
  color: string;
  initials: string;
}

// Mock "signed-in" profile, editable in place. Stands in for the real SSO user
// (src/atoms/auth.ts's userAtom) while SSO is off — see src/config/features.ts.
// Once SSO_ENABLED is true, prefer that atom's data over this one.
export const DEFAULT_PROFILE: Profile = {
  name: 'Aarav Nair',
  role: 'Tech Lead',
  organization: 'Yukthi Systems',
  email: 'aarav.nair@yukthisystems.com',
  phone: '+91 98765 43210',
  color: '#8b5cf6',
  initials: 'AN',
};

export const profileAtom = atom<Profile>(DEFAULT_PROFILE);

// Whether the read-only profile sheet / the edit form is open.
export const profileOpenAtom = atom(false);
export const profileEditOpenAtom = atom(false);
