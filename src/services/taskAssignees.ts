import { apiRequest } from './apiClient';

export interface AssignUserPayload {
  task_id: number;
  assignee_id: string;
}

// POST /assignees/create/{view_id} — adds one assignee to a task; no bulk form,
// one call per person. Anyone who can already act on the task (owner, creator,
// or an existing assignee) can assign someone else to it. Both the assignee and
// the task's owner must be in the caller's organization — silently 404s
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

// DELETE /assignees/remove/{view_id} — removes one assignee from a task; no
// bulk form here either. Stricter than assigning: only the task's owner or
// creator can remove someone (an assignee who isn't also the owner/creator
// can add others but can't remove anyone, including themselves — nobody can
// remove themselves, 403, regardless of role).
export const removeUserFromTask = async (
  accessToken: string,
  viewId: number,
  payload: AssignUserPayload,
): Promise<void> => {
  await apiRequest(`/assignees/remove/${viewId}`, {
    method: 'DELETE',
    accessToken,
    body: JSON.stringify(payload),
    parseJson: false,
  });
};
