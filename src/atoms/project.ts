import { atom } from 'jotai';
import { DEFAULT_VIEWS } from '../data/defaultViews';
import type { Comment, ProjectView, Status, WorkItem } from '../data/types';

// Start empty; src/services/projectStore.ts fills these from local storage. The
// Tasks-Main-API has no task/comment/view endpoints yet, so they stay on-device.
export const viewsAtom = atom<ProjectView[]>(DEFAULT_VIEWS);
export const activeViewIdAtom = atom<string>(DEFAULT_VIEWS[0].id);
export const itemsAtom = atom<WorkItem[]>([]);
export const selectedItemIdAtom = atom<string | null>(null);
export const searchOpenAtom = atom(false);
export const searchTitleAtom = atom('');

// Every task and subtask has its own thread — comments are just filtered by
// `itemId`, so no special-casing is needed between a task and a subtask.
export const commentsAtom = atom<Comment[]>([]);

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
