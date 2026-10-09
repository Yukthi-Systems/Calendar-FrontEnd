import { atom, getDefaultStore } from 'jotai';
import type { Member } from '../data/types';
import { userAtom } from './auth';
import { initialsOf, PROFILE_COLOR } from './profile';
import { directoryAtom } from './userInfo';

// The API exposes no member directory yet, so the only known member is the signed-in
// user, keyed by email (always present, unlike user_id on older cached sessions). Permission checks (src/data/permissions.ts) compare against this id.
export const currentUserIdAtom = atom(get => {
  const user = get(userAtom);
  return user?.email ?? user?.user_id ?? '';
});

export const membersAtom = atom<Member[]>(get => {
  const user = get(userAtom);
  const id = get(currentUserIdAtom);
  if (!user || !id) {
    return [];
  }
  const others = get(directoryAtom)
    .filter(u => u.email !== id)
    .map(u => {
      const pub = u.public_info ?? {};
      const name =
        typeof pub.name === 'string' && pub.name ? pub.name : u.email.split('@')[0];
      return {
        id: u.email,
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
