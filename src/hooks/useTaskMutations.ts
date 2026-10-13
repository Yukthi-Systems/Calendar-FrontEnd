import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { tokenAtom } from '../atoms/auth';
import { activeViewIdAtom, commentsAtom, itemsAtom, viewsAtom } from '../atoms/project';
import { createTask, deleteTask, updateTask, listTasks } from '../services/tasks';
import { assignUserToTask, removeUserFromTask } from '../services/taskAssignees';
import { drainPages } from './useTasksSync';
import {
  buildTaskFilter,
  isServerTaskId,
  taskFromServer,
  taskToCreatePayload,
  taskToUpdatePayload,
} from '../data/taskSync';
import { MAX_DEPTH, descendantsOf, hasSubtasks } from '../data/tree';
import { isServerViewId } from '../data/viewSync';
import { TASKS_API_ENABLED } from '../config/features';
import { withAuthRetry } from '../services/authRetry';
import type { WorkItem } from '../data/types';
import type { TaskInfoDto } from '../services/types';

// Create/update/delete for tasks, callable from anywhere (ItemFormModal, ItemModal,
// KanbanView) — independent of useTasksSync, which only owns the list query (see
// its header comment for why they're split).
//
// Unlike useViewsSync (still to be reworked — docs/BACKEND.md chunk B), these
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
//
// These deliberately do NOT invalidate useTasksSync's ['tasks', …] query after a
// write — that would mark it stale and (being an active query) trigger an
// immediate background refetch, and since the API has no "give me a task and its
// whole subtree" endpoint, that fetch re-lists every level of the tree one call
// at a time (see useTasksSync's own header comment): one POST
// /tasks/list/{view_id} per node that might have children, all over again, for a
// write that only touched one task. That's the burst of near-identical requests
// you'd see in the network tab after a single create. Instead, patchTaskCache
// below edits that query's cached array directly — same end state (itemsAtom and
// the cache agree, so switching away and back to this view within the cache's
// staleTime still shows the write), zero extra requests.
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
  const canMutate = TASKS_API_ENABLED && !!token && viewId !== undefined;

  const reasonUnavailable = (): string => {
    if (!TASKS_API_ENABLED) {
      return "Tasks can't be saved right now — this is waiting on a backend fix.";
    }
    if (!token) {
      return 'Sign in to save tasks.';
    }
    return "This view isn't synced to the server yet — tasks can't be saved to it.";
  };

  const createMutation = useMutation({
    mutationFn: (args: { viewId: number; payload: ReturnType<typeof taskToCreatePayload> }) =>
      withAuthRetry(token, t => createTask(t, args.viewId, args.payload)),
  });
  const updateMutation = useMutation({
    mutationFn: (args: { viewId: number; payload: ReturnType<typeof taskToUpdatePayload> }) =>
      withAuthRetry(token, t => updateTask(t, args.viewId, args.payload)),
  });
  const deleteMutation = useMutation({
    mutationFn: (args: { viewId: number; taskId: number }) =>
      withAuthRetry(token, t => deleteTask(t, args.viewId, args.taskId)),
  });
  const assignMutation = useMutation({
    mutationFn: (args: { viewId: number; taskId: number; assigneeId: string }) =>
      withAuthRetry(token, t =>
        assignUserToTask(t, args.viewId, {
          task_id: args.taskId,
          assignee_id: args.assigneeId,
        }),
      ),
  });
  const unassignMutation = useMutation({
    mutationFn: (args: { viewId: number; taskId: number; assigneeId: string }) =>
      withAuthRetry(token, t =>
        removeUserFromTask(t, args.viewId, {
          task_id: args.taskId,
          assignee_id: args.assigneeId,
        }),
      ),
  });

  // Same key shape as useTasksSync's own query for this view — see its header
  // comment. Patching it (rather than invalidating) keeps it in step with
  // itemsAtom without triggering a refetch.
  const taskQueryKey =
    viewId !== undefined
      ? [
          'tasks',
          viewId,
          JSON.stringify(activeView?.statusFilter ?? []),
          JSON.stringify(activeView?.tagFilter ?? []),
        ]
      : undefined;
  const patchTaskCache = (update: (prev: TaskInfoDto[]) => TaskInfoDto[]) => {
    if (!taskQueryKey) {
      return;
    }
    queryClient.setQueryData<TaskInfoDto[]>(taskQueryKey, prev =>
      prev ? update(prev) : prev,
    );
  };

  const addItem = async (
    draft: Omit<WorkItem, 'id' | 'createdById' | 'totalSubtasks'>,
  ): Promise<string> => {
    if (!canMutate || viewId === undefined || !activeView) {
      throw new Error(reasonUnavailable());
    }
    await createMutation.mutateAsync({
      viewId,
      payload: taskToCreatePayload(draft),
    });
    // The route returns no id (201, plain text) — (owner, parent, title) is
    // unique, so re-listing this exact level and matching by title resolves it.
    const parentTaskId = draft.parentId ? Number(draft.parentId) : undefined;
    const siblings = await withAuthRetry(token, t =>
      listTasks(t, viewId, buildTaskFilter(activeView, parentTaskId)),
    );
    const created = siblings.find(t => t.title === draft.title);
    if (!created) {
      // The create call itself went through — only finding it afterwards failed
      // (e.g. a huge sibling list past the first page) — so this isn't "nothing
      // happened", just "this device doesn't know the new task's id yet". The
      // next list refresh will pick it up.
      throw new Error(
        'Task was created, but could not be confirmed here yet — it should appear after the list refreshes.',
      );
    }
    setItems(prev => [...prev, taskFromServer(created)]);
    patchTaskCache(prev => [...prev, created]);
    return String(created.task_id);
  };

  const editItem = async (item: WorkItem): Promise<void> => {
    if (!canMutate || viewId === undefined || !isServerTaskId(item.id)) {
      throw new Error(reasonUnavailable());
    }
    const payload = taskToUpdatePayload(item);
    await updateMutation.mutateAsync({ viewId, payload });
    setItems(prev => prev.map(i => (i.id === item.id ? item : i)));
    // Merge the edited fields onto the cached row rather than replacing it
    // outright — owner_id/created_by/assignee_ids/created_at aren't part of the
    // edit and only exist on the server's shape, not WorkItem's.
    patchTaskCache(prev =>
      prev.map(t => (t.task_id === payload.task_id ? { ...t, ...payload } : t)),
    );
  };

  const removeItem = async (item: WorkItem): Promise<void> => {
    if (!canMutate || viewId === undefined || !isServerTaskId(item.id)) {
      throw new Error(reasonUnavailable());
    }
    await deleteMutation.mutateAsync({ viewId, taskId: Number(item.id) });
    // Cascades to every subtask server-side (ON DELETE CASCADE) — the local
    // cleanup here just mirrors that, now that it's confirmed to have happened.
    const gone = new Set([item.id, ...descendantsOf(items, item.id).map(d => d.id)]);
    setItems(prev => prev.filter(i => !gone.has(i.id)));
    setComments(prev => prev.filter(c => !gone.has(c.itemId)));
    patchTaskCache(prev => prev.filter(t => !gone.has(String(t.task_id))));
  };

  // Adds/removes one assignee on an existing task (POST /assignees/create and
  // DELETE /assignees/remove — no bulk form for either; see
  // services/taskAssignees.ts). Assigning is the looser of the two (owner,
  // creator or an existing assignee can do it); removing needs owner/creator.
  // Neither accepts your own id — the server 403s a self-assign or
  // self-remove before checking anything else. Both throw on failure, same as
  // the other writes here, so a denied removal doesn't silently look like it
  // worked.
  const assignUser = async (
    taskId: string,
    assigneeId: string,
  ): Promise<void> => {
    if (!canMutate || viewId === undefined || !isServerTaskId(taskId)) {
      throw new Error(reasonUnavailable());
    }
    await assignMutation.mutateAsync({
      viewId,
      taskId: Number(taskId),
      assigneeId,
    });
    setItems(prev =>
      prev.map(i =>
        i.id === taskId && !i.assigneeIds.includes(assigneeId)
          ? { ...i, assigneeIds: [...i.assigneeIds, assigneeId] }
          : i,
      ),
    );
    patchTaskCache(prev =>
      prev.map(t =>
        String(t.task_id) === taskId && !t.assignee_ids.includes(assigneeId)
          ? { ...t, assignee_ids: [...t.assignee_ids, assigneeId] }
          : t,
      ),
    );
  };

  const unassignUser = async (
    taskId: string,
    assigneeId: string,
  ): Promise<void> => {
    if (!canMutate || viewId === undefined || !isServerTaskId(taskId)) {
      throw new Error(reasonUnavailable());
    }
    await unassignMutation.mutateAsync({
      viewId,
      taskId: Number(taskId),
      assigneeId,
    });
    setItems(prev =>
      prev.map(i =>
        i.id === taskId
          ? { ...i, assigneeIds: i.assigneeIds.filter(id => id !== assigneeId) }
          : i,
      ),
    );
    patchTaskCache(prev =>
      prev.map(t =>
        String(t.task_id) === taskId
          ? { ...t, assignee_ids: t.assignee_ids.filter(id => id !== assigneeId) }
          : t,
      ),
    );
  };

  // Fetches parentId's direct children (POST /tasks/list/{view_id}, scoped to
  // that parent) and replaces whatever this device already had for them in
  // itemsAtom — called on demand (TableView's row-expand, ItemModal's open),
  // never eagerly; see useTasksSync's header comment for why. A local-only task
  // (or TASKS_API_ENABLED off) has nothing to fetch — everything it has is
  // already in itemsAtom — so this just returns what's there instead of hitting
  // the network.
  const loadChildren = async (parentId: string): Promise<WorkItem[]> => {
    if (!canMutate || viewId === undefined || !isServerTaskId(parentId)) {
      return items.filter(i => i.parentId === parentId);
    }
    const children = await withAuthRetry(token, t =>
      drainPages(t, viewId, activeView!, Number(parentId)),
    );
    const fresh = children.map(taskFromServer);
    setItems(prev => [...prev.filter(i => i.parentId !== parentId), ...fresh]);
    return fresh;
  };

  // Recursively loads a task's whole subtree, depth-first — one loadChildren
  // call per node that actually has subtasks (totalSubtasks/hasSubtasks says so
  // without needing a request), skipping leaves entirely. Used by ItemModal,
  // which shows a task's full nested subtask list, not just its direct
  // children — bounded to the one task someone opened, not the whole view.
  const loadSubtree = async (parentId: string, depth = 1): Promise<void> => {
    const children = await loadChildren(parentId);
    if (depth >= MAX_DEPTH) {
      return;
    }
    for (const child of children) {
      if (hasSubtasks(child)) {
        await loadSubtree(child.id, depth + 1);
      }
    }
  };

  return {
    addItem,
    editItem,
    removeItem,
    assignUser,
    unassignUser,
    loadChildren,
    loadSubtree,
    // Governs the Assignees field's read-only display for a task that can't
    // have assignees changed at all right now (nothing server-backed to assign
    // against) — true whenever this task is, or would be, a server-backed one.
    isServerBacked: viewId !== undefined,
    // Why writes are unavailable right now — null when they aren't. Lets a form
    // say so upfront instead of only on save.
    unavailableReason: !canMutate ? reasonUnavailable() : null,
  };
}
