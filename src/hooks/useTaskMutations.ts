import {
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { useAtom, useAtomValue } from 'jotai';
import { tokenAtom } from '../atoms/auth';
import { itemsAtom } from '../atoms/project';
import { useActiveView } from './useViews';
import { createTask, deleteTask, getTask, updateTask } from '../services/tasks';
import {
  assignUserToTask,
  removeUserFromTask,
} from '../services/taskAssignees';
import {
  bucketKey,
  drainPages,
  findRootByTitle,
  newestWithTitle,
  useRootRequest,
  type Bucket,
  refetchCalendarBuckets,
} from './useTasksSync';
import {
  bucketsForDate,
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
  const { key: rootKey } = useRootRequest(activeView);
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
    if (
      !canMutate ||
      viewId === undefined ||
      (taskId && !isServerTaskId(taskId))
    ) {
      throw new Error(reasonUnavailable());
    }
    return viewId;
  };

  const write = useMutation({
    mutationFn: (fn: (t: string) => Promise<unknown>) =>
      withAuthRetry(token, fn),
  });
  const call = <T>(fn: (t: string) => Promise<T>) =>
    write.mutateAsync(fn) as Promise<T>;

  // ── Re-reading from the server ──────────────────────────────────────────

  // Root level: refetch the view's paged root list (useTasksSync renders it) —
  // every page loaded so far, not the whole list, so a long table stays cheap
  // to refresh. Returns the rows now loaded.
  type RootPages = InfiniteData<TaskInfoDto[], unknown>;
  const isCalendar = activeView?.type === 'calendar';
  const isBucketKey = (key: readonly unknown[]) => key[4] === 'bucket';
  const loadedRoots = (): TaskInfoDto[] =>
    isCalendar
      ? queryClient
          .getQueriesData<Bucket>({ queryKey: ['tasks', viewId] })
          .filter(([key]) => isBucketKey(key))
          .flatMap(([, d]) => d?.rows ?? [])
      : queryClient.getQueryData<RootPages>(rootKey)?.pages.flat() ?? [];
  // `dates`: start dates ('yyyy-MM-dd') the write touched — a Calendar then
  // refetches only those months' buckets (if cached) instead of every month
  // on screen; without them it refetches the buckets on screen.
  const refreshRoots = async (dates?: string[]): Promise<TaskInfoDto[]> => {
    if (isCalendar) {
      const months = dates ? [...new Set(dates.flatMap(bucketsForDate))] : null;
      await (months
        ? Promise.all(
            months.map(m =>
              queryClient.refetchQueries({
                queryKey: bucketKey(activeView, m),
                exact: true,
              }),
            ),
          )
        : activeView && refetchCalendarBuckets(queryClient, activeView));
    } else {
      await queryClient.refetchQueries({ queryKey: rootKey, exact: true });
    }
    // This view's other cached lists (another quick filter) may hold the task
    // just written — refetch them when next shown. Calendar buckets are
    // left alone: a write only changes the months refetched above.
    await queryClient.invalidateQueries({
      queryKey: ['tasks', viewId],
      refetchType: 'none',
      predicate: q => !isBucketKey(q.queryKey),
    });
    return loadedRoots();
  };
  // A root task that isn't on any loaded page (e.g. just created, or edited
  // to a later start date than the pages scrolled so far) — put it on the
  // first page so it's on screen and its detail sheet keeps working. The next
  // refetch places it back in its real position. First page, not last: the
  // last page's last row is the cursor for loading more.
  // (Calendar: a task outside the loaded months isn't on screen anyway — it's
  // only added to the list so its just-opened detail sheet has something.)
  const pinRoot = (row: TaskInfoDto) =>
    isCalendar
      ? setItems(prev =>
          prev.some(i => i.id === String(row.task_id))
            ? prev
            : [...prev, taskFromServer(row)],
        )
      : queryClient.setQueryData<RootPages>(rootKey, d =>
          !d || d.pages.some(p => p.some(r => r.task_id === row.task_id))
            ? d
            : { ...d, pages: [[row, ...d.pages[0]], ...d.pages.slice(1)] },
        );

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
  const refreshLevelOf = async (
    parentId: string | null,
    dates?: string[],
  ): Promise<void> => {
    if (!parentId) {
      await refreshRoots(dates);
      return;
    }
    await loadChildren(parentId);
    const parent = items.find(i => i.id === parentId);
    if (parent) {
      await (parent.parentId
        ? loadChildren(parent.parentId)
        : refreshRoots([parent.start]));
    }
  };

  // After an edit moves a root task past the loaded pages (a later start
  // date), fetch it alone and pin it, rather than have it vanish mid-edit.
  const keepRootLoaded = async (vid: number, item: WorkItem) => {
    if (
      item.parentId ||
      loadedRoots().some(r => String(r.task_id) === item.id)
    ) {
      return;
    }
    const row = await withAuthRetry(token, t =>
      getTask(t, vid, Number(item.id)),
    ).catch(() => null);
    if (row) {
      pinRoot(row);
    }
  };

  const applyAssignees = async (
    vid: number,
    taskId: number,
    changes?: AssigneeChanges,
  ) => {
    const failed: string[] = [];
    for (const id of changes?.add ?? []) {
      await call(t =>
        assignUserToTask(t, vid, { task_id: taskId, assignee_id: id }),
      ).catch(() => failed.push(id));
    }
    for (const id of changes?.remove ?? []) {
      await call(t =>
        removeUserFromTask(t, vid, { task_id: taskId, assignee_id: id }),
      ).catch(() => failed.push(id));
    }
    return failed;
  };

  // ── Writes ──────────────────────────────────────────────────────────────

  // Create, then (optionally) assign people, then re-read the level.
  // POST /tasks/create returns no id, so the new task is identified on the
  // re-read by (parent, title) — unique per owner server-side. Returns the new
  // id and any assignees the server refused.
  const addItem = async (
    draft: Omit<
      WorkItem,
      'id' | 'createdById' | 'ownerId' | 'totalSubtasks' | 'assigneeIds'
    >,
    changes?: AssigneeChanges,
    // The id must be this very task (invites are about to be e-mailed for it):
    // only what's loaded could hold just an older task of the same title, so
    // a root task is always looked up on the server.
    exactId = false,
  ): Promise<{ id: string; failedAssignees: string[] }> => {
    const vid = ensure();
    await call(t => createTask(t, vid, taskToCreatePayload(draft)));
    const level = draft.parentId
      ? await withAuthRetry(token, t =>
          drainPages(t, vid, activeView!, Number(draft.parentId)),
        )
      : await refreshRoots([draft.start]);
    // A new root task is often past the pages loaded so far (or outside the
    // active quick filter) — look it up by title on the server instead.
    let created =
      exactId && !draft.parentId
        ? undefined
        : newestWithTitle(level, draft.title);
    if (!created && !draft.parentId) {
      created = await withAuthRetry(token, t =>
        findRootByTitle(t, vid, activeView!, draft.title),
      );
      if (created) {
        pinRoot(created);
      }
    }
    if (!created) {
      throw new Error(
        `The task was created, but the server list doesn’t show it yet — it will appear after the next refresh.${
          exactId ? ' Invites weren’t sent; add them from the task.' : ''
        }`,
      );
    }
    const assigning =
      (changes?.add.length ?? 0) + (changes?.remove.length ?? 0) > 0;
    const failedAssignees = await applyAssignees(vid, created.task_id, changes);
    if (assigning) {
      // Assignments changed the level just read — read it again.
      await refreshLevelOf(draft.parentId, [draft.start]);
    } else if (draft.parentId) {
      // The lookup above already is the fresh child list; only the parent's own
      // level (its total_sub_tasks) still needs a re-read.
      setItems(prev => [
        ...prev.filter(i => i.parentId !== draft.parentId),
        ...level.map(taskFromServer),
      ]);
      const parent = items.find(i => i.id === draft.parentId);
      await (parent?.parentId
        ? loadChildren(parent.parentId)
        : refreshRoots(parent ? [parent.start] : undefined));
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
    // Moving a task's start date moves it between month buckets — refresh both.
    const before = items.find(i => i.id === item.id);
    await call(t => updateTask(t, vid, taskToUpdatePayload(item)));
    const failedAssignees = await applyAssignees(vid, Number(item.id), changes);
    await refreshLevelOf(item.parentId, [
      item.start,
      before?.start ?? item.start,
    ]);
    if (!isCalendar) {
      await keepRootLoaded(vid, item);
    }
    return { failedAssignees };
  };

  // Assign-only: applies assignee changes without touching the task's own
  // fields. The server's assign/remove endpoints are separate from
  // updateTask and sit behind a looser bar (view-level edit access, not
  // owner/creator-only the way editing the task's own fields is — see
  // Tasks-Main-API's task_assignees service) — going through editItem here
  // would send a redundant updateTask PATCH that a plain assignee isn't
  // allowed to make, 403-ing a perfectly valid assignment. Used by the quick
  // "add assignee" control on a task's detail view.
  const assignItem = async (
    item: WorkItem,
    changes: AssigneeChanges,
  ): Promise<{ failedAssignees: string[] }> => {
    const vid = ensure(item.id);
    const failedAssignees = await applyAssignees(vid, Number(item.id), changes);
    await refreshLevelOf(item.parentId, [item.start]);
    return { failedAssignees };
  };

  // Delete (cascades to subtasks server-side), re-read.
  const removeItem = async (item: WorkItem): Promise<void> => {
    const vid = ensure(item.id);
    await call(t => deleteTask(t, vid, Number(item.id)));
    const gone = new Set([
      item.id,
      ...descendantsOf(items, item.id).map(d => d.id),
    ]);
    setItems(prev => prev.filter(i => !gone.has(i.id)));
    await refreshLevelOf(item.parentId, [item.start]);
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
    assignItem,
    removeItem,
    loadChildren,
    loadSubtree,
    // Re-reads the level a task lives on (its root list, or its parent's
    // children) straight from the server — e.g. ItemModal's refresh button.
    refreshLevelOf,
    isServerBacked: viewId !== undefined,
    subtasksEnabled,
    // Why writes are unavailable right now — null when they aren't.
    unavailableReason: !canMutate ? reasonUnavailable() : null,
  };
}
