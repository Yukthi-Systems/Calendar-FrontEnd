import { atom } from 'jotai';
import type { Person } from '../hooks/useUsers';

// Resolved @mentions, keyed by lowercased email-local-part (the mention
// "handle" written into comment/description text — see
// MarkdownEditor.tsx's handleMentionSelect and RichText.tsx's mention
// token). Populated whenever someone is picked from the @mention
// autocomplete, read back when rendering saved text so a known handle shows
// highlighted instead of as plain "@handle". Session-only, not persisted: a
// mention from someone else's comment that nobody in this session has
// looked up via the autocomplete just stays plain text rather than
// triggering a fetch to resolve it blind.
export const mentionCacheAtom = atom<Record<string, Person>>({});
