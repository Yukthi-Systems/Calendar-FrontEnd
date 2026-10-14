import { addYears, format } from 'date-fns';
import {
  BACKEND_STATUS,
  BACKEND_TAG,
  STATUS_FROM_BACKEND,
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

// start_at/end_at are TIMESTAMPTZ, but tasks here carry no time of day (brief:
// "Task has no Time required only date is enough"), so every one is always
// midnight UTC on that date — stable across the server's and every client's
// timezone, never drifting a day in either direction.
const toTimestamp = (date: string) => `${date}T00:00:00.000Z`;
// Reads the date digits straight off the ISO string instead of going through
// `parseISO` + `format`, which was the bug: date-fns' `format` renders in the
// *local* system timezone, not UTC, so a task stored at e.g.
// "2026-10-14T00:00:00.000Z" came back as "2026-10-13" for anyone west of UTC
// (any negative offset) — every task a day early (or, east of UTC, a day
// late). The backend always sends a full ISO 8601 timestamp with the date
// first, so slicing is exact and has no timezone to get wrong.
const fromTimestamp = (ts: string) => ts.slice(0, 10);

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
    parentId: dto.parent_task_id === null ? null : String(dto.parent_task_id),
    totalSubtasks: dto.total_sub_tasks,
    start: fromTimestamp(dto.start_at),
    end: fromTimestamp(dto.end_at),
    recurrence: details.recurrence ?? null,
    // Stored without ids; give each a row key for the form's list.
    reminders: (details.reminders ?? []).map((r, i) => ({
      id: `rem-${dto.task_id}-${i}`,
      offsetDays: r.offsetDays,
      time: r.time,
    })),
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
    ? { reminders: item.reminders.map(r => ({ offsetDays: r.offsetDays, time: r.time })) }
    : null),
});

export function taskToCreatePayload(
  item: Omit<WorkItem, 'id' | 'createdById' | 'assigneeIds' | 'totalSubtasks'>,
): CreateTaskPayload {
  return {
    parent_task_id: item.parentId ? Number(item.parentId) : null,
    title: item.title,
    description: item.description,
    details: detailsPayload(item),
    task_status: BACKEND_STATUS[item.status],
    task_tag: BACKEND_TAG[item.tag],
    start_at: toTimestamp(item.start),
    end_at: toTimestamp(item.end),
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
    start_at: toTimestamp(item.start),
    end_at: toTimestamp(item.end),
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
const ALL_TAGS: TaskTag[] = [
  'work',
  'important',
  'urgent',
  'optional',
  'personal',
  'other',
];

export const FETCH_PAGE_LIMIT = 100;
// Safety cap on pages drained per list (root or one parent's children) — a
// runaway-loop guard, not a real limit (see MAX_PERIODS in src/data/rrule.ts for
// the same pattern).
export const MAX_PAGES = 20;

// Builds a POST /tasks/list/{view_id} filter body for `view`. The view's own
// statusFilter/tagFilter (if set) restrict which values the API will even allow
// asking for (TaskViewPermission.check_status/check_tag), so "no filter" here
// must still spell out every value — the API has no shorthand for "all".
export function buildTaskFilter(
  view: Pick<ProjectView, 'statusFilter' | 'tagFilter'>,
  parentTaskId?: number,
  cursor?: { cursor_start_at: string; cursor_task_id: number },
): TaskFilterQuery {
  const statuses = (
    view.statusFilter?.length ? view.statusFilter : ALL_STATUSES
  ).map(s => BACKEND_STATUS[s]);
  const tags = (view.tagFilter?.length ? view.tagFilter : ALL_TAGS).map(
    t => BACKEND_TAG[t],
  );
  return {
    parent_task_id: parentTaskId,
    any_of_task_status: statuses,
    any_of_task_tag: tags,
    limit: FETCH_PAGE_LIMIT,
    ...wideTaskWindow(),
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

export interface TaskSearch {
  title: string;
  statuses: Status[];
  tags: TaskTag[];
  // yyyy-MM-dd or ''. The API matches tasks lying wholly inside the range
  // (start_at >= from AND end_at <= to); an open end uses the wide window.
  from: string;
  to: string;
}

// POST /tasks/list filter for a search: top-level tasks of the view, one page.
export function buildSearchFilter(
  s: TaskSearch,
  limit: number,
  cursor?: { cursor_start_at: string; cursor_task_id: number },
): TaskFilterQuery {
  const wide = wideTaskWindow();
  const title = searchableTitle(s.title);
  return {
    ...(title ? { title_contains: title } : null),
    any_of_task_status: s.statuses.map(k => BACKEND_STATUS[k]),
    any_of_task_tag: s.tags.map(k => BACKEND_TAG[k]),
    start_at: s.from ? toTimestamp(s.from) : wide.start_at,
    end_at: s.to ? toTimestamp(s.to) : wide.end_at,
    limit,
    ...(cursor ?? {}),
  };
}
