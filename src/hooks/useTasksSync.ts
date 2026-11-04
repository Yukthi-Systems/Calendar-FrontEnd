import { useEffect, useMemo, useRef } from 'react';
import {
  useInfiniteQuery,
  useQueries,
  useQueryClient,
} from '@tanstack/react-query';
import { addMonths, format, parseISO, subMonths } from 'date-fns';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { tokenAtom } from '../atoms/auth';
import {
  calendarRangeAtom,
  itemsAtom,
  taskFiltersAtom,
  tasksLoadingAtom,
} from '../atoms/project';
import { listTasks } from '../services/tasks';
import {
  FETCH_PAGE_LIMIT,
  MAX_PAGES,
  buildTaskFilter,
  CALENDAR_LOOKBACK_MONTHS,
  bucketFilter,
  bucketRange,
  isServerTaskId,
  searchWords,
  startsWithinBucket,
  taskFromServer,
  toServerQuickFilter,
  type MonthKey,
  type ServerQuickFilter,
} from '../data/taskSync';
import { useDebouncedValue } from './useDebouncedValue';
import { TASKS_API_ENABLED } from '../config/features';
import { withAuthRetry } from '../services/authRetry';
import type { ProjectView, WorkItem } from '../data/types';
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
  quick?: ServerQuickFilter,
): Promise<TaskInfoDto[]> {
  const out: TaskInfoDto[] = [];
  let cursor: { cursor_start_at: string; cursor_task_id: number } | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const filter = buildTaskFilter(view, parentTaskId, cursor, quick);
    // A quick filter with no overlap with what the view allows — nothing can
    // match, and the API rejects an empty status/tag list.
    if (!filter.any_of_task_status.length || !filter.any_of_task_tag.length) {
      break;
    }
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

type TaskCursor = { cursor_start_at: string; cursor_task_id: number };

const cursorAfter = (page: TaskInfoDto[]): TaskCursor | undefined => {
  const last = page[page.length - 1];
  return page.length < FETCH_PAGE_LIMIT || !last
    ? undefined
    : { cursor_start_at: last.start_at, cursor_task_id: last.task_id };
};

// Exact-title lookup of one root task without loading the whole list: the
// server narrows by the title's longest word (title_contains only takes
// letters/digits/spaces), then this keeps the exact match. A title with no
// searchable word falls back to draining the full list.
export async function findRootByTitle(
  token: string,
  viewId: number,
  view: Pick<ProjectView, 'statusFilter' | 'tagFilter'>,
  title: string,
): Promise<TaskInfoDto | undefined> {
  const word = searchWords(title).reduce(
    (a, w) => (w.length > a.length ? w : a),
    '',
  );
  if (!word) {
    return (await drainPages(token, viewId, view)).find(r => r.title === title);
  }
  let cursor: TaskCursor | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await listTasks(token, viewId, {
      ...buildTaskFilter(view, undefined, cursor),
      title_contains: word,
    });
    const hit = batch.find(r => r.title === title);
    if (hit) {
      return hit;
    }
    cursor = cursorAfter(batch);
    if (!cursor) {
      return undefined;
    }
  }
  return undefined;
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
export const rootTasksKey = (
  view: ProjectView | undefined,
  quick?: ServerQuickFilter,
) =>
  [
    'tasks',
    view ? Number(view.id) : undefined,
    JSON.stringify(view?.statusFilter ?? []),
    JSON.stringify(view?.tagFilter ?? []),
    JSON.stringify(quick ?? null),
  ] as const;

// One Calendar month bucket's cache key — same 'tasks'/viewId prefix, so a
// view-wide invalidate (refresh button) covers buckets too.
export const bucketKey = (view: ProjectView | undefined, month: MonthKey) =>
  [
    'tasks',
    view ? Number(view.id) : undefined,
    JSON.stringify(view?.statusFilter ?? []),
    JSON.stringify(view?.tagFilter ?? []),
    'bucket',
    month,
  ] as const;

// What the active view's root list request depends on beyond the view itself
// (the Table quick filter). Shared by the query and by useTaskMutations'
// refresh, so both address the same cache entry.
export function useRootRequest(view: ProjectView | undefined) {
  const quick = useRootQuickFilter(view);
  return { quick, key: rootTasksKey(view, quick) };
}

// ── Calendar month buckets ──────────────────────────────────────────────────

// Per-bucket page cap (100 rows each): a month with more top-level tasks than
// this shows only the first ones, and CalendarView says so — instead of one
// busy month eating a shared cap and starving the months on screen.
const BUCKET_MAX_PAGES = 20;
// Navigation settles this long before buckets are requested, so clicking
// through several months only fetches where you stop.
const CALENDAR_NAV_DEBOUNCE_MS = 250;
const BUCKET_STALE_MS = 5 * 60_000;
const BUCKET_GC_MS = 30 * 60_000;

export interface Bucket {
  rows: TaskInfoDto[];
  // Hit BUCKET_MAX_PAGES — more tasks start this month than were loaded.
  truncated: boolean;
}

// What one bucket request learnt beyond its own month: a bucket asks for
// everything starting from the month's first day, in start order, so its
// pages also hold the start of the following months. Every task starting
// before `completeBeforeMs` came back (Infinity when the last page was short —
// nothing at all starts later), so any later month ending by then is known.
interface BucketFetch extends Bucket {
  all: TaskInfoDto[];
  completeBeforeMs: number;
}

// How far ahead an answer may fill in months — enough for a Year view and
// the navigation after it, without writing an unbounded run of empty months.
const SEED_AHEAD_MONTHS = 24;

async function fetchBucket(
  token: string,
  viewId: number,
  view: Pick<ProjectView, 'statusFilter' | 'tagFilter'>,
  month: MonthKey,
  signal: AbortSignal,
): Promise<BucketFetch> {
  const all: TaskInfoDto[] = [];
  const done = (truncated: boolean, completeBeforeMs: number) => ({
    rows: all.filter(r => startsWithinBucket(month, r.start_at)),
    truncated,
    all,
    completeBeforeMs,
  });
  let cursor: TaskCursor | undefined;
  for (let page = 0; page < BUCKET_MAX_PAGES; page++) {
    if (signal.aborted) {
      throw new DOMException('Navigated away', 'AbortError');
    }
    const filter = bucketFilter(view, month, cursor);
    if (!filter.any_of_task_status.length || !filter.any_of_task_tag.length) {
      return done(false, Infinity);
    }
    const batch = await listTasks(token, viewId, filter);
    all.push(...batch);
    const last = batch[batch.length - 1];
    cursor = cursorAfter(batch);
    if (!cursor || !last) {
      return done(false, Infinity);
    }
    if (!startsWithinBucket(month, last.start_at)) {
      // Ordered by (start, id): more may share the last row's start.
      return done(false, Date.parse(last.start_at));
    }
  }
  return done(true, -Infinity);
}

// Fills in the later months one bucket answer already covers, so they cost
// no request of their own (an empty answer covers every month after it).
function seedLaterBuckets(
  queryClient: ReturnType<typeof useQueryClient>,
  view: ProjectView | undefined,
  month: MonthKey,
  result: BucketFetch,
) {
  let d = parseISO(`${month}-01`);
  for (let i = 0; i < SEED_AHEAD_MONTHS; i++) {
    d = addMonths(d, 1);
    const next = format(d, 'yyyy-MM');
    const { startMs, endMs } = bucketRange(next);
    if (endMs > result.completeBeforeMs) {
      return;
    }
    queryClient.setQueryData<Bucket>(bucketKey(view, next), {
      rows: result.all.filter(r => {
        const t = Date.parse(r.start_at);
        return t >= startMs && t < endMs;
      }),
      truncated: false,
    });
  }
}

const isBucketQueryKey = (key: readonly unknown[]) => key[4] === 'bucket';

// Re-reads the Calendar's loaded months (refresh button, or a write with no
// date to narrow it): the oldest first, since its answer refills the later
// months it covers (seedLaterBuckets); then only the ones it didn't, together.
export async function refetchCalendarBuckets(
  queryClient: ReturnType<typeof useQueryClient>,
  view: ProjectView,
) {
  const started = Date.now();
  const queries = queryClient
    .getQueryCache()
    .findAll({
      queryKey: ['tasks', Number(view.id)],
      type: 'active',
      predicate: q => isBucketQueryKey(q.queryKey),
    })
    .sort((a, b) => String(a.queryKey[5]).localeCompare(String(b.queryKey[5])));
  if (!queries.length) {
    return;
  }
  const refetch = (key: readonly unknown[]) =>
    queryClient.refetchQueries({ queryKey: key, exact: true });
  await refetch(queries[0].queryKey);
  await Promise.all(
    queries
      .slice(1)
      .filter(q => q.state.dataUpdatedAt < started)
      .map(q => refetch(q.queryKey)),
  );
}

const monthsBetween = (from: MonthKey, to: MonthKey): MonthKey[] => {
  const out: MonthKey[] = [];
  for (
    let d = parseISO(`${from}-01`);
    format(d, 'yyyy-MM') <= to && out.length < 36;
    d = addMonths(d, 1)
  ) {
    out.push(format(d, 'yyyy-MM'));
  }
  return out;
};

// The Calendar's tasks: the first month on screen, then the rest on screen,
// then the CALENDAR_LOOKBACK_MONTHS before them — the earliest first, since its
// answer often covers all the later ones (see seedLaterBuckets), then any still
// unknown one at a time, nearest first. A month an earlier answer covered is
// never requested, so a quiet calendar costs two requests, not one per month. Called by useTasksSync
// (which renders the rows) and CalendarView (which shows the status); both
// read the same cache, so nothing is fetched twice.
export function useCalendarBuckets(view: ProjectView | undefined) {
  const token = useAtomValue(tokenAtom);
  const viewId =
    TASKS_API_ENABLED && view?.type === 'calendar'
      ? Number(view.id)
      : undefined;
  const liveRange = useAtomValue(calendarRangeAtom);
  const range = useDebouncedValue(liveRange, CALENDAR_NAV_DEBOUNCE_MS);

  // The grid's months first, then the side panel's if it's elsewhere (today's
  // agenda while browsing another month) — each with its own lookback.
  const grid = range
    ? monthsBetween(range.from.slice(0, 7), range.to.slice(0, 7))
    : [];
  const agenda =
    range?.agendaFrom && range.agendaTo
      ? monthsBetween(
          range.agendaFrom.slice(0, 7),
          range.agendaTo.slice(0, 7),
        ).filter(m => !grid.includes(m))
      : [];
  const visible = [...grid, ...agenda];
  const lookback = (first: MonthKey | undefined) =>
    first
      ? Array.from({ length: CALENDAR_LOOKBACK_MONTHS }, (_, i) =>
          format(subMonths(parseISO(`${first}-01`), i + 1), 'yyyy-MM'),
        )
      : [];
  const earlier = [
    ...new Set([...lookback(grid[0]), ...lookback(agenda[0])]),
  ].filter(m => !visible.includes(m));
  const months = [...visible, ...earlier];
  const ready = !!token && viewId !== undefined;

  // Staged enabling: read straight from the cache (re-evaluated every render,
  // and each bucket settling re-renders through useQueries below).
  const queryClient = useQueryClient();
  const settled = (month: MonthKey) => {
    const st = queryClient.getQueryState(bucketKey(view, month));
    return !!st && (st.data !== undefined || st.status === 'error');
  };
  const visibleDone = visible.every(settled);
  const earliest = [...earlier].sort()[0];
  const enabledFor = (month: MonthKey, index: number) => {
    if (!ready) {
      return false;
    }
    if (index < visible.length) {
      return index === 0 || settled(visible[0]);
    }
    if (!visibleDone) {
      return false;
    }
    if (month === earliest) {
      return true;
    }
    const before = earlier.slice(0, index - visible.length);
    return settled(earliest) && before.every(settled);
  };

  const results = useQueries({
    queries: months.map((month, index) => ({
      queryKey: bucketKey(view, month),
      queryFn: async ({ signal }: { signal: AbortSignal }): Promise<Bucket> => {
        const result = await withAuthRetry(token, t =>
          fetchBucket(t, viewId!, view!, month, signal),
        );
        seedLaterBuckets(queryClient, view, month, result);
        return { rows: result.rows, truncated: result.truncated };
      },
      enabled: enabledFor(month, index),
      staleTime: BUCKET_STALE_MS,
      gcTime: BUCKET_GC_MS,
    })),
  });

  // Merged, de-duplicated (buckets overlap by a day at each month edge).
  const dataSig = results.map(r => r.dataUpdatedAt).join(',');
  const rows = useMemo(() => {
    const seen = new Set<number>();
    const out: TaskInfoDto[] = [];
    for (const r of results) {
      for (const row of r.data?.rows ?? []) {
        if (!seen.has(row.task_id)) {
          seen.add(row.task_id);
          out.push(row);
        }
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- results is a new array every render; dataSig captures what matters
  }, [dataSig]);

  return {
    rows: ready && range ? rows : undefined,
    // The screen's own months — what "still loading" means for a spinner.
    loading:
      ready &&
      (!range ||
        results.slice(0, visible.length).some(r => !r.data && !r.isError)),
    // Earlier months still coming in, for long tasks that began before.
    loadingEarlier:
      ready && results.slice(visible.length).some(r => !r.data && !r.isError),
    // Months on screen that hit the cap (an earlier month over it only
    // affects the rare long task, not worth a warning).
    truncatedMonths: visible.filter((_, i) => results[i]?.data?.truncated),
    error: results.find(r => r.error)?.error ?? null,
  };
}

const QUICK_FILTER_DEBOUNCE_MS = 300;

// TableView's quick filter, as the root task list request applies it (debounced,
// so a burst of chip taps is one request). Only Table views have that filter
// UI — taskFiltersAtom is session-wide, so any other layout ignores it rather
// than inherit a Table view's leftover filter.
export function useRootQuickFilter(
  view: ProjectView | undefined,
): ServerQuickFilter | undefined {
  const filters = useAtomValue(taskFiltersAtom);
  const live =
    view?.type === 'table'
      ? JSON.stringify(toServerQuickFilter(filters) ?? null)
      : 'null';
  const debounced = useDebouncedValue(live, QUICK_FILTER_DEBOUNCE_MS);
  return (JSON.parse(debounced) as ServerQuickFilter | null) ?? undefined;
}

// The view's root task list, one POST /tasks/list page (FETCH_PAGE_LIMIT rows)
// at a time via the API's cursor. Table views load more on scroll (TableView
// calls fetchNextPage near the bottom); every other layout is drained to the
// end by useTasksSync, since a calendar/board/roadmap needs every task in range
// at once. Same key/options from every caller, so they share one cache entry.
export function useRootTasksQuery(view: ProjectView | undefined) {
  const token = useAtomValue(tokenAtom);
  const viewId = TASKS_API_ENABLED && view ? Number(view.id) : undefined;
  const { quick, key } = useRootRequest(view);
  return useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => {
      const filter = buildTaskFilter(view!, undefined, pageParam, quick);
      // A quick filter with no overlap with what the view allows — nothing can
      // match, and the API rejects an empty status/tag list.
      if (!filter.any_of_task_status.length || !filter.any_of_task_tag.length) {
        return Promise.resolve([] as TaskInfoDto[]);
      }
      return withAuthRetry(token, t => listTasks(t, viewId!, filter));
    },
    initialPageParam: undefined as TaskCursor | undefined,
    getNextPageParam: (last, all) =>
      all.length >= MAX_PAGES ? undefined : cursorAfter(last),
    // The Calendar loads by month bucket instead (useCalendarBuckets).
    enabled: !!token && viewId !== undefined && view?.type !== 'calendar',
    // Changing the filter keeps the current rows on screen until the new page
    // arrives, instead of flashing an empty table — same view only.
    placeholderData: (prev, prevQuery) =>
      prevQuery?.queryKey[1] === viewId ? prev : undefined,
  });
}

export function useTasksSync(view: ProjectView | undefined) {
  const token = useAtomValue(tokenAtom);
  const [items, setItems] = useAtom(itemsAtom);
  const queryClient = useQueryClient();

  const viewId = TASKS_API_ENABLED && view ? Number(view.id) : undefined;
  const enabled = !!token && viewId !== undefined;
  const query = useRootTasksQuery(view);
  const calendar = useCalendarBuckets(view);
  const isCalendar = view?.type === 'calendar';
  const listRows = useMemo(() => query.data?.pages.flat(), [query.data]);
  const rows = isCalendar ? calendar.rows : listRows;
  const pending = isCalendar ? calendar.loading : query.isPending;
  const loadError = isCalendar ? calendar.error : query.error;

  // Non-table layouts need the whole list — keep fetching until the last page.
  const loadsOnScroll = view?.type === 'table';
  // Keyed on the page count too: a fast response can batch the "fetching"
  // and "done" renders together, leaving isFetching looking unchanged.
  const { hasNextPage, isFetching, fetchNextPage } = query;
  const pageCount = query.data?.pages.length ?? 0;
  useEffect(() => {
    if (!loadsOnScroll && hasNextPage && !isFetching) {
      fetchNextPage();
    }
  }, [loadsOnScroll, hasNextPage, isFetching, fetchNextPage, pageCount]);

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
    if (!rows) {
      if (switched) {
        setItems([]);
      }
      return;
    }
    const freshRoots = rows.map(taskFromServer);
    const freshRootIds = new Set(freshRoots.map(t => t.id));
    setItems(prev => {
      if (switched) {
        return freshRoots;
      }
      // A refresh (or a filter change) of the same view shouldn't throw away
      // subtrees someone already expanded on demand — but only those still
      // hanging off a root that came back; a subtask whose root the filter
      // just dropped would otherwise show up as a stray top-level row.
      const byId = new Map(prev.map(i => [i.id, i]));
      const rootOf = (i: WorkItem): string => {
        let cur = i;
        for (let hops = 0; cur.parentId && hops < 50; hops++) {
          const up = byId.get(cur.parentId);
          if (!up) {
            return cur.parentId;
          }
          cur = up;
        }
        return cur.id;
      };
      const keep = prev.filter(
        i =>
          !freshRootIds.has(i.id) &&
          i.parentId !== null &&
          freshRootIds.has(rootOf(i)),
      );
      return [...freshRoots, ...keep];
    });
  }, [viewId, rows, setItems]);

  useEffect(() => {
    if (loadError) {
      console.warn('Could not load tasks from the server:', loadError);
    }
  }, [loadError]);

  // Switching to a local-only view (or signing out) drops whatever server tasks
  // were loaded for the last one — they belong to a different view/account.
  useEffect(() => {
    if (viewId === undefined && items.some(i => isServerTaskId(i.id))) {
      setItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the view/token actually changing, not to every items write
  }, [viewId, token]);

  // `enabled && isPending`, not `isLoading`: plain `isLoading` (isPending &&
  // fetchStatus === 'fetching') stays false for the one render where a query
  // has just flipped from disabled to enabled (e.g. the same render `active`
  // first resolves, right after switching views/views finish loading) — React
  // Query doesn't dispatch the actual fetch until its own effect runs after
  // that commit. TableView was reading that render's items ([]) and loading
  // (false) together and showing "No tasks yet" instead of a skeleton. Plain
  // `isPending` alone would fix that but then never clears for a disabled
  // query (TASKS_API_ENABLED off, or a local-only view), which has no data and
  // never fetches — gating on `enabled` keeps that case resolving to false.
  const setLoading = useSetAtom(tasksLoadingAtom);
  useEffect(() => {
    setLoading(enabled && pending);
  }, [enabled, pending, setLoading]);

  const refetch = () =>
    viewId !== undefined
      ? queryClient.invalidateQueries({ queryKey: ['tasks', viewId] })
      : Promise.resolve();

  return { ready: !pending, loading: enabled && pending, refetch };
}
