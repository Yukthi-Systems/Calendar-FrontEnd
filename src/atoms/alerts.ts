import { atom } from 'jotai';
import type { TaskAlertDto } from '../services/types';

// Task Alerts has nothing to do with views (Tasks-Main-API's own comment:
// "All alerts are associated only with self") — so unlike contentModeAtom
// (tasks/recurring, both scoped to whichever view is active), this is a
// standalone top-level screen. ProjectScreen's rail (desktop) and
// MobileHome (phone) both get their own "Alerts" entry that flips this on;
// opening a view flips it back off.
export const alertsOpenAtom = atom(false);

// The create/edit alert sheet, opened from a task's own detail view
// (ItemModal's AlertsSection) or from the Alerts screen's row actions.
// Carries the task's title along rather than just its id — there's nowhere
// else to look it up from outside whatever list the id came from (the same
// reasoning as recurringFormAtom carrying the whole template, not just its
// id — see project.ts).
export type AlertFormState =
  | { mode: 'new'; taskId: string; taskTitle: string }
  | { mode: 'edit'; taskId: string; taskTitle: string; alert: TaskAlertDto }
  | null;
export const alertFormAtom = atom<AlertFormState>(null);
