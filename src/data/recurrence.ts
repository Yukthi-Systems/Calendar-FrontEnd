import {
  addDays,
  addYears,
  differenceInCalendarDays,
  isLeapYear,
  parseISO,
  setHours,
  setMinutes,
  setSeconds,
  startOfDay,
} from 'date-fns';
import { expandRRule, migrateRecurrence, tryParseRRule } from './rrule';
import type { Reminder, WorkItem } from './types';

// Feb 29 is the only start date a recurrence rule can't always land on again.
export const isLeapDayAnchor = (date: Date) =>
  date.getMonth() === 1 && date.getDate() === 29;

// True if `date` is a Feb 29 whose very next yearly occurrence falls outside
// a leap year — i.e. the thing the form needs to warn about before saving a
// yearly recurrence anchored there.
export const yearlyRecurrenceNeedsLeapWarning = (date: Date) =>
  isLeapDayAnchor(date) && !isLeapYear(addYears(date, 1));

export interface Occurrence {
  start: Date;
  end: Date;
  // 0 for the task's own stored start/end; 1, 2, … for each repeat after it.
  index: number;
}

// Every occurrence (including the original) whose span overlaps
// [rangeStart, rangeEnd], preserving the task's original duration. Used only
// to decide what to *display* on the calendar for a given visible range —
// the stored task is still just the one WorkItem; nothing here is persisted.
// `recurrence` is an RRULE string (or a legacy word); an unparseable one is
// treated as "doesn't repeat".
export function occurrencesInRange(
  start: Date,
  end: Date,
  recurrence: string | null,
  rangeStart: Date,
  rangeEnd: Date,
): Occurrence[] {
  const overlaps = (s: Date, e: Date) => s <= rangeEnd && e >= rangeStart;
  const rule = tryParseRRule(migrateRecurrence(recurrence));

  if (!rule) {
    return overlaps(start, end) ? [{ start, end, index: 0 }] : [];
  }

  const durationDays = differenceInCalendarDays(end, start);
  // A long task can start before the range and still overlap it, so look back
  // by its duration when asking for starts.
  const hits = expandRRule(
    rule,
    start,
    addDays(rangeStart, -durationDays),
    rangeEnd,
  );
  return hits
    .map(h => ({
      start: h.date,
      end: addDays(h.date, durationDays),
      index: h.index,
    }))
    .filter(o => overlaps(o.start, o.end));
}

// The next not-yet-passed moment this reminder should fire, across however
// many future occurrences it takes to find one — a reminder on a recurring
// task re-fires for every future occurrence, not just the original. Looks up
// to 2 years ahead (comfortably past a single yearly cycle) and returns null
// once nothing upcoming is left (a one-off task whose reminder already came
// and went, with no recurrence to look forward to).
export function nextReminderTrigger(
  item: Pick<WorkItem, 'start' | 'end' | 'recurrence'>,
  reminder: Reminder,
  from: Date = new Date(),
): Date | null {
  const start = parseISO(item.start);
  const end = parseISO(item.end);
  const horizon = addYears(from, 2);
  // Occurrence dates carry no time-of-day (they're midnight), so comparing
  // them against the precise `from` moment would wrongly drop today's
  // occurrence the instant any time has passed since midnight. Querying from
  // the start of `from`'s day keeps today's occurrence in the candidate
  // list; the loop below still checks each computed trigger against the
  // precise `from` to decide whether it's actually still upcoming.
  const occurrences = occurrencesInRange(start, end, item.recurrence, startOfDay(from), horizon);
  const [hours, minutes] = reminder.time.split(':').map(Number);

  for (const occ of occurrences) {
    const triggerDay = addDays(occ.start, -reminder.offsetDays);
    const trigger = setSeconds(setMinutes(setHours(triggerDay, hours), minutes), 0);
    if (trigger >= from) {
      return trigger;
    }
  }
  return null;
}
