import { atom } from 'jotai';

// Whether the account sheet / the profile edit form is open. Profile data itself
// comes from the server (src/hooks/useUsers.ts useMyProfile).
export const profileOpenAtom = atom(false);
export const profileEditOpenAtom = atom(false);
