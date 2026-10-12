import { apiRequest } from './apiClient';

export interface AssignUserPayload {
  task_id: number;
  assignee_id: string;
}

// POST /assignees/create/{view_id} — adds one assignee to a task. There is no
// bulk form and no remove/list endpoint live yet (routes/task_assignees.rs has
// remove_user/list_assignees commented out) — assignees can only ever be added
// here, one call per person, never removed through the API.
//
// Needs can_edit on the view (not can_create, despite being additive), and the
// view's status_filter/task_tag_filter (if set) must allow the task's current
// status/tag; a subtask also needs show_subtasks. Both the assignee and the
// task's owner must be in the caller's organization — silently 404s
// ("Failed to assign user to task") otherwise, same as a real "not found".
// Assigning yourself is rejected (403) before any of that is even checked.
export const assignUserToTask = async (
  accessToken: string,
  viewId: number,
  payload: AssignUserPayload,
): Promise<void> => {
  await apiRequest(`/assignees/create/${viewId}`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify(payload),
    parseJson: false,
  });
};
