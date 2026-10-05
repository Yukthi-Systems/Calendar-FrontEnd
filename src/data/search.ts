import type { Status, WorkItem } from './types';

export interface SearchCriteria {
  // Matched against title only (never description). Empty = no title filter.
  title: string;
  // Exactly one assignee, or null for anyone.
  assigneeId: string | null;
  // Mandatory: exactly one status.
  status: Status;
  // yyyy-MM-dd, inclusive, matched against the due date (`end`). Ignored when
  // `oldUnfinishedOnly` is set.
  dueFrom: string | null;
  dueTo: string | null;
  // Overdue tasks (due before `today`) that aren't completed or rejected.
  oldUnfinishedOnly: boolean;
}

const FINISHED: Status[] = ['completed', 'rejected'];

// Top-level tasks created by `userId` that match every criterion, earliest due
// date first. Subtasks are never returned, and descriptions are never searched.
export function searchItems(
  items: WorkItem[],
  userId: string,
  criteria: SearchCriteria,
  today: string,
): WorkItem[] {
  const title = criteria.title.trim().toLowerCase();
  return items
    .filter(i => i.parentId === null)
    .filter(i => i.createdById === userId)
    .filter(i => i.status === criteria.status)
    .filter(i => !title || i.title.toLowerCase().includes(title))
    .filter(
      i =>
        criteria.assigneeId === null ||
        i.assigneeIds.includes(criteria.assigneeId),
    )
    .filter(i => {
      if (criteria.oldUnfinishedOnly) {
        return i.end < today && !FINISHED.includes(i.status);
      }
      if (criteria.dueFrom && i.end < criteria.dueFrom) {
        return false;
      }
      if (criteria.dueTo && i.end > criteria.dueTo) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.end.localeCompare(b.end));
}
