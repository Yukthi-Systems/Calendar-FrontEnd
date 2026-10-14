import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAtomValue } from 'jotai';
import { tokenAtom } from '../atoms/auth';
import { withAuthRetry } from '../services/authRetry';
import {
  createComment,
  deleteComment,
  listComments,
  reactToComment,
  updateComment,
} from '../services/comments';
import type { CommentDbDto } from '../services/types';

// Task comments and reactions — read straight from Tasks-Main-API (/comments) via
// TanStack Query, written straight back. No local copy: this is exactly the "comments
// used to live on-device only, which is worse than not having them" problem
// CommentsSection.tsx used to warn about, now that the backend routes are live.

export const commentsKey = (viewId: number, taskId: number) =>
  ['comments', viewId, taskId] as const;

// GET /comments/list/{view_id}/{task_id}. `enabled` lets the caller hold off
// until it actually has a real view + server-backed task to ask about.
export function useComments(viewId: number, taskId: number, enabled: boolean) {
  const token = useAtomValue(tokenAtom);
  const query = useQuery({
    queryKey: commentsKey(viewId, taskId),
    queryFn: () => withAuthRetry(token, t => listComments(t, viewId, taskId)),
    enabled: enabled && !!token,
  });
  return {
    comments: query.data ?? ([] as CommentDbDto[]),
    isLoading: query.isLoading,
    error: query.error,
  };
}

// Create / edit / delete / react, each refetching the list so reaction counts and
// edits from someone else show up too, not just the caller's own write.
export function useCommentMutations(viewId: number, taskId: number) {
  const token = useAtomValue(tokenAtom);
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: commentsKey(viewId, taskId) });

  const add = useMutation({
    mutationFn: (content: string) =>
      withAuthRetry(token, t => createComment(t, viewId, taskId, content)),
    onSettled: refresh,
  });
  const edit = useMutation({
    mutationFn: ({ commentId, content }: { commentId: number; content: string }) =>
      withAuthRetry(token, t => updateComment(t, viewId, taskId, commentId, content)),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: (commentId: number) =>
      withAuthRetry(token, t => deleteComment(t, viewId, taskId, commentId)),
    onSettled: refresh,
  });
  const react = useMutation({
    mutationFn: ({ commentId, emoji }: { commentId: number; emoji: string }) =>
      withAuthRetry(token, t => reactToComment(t, viewId, taskId, commentId, emoji)),
    onSettled: refresh,
  });

  return {
    addComment: add.mutateAsync,
    editComment: edit.mutateAsync,
    deleteComment: remove.mutateAsync,
    react: react.mutateAsync,
    isAdding: add.isPending,
  };
}
