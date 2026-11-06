import type { TaskQuickFilter, WorkItem } from './types';

// How many separate things the quick filter is narrowing by; a due date range
// counts as one.
export const taskFilterCount = (f: TaskQuickFilter) =>
  f.statuses.length +
  f.tags.length +
  f.assigneeIds.length +
  (f.dueFrom || f.dueTo ? 1 : 0);

// Whether this task, judged on its own fields, passes the quick filter.
export const passesTaskFilter = (i: WorkItem, f: TaskQuickFilter) =>
  (f.statuses.length === 0 || f.statuses.includes(i.status)) &&
  (f.tags.length === 0 || f.tags.includes(i.tag)) &&
  (f.assigneeIds.length === 0 ||
    i.assigneeIds.some(id => f.assigneeIds.includes(id))) &&
  (!f.dueFrom || i.end >= f.dueFrom) &&
  (!f.dueTo || i.end <= f.dueTo);
