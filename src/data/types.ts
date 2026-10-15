export type Status =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'on_hold';
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
  // Required by Tasks-Main-API (task_tag column, NOT NULL) once a task is
  // server-backed; defaults to 'other' for anything created before this existed.
  tag: TaskTag;
  // Zero or more members; [] means unassigned. Changed via useTaskMutations'
  // assignUser/unassignUser (POST/DELETE /assignees/*), not by editing the task
  // itself — see ItemFormModal.
  assigneeIds: string[];
  // Whoever opened this task — the only one who can delete it. A member id
  // (the server enforces what each role may do — docs/BACKEND.md §4).
  createdById: string;
  // Parent task; null for top-level. Nesting is limited to MAX_DEPTH levels.
  parentId: string | null;
  // Direct children this task has on the server, whether or not they're loaded
  // into the items list right now (tasks load lazily — see useTasksSync's header
  // comment) — the only reliable way to know a task has subtasks before fetching
  // them. 0 for a purely local item. See hasSubtasks/subtaskProgress (src/data/tree.ts).
  totalSubtasks: number;
  // yyyy-MM-dd (local)
  start: string;
  end: string;
  // 'HH:mm' (local), or null for an all-day date — every task saved before times
  // existed. See toTimestamp/fromTimestamp in src/data/taskSync.ts.
  startTime: string | null;
  endTime: string | null;
  // null/[] are the common case — most tasks don't repeat or have reminders.
  recurrence: string | null;
  reminders: Reminder[];
}

// Optional per-field toggles for the Table and Calendar layouts (the task title
// is always shown). Undefined means every field for that layout is shown.
export type ViewField =
  | 'status'
  | 'assignee'
  | 'start'
  | 'end';

export interface ProjectView {
  // The server's view_id (numeric string) — every view is a Tasks-Main-API row.
  id: string;
  // Who owns it; `shared` = someone else shared it with me (GET /views/list/true),
  // so only its owner can edit, delete or share it.
  ownerId: string;
  shared: boolean;
  name: string;
  type: ViewType;
  description?: string;
  fields?: ViewField[];
  // Tasks-Main-API's task_views filters. The server enforces them on every task
  // call made through this view. Empty/undefined = every status / every tag.
  // showSubtasks off ⇒ the server refuses subtask list/create/edit in this view.
  statusFilter?: Status[];
  tagFilter?: TaskTag[];
  showRecurring?: boolean;
  showComments?: boolean;
  showSubtasks?: boolean;
  showAssigned?: boolean;
}

