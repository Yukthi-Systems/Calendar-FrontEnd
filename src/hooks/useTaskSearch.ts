import { useInfiniteQuery } from '@tanstack/react-query';
import { useAtomValue } from 'jotai';
import { tokenAtom } from '../atoms/auth';
import { listTasks } from '../services/tasks';
import { withAuthRetry } from '../services/authRetry';
import { buildSearchFilter, taskFromServer, type TaskSearch } from '../data/taskSync';
import { useDebouncedValue } from './useDebouncedValue';
import type { ProjectView } from '../data/types';

// Search = POST /tasks/list/{view_id} with the user's filters — the view's
// top-level tasks, matched by the server (title contains, any of the statuses,
// any of the tags, wholly inside the date range), sorted by start date, one
// page at a time via the cursor it returns. Nothing is filtered on the device.
// See docs/BACKEND.md §10.

const PAGE = 25;
const DEBOUNCE_MS = 300;

export function useTaskSearch(view: ProjectView | undefined, search: TaskSearch, enabled: boolean) {
  const token = useAtomValue(tokenAtom);
  // Debounced as a string: `search` is a new object every render.
  const key = JSON.stringify(search);
  const debouncedKey = useDebouncedValue(key, DEBOUNCE_MS);
  const debounced = JSON.parse(debouncedKey) as TaskSearch;
  const valid =
    debounced.statuses.length > 0 &&
    debounced.tags.length > 0 &&
    !(debounced.from && debounced.to && debounced.from > debounced.to);
  const viewId = view ? Number(view.id) : undefined;

  const query = useInfiniteQuery({
    queryKey: ['taskSearch', viewId, debouncedKey],
    enabled: enabled && !!token && viewId !== undefined && valid,
    initialPageParam: undefined as { cursor_start_at: string; cursor_task_id: number } | undefined,
    queryFn: ({ pageParam }) =>
      withAuthRetry(token, t => listTasks(t, viewId!, buildSearchFilter(debounced, PAGE, pageParam))),
    getNextPageParam: last =>
      last.length < PAGE
        ? undefined
        : {
            cursor_start_at: last[last.length - 1].start_at,
            cursor_task_id: last[last.length - 1].task_id,
          },
  });

  return {
    results: (query.data?.pages ?? []).flat().map(taskFromServer),
    // True while the typed filters haven't been sent yet, or the request is out.
    isSearching: query.isFetching || debouncedKey !== key,
    isLoading: query.isLoading,
    error: query.error,
    hasMore: query.hasNextPage,
    loadMore: () => query.fetchNextPage(),
    loadingMore: query.isFetchingNextPage,
  };
}
