import {
  addMonths,
  addYears,
  endOfDay,
  format,
  parseISO,
  startOfDay,
  subMonths,
} from 'date-fns';
import {
  BACKEND_STATUS,
  BACKEND_TAG,
  STATUS_FROM_BACKEND,
  TAGS,
  TAG_FROM_BACKEND,
} from './constants';
import type { ProjectView, Reminder, Status, TaskTag, WorkItem } from './types';
import type {
  CreateTaskPayload,
  TaskFilterQuery,
  TaskInfoDto,
  UpdateTaskPayload,
} from '../services/types';

// Converts between this app's WorkItem and Tasks-Main-API's `tasks` row. The API
// has no columns for recurrence/reminders — only title,
// description, status, tag and the start/end dates are real columns — so those
// ride in the open-schema `details` JSON, the same trick src/data/viewSync.ts uses
// for a view's `ui_info`.

const DATE_FMT = 'yyyy-MM-dd';

// start_at/end_at are TIMESTAMPTZ. Two shapes live in them:
//  - **With a time** ('HH:mm', local): the real instant — local date + time
//    converted to UTC — so it reads back as the same wall-clock time anywhere.
//  - **All-day** (time null — every task saved before times existed): midnight
//    UTC on that date. Read back by slicing the date digits, never through the
//    local timezone, which would shift it a day for anyone west of UTC.
// A timed instant that happens to land exactly on midnight UTC (05:30 in India)
// is nudged one second so it isn't mistaken for all-day.
const ALL_DAY = /T00:00:00(\.0+)?(Z|\+00(:?00)?)$/;
const toTimestamp = (date: string, time: string | null = null) => {
  if (!time) {
    return `${date}T00:00:00.000Z`;
  }
  const iso = new Date(`${date}T${time}:00`).toISOString();
  return ALL_DAY.test(iso) ? iso.replace('T00:00:00', 'T00:00:01') : iso;
};
const fromTimestamp = (ts: string): { date: string; time: string | null } => {
  if (ALL_DAY.test(ts)) {
    return { date: ts.slice(0, 10), time: null };
  }
  const d = parseISO(ts);
  return { date: format(d, DATE_FMT), time: format(d, 'HH:mm') };
};

interface TaskDetails {
  recurrence?: string | null;
  reminders?: Reminder[];
}

export function taskFromServer(dto: TaskInfoDto): WorkItem {
  const details = (dto.details ?? {}) as TaskDetails;
  return {
    id: String(dto.task_id),
    title: dto.title,
    description: dto.description,
    status: STATUS_FROM_BACKEND[dto.task_status],
    tag: TAG_FROM_BACKEND[dto.task_tag] ?? 'other',
    // Read-only: the API has no endpoint yet to set a task's assignees (no live
    // /assignees scope), so this only ever reflects what's already on the server.
    assigneeIds: dto.assignee_ids,
    // created_by is nullable (SET NULL if that account is gone); the view's
    // owner is the next most sensible "who can manage this" fallback.
    createdById: dto.created_by ?? dto.owner_id,
    ownerId: dto.owner_id,
    parentId: dto.parent_task_id === null ? null : String(dto.parent_task_id),
    totalSubtasks: dto.total_sub_tasks,
    start: fromTimestamp(dto.start_at).date,
    startTime: fromTimestamp(dto.start_at).time,
    end: fromTimestamp(dto.end_at).date,
    endTime: fromTimestamp(dto.end_at).time,
    recurrence: details.recurrence ?? null,
    // Stored without ids; give each a row key for the form's list.
    reminders: (details.reminders ?? []).map((r, i) => ({
      id: `rem-${dto.task_id}-${i}`,
      offsetDays: r.offsetDays,
      time: r.time,
    })),
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

type DetailFields = Pick<WorkItem, 'recurrence' | 'reminders'>;

// `details` (JSONB) carries only what the tasks table has no column for, and only
// when set — every core field (title, description, status, tag, dates, parent)
// is a top-level column. Contract (read back in taskFromServer):
//   { recurrence?: RRULE string, reminders?: { offsetDays, time }[] }
const detailsPayload = (item: DetailFields): Record<string, unknown> => ({
  ...(item.recurrence ? { recurrence: item.recurrence } : null),
  ...(item.reminders.length
    ? {
        reminders: item.reminders.map(r => ({
          offsetDays: r.offsetDays,
          time: r.time,
        })),
      }
    : null),
});

export function taskToCreatePayload(
  item: Omit<
    WorkItem,
    'id' | 'createdById' | 'ownerId' | 'assigneeIds' | 'totalSubtasks'
  >,
): CreateTaskPayload {
  return {
    parent_task_id: item.parentId ? Number(item.parentId) : null,
    title: item.title,
    description: item.description,
    details: detailsPayload(item),
    task_status: BACKEND_STATUS[item.status],
    task_tag: BACKEND_TAG[item.tag],
    start_at: toTimestamp(item.start, item.startTime),
    end_at: toTimestamp(item.end, item.endTime),
  };
}

export function taskToUpdatePayload(item: WorkItem): UpdateTaskPayload {
  return {
    task_id: Number(item.id),
    title: item.title,
    description: item.description,
    details: detailsPayload(item),
    task_status: BACKEND_STATUS[item.status],
    task_tag: BACKEND_TAG[item.tag],
    start_at: toTimestamp(item.start, item.startTime),
    end_at: toTimestamp(item.end, item.endTime),
  };
}

// Server-backed tasks have the server's numeric task_id as their string id;
// anything else (made while signed out, or before this API existed) is
// local-only and has no row to PATCH/DELETE.
export const isServerTaskId = (id: string) => /^\d+$/.test(id);

// How far back/forward a view's task list looks. TaskFilterDto's start_at/end_at
// are mandatory — there's no "no date filter" option — so some window has to be
// picked; a task outside it won't load. Generous for a small-team planner, but a
// real limit: a task due more than 5 years out or 5 years overdue won't show up.
const WINDOW_YEARS = 5;
const wideTaskWindow = (): { start_at: string; end_at: string } => {
  const now = new Date();
  return {
    start_at: toTimestamp(format(addYears(now, -WINDOW_YEARS), DATE_FMT)),
    end_at: toTimestamp(format(addYears(now, WINDOW_YEARS), DATE_FMT)),
  };
};

const ALL_STATUSES: Status[] = [
  'not_started',
  'in_progress',
  'completed',
  'rejected',
  'on_hold',
];
const ALL_TAGS: TaskTag[] = TAGS.map(t => t.key);

export const FETCH_PAGE_LIMIT = 100;
// Safety cap on pages drained per list (root or one parent's children) — a
// runaway-loop guard, not a real limit (see MAX_PERIODS in src/data/rrule.ts for
// the same pattern).
export const MAX_PAGES = 20;

// The Calendar loads tasks in "month buckets": every top-level task that
// *starts* in one calendar month, whatever its end. /tasks/list can only
// return tasks lying entirely inside [start_at, end_at], so a bucket asks for
// start_at = the month's first day and end_at = far future, then stops paging
// once tasks start after the month (results come back ordered by start_at).
// Buckets are cached per month and shared by Day/Week/Month/Year, so moving
// to the next month usually costs one new bucket, not a whole new range.
//
// A calendar needs every task *overlapping* what it shows, so it also loads
// this many earlier months' buckets for long tasks that began before the
// screen. A task that started even earlier won't show — the backend has no
// overlap filter to do better.
export const CALENDAR_LOOKBACK_MONTHS = 6;

// 'yyyy-MM' — one bucket.
export type MonthKey = string;

// A bucket reaches one day past its month: an all-day task is stored at UTC
// midnight while a timed one keeps its real instant, so a task near a month
// edge can land on either side depending on the viewer's timezone. The
// overlap duplicates are dropped when buckets are merged.
const bucketBounds = (month: MonthKey) => {
  const first = parseISO(`${month}-01`);
  return {
    start: toTimestamp(month + '-01'),
    endMs:
      Date.parse(toTimestamp(format(addMonths(first, 1), DATE_FMT))) +
      24 * 3600e3,
  };
};

export const bucketFilter = (
  view: Pick<ProjectView, 'statusFilter' | 'tagFilter'>,
  month: MonthKey,
  cursor?: { cursor_start_at: string; cursor_task_id: number },
): TaskFilterQuery => ({
  ...buildTaskFilter(view, undefined, cursor),
  start_at: bucketBounds(month).start,
});

// A bucket's span as epoch ms: tasks starting in [startMs, endMs) belong to it.
export const bucketRange = (month: MonthKey) => {
  const b = bucketBounds(month);
  return { startMs: Date.parse(b.start), endMs: b.endMs };
};

// Whether `row` belongs to `month`'s bucket (start before its far edge), and
// so whether paging should go on after a page ending in it.
export const startsWithinBucket = (month: MonthKey, startAt: string) =>
  Date.parse(startAt) < bucketBounds(month).endMs;

// The bucket(s) a task starting on `date` ('yyyy-MM-dd') lives in — its own
// month, and on a month's first day also the previous one (see bucketBounds).
export const bucketsForDate = (date: string): MonthKey[] => {
  const d = parseISO(date);
  const own = format(d, 'yyyy-MM');
  return d.getDate() === 1 ? [format(subMonths(d, 1), 'yyyy-MM'), own] : [own];
};

// The part of TableView's quick filter the list API can apply itself. Assignee
// and "due on or after" have no TaskFilterDto field, so they stay client-side.
export interface ServerQuickFilter {
  statuses: Status[];
  tags: TaskTag[];
  // 'yyyy-MM-dd' or '' — sent as the request's end_at bound.
  dueTo: string;
}

export const toServerQuickFilter = (f: {
  statuses: Status[];
  tags: TaskTag[];
  dueTo: string;
}): ServerQuickFilter | undefined =>
  f.statuses.length || f.tags.length || f.dueTo
    ? { statuses: f.statuses, tags: f.tags, dueTo: f.dueTo }
    : undefined;

// Builds a POST /tasks/list/{view_id} filter body for `view`. The view's own
// statusFilter/tagFilter (if set) restrict which values the API will even allow
// asking for (TaskViewPermission.check_status/check_tag), so "no filter" here
// must still spell out every value — the API has no shorthand for "all". A
// quick filter only ever narrows within that.
export function buildTaskFilter(
  view: Pick<ProjectView, 'statusFilter' | 'tagFilter'>,
  parentTaskId?: number,
  cursor?: { cursor_start_at: string; cursor_task_id: number },
  quick?: ServerQuickFilter,
): TaskFilterQuery {
  const viewStatuses = view.statusFilter?.length
    ? view.statusFilter
    : ALL_STATUSES;
  const viewTags = view.tagFilter?.length ? view.tagFilter : ALL_TAGS;
  const statuses = quick?.statuses.length
    ? viewStatuses.filter(s => quick.statuses.includes(s))
    : viewStatuses;
  const tags = quick?.tags.length
    ? viewTags.filter(t => quick.tags.includes(t))
    : viewTags;
  const window = wideTaskWindow();
  // The whole "To" day, in local time. Can over-include a little next to
  // midnight UTC — the client-side filter still trims to the exact day.
  const dueToEnd = quick?.dueTo ? toTimestamp(quick.dueTo, '23:59') : null;
  return {
    parent_task_id: parentTaskId,
    any_of_task_status: statuses.map(s => BACKEND_STATUS[s]),
    any_of_task_tag: tags.map(t => BACKEND_TAG[t]),
    limit: FETCH_PAGE_LIMIT,
    start_at: window.start_at,
    end_at:
      dueToEnd && dueToEnd < window.end_at && dueToEnd > window.start_at
        ? dueToEnd
        : window.end_at,
    ...(cursor ?? {}),
  };
}

// `title_contains` only accepts letters, digits and spaces (TaskFilterDto::
// has_valid_title_filter — anything else is a 400), so punctuation becomes a
// space. '' = nothing searchable; leave the title filter out.
export const searchableTitle = (raw: string) =>
  raw
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// The typed words, lowercased, punctuation dropped: "V3 - ss" → ["v3", "ss"].
export const searchWords = (raw: string) =>
  searchableTitle(raw).toLowerCase().split(' ').filter(Boolean);

// Title search matches words, not the exact phrase: the API only takes one string
// of letters/digits/spaces, so "v3 - ss" sent as "v3 ss" would miss
// "V3 - SSO …". The server gets the longest word (narrows the most); the hook then
// keeps titles containing every typed word (titleHasWords).
const serverTitle = (raw: string) =>
  searchWords(raw).reduce((a, w) => (w.length > a.length ? w : a), '');

export const titleHasWords = (title: string, words: string[]) => {
  const t = searchableTitle(title).toLowerCase();
  return words.every(w => t.includes(w));
};

export interface TaskSearch {
  title: string;
  statuses: Status[];
  tags: TaskTag[];
  // yyyy-MM-dd or ''. The API matches tasks lying wholly inside the range
  // (start_at >= from AND end_at <= to); an open end uses the wide window.
  from: string;
  to: string;
  // 'HH:mm' (local) or '' — '' = the whole day (from its start / to its end).
  fromTime: string;
  toTime: string;
}

// The whole of a local day as an API bound, also covering its all-day form
// (midnight UTC), whichever side of UTC this device is on.
const dayBound = (date: string, side: 'start' | 'end') => {
  const local = (side === 'start' ? startOfDay : endOfDay)(
    parseISO(date),
  ).toISOString();
  const utc =
    side === 'start' ? `${date}T00:00:00.000Z` : `${date}T23:59:59.999Z`;
  return side === 'start'
    ? local < utc
      ? local
      : utc
    : local > utc
    ? local
    : utc;
};

// POST /tasks/list filter for a search: top-level tasks of the view, one page.
export function buildSearchFilter(
  s: TaskSearch,
  limit: number,
  cursor?: { cursor_start_at: string; cursor_task_id: number },
): TaskFilterQuery {
  const wide = wideTaskWindow();
  const title = serverTitle(s.title);
  return {
    ...(title ? { title_contains: title } : null),
    any_of_task_status: s.statuses.map(k => BACKEND_STATUS[k]),
    any_of_task_tag: s.tags.map(k => BACKEND_TAG[k]),
    start_at: !s.from
      ? wide.start_at
      : s.fromTime
      ? new Date(`${s.from}T${s.fromTime}:00`).toISOString()
      : dayBound(s.from, 'start'),
    end_at: !s.to
      ? wide.end_at
      : s.toTime
      ? new Date(`${s.to}T${s.toTime}:59.999`).toISOString()
      : dayBound(s.to, 'end'),
    limit,
    ...(cursor ?? {}),
  };
}
