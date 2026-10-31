import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDefaultStore, useAtomValue } from 'jotai';
import { tokenAtom } from '../atoms/auth';
import { activeViewIdAtom } from '../atoms/project';
import { currentUserIdAtom } from '../atoms/members';
import {
  createSharedTaskView,
  createTaskView,
  deleteSharedTaskView,
  deleteTaskView,
  getSharedTaskView,
  listSharedUsersForView,
  listTaskViews,
  updateMySharedViewInfo,
  updateTaskView,
} from '../services/views';
import { queryClient as appQueryClient } from '../services/queryClient';
import { withAuthRetry } from '../services/authRetry';
import {
  applySharedUiInfo,
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
    // `ready`: both lists have answered (success or error) — a `?view=` URL
    // pointing at a *shared* view has to be checked against the full
    // mine+shared list, not just `mine`; waiting on `mine` alone raced the
    // slower `shared` query on reload, landing on `views[0]` (see
    // useActiveView's fallback) instead of the shared view in the URL
    // whenever `mine` happened to resolve first.
    ready: (mine.isSuccess || mine.isError) && (shared.isSuccess || shared.isError),
    isLoading: mine.isLoading,
    error: mine.error,
    refetch: () => Promise.all([mine.refetch(), shared.refetch()]),
  };
}

// The view the workspace is showing: the selected id if it still exists, else the
// first one. The selection itself is UI state (activeViewIdAtom, mirrored in the
// URL on web) — never stored on the device. For a shared view, overlays the
// viewer's own saved ui_info (their quick filter — see applySharedUiInfo) on
// top of the owner's, so it's there again next time they open it, same as it
// would be for a view they own.
export function useActiveView(): ProjectView | undefined {
  const { views } = useViewList();
  const activeId = useAtomValue(activeViewIdAtom);
  const base = views.find(v => v.id === activeId) ?? views[0];
  const myShare = useMyShare(base);
  if (base?.shared && myShare.data) {
    return applySharedUiInfo(base, myShare.data.ui_info);
  }
  return base;
}

// Same, for code outside React (the native widget bridge).
export function activeViewFromCache(): ProjectView | undefined {
  const rows = (kind: 'mine' | 'shared') =>
    (appQueryClient.getQueryData<TaskViewDbDto[]>(viewsKey(kind)) ?? []).map(
      r => viewFromServer(r, kind === 'shared'),
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
      await withAuthRetry(token, t =>
        createTaskView(t, viewToCreatePayload(draft)),
      );
      // POST /views/create returns no id; (owner, view_name) is unique, so the
      // refetched list identifies the new row by name.
      const rows = await refetchMine();
      return String(rows.find(r => r.view_name === draft.name)?.view_id ?? '');
    },
  });
  const update = useMutation({
    mutationFn: (view: ProjectView) =>
      withAuthRetry(token, t => updateTaskView(t, viewToUpdatePayload(view))),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: viewsKey('mine') }),
  });
  const remove = useMutation({
    mutationFn: (view: ProjectView) =>
      withAuthRetry(token, t => deleteTaskView(t, Number(view.id))),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: viewsKey('mine') }),
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
    queryFn: () =>
      withAuthRetry(token, t => listSharedUsersForView(t, Number(view!.id))),
    enabled,
  });
}

export const myShareKey = (viewId: string) => ['myShare', viewId] as const;

// My own access to a view someone shared with me — GET /shared/info/{view_id}/{me}.
// Cached briefly (many components ask); `fresh` refetches on mount, e.g. the ⋯
// menu, so a change by the owner shows up there. The refresh button invalidates it.
export function useMyShare(
  view: ProjectView | null | undefined,
  fresh = false,
) {
  const token = useAtomValue(tokenAtom);
  const me = useAtomValue(currentUserIdAtom);
  return useQuery({
    queryKey: [...myShareKey(view?.id ?? ''), me],
    queryFn: () =>
      withAuthRetry(token, t => getSharedTaskView(t, Number(view!.id), me)),
    enabled: !!token && !!me && !!view?.shared,
    staleTime: 60_000,
    refetchOnMount: fresh ? 'always' : true,
  });
}

// Saves my own ui_info on a view shared with me (PATCH
// /shared/update-shared/{view_id}) — distinct from useViewMutations().updateView,
// which only the owner may call. Used by TableView.tsx for a shared view's
// quick filter (useActiveView overlays it back via applySharedUiInfo on read).
export function useUpdateMySharedViewInfo() {
  const token = useAtomValue(tokenAtom);
  const me = useAtomValue(currentUserIdAtom);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({
      viewId,
      uiInfo,
    }: {
      viewId: string;
      uiInfo: Record<string, unknown>;
    }) =>
      withAuthRetry(token, t =>
        updateMySharedViewInfo(t, Number(viewId), uiInfo),
      ),
    onSuccess: (_data, { viewId }) => {
      queryClient.invalidateQueries({ queryKey: [...myShareKey(viewId), me] });
    },
  });
  return (viewId: string, uiInfo: Record<string, unknown>) =>
    mutation.mutateAsync({ viewId, uiInfo });
}

export interface ViewAccess {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

const FULL: ViewAccess = { canCreate: true, canEdit: true, canDelete: true };
const NONE: ViewAccess = { canCreate: false, canEdit: false, canDelete: false };

// What I may do with tasks in `view`: everything in my own views; in a shared one,
// exactly what the owner granted (the server's share record — the same one the
// server checks). Until that record has loaded, nothing — actions appear once known
// rather than flash in and vanish. If it can't be read, everything is offered and
// the server's answer (a toast on refusal) decides, rather than a dead-end screen.
export function useViewAccess(
  view: ProjectView | null | undefined,
): ViewAccess {
  const { data, isError } = useMyShare(view);
  if (!view) {
    return NONE;
  }
  if (!view.shared || isError) {
    return FULL;
  }
  return data
    ? {
        canCreate: data.can_create,
        canEdit: data.can_edit,
        canDelete: data.can_delete,
      }
    : NONE;
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
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: sharesKey(viewId) });

  const add = useMutation({
    mutationFn: (d: ShareDraft) =>
      withAuthRetry(token, t =>
        createSharedTaskView(t, sharePayload(viewId, d)),
      ),
    onSettled: refresh,
  });
  // TEMPORARY (2026-10-15) — backend bug #0c: PATCH /shared/update has no
  // `user_id` condition, so it rewrites *every* share of the view (permissions and
  // note). Until that's fixed, a change is "remove this person, add them back with
  // the new values": DELETE is exact (and clears their cached permission), so no
  // one else is touched. If the re-add fails, their old access is put back.
  // Restore `updateSharedTaskView` here once the backend filters by user.
  const change = useMutation({
    mutationFn: async ({
      next,
      prev,
    }: {
      next: ShareDraft;
      prev: ShareDraft;
    }) => {
      await withAuthRetry(token, t =>
        deleteSharedTaskView(t, Number(viewId), next.userId),
      );
      try {
        await withAuthRetry(token, t =>
          createSharedTaskView(t, sharePayload(viewId, next)),
        );
      } catch (err) {
        await withAuthRetry(token, t =>
          createSharedTaskView(t, sharePayload(viewId, prev)),
        ).catch(() => undefined);
        throw err;
      }
    },
    onSettled: refresh,
  });
  const revoke = useMutation({
    mutationFn: (userId: string) =>
      withAuthRetry(token, t =>
        deleteSharedTaskView(t, Number(viewId), userId),
      ),
    onSettled: refresh,
  });
  return {
    addShare: add.mutateAsync,
    updateShare: change.mutateAsync,
    removeShare: revoke.mutateAsync,
  };
}
