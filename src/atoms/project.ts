import { atom } from 'jotai';
import type { Status, WorkItem } from '../data/types';
import type { RecurringTemplate } from '../data/recurringTemplate';

// Views themselves come from the server (src/hooks/useViews.ts). This is only
// which one is selected — UI state, mirrored in the URL on web, never stored.
// '' = none chosen yet → the first view.
export const activeViewIdAtom = atom<string>('');

// Tasks (the active view's table/kanban/roadmap/calendar) or that view's
// recurring-task templates (ProjectScreen's sidebar nav) — also mirrored in the
// URL on web (useViewUrlSync), so a reload or a shared link stays on whichever
// one was open instead of always landing back on Tasks.
export type ContentMode = 'tasks' | 'recurring';
// Seeded straight from the URL (web only) rather than always starting at
// 'tasks' and correcting via an effect: that two-step version raced with
// useViewUrlSync's "push state to URL" effect, which could read the mode
// back from the URL before the correction had landed and stomp it to the
// wrong value. Reading it here, once, before first render, removes the race.
const initialContentMode = (): ContentMode => {
  if (typeof window === 'undefined') {
    return 'tasks';
  }
  return new URLSearchParams(window.location.search).get('mode') === 'recurring'
    ? 'recurring'
    : 'tasks';
};
export const contentModeAtom = atom<ContentMode>(initialContentMode());
export const itemsAtom = atom<WorkItem[]>([]);
export const selectedItemIdAtom = atom<string | null>(null);
// Same idea, for a recurring template's view sheet (RecurringTaskViewModal) —
// opened by a row click, its own Edit button hands off to recurringFormAtom.
export const selectedTemplateIdAtom = atom<string | null>(null);
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

// Same idea for the recurring-template form — shared between RecurringTasksView
// (its own rows, and its empty state's button) and the navbar's "New template"
// (ProjectScreen), so either one opens the same modal. `edit` carries the whole
// template rather than just an id since there's nowhere else to look it up from
// outside RecurringTasksView's own query.
export type RecurringFormState =
  | { mode: 'new' }
  | { mode: 'edit'; template: RecurringTemplate }
  | null;
export const recurringFormAtom = atom<RecurringFormState>(null);
