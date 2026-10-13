import { atom, getDefaultStore } from 'jotai';
import { commentsAtom, projectHydratedAtom } from '../atoms/project';
import { storage } from './runtime';

// Local persistence for task comments only — slated for removal once the backend
// has /comments (docs/BACKEND.md chunk D). Profile, theme and views already come
// from the server (src/hooks/useUsers.ts, useViews.ts). Ported from authStore.ts's session pattern: hydrate the atoms
// from storage once at boot, then keep storage in step with every change.
//
// Tasks are deliberately NOT part of this — they're never written to local
// storage, not even as an offline cache or a fallback when the server is
// unreachable. A local copy of a task can silently drift from (or just plain not
// exist on) the server, and the API has no way to tell a "real" task from a
// locally-invented one, so this app doesn't keep one at all: tasks only ever come
// from and go to Tasks-Main-API's /tasks (src/hooks/useTasksSync.ts,
// useTaskMutations.ts). When the server is unavailable, a task action fails
// visibly instead of quietly succeeding into a local-only copy.
//
// Comments still stay on-device — Tasks-Main-API has no /comments endpoint yet.

const store = getDefaultStore();

// Bump this suffix whenever a stored field's shape changes in a way old data
// can't satisfy (e.g. Status's values changing, as just happened) — old data
// under the previous key is simply never read again, falling back to the
// fresh mock seed, instead of being force-fit into the new shape. The
// `statusInfo()` fallback (src/data/constants.ts) is the last line of
// defence for whatever slips through anyway.
const PROJECT_KEY = 'ytc_project_v4';

const persistedProjectAtom = atom(get => ({
  comments: get(commentsAtom),
}));

let persisting = false;

export const bootProject = async () => {
  let hadStoredItems = false;
  try {
    const raw = await storage.getItem(PROJECT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      hadStoredItems = Array.isArray(parsed?.items);
      applySaved(parsed);
    }
  } catch {
    /* corrupt or unavailable — start from the mock seed */
  }
  store.set(projectHydratedAtom, true);
  if (!persisting) {
    persisting = true;
    store.sub(persistedProjectAtom, persistProject);
  }
  // A device that had tasks saved locally before this stopped doing that still
  // has them sitting in storage, unread from here on — overwrite the blob once
  // so they're actually gone, not just ignored.
  if (hadStoredItems) {
    persistProject();
  }
};

// Loosely validated: a corrupt or partial save (e.g. from an older shape)
// should fall back field-by-field to the mock seed, not wipe everything out.
function applySaved(saved: unknown) {
  if (!saved || typeof saved !== 'object') {
    return;
  }
  const s = saved as Record<string, unknown>;
  if (Array.isArray(s.comments)) {
    store.set(commentsAtom, s.comments);
  }
}

const persistProject = () => {
  const snapshot = store.get(persistedProjectAtom);
  storage.setItem(PROJECT_KEY, JSON.stringify(snapshot));
};
