import { atom, getDefaultStore } from 'jotai';
import type { Member } from '../data/types';
import { userAtom } from './auth';
import { initialsOf, PROFILE_COLOR } from './profile';
import { directoryAtom } from './userInfo';

// Keyed by the real user_id (UUID) — not email — because Tasks-Main-API's
// owner_id/created_by/assignee_ids are all real user_id UUIDs (e.g. a task's
// `created_by`), and WorkItem.createdById/assigneeIds need to compare equal to
// those for permission checks (src/data/permissions.ts) and name lookups
// (memberById) to work. Falls back to email only for an old cached session from
// before user_id was reliably present.
export const currentUserIdAtom = atom(get => {
  const user = get(userAtom);
  return user?.user_id ?? user?.email ?? '';
});

export const membersAtom = atom<Member[]>(get => {
  const user = get(userAtom);
  const id = get(currentUserIdAtom);
  if (!user || !id) {
    return [];
  }
  const others = get(directoryAtom)
    .filter(u => u.user_id !== id)
    .map(u => {
      const pub = u.public_info ?? {};
      const name =
        typeof pub.name === 'string' && pub.name ? pub.name : u.email.split('@')[0];
      return {
        id: u.user_id,
        name,
        initials: initialsOf(name),
        color: PROFILE_COLOR,
        role: typeof pub.role === 'string' ? pub.role : '',
        capacity: 5,
      };
    });
  return [
    {
      id,
      name: user.username,
      initials: initialsOf(user.username),
      color: PROFILE_COLOR,
      role: '',
      capacity: 5,
    },
    ...others,
  ];
});

// Non-reactive lookup for plain helpers that aren't components.
export const memberById = (id: string | null) =>
  getDefaultStore()
    .get(membersAtom)
    .find(m => m.id === id) ?? null;
