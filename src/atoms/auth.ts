import { atom } from 'jotai';
import type { BackendUserInfo, SsoProfile } from '../services/types';

export interface UserInfo extends BackendUserInfo, SsoProfile {
  username: string;
}

// Persisted by authStore (hydrateSession / persistSession) rather than atomWithStorage:
// AsyncStorage is async on native, which would make these atoms resolve to Promises.
export const userAtom = atom<UserInfo | null>(null);
export const tokenAtom = atom<string | null>(null);
export const refreshTokenAtom = atom<string | null>(null);
export const sessionExpiresAtAtom = atom<number | null>(null);

// Everything above, as one value — what gets written to storage.
export const persistedSessionAtom = atom(get => ({
  user: get(userAtom),
  token: get(tokenAtom),
  refreshToken: get(refreshTokenAtom),
  sessionExpiresAt: get(sessionExpiresAtAtom),
}));

// True until the persisted session is read, and while a login with no cached session runs.
export const isAuthLoadingAtom = atom<boolean>(true);
export const authErrorMsgAtom = atom<string | null>(null);
