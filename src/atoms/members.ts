import { atom } from 'jotai';
import { userAtom } from './auth';

// The signed-in user's id (UUID) — the same id the API uses for owner_id,
// created_by and assignee_ids. Comes from the session (src/atoms/auth.ts).
// Everything else about people is fetched by id: src/hooks/useUsers.ts.
export const currentUserIdAtom = atom(get => get(userAtom)?.user_id ?? '');
