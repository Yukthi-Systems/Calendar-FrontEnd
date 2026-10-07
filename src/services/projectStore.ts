import { atom, getDefaultStore } from 'jotai';
import {
  activeViewIdAtom,
  commentsAtom,
  itemsAtom,
  projectHydratedAtom,
  viewsAtom,
} from '../atoms/project';
import { profileAtom } from '../atoms/profile';
import { themeAtom } from '../atoms/theme';
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

// Bump this suffix whenever a stored field's shape changes in a way old data
// can't satisfy (e.g. Status's values changing, as just happened) — old data
// under the previous key is simply never read again, falling back to the
// fresh mock seed, instead of being force-fit into the new shape. The
// `statusInfo()` fallback (src/data/constants.ts) is the last line of
// defence for whatever slips through anyway.
const PROJECT_KEY = 'ytc_project_v3';

const persistedProjectAtom = atom(get => ({
  views: get(viewsAtom),
  activeViewId: get(activeViewIdAtom),
  items: get(itemsAtom),
  comments: get(commentsAtom),
  profile: get(profileAtom),
  theme: get(themeAtom),
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
  if (s.theme && typeof s.theme === 'object') {
    const savedTheme = s.theme;
    store.set(themeAtom, prev => ({ ...prev, ...savedTheme }));
  }
}

const persistProject = () => {
  const snapshot = store.get(persistedProjectAtom);
  storage.setItem(PROJECT_KEY, JSON.stringify(snapshot));
};
