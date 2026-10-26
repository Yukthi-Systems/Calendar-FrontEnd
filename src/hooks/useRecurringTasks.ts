import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAtomValue } from 'jotai';
import { tokenAtom } from '../atoms/auth';
import { withAuthRetry } from '../services/authRetry';
import {
  createRecurringTask,
  deleteRecurringTask,
  listRecurringTasks,
  updateRecurringTask,
} from '../services/recurringTasks';
import {
  allTemplateTags,
  templateFromServer,
  templateToCreatePayload,
  templateToUpdatePayload,
  type RecurringTemplate,
} from '../data/recurringTemplate';
import { BACKEND_TAG } from '../data/constants';
import type { ProjectView } from '../data/types';

// Recurring task templates (/recurring) — read and written straight from the
// server, same "no local copy" shape as useViews.ts. Scoped to one view, same as
// /tasks: the view's own show_recurring/can_* and task_tag_filter gate what's
// allowed, enforced server-side.

export const templatesKey = (viewId: string) => ['recurringTasks', viewId] as const;

export function useRecurringTasks(view: ProjectView | undefined) {
  const token = useAtomValue(tokenAtom);
  const viewId = view ? Number(view.id) : undefined;

  const enabled = !!token && viewId !== undefined;
  const query = useQuery({
    queryKey: templatesKey(view?.id ?? ''),
    queryFn: () =>
      withAuthRetry(token, t => listRecurringTasks(t, viewId!, allTemplateTags(view))),
    enabled,
  });

  return {
    templates: (query.data ?? []).map(templateFromServer),
    // `enabled && isPending`, not `isLoading`: see useTasksSync.ts's identical
    // comment — plain `isLoading` stays false for the one render where this
    // query has just flipped from disabled to enabled (e.g. the view first
    // resolving), which briefly showed "No recurring templates" instead of a
    // skeleton.
    isLoading: enabled && query.isPending,
    error: query.error,
    enabled: viewId !== undefined,
  };
}

export type TemplateDraft = Omit<RecurringTemplate, 'id' | 'ownerId' | 'createdAt'>;

export function useRecurringTaskMutations(view: ProjectView | undefined) {
  const token = useAtomValue(tokenAtom);
  const queryClient = useQueryClient();
  const viewId = view ? Number(view.id) : undefined;
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: templatesKey(view?.id ?? '') });

  const ensure = () => {
    if (viewId === undefined) {
      throw new Error('This view isn’t synced to the server yet.');
    }
    return viewId;
  };

  const create = useMutation({
    mutationFn: (draft: TemplateDraft) =>
      withAuthRetry(token, t =>
        createRecurringTask(t, ensure(), templateToCreatePayload(draft)),
      ),
    onSettled: refresh,
  });
  const update = useMutation({
    mutationFn: (t: Omit<RecurringTemplate, 'ownerId' | 'createdAt'>) =>
      withAuthRetry(token, tok =>
        updateRecurringTask(tok, ensure(), templateToUpdatePayload(t)),
      ),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: (t: Pick<RecurringTemplate, 'id' | 'tag'>) =>
      withAuthRetry(token, tok =>
        deleteRecurringTask(tok, ensure(), Number(t.id), BACKEND_TAG[t.tag]),
      ),
    onSettled: refresh,
  });

  return {
    createTemplate: create.mutateAsync,
    updateTemplate: update.mutateAsync,
    deleteTemplate: remove.mutateAsync,
  };
}
