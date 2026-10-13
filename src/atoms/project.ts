import { atom } from 'jotai';
import type { Status, WorkItem } from '../data/types';

// Views themselves come from the server (src/hooks/useViews.ts). This is only
// which one is selected — UI state, mirrored in the URL on web, never stored.
// '' = none chosen yet → the first view.
export const activeViewIdAtom = atom<string>('');
export const itemsAtom = atom<WorkItem[]>([]);
export const selectedItemIdAtom = atom<string | null>(null);
export const searchOpenAtom = atom(false);
export const searchTitleAtom = atom('');
// True while the active view's first task fetch is in flight (useTasksSync) —
// views show skeletons instead of an empty state until it settles.
export const tasksLoadingAtom = atom(false);



// Which item form is open: creating (optionally into a status column), editing one, or closed.
export type ItemFormState =
  // `start` ('yyyy-MM-dd'): prefill the dates, e.g. from a calendar day.
  | { mode: 'new'; status?: Status; parentId?: string; start?: string }
  | { mode: 'edit'; id: string }
  | null;
export const itemFormAtom = atom<ItemFormState>(null);
