import { format, parseISO } from 'date-fns';
import { expandRRule, nextOccurrence, tryParseRRule } from './rrule';
import type { RecurringTemplate } from './recurringTemplate';
import type { WorkItem } from './types';

// A recurring template never becomes a real task on its own (see
// recurringTemplate.ts / recurring_tasks' own schema comment) — these are
// synthetic, display-only stand-ins so the views that already know how to
// render a WorkItem (Calendar's day/week/month/agenda, Table's rows) can show
// where a template's pattern lands, without a server round trip. Never
// written to itemsAtom, never mutated/edited directly — clicking one opens
// the normal "new task" form prefilled from the template instead
// (itemFormAtom's `fromTemplate`; see TableView/CalendarView's
// openTaskFromTemplate).
const DATE_FMT = 'yyyy-MM-dd';
const VIRTUAL_PREFIX = 'recurring:';

export const isVirtualRecurringId = (id: string): boolean =>
  id.startsWith(VIRTUAL_PREFIX);

// Recovers which template + date a virtual occurrence's id stands for, so a
// click handler can look the template up and open the "new task" form for it
// — null for a real task's id (or anything else that isn't one of these).
export function parseVirtualRecurringId(
  id: string,
): { templateId: string; date: string } | null {
  if (!isVirtualRecurringId(id)) {
    return null;
  }
  const [, templateId, date] = id.split(':');
  return templateId && date ? { templateId, date } : null;
}

// itemFormAtom's `fromTemplate` shape, built once here so every caller (Table,
// Calendar, the template's own view/row "Create task" actions) prefills a new
// task the same way.
export const templateFormPrefill = (template: RecurringTemplate) => ({
  title: template.title,
  description: template.description,
  tag: template.tag,
  time: template.time,
});

export interface VirtualOccurrence {
  item: WorkItem;
  template: RecurringTemplate;
  // 'yyyy-MM-dd'
  date: string;
}

function virtualItem(template: RecurringTemplate, date: string): WorkItem {
  return {
    id: `${VIRTUAL_PREFIX}${template.id}:${date}`,
    title: template.title,
    description: template.description,
    status: 'not_started',
    tag: template.tag,
    assigneeIds: [],
    createdById: template.ownerId,
    ownerId: template.ownerId,
    parentId: null,
    totalSubtasks: 0,
    start: date,
    end: date,
    startTime: template.time || null,
    endTime: template.time || null,
    recurrence: null,
    reminders: [],
  };
}

// Every date within [from, to] each template's rule lands on — each anchored
// on its own `createdAt` (see rrule.ts's nextOccurrence for why: a shared
// "today" anchor would hide every matching date earlier in the range than
// today, and would make the pattern's phase drift with whatever day it's
// viewed on). A date before the template existed never shows, but otherwise
// this fills the whole range, past or future relative to today — a Weekly
// template shows on every matching day of the month being looked at, not
// just the next one.
export function templateOccurrences(
  templates: RecurringTemplate[],
  from: Date,
  to: Date,
): VirtualOccurrence[] {
  const out: VirtualOccurrence[] = [];
  for (const template of templates) {
    const rule = tryParseRRule(template.rrule);
    if (!rule) {
      continue;
    }
    const anchor = parseISO(template.createdAt);
    for (const hit of expandRRule(rule, anchor, from, to)) {
      const date = format(hit.date, DATE_FMT);
      out.push({ template, date, item: virtualItem(template, date) });
    }
  }
  return out;
}

// Drops any occurrence that's already been turned into a real task (via
// "Create task") — once that's happened, the preview row for that same date
// is just noise alongside the task it produced. Nothing links a created task
// back to the template it came from (see templateFormPrefill's comment
// above), so title + date is the only signal available that this particular
// occurrence already has a real task; an unrelated task that just happens to
// share a title on some other date is left alone.
export function withoutCreatedOccurrences(
  occurrences: VirtualOccurrence[],
  realItems: WorkItem[],
): VirtualOccurrence[] {
  const created = new Set(
    realItems.map(i => `${i.title.trim().toLowerCase()}|${i.start}`),
  );
  return occurrences.filter(
    v => !created.has(`${v.item.title.trim().toLowerCase()}|${v.date}`),
  );
}

// One entry per template — its own next occurrence from today only (not
// every date in a range), for TableView's flat list: a single preview row
// sorted into the list by that date, the same way a real task would be. null
// for a template whose rule has already run out (a past UNTIL/COUNT).
export function nextVirtualOccurrences(
  templates: RecurringTemplate[],
  today: Date = new Date(),
): VirtualOccurrence[] {
  const out: VirtualOccurrence[] = [];
  for (const template of templates) {
    const next = nextOccurrence(
      template.rrule,
      parseISO(template.createdAt),
      today,
    );
    if (!next) {
      continue;
    }
    const date = format(next, DATE_FMT);
    out.push({ template, date, item: virtualItem(template, date) });
  }
  return out;
}
