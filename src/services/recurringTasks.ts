import { apiRequest } from './apiClient';
import type {
  BackendTaskTag,
  CreateRecurringTaskPayload,
  RecurringTaskDto,
  UpdateRecurringTaskPayload,
} from './types';

// Wrappers for Tasks-Main-API's /recurring/* — recurring_tasks rows are templates
// (title/description/tag/RRULE only, no anchor date or start/end; "UI will use
// this to generate a task", per the schema's own comment) and are a separate
// concept from a task's own `recurrence` field (src/data/rrule.ts), which already
// covers single-task repeats end to end. Nothing in the UI calls these yet — nothing
// in this app manages a library of reusable recurrence templates or generates task
// rows from one, which is its own feature, not a prerequisite for /tasks.

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

// GET /recurring/list/{view_id} — needs show_recurring; the view's task_tag_filter
// (if any) must allow every tag asked for. The route takes the tag list as a bare
// `web::Query<Vec<TaskTag>>` with no wrapping struct — the same shape that made
// the old GET /user/search reject every call (web::Query<String> couldn't bind a
// bare query string either; see that earlier fix request). This sends the
// conventional repeated-key form (?task_tag=WORK&task_tag=URGENT); if the route
// has the same binding bug, every call 400s regardless of what's sent here.
export const listRecurringTasks = async (
  accessToken: string,
  viewId: number,
  taskTags: BackendTaskTag[],
): Promise<RecurringTaskDto[]> => {
  const query = taskTags.map(t => `task_tag=${t}`).join('&');
  const { data } = await apiRequest<RecurringTaskDto[]>(
    `/recurring/list/${viewId}${query ? `?${query}` : ''}`,
    { accessToken },
  );
  return data;
};
