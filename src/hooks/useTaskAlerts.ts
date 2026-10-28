import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAtomValue } from 'jotai';
import { tokenAtom } from '../atoms/auth';
import { withAuthRetry } from '../services/authRetry';
import {
  createTaskAlert,
  deleteTaskAlert,
  editTaskAlert,
  listAllTaskAlerts,
  listTaskAlerts,
} from '../services/taskAlerts';
import type { TaskAlertDto } from '../services/types';

// Task Alerts (/alerts) — read and written straight from the server, same
// "no local copy" shape as useRecurringTasks.ts. Entirely self-scoped, no
// view_id anywhere (see taskAlerts.ts's header comment) — the query keys
// below reflect that: per-task and "every alert of mine" are the only two
// shapes, nothing view-scoped in between.

export const taskAlertsKey = (taskId: string) =>
  ['taskAlerts', taskId] as const;
export const allTaskAlertsKey = ['taskAlerts', 'all'] as const;

// This task's own alerts (ItemModal's "Alerts" section) — soonest first.
export function useTaskAlerts(taskId: string | undefined) {
  const token = useAtomValue(tokenAtom);
  const numericId = taskId ? Number(taskId) : undefined;
  const enabled =
    !!token && numericId !== undefined && Number.isFinite(numericId);

  const query = useQuery({
    queryKey: taskAlertsKey(taskId ?? ''),
    queryFn: () => withAuthRetry(token, t => listTaskAlerts(t, numericId!)),
    enabled,
  });

  return {
    alerts: query.data ?? ([] as TaskAlertDto[]),
    isLoading: enabled && query.isPending,
    error: query.error,
  };
}

// Every alert across every task (the left-menu Alerts screen) — soonest
// first. No task title/tag comes back with these (the server doesn't join
// them in) — the screen resolves what it can from already-loaded tasks and
// falls back to "Task #<id>" for the rest.
export function useAllTaskAlerts() {
  const token = useAtomValue(tokenAtom);
  const enabled = !!token;

  const query = useQuery({
    queryKey: allTaskAlertsKey,
    queryFn: () => withAuthRetry(token, t => listAllTaskAlerts(t)),
    enabled,
  });

  return {
    alerts: query.data ?? ([] as TaskAlertDto[]),
    isLoading: enabled && query.isPending,
    error: query.error,
  };
}

export interface AlertDraft {
  taskId: number;
  alertAt: string;
  notifyViaEmail: boolean;
  notifyViaPush: boolean;
}

export interface AlertEdit {
  taskId: number;
  currentAlertAt: string;
  newAlertAt: string;
  notifyViaEmail: boolean;
  notifyViaPush: boolean;
}

// Not bound to one task — the Alerts screen edits/deletes across whichever
// tasks its rows belong to, so every mutation here takes its own taskId
// rather than closing over a fixed one. Every write invalidates both that
// task's own list and the global one, since either screen could be open.
export function useTaskAlertMutations() {
  const token = useAtomValue(tokenAtom);
  const queryClient = useQueryClient();

  const refresh = (taskId: number) => {
    queryClient.invalidateQueries({ queryKey: taskAlertsKey(String(taskId)) });
    queryClient.invalidateQueries({ queryKey: allTaskAlertsKey });
  };

  const create = useMutation({
    mutationFn: (draft: AlertDraft) =>
      withAuthRetry(token, t =>
        createTaskAlert(t, draft.taskId, {
          alertAt: draft.alertAt,
          notifyViaEmail: draft.notifyViaEmail,
          notifyViaPush: draft.notifyViaPush,
        }),
      ),
    onSettled: (_data, _err, draft) => refresh(draft.taskId),
  });

  const edit = useMutation({
    mutationFn: (e: AlertEdit) =>
      withAuthRetry(token, t =>
        editTaskAlert(t, e.taskId, {
          currentAlertAt: e.currentAlertAt,
          newAlertAt: e.newAlertAt,
          notifyViaEmail: e.notifyViaEmail,
          notifyViaPush: e.notifyViaPush,
        }),
      ),
    onSettled: (_data, _err, e) => refresh(e.taskId),
  });

  const remove = useMutation({
    mutationFn: ({ taskId, alertAt }: { taskId: number; alertAt: string }) =>
      withAuthRetry(token, t => deleteTaskAlert(t, taskId, alertAt)),
    onSettled: (_data, _err, v) => refresh(v.taskId),
  });

  return {
    createAlert: create.mutateAsync,
    editAlert: edit.mutateAsync,
    deleteAlert: remove.mutateAsync,
  };
}
