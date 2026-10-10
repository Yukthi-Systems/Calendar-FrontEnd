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

// Tasks-Main-API task_status enum (RFC: PENDING/IN_PROGRESS/COMPLETED/CANCELLED/ON_HOLD).
export type BackendTaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ON_HOLD';

// GET /views/list, GET /views/get/{id} row shape.
export interface TaskViewDbDto {
  view_id: number;
  owner_id: string;
  view_name: string;
  description: string;
  // Open schema — this app stores { type, fields } (src/data/viewSync.ts).
  ui_info: Record<string, unknown> | null;
  status_filter: BackendTaskStatus[];
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
  status_filter: BackendTaskStatus[];
  show_recurring: boolean;
  show_comments: boolean;
  show_subtasks: boolean;
  show_assigned: boolean;
}

// PATCH /views/update body.
export interface UpdateTaskViewPayload extends CreateTaskViewPayload {
  view_id: number;
}

// POST /shared/create body — the caller must own view_id; user_id is who it's shared with.
export interface CreateSharedTaskViewPayload {
  view_id: number;
  user_id: string;
  share_notes: string;
  ui_info: Record<string, unknown>;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}
