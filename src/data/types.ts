export type Status =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'on_hold';
export type Priority = 'low' | 'medium' | 'high';
export type ViewType = 'table' | 'kanban' | 'roadmap' | 'calendar';

// Mirrors Tasks-Main-API's task_tag enum — every task will need one once /tasks is
// integrated, and a view can restrict itself to a subset (src/data/constants.ts
// has the display labels/colors and the BACKEND_TAG mapping).
export type TaskTag =
  | 'work'
  | 'important'
  | 'urgent'
  | 'optional'
  | 'personal'
  | 'other';

// How a task repeats: an RFC 5545 RRULE value (e.g. "FREQ=WEEKLY;BYDAY=MO,FR"),
// anchored on the task's own `start` date. See src/data/rrule.ts for the parser,
// writer and expander. Tasks saved before RRULE support held 'weekly' | 'monthly'
// | 'quarterly' | 'yearly'; those are migrated on load (migrateRecurrence).
// Feb 29 / day-31 anchors without an explicit BYMONTHDAY clamp to the month's last
// day rather than rolling over or being skipped.

// A reminder fires at `time` on the day `offsetDays` before the task's start
// (0 = the start date itself). Up to 2 per task/calendar event.
export interface Reminder {
  id: string;
  offsetDays: number;
  // 'HH:mm', 24-hour.
  time: string;
}

export interface WorkItem {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  // Required by Tasks-Main-API (task_tag column, NOT NULL) once a task is
  // server-backed; defaults to 'other' for anything created before this existed.
  tag: TaskTag;
  // Zero or more members; [] means unassigned. Changed via useTaskMutations'
  // assignUser/unassignUser (POST/DELETE /assignees/*), not by editing the task
  // itself — see ItemFormModal.
  assigneeIds: string[];
  // Whoever opened this task — the only one who can delete it. A member id
  // (see src/data/permissions.ts for how roles/permissions read this).
  createdById: string;
  // Parent task; null for top-level. Nesting is limited to MAX_DEPTH levels.
  parentId: string | null;
  // Direct children this task has on the server, whether or not they're loaded
  // into the items list right now (tasks load lazily — see useTasksSync's header
  // comment) — the only reliable way to know a task has subtasks before fetching
  // them. 0 for a purely local item. See hasSubtasks/subtaskProgress (src/data/tree.ts).
  totalSubtasks: number;
  // yyyy-MM-dd
  start: string;
  end: string;
  labels: string[];
  // null/[] are the common case — most tasks don't repeat or have reminders.
  recurrence: string | null;
  reminders: Reminder[];
}

// Optional per-field toggles for the Table and Calendar layouts (the task title
// is always shown). Undefined means every field for that layout is shown.
export type ViewField =
  | 'id'
  | 'status'
  | 'assignee'
  | 'priority'
  | 'start'
  | 'end';

export interface ProjectView {
  id: string;
  name: string;
  type: ViewType;
  description?: string;
  fields?: ViewField[];
  // Mirrors Tasks-Main-API's task_views row (status_filter/show_*) so a view is
  // ready to actually filter once the /tasks API exists — inert until then.
  // Empty/undefined statusFilter/tagFilter means "every status"/"every tag".
  statusFilter?: Status[];
  tagFilter?: TaskTag[];
  showRecurring?: boolean;
  showComments?: boolean;
  showSubtasks?: boolean;
  showAssigned?: boolean;
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
