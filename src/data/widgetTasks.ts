import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { occurrencesInRange } from './recurrence';
import type { WorkItem } from './types';

export interface WidgetTask {
  id: string;
  title: string;
}

// What the home-screen widget lists: unfinished tasks that are active today
// (recurring ones count on the days they fall).
export const widgetTasks = (items: WorkItem[], now: Date): WidgetTask[] =>
  items
    .filter(
      i =>
        i.status !== 'completed' &&
        i.status !== 'rejected' &&
        occurrencesInRange(
          parseISO(i.start),
          parseISO(i.end),
          i.recurrence,
          startOfDay(now),
          endOfDay(now),
        ).length > 0,
    )
    .map(i => ({ id: i.id, title: i.title }));
