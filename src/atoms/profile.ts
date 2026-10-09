import { atom } from 'jotai';
import { userAtom } from './auth';
import { userInfoAtom } from './userInfo';

export interface Profile {
  name: string;
  role: string;
  organization: string;
  email: string;
  phone: string;
  color: string;
  initials: string;
}

export const PROFILE_COLOR = '#8b5cf6';

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('') || '?';

// Local edits layered over the session's user (src/atoms/auth.ts's userAtom, filled
// from /auth/login and /auth/session). The API has no profile-update endpoint, so
// edits only live on this device; persisted by projectStore.
export const profileOverridesAtom = atom<Partial<Profile>>({});

export const profileAtom = atom(
  (get): Profile => {
    const user = get(userAtom);
    const name = user?.username ?? '';
    const info = get(userInfoAtom);
    const str = (key: string) => {
      const v = info?.private_info?.[key] ?? info?.public_info?.[key];
      return typeof v === 'string' ? v : '';
    };
    const base: Profile = {
      name,
      role: str('role'),
      organization: info?.organization_name ?? user?.organization_name ?? '',
      email: user?.email ?? '',
      phone: user?.phone || str('phone'),
      color: PROFILE_COLOR,
      initials: initialsOf(name),
    };
    const merged = { ...base, ...get(profileOverridesAtom) };
    // Initials follow the name unless it was never overridden.
    return { ...merged, initials: initialsOf(merged.name) };
  },
  (get, set, update: Profile | ((prev: Profile) => Profile)) => {
    const next = typeof update === 'function' ? update(get(profileAtom)) : update;
    set(profileOverridesAtom, next);
  },
);

// Whether the read-only profile sheet / the edit form is open.
export const profileOpenAtom = atom(false);
export const profileEditOpenAtom = atom(false);
