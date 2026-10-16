import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { tokenAtom } from '../atoms/auth';
import { itemsAtom, tasksLoadingAtom } from '../atoms/project';
import { listTasks } from '../services/tasks';
import {
  FETCH_PAGE_LIMIT,
  MAX_PAGES,
  buildTaskFilter,
  isServerTaskId,
  taskFromServer,
} from '../data/taskSync';
import { TASKS_API_ENABLED } from '../config/features';
import { withAuthRetry } from '../services/authRetry';
import type { ProjectView } from '../data/types';
import type { TaskInfoDto } from '../services/types';

// Drains every page of one POST /tasks/list/{view_id} call (root tasks, or one
// parent's direct children when parentTaskId is given) via the cursor it returns.
// Exported for useTaskMutations.ts's loadChildren/loadSubtree (on-demand, one
// subtree at a time) — this file only ever calls it for the active view's root
// level now; see this file's own header comment for why.
export async function drainPages(
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

// Populates itemsAtom from Tasks-Main-API's /tasks for the active view's ROOT
// tasks only — call once, from ProjectScreen (which already tracks the active
// view). Subtasks load lazily instead of all up front: the API has no "give me a
// task and its whole subtree" endpoint, only "list root tasks" or "list one
// parent's direct children", so loading everything eagerly meant one request per
// node that has children, depth-first, for every view opened whether or not
// anyone ever looked at a subtask. `total_sub_tasks` on every task row (see
// TaskInfoDto) makes the lazy version possible — a task says how many direct
// children it has without them being loaded — so the UI can show the count and
// an expand affordance, and only fetch on demand (useTaskMutations.ts's
// loadChildren/loadSubtree, called from TableView's row-expand and ItemModal's
// open).
//
// Mutations (create/update/delete/assign) live in useTaskMutations instead, so
// every component that needs to write a task doesn't also need to re-run this
// fetch.
//
// Signed out, no view loaded yet, or TASKS_API_ENABLED is off (see that
// constant's comment) — itemsAtom is left exactly as it is (nothing
// deliberately never persists tasks locally, so that's an empty list unless
// something else has already written to it this session).
// The cache key of a view's root-level task list — shared with useTaskMutations,
// which refetches exactly this after every write.
export const rootTasksKey = (view: ProjectView | undefined) =>
  [
    'tasks',
    view ? Number(view.id) : undefined,
    JSON.stringify(view?.statusFilter ?? []),
    JSON.stringify(view?.tagFilter ?? []),
  ] as const;

export function useTasksSync(view: ProjectView | undefined) {
  const token = useAtomValue(tokenAtom);
  const [items, setItems] = useAtom(itemsAtom);
  const queryClient = useQueryClient();

  const viewId =
    TASKS_API_ENABLED && view
      ? Number(view.id)
      : undefined;
  const query = useQuery({
    queryKey: rootTasksKey(view),
    queryFn: () => withAuthRetry(token, t => drainPages(t, viewId!, view!)),
    enabled: !!token && viewId !== undefined,
  });

  // Which view the tasks in itemsAtom belong to. Switching views starts from that
  // view's own tasks only — subtasks expanded in the previous view belong to it
  // (often to another owner) and must not leak in: they'd show up as stray rows
  // here, and re-reading them through this view is refused (403).
  const shownView = useRef<number | undefined>(undefined);

  useEffect(() => {
    const switched = shownView.current !== viewId;
    if (switched) {
      shownView.current = viewId;
    }
    if (!query.data) {
      if (switched) {
        setItems([]);
      }
      return;
    }
    const freshRoots = query.data.map(taskFromServer);
    const freshRootIds = new Set(freshRoots.map(t => t.id));
    setItems(prev => {
      if (switched) {
        return freshRoots;
      }
      // A plain refresh of the same view shouldn't throw away subtrees someone
      // already expanded on demand — keep any already-loaded subtask that isn't
      // itself one of the roots just refetched.
      const keep = prev.filter(
        i => !freshRootIds.has(i.id) && i.parentId !== null,
      );
      return [...freshRoots, ...keep];
    });
  }, [viewId, query.data, setItems]);

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

  // isLoading, not isPending: a disabled query (TASKS_API_ENABLED off, or a
  // local-only view) stays "pending" forever but never fetches.
  const setLoading = useSetAtom(tasksLoadingAtom);
  useEffect(() => {
    setLoading(query.isLoading);
  }, [query.isLoading, setLoading]);

  const refetch = () =>
    viewId !== undefined
      ? queryClient.invalidateQueries({ queryKey: ['tasks', viewId] })
      : Promise.resolve();

  return { ready: !query.isPending, loading: query.isLoading, refetch };
}
