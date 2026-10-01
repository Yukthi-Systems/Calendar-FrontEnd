export type Status =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'on_hold';
export type Priority = 'low' | 'medium' | 'high';
export type ViewType = 'table' | 'team' | 'kanban' | 'roadmap' | 'calendar';

// How a task repeats, anchored on its own `start` date — see
// src/data/recurrence.ts for what each one actually computes:
//   - weekly: same day of the week
//   - monthly: same date of the month
//   - quarterly: same date, every 3 months (so once per quarter)
//   - yearly: same date of the year — a Feb 29 anchor lands on Feb 28 in a
//     non-leap target year, never rolling into March
export type RecurrenceFreq = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

// A reminder fires at `time` on the day `offsetDays` before the task's start
// (0 = the start date itself). Up to 2 per task/calendar event.
export interface Reminder {
  id: string;
  offsetDays: number;
  // 'HH:mm', 24-hour.
  time: string;
}

export interface Member {
  id: string;
  name: string;
  initials: string;
  color: string;
  role: string;
  // Max number of items this person can carry at once, for the workload bar.
  capacity: number;
}

export interface WorkItem {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  // Zero or more members; [] means unassigned.
  assigneeIds: string[];
  // Whoever opened this task — the only one who can delete it. A member id
  // (see src/data/permissions.ts for how roles/permissions read this).
  createdById: string;
  // Parent task; null for top-level. Nesting is limited to MAX_DEPTH levels.
  parentId: string | null;
  // yyyy-MM-dd
  start: string;
  end: string;
  labels: string[];
  // null/[] are the common case — most tasks don't repeat or have reminders.
  recurrence: RecurrenceFreq | null;
  reminders: Reminder[];
}

export interface ProjectView {
  id: string;
  name: string;
  type: ViewType;
}

// Author fields are captured at post time rather than referencing a member id —
// the poster might be the account profile (not one of MEMBERS) or a member who's
// since changed their name/color, and a comment should keep the attribution it
// had when posted either way.
export interface Comment {
  id: string;
  itemId: string;
  // Who posted it, for edit/delete permission checks — only this id may
  // change or remove the comment (see src/data/permissions.ts).
  authorId: string;
  authorName: string;
  authorInitials: string;
  authorColor: string;
  text: string;
  // ISO timestamps.
  createdAt: string;
  editedAt?: string;
}
