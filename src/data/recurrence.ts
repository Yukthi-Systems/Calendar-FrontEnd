import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  isLeapYear,
  parseISO,
  setHours,
  setMinutes,
  setSeconds,
  startOfDay,
} from 'date-fns';
import type { Reminder, RecurrenceFreq, WorkItem } from './types';

export const RECURRENCE_LABEL: Record<RecurrenceFreq, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

// Feb 29 is the only start date a recurrence rule can't always land on again.
export const isLeapDayAnchor = (date: Date) =>
  date.getMonth() === 1 && date.getDate() === 29;

// True if `date` is a Feb 29 whose very next yearly occurrence falls outside
// a leap year — i.e. the thing the form needs to warn about before saving a
// yearly recurrence anchored there.
export const yearlyRecurrenceNeedsLeapWarning = (date: Date) =>
  isLeapDayAnchor(date) && !isLeapYear(addYears(date, 1));

// Occurrence number `n` (0 = the anchor itself), computed fresh from the
// original anchor every time — never from the previous occurrence. That
// matters: date-fns clamps a day that doesn't exist in the target month to
// that month's last day (e.g. Jan 31 -> Feb 28, or Feb 29 -> Feb 28 in a
// non-leap year, per the brief's "do -1 of that"). Advancing from the
// *previous* occurrence instead of the anchor would make that clamp
// permanent — a Feb 29 task would drift to Feb 28 forever and never land on
// Feb 29 again, even the next time the target year is a leap year. Anchoring
// every step on the original date instead gives each occurrence an
// independent chance to land on the real date.
function occurrenceAt(anchor: Date, freq: RecurrenceFreq, n: number): Date {
  switch (freq) {
    case 'weekly':
      return addWeeks(anchor, n);
    case 'monthly':
      return addMonths(anchor, n);
    case 'quarterly':
      return addMonths(anchor, n * 3);
    case 'yearly':
      return addYears(anchor, n);
  }
}

export interface Occurrence {
  start: Date;
  end: Date;
  // 0 for the task's own stored start/end; 1, 2, … for each repeat after it.
  index: number;
}

const MAX_OCCURRENCES = 1000; // safety cap against a runaway loop, not a real limit

// Every occurrence (including the original) whose span overlaps
// [rangeStart, rangeEnd], preserving the task's original duration. Used only
// to decide what to *display* on the calendar for a given visible range —
// the stored task is still just the one WorkItem; nothing here is persisted.
export function occurrencesInRange(
  start: Date,
  end: Date,
  freq: RecurrenceFreq | null,
  rangeStart: Date,
  rangeEnd: Date,
): Occurrence[] {
  const overlaps = (s: Date, e: Date) => s <= rangeEnd && e >= rangeStart;

  if (!freq) {
    return overlaps(start, end) ? [{ start, end, index: 0 }] : [];
  }

  const durationDays = differenceInCalendarDays(end, start);
  const out: Occurrence[] = [];
  let n = 0;
  let curStart = occurrenceAt(start, freq, n);
  let curEnd = addDays(curStart, durationDays);

  // Skip past occurrences that end before the range even starts — e.g. a
  // weekly task from years ago, viewed on this month's calendar.
  while (curEnd < rangeStart && n < MAX_OCCURRENCES) {
    n++;
    curStart = occurrenceAt(start, freq, n);
    curEnd = addDays(curStart, durationDays);
  }

  while (curStart <= rangeEnd && n < MAX_OCCURRENCES) {
    if (overlaps(curStart, curEnd)) {
      out.push({ start: curStart, end: curEnd, index: n });
    }
    n++;
    curStart = occurrenceAt(start, freq, n);
    curEnd = addDays(curStart, durationDays);
  }

  return out;
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
