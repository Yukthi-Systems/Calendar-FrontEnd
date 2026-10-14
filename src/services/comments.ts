import { apiRequest } from './apiClient';
import type { CommentDbDto } from './types';

// Tasks-Main-API /comments routes. Every one takes both a view_id (the view must
// have show_comments on) and a task_id — see docs/BACKEND.md §8.

// POST /comments/create/{view_id}/{task_id} — authored by the caller. Body is
// the raw content string, not wrapped in an object.
export const createComment = async (
  accessToken: string,
  viewId: number,
  taskId: number,
  content: string,
): Promise<void> => {
  await apiRequest(`/comments/create/${viewId}/${taskId}`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify(content),
    parseJson: false,
  });
};

// GET /comments/list/{view_id}/{task_id} — anyone who can see the task. Query
// params are mandatory server-side (offset >= 0, 1 <= limit <= 50).
export const listComments = async (
  accessToken: string,
  viewId: number,
  taskId: number,
): Promise<CommentDbDto[]> => {
  const { data } = await apiRequest<CommentDbDto[]>(
    `/comments/list/${viewId}/${taskId}?created_at_ascending=true&offset=0&limit=50`,
    { accessToken },
  );
  return data;
};

// PATCH /comments/update/{view_id}/{task_id}/{comment_id} — self-owned only;
// 404 if the comment doesn't exist or isn't the caller's. Body is the raw new
// content string.
export const updateComment = async (
  accessToken: string,
  viewId: number,
  taskId: number,
  commentId: number,
  content: string,
): Promise<void> => {
  await apiRequest(`/comments/update/${viewId}/${taskId}/${commentId}`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify(content),
    parseJson: false,
  });
};

// DELETE /comments/delete/{view_id}/{task_id}/{comment_id} — self-owned only.
export const deleteComment = async (
  accessToken: string,
  viewId: number,
  taskId: number,
  commentId: number,
): Promise<void> => {
  await apiRequest(`/comments/delete/${viewId}/${taskId}/${commentId}`, {
    method: 'DELETE',
    accessToken,
    parseJson: false,
  });
};

// PATCH /comments/react/{view_id}/{task_id}/{comment_id} — the server does a
// dumb `reactions || patch` JSONB merge, no toggling of its own, so the
// caller must compute the full desired array per emoji first (see
// useComments' react mutation) and send that as `patch`.
export const reactToComment = async (
  accessToken: string,
  viewId: number,
  taskId: number,
  commentId: number,
  patch: Record<string, string[]>,
): Promise<void> => {
  await apiRequest(`/comments/react/${viewId}/${taskId}/${commentId}`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify(patch),
    parseJson: false,
  });
};
