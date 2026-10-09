import { atom } from 'jotai';
import type { UserInfoResponse, UserSearchResult } from '../services/types';

// The signed-in user's own record from GET /user/info/{user_id} (includes private_info).
export const userInfoAtom = atom<UserInfoResponse | null>(null);

// Colleagues found via the email search, keyed by email, so they can be picked as
// assignees and still resolve to a name afterwards.
export const directoryAtom = atom<UserSearchResult[]>([]);
