import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAtomValue } from 'jotai';
import { tokenAtom } from '../atoms/auth';
import { withAuthRetry } from '../services/authRetry';
import {
  createInvite,
  deleteInvite,
  listInvitees,
  resendInvite,
} from '../services/eventInvitees';
import type { EventInviteeDto } from '../services/types';

// Task invitees (/invites) — read and written straight from the server, same
// shape as useTaskAlerts.ts. Per (view, task), since every route needs both.

export const inviteesKey = (viewId: number, taskId: string) =>
  ['eventInvitees', viewId, taskId] as const;

export function useEventInvitees(
  viewId: number | undefined,
  taskId: string | undefined,
) {
  const token = useAtomValue(tokenAtom);
  const numericId = taskId ? Number(taskId) : undefined;
  const enabled =
    !!token &&
    viewId !== undefined &&
    numericId !== undefined &&
    Number.isFinite(numericId);

  const query = useQuery({
    queryKey: inviteesKey(viewId ?? 0, taskId ?? ''),
    queryFn: () =>
      withAuthRetry(token, t => listInvitees(t, viewId!, numericId!)),
    enabled,
  });

  return {
    invitees: query.data ?? ([] as EventInviteeDto[]),
    isLoading: enabled && query.isPending,
    error: query.error,
  };
}

export function useEventInviteeMutations(
  viewId: number | undefined,
  taskId: string | undefined,
) {
  const token = useAtomValue(tokenAtom);
  const queryClient = useQueryClient();
  const numericId = taskId ? Number(taskId) : undefined;

  const ids = (): [number, number] => {
    if (viewId === undefined || numericId === undefined) {
      throw new Error('No view or task to invite through');
    }
    return [viewId, numericId];
  };

  const refresh = () => {
    if (viewId === undefined || taskId === undefined) {
      return;
    }
    queryClient.invalidateQueries({ queryKey: inviteesKey(viewId, taskId) });
  };

  const invite = useMutation({
    mutationFn: (email: string) => {
      const [vid, tid] = ids();
      return withAuthRetry(token, t => createInvite(t, vid, tid, email));
    },
    onSettled: refresh,
  });

  const resend = useMutation({
    mutationFn: (email: string) => {
      const [vid, tid] = ids();
      return withAuthRetry(token, t => resendInvite(t, vid, tid, email));
    },
  });

  const remove = useMutation({
    mutationFn: (email: string) => {
      const [vid, tid] = ids();
      return withAuthRetry(token, t => deleteInvite(t, vid, tid, email));
    },
    onSettled: refresh,
  });

  return {
    inviteByEmail: invite.mutateAsync,
    resendInvite: resend.mutateAsync,
    removeInvite: remove.mutateAsync,
  };
}
