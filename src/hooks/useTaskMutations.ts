import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { tokenAtom } from '../atoms/auth';
import { activeViewIdAtom, commentsAtom, itemsAtom, viewsAtom } from '../atoms/project';
import { createTask, deleteTask, updateTask, listTasks } from '../services/tasks';
import {
  buildTaskFilter,
  isServerTaskId,
  taskFromServer,
  taskToCreatePayload,
  taskToUpdatePayload,
} from '../data/taskSync';
import { descendantsOf } from '../data/tree';
import { isServerViewId } from '../data/viewSync';
import { TASK_CREATE_ENABLED, TASKS_API_ENABLED } from '../config/features';
import type { WorkItem } from '../data/types';

// Create/update/delete for tasks, callable from anywhere (ItemFormModal, ItemModal,
// KanbanView) — independent of useTasksSync, which only owns the list query (see
// its header comment for why they're split).
//
// Unlike this session's other write hooks (useViewsSync, useUpdateUserInfo), these
// never touch itemsAtom until the server has actually confirmed the write — and
// if a write can't be reached or is refused, the relevant function throws instead
// of keeping a local copy. A task only ever exists here because the server said
// it does; itemsAtom is populated solely by useTasksSync's fetch, and
// projectStore.ts deliberately never persists it to local storage. A task
// created, edited or deleted "locally" would have no server id, no way to
// resolve one later, and no way for the API to ever recognize it — it'd just be
// a copy this one device imagines exists. Callers (ItemFormModal, ItemModal,
// KanbanView) catch the throw and show it rather than closing as if the write
// succeeded.
export function useTaskMutations() {
  const token = useAtomValue(tokenAtom);
  const views = useAtomValue(viewsAtom);
  const activeViewId = useAtomValue(activeViewIdAtom);
  const [items, setItems] = useAtom(itemsAtom);
  const setComments = useSetAtom(commentsAtom);
  const queryClient = useQueryClient();

  const activeView = views.find(v => v.id === activeViewId);
  const viewId =
    activeView && isServerViewId(activeView.id) ? Number(activeView.id) : undefined;

  // addItem and editItem/removeItem depend on different things being enabled —
  // see TASK_CREATE_ENABLED's comment (src/config/features.ts) for why creating
  // is available on its own right now while the rest isn't.
  const canCreate = TASK_CREATE_ENABLED && !!token && viewId !== undefined;
  const canMutateExisting = TASKS_API_ENABLED && !!token && viewId !== undefined;

  const reasonCreateUnavailable = (): string => {
    if (!TASK_CREATE_ENABLED) {
      return "Tasks can't be created right now.";
    }
    if (!token) {
      return 'Sign in to create tasks.';
    }
    return "This view isn't synced to the server yet — tasks can't be created in it.";
  };
  const reasonMutateUnavailable = (): string => {
    if (!TASKS_API_ENABLED) {
      return "This can't be saved right now — this is waiting on a backend fix.";
    }
    if (!token) {
      return 'Sign in to save tasks.';
    }
    return "This view isn't synced to the server yet — tasks can't be saved to it.";
  };

  const createMutation = useMutation({
    mutationFn: (args: { viewId: number; payload: ReturnType<typeof taskToCreatePayload> }) =>
      createTask(token!, args.viewId, args.payload),
  });
  const updateMutation = useMutation({
    mutationFn: (args: { viewId: number; payload: ReturnType<typeof taskToUpdatePayload> }) =>
      updateTask(token!, args.viewId, args.payload),
  });
  const deleteMutation = useMutation({
    mutationFn: (args: { viewId: number; taskId: number }) =>
      deleteTask(token!, args.viewId, args.taskId),
  });

  const invalidate = (id: number) =>
    queryClient.invalidateQueries({ queryKey: ['tasks', id] });

  // Returns the created task's id once it can confirm one, or '' when the task
  // was saved but can't be shown/selected yet — see TASK_CREATE_ENABLED's
  // comment. A caller should treat '' as success, just with nothing (yet) to
  // navigate to; only a thrown error means the task wasn't actually created.
  const addItem = async (
    draft: Omit<WorkItem, 'id' | 'createdById'>,
  ): Promise<string> => {
    if (!canCreate || viewId === undefined || !activeView) {
      throw new Error(reasonCreateUnavailable());
    }
    await createMutation.mutateAsync({
      viewId,
      payload: taskToCreatePayload(draft),
    });
    // The create above has now genuinely happened server-side — everything
    // from here on is only about confirming and displaying it, which needs a
    // working GET /tasks/list/{view_id}. While that's broken (TASKS_API_ENABLED
    // off), there's no point even trying.
    if (!TASKS_API_ENABLED) {
      return '';
    }
    try {
      // The route returns no id (201, plain text) — (owner, parent, title) is
      // unique, so re-listing this exact level and matching by title resolves it.
      const parentTaskId = draft.parentId ? Number(draft.parentId) : undefined;
      const siblings = await listTasks(
        token!,
        viewId,
        buildTaskFilter(activeView, parentTaskId),
      );
      const created = siblings.find(t => t.title === draft.title);
      invalidate(viewId);
      if (created) {
        setItems(prev => [...prev, taskFromServer(created)]);
        return String(created.task_id);
      }
    } catch (err) {
      console.warn(
        'Task was created, but could not be confirmed/displayed yet:',
        err,
      );
    }
    return '';
  };

  const editItem = async (item: WorkItem): Promise<void> => {
    if (!canMutateExisting || viewId === undefined || !isServerTaskId(item.id)) {
      throw new Error(reasonMutateUnavailable());
    }
    await updateMutation.mutateAsync({ viewId, payload: taskToUpdatePayload(item) });
    setItems(prev => prev.map(i => (i.id === item.id ? item : i)));
    invalidate(viewId);
  };

  const removeItem = async (item: WorkItem): Promise<void> => {
    if (!canMutateExisting || viewId === undefined || !isServerTaskId(item.id)) {
      throw new Error(reasonMutateUnavailable());
    }
    await deleteMutation.mutateAsync({ viewId, taskId: Number(item.id) });
    // Cascades to every subtask server-side (ON DELETE CASCADE) — the local
    // cleanup here just mirrors that, now that it's confirmed to have happened.
    const gone = new Set([item.id, ...descendantsOf(items, item.id).map(d => d.id)]);
    setItems(prev => prev.filter(i => !gone.has(i.id)));
    setComments(prev => prev.filter(c => !gone.has(c.itemId)));
    invalidate(viewId);
  };

  return {
    addItem,
    editItem,
    removeItem,
    // Governs the Assignees field's read-only display (assigning is never
    // settable via this API, whichever flag is in play) — true whenever this
    // task is, or would be, a server-backed one at all.
    isServerBacked: viewId !== undefined,
    canCreate,
    // Why editing/deleting an existing task is unavailable right now — null when
    // it isn't. Creating has its own reasonCreateUnavailable(); a caller asks
    // for whichever one applies to what it's about to do.
    unavailableReason: !canMutateExisting ? reasonMutateUnavailable() : null,
  };
}
