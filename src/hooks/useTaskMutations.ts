import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAtom, useAtomValue } from 'jotai';
import { tokenAtom } from '../atoms/auth';
import { itemsAtom } from '../atoms/project';
import { useActiveView } from './useViews';
import { createTask, deleteTask, updateTask } from '../services/tasks';
import { assignUserToTask, removeUserFromTask } from '../services/taskAssignees';
import { drainPages, rootTasksKey } from './useTasksSync';
import {
  isServerTaskId,
  taskFromServer,
  taskToCreatePayload,
  taskToUpdatePayload,
} from '../data/taskSync';
import { MAX_DEPTH, descendantsOf, hasSubtasks } from '../data/tree';
import { TASKS_API_ENABLED } from '../config/features';
import { withAuthRetry } from '../services/authRetry';
import type { WorkItem } from '../data/types';
import type { TaskInfoDto } from '../services/types';

// Task writes through the active view (every task call is view-scoped on the
// server). One rule throughout: **save, then re-read from the server.** Nothing
// is patched locally — after a write, the affected level (the root list, or one
// parent's direct children) is fetched again and that is what the screen shows.
// See docs/BACKEND.md §5–6.

export interface AssigneeChanges {
  add: string[];
  remove: string[];
}

export function useTaskMutations() {
  const token = useAtomValue(tokenAtom);
  const activeView = useActiveView();
  const [items, setItems] = useAtom(itemsAtom);
  const queryClient = useQueryClient();

  const viewId = activeView ? Number(activeView.id) : undefined;
  // A view with show_subtasks off: the server refuses every subtask list/create/
  // edit through it, so don't ask.
  const subtasksEnabled = activeView?.showSubtasks !== false;
  const canMutate = TASKS_API_ENABLED && !!token && viewId !== undefined;

  const reasonUnavailable = (): string => {
    if (!TASKS_API_ENABLED) {
      return "Tasks can't be saved right now — this is waiting on a backend fix.";
    }
    if (!token) {
      return 'Sign in to save tasks.';
    }
    return 'Open a view first — tasks are saved through a view.';
  };
  const ensure = (taskId?: string) => {
    if (!canMutate || viewId === undefined || (taskId && !isServerTaskId(taskId))) {
      throw new Error(reasonUnavailable());
    }
    return viewId;
  };

  const write = useMutation({
    mutationFn: (fn: (t: string) => Promise<unknown>) => withAuthRetry(token, fn),
  });
  const call = <T,>(fn: (t: string) => Promise<T>) => write.mutateAsync(fn) as Promise<T>;

  // ── Re-reading from the server ──────────────────────────────────────────

  // Root level: refetch the view's root list query (useTasksSync renders it).
  const refreshRoots = (): Promise<TaskInfoDto[]> =>
    queryClient.fetchQuery({
      queryKey: rootTasksKey(activeView),
      queryFn: () => withAuthRetry(token, t => drainPages(t, viewId!, activeView!)),
      staleTime: 0,
    });

  // One parent's direct children (POST /tasks/list with parent_task_id).
  const loadChildren = async (parentId: string): Promise<WorkItem[]> => {
    if (!subtasksEnabled) {
      return [];
    }
    if (!canMutate || viewId === undefined || !isServerTaskId(parentId)) {
      return items.filter(i => i.parentId === parentId);
    }
    const rows = await withAuthRetry(token, t =>
      drainPages(t, viewId, activeView!, Number(parentId)),
    );
    const fresh = rows.map(taskFromServer);
    setItems(prev => [...prev.filter(i => i.parentId !== parentId), ...fresh]);
    return fresh;
  };

  // Re-read the level a task lives on. A subtask's parent also lives on a level
  // whose `total_sub_tasks` just changed, so that one is re-read too.
  const refreshLevelOf = async (parentId: string | null): Promise<void> => {
    if (!parentId) {
      await refreshRoots();
      return;
    }
    await loadChildren(parentId);
    const parent = items.find(i => i.id === parentId);
    if (parent) {
      await (parent.parentId ? loadChildren(parent.parentId) : refreshRoots());
    }
  };

  const applyAssignees = async (vid: number, taskId: number, changes?: AssigneeChanges) => {
    const failed: string[] = [];
    for (const id of changes?.add ?? []) {
      await call(t => assignUserToTask(t, vid, { task_id: taskId, assignee_id: id })).catch(
        () => failed.push(id),
      );
    }
    for (const id of changes?.remove ?? []) {
      await call(t => removeUserFromTask(t, vid, { task_id: taskId, assignee_id: id })).catch(
        () => failed.push(id),
      );
    }
    return failed;
  };

  // ── Writes ──────────────────────────────────────────────────────────────

  // Create, then (optionally) assign people, then re-read the level.
  // POST /tasks/create returns no id, so the new task is identified on the
  // re-read by (parent, title) — unique per owner server-side. Returns the new
  // id and any assignees the server refused.
  const addItem = async (
    draft: Omit<WorkItem, 'id' | 'createdById' | 'totalSubtasks' | 'assigneeIds'>,
    changes?: AssigneeChanges,
  ): Promise<{ id: string; failedAssignees: string[] }> => {
    const vid = ensure();
    await call(t => createTask(t, vid, taskToCreatePayload(draft)));
    const level = draft.parentId
      ? await withAuthRetry(token, t => drainPages(t, vid, activeView!, Number(draft.parentId)))
      : await refreshRoots();
    const created = level.find(r => r.title === draft.title);
    if (!created) {
      throw new Error(
        'The task was created, but the server list doesn’t show it yet — it will appear after the next refresh.',
      );
    }
    const assigning = (changes?.add.length ?? 0) + (changes?.remove.length ?? 0) > 0;
    const failedAssignees = await applyAssignees(vid, created.task_id, changes);
    if (assigning) {
      // Assignments changed the level just read — read it again.
      await refreshLevelOf(draft.parentId);
    } else if (draft.parentId) {
      // The lookup above already is the fresh child list; only the parent's own
      // level (its total_sub_tasks) still needs a re-read.
      setItems(prev => [
        ...prev.filter(i => i.parentId !== draft.parentId),
        ...level.map(taskFromServer),
      ]);
      const parent = items.find(i => i.id === draft.parentId);
      await (parent?.parentId ? loadChildren(parent.parentId) : refreshRoots());
    }
    // (Root task, no assignees: refreshRoots() above was the re-read.)
    return { id: String(created.task_id), failedAssignees };
  };

  // Update, apply assignee changes, re-read.
  const editItem = async (
    item: WorkItem,
    changes?: AssigneeChanges,
  ): Promise<{ failedAssignees: string[] }> => {
    const vid = ensure(item.id);
    await call(t => updateTask(t, vid, taskToUpdatePayload(item)));
    const failedAssignees = await applyAssignees(vid, Number(item.id), changes);
    await refreshLevelOf(item.parentId);
    return { failedAssignees };
  };

  // Delete (cascades to subtasks server-side), re-read.
  const removeItem = async (item: WorkItem): Promise<void> => {
    const vid = ensure(item.id);
    await call(t => deleteTask(t, vid, Number(item.id)));
    const gone = new Set([item.id, ...descendantsOf(items, item.id).map(d => d.id)]);
    setItems(prev => prev.filter(i => !gone.has(i.id)));
    await refreshLevelOf(item.parentId);
  };

  // A task's full nested subtree, depth-first — only for nodes the server says
  // have children (total_sub_tasks), so a leaf costs no request at all.
  const loadSubtree = async (task: WorkItem, depth = 1): Promise<void> => {
    if (!hasSubtasks(task)) {
      return;
    }
    const children = await loadChildren(task.id);
    if (depth >= MAX_DEPTH) {
      return;
    }
    for (const child of children) {
      await loadSubtree(child, depth + 1);
    }
  };

  return {
    addItem,
    editItem,
    removeItem,
    loadChildren,
    loadSubtree,
    isServerBacked: viewId !== undefined,
    subtasksEnabled,
    // Why writes are unavailable right now — null when they aren't.
    unavailableReason: !canMutate ? reasonUnavailable() : null,
  };
}
