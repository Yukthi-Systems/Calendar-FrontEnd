import { atom } from 'jotai';
import { DEFAULT_VIEWS, MOCK_COMMENTS, MOCK_ITEMS } from '../data/mockData';
import type { Comment, ProjectView, Status, WorkItem } from '../data/types';

// Seeded from the mock data below; src/services/projectStore.ts overwrites these
// with whatever was saved locally last time (see its comment for the plan once a
// backend exists: same atoms, the seed just becomes a fetched JSON payload instead
// of these mock files).
export const viewsAtom = atom<ProjectView[]>(DEFAULT_VIEWS);
export const activeViewIdAtom = atom<string>(DEFAULT_VIEWS[0].id);
export const itemsAtom = atom<WorkItem[]>(MOCK_ITEMS);
export const selectedItemIdAtom = atom<string | null>(null);

// Every task and subtask has its own thread — comments are just filtered by
// `itemId`, so no special-casing is needed between a task and a subtask.
export const commentsAtom = atom<Comment[]>(MOCK_COMMENTS);

// True once projectStore's boot has read local storage (or found nothing) — lets
// things that must not act on the pre-hydration seed values (e.g. applying a
// `?view=` URL param against the real, persisted view list) wait for it.
export const projectHydratedAtom = atom(false);

// Which item form is open: creating (optionally into a status column), editing one, or closed.
export type ItemFormState =
  | { mode: 'new'; status?: Status; parentId?: string }
  | { mode: 'edit'; id: string }
  | null;
export const itemFormAtom = atom<ItemFormState>(null);
