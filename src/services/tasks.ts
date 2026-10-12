import { apiRequest } from './apiClient';
import type {
  CreateTaskPayload,
  TaskFilterQuery,
  TaskInfoDto,
  UpdateTaskPayload,
} from './types';

const qs = (params: Record<string, string | number | undefined>) => {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }
    parts.push(`${key}=${encodeURIComponent(value)}`);
  }
  return parts.join('&');
};

// POST /tasks/create/{view_id} — permission + tag/status/subtask rules enforced
// server-side against the view (403 when they don't hold).
export const createTask = async (
  accessToken: string,
  viewId: number,
  payload: CreateTaskPayload,
): Promise<void> => {
  await apiRequest(`/tasks/create/${viewId}`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify(payload),
    parseJson: false,
  });
};

// PATCH /tasks/update/{view_id} — owner or creator only; replaces every editable
// field (no partial patch), so callers must send the task's current values merged
// with their change.
export const updateTask = async (
  accessToken: string,
  viewId: number,
  payload: UpdateTaskPayload,
): Promise<void> => {
  await apiRequest(`/tasks/update/${viewId}`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify(payload),
    parseJson: false,
  });
};

// DELETE /tasks/delete/{view_id}/{task_id} — owner or creator only; cascades to
// every subtask (ON DELETE CASCADE), so one call is enough for a whole subtree.
export const deleteTask = async (
  accessToken: string,
  viewId: number,
  taskId: number,
): Promise<void> => {
  await apiRequest(`/tasks/delete/${viewId}/${taskId}`, {
    method: 'DELETE',
    accessToken,
    parseJson: false,
  });
};

// GET /tasks/get/{view_id}/{task_id} — 403 unless the caller is the task's owner,
// creator or an assignee, and the view's tag/status/subtask rules allow it.
export const getTask = async (
  accessToken: string,
  viewId: number,
  taskId: number,
): Promise<TaskInfoDto> => {
  const { data } = await apiRequest<TaskInfoDto>(
    `/tasks/get/${viewId}/${taskId}`,
    { accessToken },
  );
  return data;
};

// GET /tasks/list/{view_id} — one page (filter.limit, 10-100) of root tasks, or of
// one parent's direct children when filter.parent_task_id is set. Ordered by
// (start_at, task_id); page again with filter.cursor_start_at/cursor_task_id set
// to the last row's values once a page comes back full.
export const listTasks = async (
  accessToken: string,
  viewId: number,
  filter: TaskFilterQuery,
): Promise<TaskInfoDto[]> => {
  const query = qs({
    parent_task_id: filter.parent_task_id,
    title_contains: filter.title_contains,
    start_at: filter.start_at,
    end_at: filter.end_at,
    cursor_start_at: filter.cursor_start_at,
    cursor_task_id: filter.cursor_task_id,
    limit: filter.limit,
  });
  const statusParams = filter.any_of_task_status
    .map(s => `any_of_task_status=${s}`)
    .join('&');
  const tagParams = filter.any_of_task_tag
    .map(t => `any_of_task_tag=${t}`)
    .join('&');
  const { data } = await apiRequest<TaskInfoDto[]>(
    `/tasks/list/${viewId}?${[query, statusParams, tagParams].filter(Boolean).join('&')}`,
    { accessToken },
  );
  return data;
};
