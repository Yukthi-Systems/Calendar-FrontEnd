import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDefaultStore, useAtomValue } from 'jotai';
import { tokenAtom } from '../atoms/auth';
import { activeViewIdAtom } from '../atoms/project';
import {
  createSharedTaskView,
  createTaskView,
  deleteSharedTaskView,
  deleteTaskView,
  listSharedUsersForView,
  listTaskViews,
  updateSharedTaskView,
  updateTaskView,
} from '../services/views';
import { queryClient as appQueryClient } from '../services/queryClient';
import { withAuthRetry } from '../services/authRetry';
import {
  viewFromServer,
  viewToCreatePayload,
  viewToUpdatePayload,
} from '../data/viewSync';
import type { ProjectView } from '../data/types';
import type { SharedTaskViewDto, TaskViewDbDto } from '../services/types';

// Views and sharing — read straight from Tasks-Main-API (/views, /shared) via
// TanStack Query, written straight back, then refetched. No local copy, no
// defaults, no migration. See docs/BACKEND.md §3–4.

export const viewsKey = (kind: 'mine' | 'shared') => ['views', kind] as const;
export const sharesKey = (viewId: string) => ['shares', viewId] as const;

// Every view write here refetches explicitly, so the lists don't need to go stale
// on a timer — that only caused a re-list each time a sheet using them mounted.
const VIEWS_STALE_MS = 5 * 60_000;

// GET /views/list/false (mine) + GET /views/list/true (shared with me).
export function useViewList() {
  const token = useAtomValue(tokenAtom);
  const mine = useQuery({
    queryKey: viewsKey('mine'),
    queryFn: () => withAuthRetry(token, t => listTaskViews(t, false)),
    enabled: !!token,
    staleTime: VIEWS_STALE_MS,
    select: (rows: TaskViewDbDto[]) => rows.map(r => viewFromServer(r, false)),
  });
  const shared = useQuery({
    queryKey: viewsKey('shared'),
    queryFn: () => withAuthRetry(token, t => listTaskViews(t, true)),
    enabled: !!token,
    staleTime: VIEWS_STALE_MS,
    select: (rows: TaskViewDbDto[]) => rows.map(r => viewFromServer(r, true)),
  });
  const myViews = mine.data ?? [];
  const sharedViews = shared.data ?? [];
  return {
    myViews,
    sharedViews,
    views: [...myViews, ...sharedViews],
    // `ready`: the owned list has answered (shared is a bonus — a failure there
    // shouldn't block the workspace).
    ready: mine.isSuccess || mine.isError,
    isLoading: mine.isLoading,
    error: mine.error,
    refetch: () => Promise.all([mine.refetch(), shared.refetch()]),
  };
}

// The view the workspace is showing: the selected id if it still exists, else the
// first one. The selection itself is UI state (activeViewIdAtom, mirrored in the
// URL on web) — never stored on the device.
export function useActiveView(): ProjectView | undefined {
  const { views } = useViewList();
  const activeId = useAtomValue(activeViewIdAtom);
  return views.find(v => v.id === activeId) ?? views[0];
}

// Same, for code outside React (the native widget bridge).
export function activeViewFromCache(): ProjectView | undefined {
  const rows = (kind: 'mine' | 'shared') =>
    (appQueryClient.getQueryData<TaskViewDbDto[]>(viewsKey(kind)) ?? []).map(r =>
      viewFromServer(r, kind === 'shared'),
    );
  const views = [...rows('mine'), ...rows('shared')];
  const activeId = getDefaultStore().get(activeViewIdAtom);
  return views.find(v => v.id === activeId) ?? views[0];
}

export type ViewDraftFields = Omit<ProjectView, 'id' | 'ownerId' | 'shared'>;

// Create / edit / delete my views. Each write goes to the server and then
// refetches the list — the list on screen is always the server's.
export function useViewMutations() {
  const token = useAtomValue(tokenAtom);
  const queryClient = useQueryClient();

  const refetchMine = () =>
    queryClient.fetchQuery({
      queryKey: viewsKey('mine'),
      queryFn: () => withAuthRetry(token, t => listTaskViews(t, false)),
      staleTime: 0,
    });

  const create = useMutation({
    mutationFn: async (draft: ViewDraftFields): Promise<string> => {
      await withAuthRetry(token, t => createTaskView(t, viewToCreatePayload(draft)));
      // POST /views/create returns no id; (owner, view_name) is unique, so the
      // refetched list identifies the new row by name.
      const rows = await refetchMine();
      return String(rows.find(r => r.view_name === draft.name)?.view_id ?? '');
    },
  });
  const update = useMutation({
    mutationFn: (view: ProjectView) =>
      withAuthRetry(token, t => updateTaskView(t, viewToUpdatePayload(view))),
    onSettled: () => queryClient.invalidateQueries({ queryKey: viewsKey('mine') }),
  });
  const remove = useMutation({
    mutationFn: (view: ProjectView) =>
      withAuthRetry(token, t => deleteTaskView(t, Number(view.id))),
    onSettled: () => queryClient.invalidateQueries({ queryKey: viewsKey('mine') }),
  });

  return {
    createView: create.mutateAsync,
    updateView: update.mutateAsync,
    deleteView: remove.mutateAsync,
  };
}

// Who a view of mine is shared with — GET /shared/list/{view_id} (owner only).
export function useViewShares(view: ProjectView | null) {
  const token = useAtomValue(tokenAtom);
  const enabled = !!token && !!view && !view.shared;
  return useQuery({
    queryKey: sharesKey(view?.id ?? ''),
    queryFn: () => withAuthRetry(token, t => listSharedUsersForView(t, Number(view!.id))),
    enabled,
  });
}

export interface ShareDraft {
  userId: string;
  notes: string;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

const sharePayload = (viewId: string, d: ShareDraft) => ({
  view_id: Number(viewId),
  user_id: d.userId,
  share_notes: d.notes,
  ui_info: {},
  can_create: d.canCreate,
  can_edit: d.canEdit,
  can_delete: d.canDelete,
});

export const shareFromServer = (s: SharedTaskViewDto): ShareDraft => ({
  userId: s.user_id,
  notes: s.share_notes ?? '',
  canCreate: s.can_create,
  canEdit: s.can_edit,
  canDelete: s.can_delete,
});

// Add / change / revoke one person's access (POST/PATCH/DELETE /shared/*), then
// refetch the share list.
export function useShareMutations(viewId: string) {
  const token = useAtomValue(tokenAtom);
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: sharesKey(viewId) });

  const add = useMutation({
    mutationFn: (d: ShareDraft) =>
      withAuthRetry(token, t => createSharedTaskView(t, sharePayload(viewId, d))),
    onSettled: refresh,
  });
  const change = useMutation({
    mutationFn: (d: ShareDraft) =>
      withAuthRetry(token, t => updateSharedTaskView(t, sharePayload(viewId, d))),
    onSettled: refresh,
  });
  const revoke = useMutation({
    mutationFn: (userId: string) =>
      withAuthRetry(token, t => deleteSharedTaskView(t, Number(viewId), userId)),
    onSettled: refresh,
  });
  return {
    addShare: add.mutateAsync,
    updateShare: change.mutateAsync,
    removeShare: revoke.mutateAsync,
  };
}
