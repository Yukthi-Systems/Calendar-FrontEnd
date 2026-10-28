import { atom } from 'jotai';
import type { Status, TaskQuickFilter, TaskTag, WorkItem } from '../data/types';
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

// TableView's own quick filter (GitHub Issues-style: status/tag/assignee
// chips on top of whatever's loaded) — a client-side narrowing of itemsAtom,
// separate from a view's own statusFilter/tagFilter (which gate what the
// server returns at all, for everyone who opens the view). Empty array on any
// field = no filter on that dimension. Mirrors the active view's own
// `quickFilter` (see data/types.ts) — TableView loads it in on view change and
// saves it back out, so this atom is just the live editing copy, not storage.
export type TaskFilters = TaskQuickFilter;
export const EMPTY_TASK_FILTERS: TaskFilters = {
  statuses: [],
  tags: [],
  assigneeIds: [],
  dueFrom: '',
  dueTo: '',
};
export const taskFiltersAtom = atom<TaskFilters>(EMPTY_TASK_FILTERS);

// Which item form is open: creating (optionally into a status column), editing one, or closed.
export type ItemFormState =
  // `start` ('yyyy-MM-dd'): prefill the dates, e.g. from a calendar day.
  // `fromTemplate`: prefill title/description/tag/time from a recurring
  // template (see recurringOccurrences.ts's "turn into a real task" flow —
  // the schema's own comment says this, not auto-generation, is the intended
  // way a template ever becomes an actual task) — the created task has no
  // further link back to the template once saved, same as any other task.
  | {
      mode: 'new';
      status?: Status;
      parentId?: string;
      start?: string;
      fromTemplate?: {
        title: string;
        description: string;
        tag: TaskTag;
        time: string;
      };
    }
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
