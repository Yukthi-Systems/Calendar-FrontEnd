import { apiRequest } from './apiClient';
import type {
  CreateSharedTaskViewPayload,
  CreateTaskViewPayload,
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

// GET /views/list — every view the caller owns. No pagination (see the route's note).
export const listTaskViews = async (
  accessToken: string,
): Promise<TaskViewDbDto[]> => {
  const { data } = await apiRequest<TaskViewDbDto[]>('/views/list', {
    accessToken,
  });
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
