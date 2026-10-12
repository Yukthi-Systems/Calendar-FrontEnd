// `user_info` from YCT-Mesh-API. /auth/login returns every field; /auth/refresh and
// /auth/session return a subset, so callers merge onto the previous value.
export interface BackendUserInfo {
  email: string;
  user_id?: string;
  first_name?: string;
  last_name?: string;
  is_external_sharing_enabled?: boolean;
  domain_name?: string;
  organization_id?: string;
  organization_name?: string;
  enable_file_sharing?: boolean;
  file_size_limit_mb?: number;
  enable_group_chat?: boolean;
  enable_direct_chat?: boolean;
  quota_allocated?: number;
  quota_utilized?: number;
}

// Optional profile fields the SSO service may hand back alongside a login.
export interface SsoProfile {
  first_name?: string;
  last_name?: string;
  phone?: string;
  two_factor_methods?: string[];
}

export interface AuthPayload {
  access_token: string;
  refresh_token?: string;
  // Seconds until the access token expires.
  expires_in?: number;
  user_info: BackendUserInfo;
  sso_profile?: SsoProfile;
}

export interface SsoAuthResponse {
  data: AuthPayload;
}

// Tasks-Main-API /sample_db/* — `id` is omitted when creating.
export interface Note {
  id?: number | null;
  title: string;
  content: string;
}

// Tasks-Main-API GET /user/info/{user_id}. `private_info` is present only when the
// requested user is the caller; other users in the same organization get the public subset.
export interface UserInfoResponse {
  user_id: string;
  email: string;
  domain: string;
  organization_id: string;
  organization_name: string;
  public_info: Record<string, unknown>;
  private_info?: Record<string, unknown>;
  is_external_sharing_enabled: boolean;
  created_at: string;
}

// Tasks-Main-API GET /user/search result row.
export interface UserSearchResult {
  user_id: string;
  email: string;
  domain: string;
  public_info: Record<string, unknown>;
  created_at: string;
}

// Tasks-Main-API task_status enum, as it comes back in a response (read straight
// off the Postgres enum column, e.g. TaskInfoDto.task_status, TaskViewDbDto.status_filter
// — SCREAMING_SNAKE_CASE, matching the DB's own `task_status` values).
export type BackendTaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ON_HOLD';

// The SAME enum, but as a request has to spell it for the API to accept it.
// features::task_views::model::TaskStatus derives plain serde Deserialize with no
// #[serde(rename_all/rename)], so it matches only its literal Rust variant names —
// PascalCase — never the SCREAMING_SNAKE_CASE a response reads back. Sending
// BackendTaskStatus's casing in a request body/query 400s with "unknown variant
// `PENDING`, expected one of `Pending`, `InProgress`, …". Used only by the request
// payload types below; BACKEND_STATUS_WIRE (src/data/constants.ts) builds them.
export type BackendTaskStatusWire =
  | 'Pending'
  | 'InProgress'
  | 'Completed'
  | 'Cancelled'
  | 'OnHold';

// Tasks-Main-API task_tag enum, as it comes back in a response — see
// BackendTaskStatus above; the same read/write casing split applies here too.
export type BackendTaskTag =
  | 'WORK'
  | 'IMPORTANT'
  | 'URGENT'
  | 'OPTIONAL'
  | 'PERSONAL'
  | 'OTHER';

// task_tag's write-side spelling — see BackendTaskStatusWire.
export type BackendTaskTagWire =
  | 'Work'
  | 'Important'
  | 'Urgent'
  | 'Optional'
  | 'Personal'
  | 'Other';

// GET /views/list/{is_shared}, GET /views/get/{id} row shape.
export interface TaskViewDbDto {
  view_id: number;
  owner_id: string;
  view_name: string;
  description: string;
  // Open schema — this app stores { type, fields } (src/data/viewSync.ts).
  ui_info: Record<string, unknown> | null;
  status_filter: BackendTaskStatus[];
  task_tag_filter: BackendTaskTag[];
  show_recurring: boolean;
  show_comments: boolean;
  show_subtasks: boolean;
  show_assigned: boolean;
}

// POST /views/create body. The route returns no id — list again to resolve it.
export interface CreateTaskViewPayload {
  view_name: string;
  description: string;
  ui_info: Record<string, unknown>;
  status_filter: BackendTaskStatusWire[];
  task_tag_filter: BackendTaskTagWire[];
  show_recurring: boolean;
  show_comments: boolean;
  show_subtasks: boolean;
  show_assigned: boolean;
}

// PATCH /views/update body.
export interface UpdateTaskViewPayload extends CreateTaskViewPayload {
  view_id: number;
}

// POST /shared/create and PATCH /shared/update body (same shape — update just
// re-sends it for the same view_id/user_id pair). The caller must own view_id.
export interface CreateSharedTaskViewPayload {
  view_id: number;
  user_id: string;
  share_notes: string;
  ui_info: Record<string, unknown>;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

// GET /shared/list/{view_id}, GET /shared/info/{view_id}/{user_id} row shape.
export interface SharedTaskViewDto {
  view_id: number;
  user_id: string;
  share_notes: string;
  ui_info: Record<string, unknown>;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  shared_at: string;
}

// GET /tasks/get, GET /tasks/list/{view_id} row shape.
export interface TaskInfoDto {
  task_id: number;
  parent_task_id: number | null;

  owner_id: string;
  created_by: string | null;
  assignee_ids: string[];

  title: string;
  description: string;
  // Open schema — this app stores { priority, labels, recurrence, reminders }
  // (src/data/taskSync.ts), the fields the backend has no column for.
  details: Record<string, unknown>;

  task_status: BackendTaskStatus;
  task_tag: BackendTaskTag;

  start_at: string;
  end_at: string;

  created_at: string;
  updated_at: string;
}

// POST /tasks/create/{view_id} body.
export interface CreateTaskPayload {
  parent_task_id: number | null;
  title: string;
  description: string;
  details: Record<string, unknown>;
  task_status: BackendTaskStatusWire;
  task_tag: BackendTaskTagWire;
  start_at: string;
  end_at: string;
}

// PATCH /tasks/update/{view_id} body.
export interface UpdateTaskPayload {
  task_id: number;
  title: string;
  description: string;
  details: Record<string, unknown>;
  task_status: BackendTaskStatusWire;
  task_tag: BackendTaskTagWire;
  start_at: string;
  end_at: string;
}

// GET /tasks/list/{view_id} query (TaskFilterDto). status/tag lists must be
// non-empty — the API has no "every value" shorthand, so the caller always
// spells every allowed value out (see buildTaskFilter in src/data/taskSync.ts).
export interface TaskFilterQuery {
  parent_task_id?: number;
  title_contains?: string;
  any_of_task_status: BackendTaskStatusWire[];
  any_of_task_tag: BackendTaskTagWire[];
  start_at: string;
  end_at: string;
  cursor_start_at?: string;
  cursor_task_id?: number;
  limit: number;
}

// recurring_tasks row — a template with no anchor date or start/end, only a
// title/description/tag and an RFC 5545 rule (no DTSTART; see services/recurringTasks.ts).
export interface RecurringTaskDto {
  recurring_task_id: number;
  owner_id: string;
  title: string;
  description: string;
  details: Record<string, unknown>;
  rrule: string;
  task_tag: BackendTaskTag;
  created_at: string;
}

export interface CreateRecurringTaskPayload {
  title: string;
  description: string;
  details: Record<string, unknown>;
  rrule: string;
  task_tag: BackendTaskTagWire;
}

export interface UpdateRecurringTaskPayload {
  recurring_task_id: number;
  title: string;
  description: string;
  details: Record<string, unknown>;
  rrule: string;
  task_tag: BackendTaskTagWire;
}
