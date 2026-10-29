import { apiRequest } from './apiClient';
import type {
  CreateSharedTaskViewPayload,
  CreateTaskViewPayload,
  SharedTaskViewDto,
  TaskViewDbDto,
  UpdateTaskViewPayload,
} from './types';

// POST /views/create — 201 with a plain-text body, no id (ON CONFLICT DO NOTHING on
// a duplicate (owner, view_name), so a repeat name silently no-ops). Call
// listTaskViews after to resolve the created row.
export const createTaskView = async (
  accessToken: string,
  payload: CreateTaskViewPayload,
): Promise<void> => {
  await apiRequest('/views/create', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(payload),
    parseJson: false,
  });
};

// GET /views/list/{is_shared} — false: views the caller owns; true: views shared
// with the caller by someone else. No pagination (see the route's note).
export const listTaskViews = async (
  accessToken: string,
  isShared = false,
): Promise<TaskViewDbDto[]> => {
  const { data } = await apiRequest<TaskViewDbDto[]>(
    `/views/list/${isShared}`,
    { accessToken },
  );
  return data;
};

// GET /views/get/{view_id} — owned or shared-with-permission; 403/404 otherwise.
export const getTaskView = async (
  accessToken: string,
  viewId: number,
): Promise<TaskViewDbDto> => {
  const { data } = await apiRequest<TaskViewDbDto>(`/views/get/${viewId}`, {
    accessToken,
  });
  return data;
};

// PATCH /views/update — owner only; 404 if the view doesn't exist / isn't owned.
export const updateTaskView = async (
  accessToken: string,
  payload: UpdateTaskViewPayload,
): Promise<void> => {
  await apiRequest('/views/update', {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify(payload),
    parseJson: false,
  });
};

// DELETE /views/delete/{view_id} — owner only; 404 if the view doesn't exist / isn't owned.
export const deleteTaskView = async (
  accessToken: string,
  viewId: number,
): Promise<void> => {
  await apiRequest(`/views/delete/${viewId}`, {
    method: 'DELETE',
    accessToken,
    parseJson: false,
  });
};

// POST /shared/create — caller must own view_id; 400 when sharing with yourself,
// someone outside your organization, or a view you don't own.
export const createSharedTaskView = async (
  accessToken: string,
  payload: CreateSharedTaskViewPayload,
): Promise<void> => {
  await apiRequest('/shared/create', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(payload),
    parseJson: false,
  });
};

// PATCH /shared/update — same body shape as create; changes an existing share's
// notes/ui_info/permissions. Caller must own the view.
export const updateSharedTaskView = async (
  accessToken: string,
  payload: CreateSharedTaskViewPayload,
): Promise<void> => {
  await apiRequest('/shared/update', {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify(payload),
    parseJson: false,
  });
};

// DELETE /shared/delete/{view_id}/{user_id} — revokes one person's access to a
// view the caller owns.
export const deleteSharedTaskView = async (
  accessToken: string,
  viewId: number,
  userId: string,
): Promise<void> => {
  await apiRequest(`/shared/delete/${viewId}/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    accessToken,
    parseJson: false,
  });
};

// GET /shared/list/{view_id} — everyone a view the caller owns has been shared
// with. Owner only.
export const listSharedUsersForView = async (
  accessToken: string,
  viewId: number,
): Promise<SharedTaskViewDto[]> => {
  const { data } = await apiRequest<SharedTaskViewDto[]>(
    `/shared/list/${viewId}`,
    { accessToken },
  );
  return data;
};

// GET /shared/info/{view_id}/{user_id} — one share record. The owner can read
// anyone's; a shared user only their own (read from the DB, not the permission cache).
export const getSharedTaskView = async (
  accessToken: string,
  viewId: number,
  userId: string,
): Promise<SharedTaskViewDto> => {
  const { data } = await apiRequest<SharedTaskViewDto>(
    `/shared/info/${viewId}/${encodeURIComponent(userId)}`,
    { accessToken },
  );
  return data;
};

// PATCH /shared/update-shared/{view_id} — the caller's OWN ui_info on a view
// shared with them (shared_views.ui_info, not the owner's task_views row).
// Scoped server-side to (view_id, caller's own user_id) — anyone the view is
// shared with may call this for themselves, no can_create/can_edit/can_delete
// grant needed (unlike PATCH /shared/update, which only the owner may call).
export const updateMySharedViewInfo = async (
  accessToken: string,
  viewId: number,
  uiInfo: Record<string, unknown>,
): Promise<void> => {
  await apiRequest(`/shared/update-shared/${viewId}`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify({ ui_info: uiInfo }),
    parseJson: false,
  });
};
