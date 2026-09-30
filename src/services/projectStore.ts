import { atom, getDefaultStore } from 'jotai';
import {
  activeViewIdAtom,
  commentsAtom,
  itemsAtom,
  projectHydratedAtom,
  viewsAtom,
} from '../atoms/project';
import { profileAtom } from '../atoms/profile';
import { storage } from './runtime';

// Local persistence for the project workspace (views, items, active tab, profile),
// ported from authStore.ts's session pattern: hydrate the atoms from storage once
// at boot, then keep storage in step with every change.
//
// There's no backend yet, so the atoms' own initial values (mockData.ts's
// DEFAULT_VIEWS/MOCK_ITEMS, profile.ts's DEFAULT_PROFILE) are the "seed" — what a
// first-ever run looks like before anything's been saved. Once a real API exists,
// swap that seed for a fetch here (still landing in these same atoms via
// `store.set`); everything downstream keeps working unchanged.

const store = getDefaultStore();

const PROJECT_KEY = 'ytc_project_v1';

const persistedProjectAtom = atom(get => ({
  views: get(viewsAtom),
  activeViewId: get(activeViewIdAtom),
  items: get(itemsAtom),
  comments: get(commentsAtom),
  profile: get(profileAtom),
}));

let persisting = false;

export const bootProject = async () => {
  try {
    const raw = await storage.getItem(PROJECT_KEY);
    if (raw) {
      applySaved(JSON.parse(raw));
    }
  } catch {
    /* corrupt or unavailable — start from the mock seed */
  }
  store.set(projectHydratedAtom, true);
  if (!persisting) {
    persisting = true;
    store.sub(persistedProjectAtom, persistProject);
  }
};

// Loosely validated: a corrupt or partial save (e.g. from an older shape)
// should fall back field-by-field to the mock seed, not wipe everything out.
function applySaved(saved: unknown) {
  if (!saved || typeof saved !== 'object') {
    return;
  }
  const s = saved as Record<string, unknown>;
  if (Array.isArray(s.views) && s.views.length > 0) {
    store.set(viewsAtom, s.views);
  }
  if (Array.isArray(s.items)) {
    store.set(itemsAtom, s.items);
  }
  if (Array.isArray(s.comments)) {
    store.set(commentsAtom, s.comments);
  }
  if (typeof s.activeViewId === 'string') {
    const views = store.get(viewsAtom);
    store.set(
      activeViewIdAtom,
      views.some(v => v.id === s.activeViewId)
        ? s.activeViewId
        : views[0]?.id ?? '',
    );
  }
  if (s.profile && typeof s.profile === 'object') {
    const savedProfile = s.profile;
    store.set(profileAtom, prev => ({ ...prev, ...savedProfile }));
  }
}

const persistProject = () => {
  const snapshot = store.get(persistedProjectAtom);
  storage.setItem(PROJECT_KEY, JSON.stringify(snapshot));
};
