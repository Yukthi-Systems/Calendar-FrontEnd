import { apiRequest } from './apiClient';
import type { CommentDbDto } from './types';

// Tasks-Main-API /comments routes. Every one takes both a view_id (the view must
// have show_comments on) and a task_id — see docs/BACKEND.md §8.

// POST /comments/create/{view_id}/{task_id} — authored by the caller.
export const createComment = async (
  accessToken: string,
  viewId: number,
  taskId: number,
  content: string,
): Promise<void> => {
  await apiRequest(`/comments/create/${viewId}/${taskId}`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify({ content }),
    parseJson: false,
  });
};

// GET /comments/list/{view_id}/{task_id} — anyone who can see the task, oldest first.
export const listComments = async (
  accessToken: string,
  viewId: number,
  taskId: number,
): Promise<CommentDbDto[]> => {
  const { data } = await apiRequest<CommentDbDto[]>(
    `/comments/list/${viewId}/${taskId}`,
    { accessToken },
  );
  return data;
};

// PATCH /comments/update/{view_id}/{task_id}/{comment_id} — self-owned only;
// 404 if the comment doesn't exist or isn't the caller's.
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
    body: JSON.stringify({ content }),
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

// PATCH /comments/react/{view_id}/{task_id}/{comment_id} — toggles the caller's
// reaction with `emoji` (any visible comment, not just the caller's own).
// Returns the comment's full, updated reaction map.
export const reactToComment = async (
  accessToken: string,
  viewId: number,
  taskId: number,
  commentId: number,
  emoji: string,
): Promise<Record<string, string[]>> => {
  const { data } = await apiRequest<Record<string, string[]>>(
    `/comments/react/${viewId}/${taskId}/${commentId}`,
    {
      method: 'PATCH',
      accessToken,
      body: JSON.stringify({ emoji }),
    },
  );
  return data;
};
