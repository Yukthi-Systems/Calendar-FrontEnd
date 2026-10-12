import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAtom, useAtomValue } from 'jotai';
import { tokenAtom } from '../atoms/auth';
import { itemsAtom } from '../atoms/project';
import { listTasks } from '../services/tasks';
import {
  FETCH_PAGE_LIMIT,
  MAX_PAGES,
  buildTaskFilter,
  isServerTaskId,
  taskFromServer,
} from '../data/taskSync';
import { MAX_DEPTH } from '../data/tree';
import { isServerViewId } from '../data/viewSync';
import { TASKS_API_ENABLED } from '../config/features';
import { withAuthRetry } from '../services/authRetry';
import type { ProjectView } from '../data/types';
import type { TaskInfoDto } from '../services/types';

// Drains every page of one POST /tasks/list/{view_id} call (root tasks, or one
// parent's direct children when parentTaskId is given) via the cursor it returns.
async function drainPages(
  token: string,
  viewId: number,
  view: Pick<ProjectView, 'statusFilter' | 'tagFilter'>,
  parentTaskId?: number,
): Promise<TaskInfoDto[]> {
  const out: TaskInfoDto[] = [];
  let cursor: { cursor_start_at: string; cursor_task_id: number } | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const filter = buildTaskFilter(view, parentTaskId, cursor);
    const batch = await listTasks(token, viewId, filter);
    out.push(...batch);
    if (batch.length < FETCH_PAGE_LIMIT) {
      break;
    }
    const last = batch[batch.length - 1];
    cursor = { cursor_start_at: last.start_at, cursor_task_id: last.task_id };
  }
  return out;
}

// The API only lists one level at a time (root tasks, or one parent's direct
// children) — there's no "give me a task and its whole subtree" endpoint — so a
// full view's worth of tasks takes one list call per node that has children,
// depth-first. Bounded by MAX_DEPTH (real trees are shallow; this is a guard
// against anything unexpected, not an expected case).
async function fetchViewTaskTree(
  token: string,
  viewId: number,
  view: Pick<ProjectView, 'statusFilter' | 'tagFilter'>,
  parentTaskId?: number,
  depth = 1,
): Promise<TaskInfoDto[]> {
  const level = await drainPages(token, viewId, view, parentTaskId);
  if (depth >= MAX_DEPTH) {
    return level;
  }
  const out = [...level];
  for (const task of level) {
    out.push(
      ...(await fetchViewTaskTree(token, viewId, view, task.task_id, depth + 1)),
    );
  }
  return out;
}

// Populates itemsAtom from Tasks-Main-API's /tasks for the active view — call once,
// from ProjectScreen (which already tracks the active view). Mutations
// (create/update/delete) live in useTaskMutations instead, so every component that
// needs to write a task doesn't also need to re-run this fetch.
//
// Signed out, the active view isn't server-backed yet (a local-only view, or
// still mid-migration — see useViewsSync), or TASKS_API_ENABLED is off (see that
// constant's comment) — itemsAtom is left exactly as it is (projectStore.ts
// deliberately never persists tasks locally, so that's an empty list unless
// something else has already written to it this session).
export function useTasksSync(view: ProjectView | undefined) {
  const token = useAtomValue(tokenAtom);
  const [items, setItems] = useAtom(itemsAtom);
  const queryClient = useQueryClient();

  const viewId =
    TASKS_API_ENABLED && view && isServerViewId(view.id)
      ? Number(view.id)
      : undefined;
  const statusKey = JSON.stringify(view?.statusFilter ?? []);
  const tagKey = JSON.stringify(view?.tagFilter ?? []);

  const query = useQuery({
    queryKey: ['tasks', viewId, statusKey, tagKey],
    queryFn: () => withAuthRetry(token, t => fetchViewTaskTree(t, viewId!, view!)),
    enabled: !!token && viewId !== undefined,
  });

  useEffect(() => {
    if (query.data) {
      setItems(query.data.map(taskFromServer));
    }
  }, [query.data, setItems]);

  useEffect(() => {
    if (query.error) {
      console.warn('Could not load tasks from the server:', query.error);
    }
  }, [query.error]);

  // Switching to a local-only view (or signing out) drops whatever server tasks
  // were loaded for the last one — they belong to a different view/account.
  useEffect(() => {
    if (viewId === undefined && items.some(i => isServerTaskId(i.id))) {
      setItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the view/token actually changing, not to every items write
  }, [viewId, token]);

  const refetch = () =>
    viewId !== undefined
      ? queryClient.invalidateQueries({ queryKey: ['tasks', viewId] })
      : Promise.resolve();

  return { ready: !query.isPending, refetch };
}
