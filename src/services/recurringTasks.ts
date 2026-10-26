import { apiRequest } from './apiClient';
import type {
  BackendTaskTag,
  CreateRecurringTaskPayload,
  RecurringTaskDto,
  UpdateRecurringTaskPayload,
} from './types';

// Wrappers for Tasks-Main-API's /recurring/* — recurring_tasks rows are templates
// (title/description/tag/RRULE only, no anchor date or start/end) and a separate
// concept from a task's own `recurrence` field (src/data/rrule.ts), which already
// covers single-task repeats end to end. The "Recurring tasks" screen
// (RecurringTasksView.tsx, via hooks/useRecurringTasks.ts) manages this library —
// create/edit/delete a template. The backend doesn't generate real tasks rows from
// one on any schedule; that's still a future feature, not this one.

// POST /recurring/create/{view_id} — needs show_recurring + can_create on the view,
// and the view's task_tag_filter (if any) must allow the given tag.
export const createRecurringTask = async (
  accessToken: string,
  viewId: number,
  payload: CreateRecurringTaskPayload,
): Promise<void> => {
  await apiRequest(`/recurring/create/${viewId}`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify(payload),
    parseJson: false,
  });
};

// PATCH /recurring/update/{view_id} — needs show_recurring + can_edit on the view.
export const updateRecurringTask = async (
  accessToken: string,
  viewId: number,
  payload: UpdateRecurringTaskPayload,
): Promise<void> => {
  await apiRequest(`/recurring/update/${viewId}`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify(payload),
    parseJson: false,
  });
};

// DELETE /recurring/delete/{view_id}/{recurring_task_id}/{task_tag} — needs
// show_recurring + can_delete on the view; task_tag is the template's own tag
// (part of its lookup key, alongside owner + id).
export const deleteRecurringTask = async (
  accessToken: string,
  viewId: number,
  recurringTaskId: number,
  taskTag: BackendTaskTag,
): Promise<void> => {
  await apiRequest(
    `/recurring/delete/${viewId}/${recurringTaskId}/${taskTag}`,
    { method: 'DELETE', accessToken, parseJson: false },
  );
};

// GET /recurring/info/{view_id}/{recurring_task_id}/{task_tag} — needs show_recurring.
export const getRecurringTask = async (
  accessToken: string,
  viewId: number,
  recurringTaskId: number,
  taskTag: BackendTaskTag,
): Promise<RecurringTaskDto> => {
  const { data } = await apiRequest<RecurringTaskDto>(
    `/recurring/info/${viewId}/${recurringTaskId}/${taskTag}`,
    { accessToken },
  );
  return data;
};

// POST /recurring/list/{view_id} — needs show_recurring; the view's
// task_tag_filter (if any) must allow every tag asked for. Body is the tag list
// as a bare JSON array (Vec<TaskTag>, not wrapped in an object) — this used to be
// GET with the tags as a query string, which could never work (a bare
// web::Query<Vec<TaskTag>> can't bind an array in any encoding — the same class
// of bug /tasks/list had; fixed there the same way, by moving to a JSON body).
export const listRecurringTasks = async (
  accessToken: string,
  viewId: number,
  taskTags: BackendTaskTag[],
): Promise<RecurringTaskDto[]> => {
  const { data } = await apiRequest<RecurringTaskDto[]>(
    `/recurring/list/${viewId}`,
    { method: 'POST', accessToken, body: JSON.stringify(taskTags) },
  );
  return data;
};
