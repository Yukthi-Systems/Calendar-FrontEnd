import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { tokenAtom, userAtom } from '../atoms/auth';
import { activeViewIdAtom, viewsAtom } from '../atoms/project';
import { userInfoAtom } from '../atoms/userInfo';
import { useUpdateUserInfo } from './useUpdateUserInfo';
import {
  createTaskView,
  deleteTaskView,
  listTaskViews,
  updateTaskView,
} from '../services/views';
import {
  isServerViewId,
  viewFromServer,
  viewToCreatePayload,
  viewToUpdatePayload,
} from '../data/viewSync';
import type { ProjectView } from '../data/types';

// Task views now live in Tasks-Main-API's /views (one row per view; GET /views/get,
// PATCH /views/update, DELETE /views/delete), fetched and mutated through TanStack
// Query. On sign-in the server's list replaces the local one. A brand-new account
// has no server views yet, so whatever is local (the three built-in defaults, or
// anything made before this sync existed) is pushed up once, so it isn't lost —
// guarded by a `viewsMigrated` flag kept in `private_info.settings` (see
// useSettingsSync) so a deliberate "delete everything" doesn't get silently undone
// by the same migration on the next sign-in.
//
// addView/editView/removeView below are what the UI should call instead of touching
// viewsAtom directly: signed in, they call the API (via mutations) and reconcile
// viewsAtom from the response; signed out (or on a request failure) they fall back
// to local-only, same as before this API existed.
export function useViewsSync() {
  const token = useAtomValue(tokenAtom);
  const userId = useAtomValue(userAtom)?.user_id;
  const info = useAtomValue(userInfoAtom);
  const [views, setViews] = useAtom(viewsAtom);
  const setActiveId = useSetAtom(activeViewIdAtom);
  const [ready, setReady] = useState(false);
  const queryClient = useQueryClient();
  const updateUserInfo = useUpdateUserInfo();

  const viewsQuery = useQuery({
    queryKey: ['views', userId],
    queryFn: () => listTaskViews(token!),
    enabled: !!token && !!userId,
  });

  const createMutation = useMutation({
    mutationFn: (draft: Omit<ProjectView, 'id'>) =>
      createTaskView(token!, viewToCreatePayload(draft)),
  });
  const updateMutation = useMutation({
    mutationFn: (view: ProjectView) =>
      updateTaskView(token!, viewToUpdatePayload(view)),
  });
  const deleteMutation = useMutation({
    mutationFn: (viewId: number) => deleteTaskView(token!, viewId),
  });

  const migratedFor = useRef<string | null>(null);
  const viewsRef = useRef(views);
  viewsRef.current = views;

  useEffect(() => {
    if (!token) {
      migratedFor.current = null;
      setReady(true);
      return;
    }
    if (viewsQuery.isPending || viewsQuery.isError) {
      return;
    }
    if (!info || migratedFor.current === info.user_id) {
      setReady(true);
      return;
    }

    const server = viewsQuery.data ?? [];
    if (server.length > 0) {
      migratedFor.current = info.user_id;
      setViews(server.map(viewFromServer));
      setReady(true);
      return;
    }

    const settings = (info.private_info?.settings ?? {}) as Record<
      string,
      unknown
    >;
    if (settings.viewsMigrated) {
      migratedFor.current = info.user_id;
      setReady(true);
      return;
    }

    migratedFor.current = info.user_id;
    (async () => {
      if (viewsRef.current.length > 0) {
        for (const v of viewsRef.current) {
          try {
            await createMutation.mutateAsync(v);
          } catch (err) {
            console.warn('Could not move view to the server:', v.name, err);
          }
        }
        try {
          const after = await queryClient.query({
            queryKey: ['views', userId],
            queryFn: () => listTaskViews(token),
            staleTime: 0,
          });
          if (after.length > 0) {
            setViews(after.map(viewFromServer));
          }
        } catch (err) {
          console.warn('Could not reload views after moving them up:', err);
        }
      }
      updateUserInfo.mutate(
        {
          isPublic: false,
          info: { ...info.private_info, settings: { ...settings, viewsMigrated: true } },
        },
        {
          onError: err =>
            console.warn('Could not record that views were moved:', err),
        },
      );
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per signed-in user, once the list query has settled
  }, [token, info?.user_id, viewsQuery.isPending, viewsQuery.isError, viewsQuery.data]);

  // Keeps the active tab pointed at a view that still exists, once sync settles.
  useEffect(() => {
    if (!ready) {
      return;
    }
    setActiveId(prev =>
      views.some(v => v.id === prev) ? prev : views[0]?.id ?? '',
    );
  }, [ready, views, setActiveId]);

  const refetchViews = async () => {
    if (!token) {
      return;
    }
    try {
      const server = await queryClient.query({
        queryKey: ['views', userId],
        queryFn: () => listTaskViews(token),
        staleTime: 0,
      });
      setViews(server.map(viewFromServer));
    } catch (err) {
      console.warn('Could not reload views from the server:', err);
    }
  };

  const addView = async (draft: Omit<ProjectView, 'id'>): Promise<string> => {
    if (!token) {
      const id = `v-${Date.now()}`;
      setViews(prev => [...prev, { ...draft, id }]);
      return id;
    }
    try {
      await createMutation.mutateAsync(draft);
      const server = await queryClient.query({
        queryKey: ['views', userId],
        queryFn: () => listTaskViews(token),
        staleTime: 0,
      });
      const next = server.map(viewFromServer);
      setViews(next);
      return (
        next.find(v => v.name === draft.name)?.id ?? next[next.length - 1]?.id ?? ''
      );
    } catch (err) {
      console.warn('Could not create view on the server:', err);
      const id = `v-${Date.now()}`;
      setViews(prev => [...prev, { ...draft, id }]);
      return id;
    }
  };

  const editView = async (view: ProjectView): Promise<void> => {
    setViews(prev => prev.map(v => (v.id === view.id ? view : v)));
    if (!token || !isServerViewId(view.id)) {
      return;
    }
    try {
      await updateMutation.mutateAsync(view);
    } catch (err) {
      console.warn('Could not save view to the server:', err);
    }
  };

  const removeView = async (view: ProjectView): Promise<void> => {
    if (!token || !isServerViewId(view.id)) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(Number(view.id));
    } catch (err) {
      console.warn('Could not delete view on the server:', err);
    }
  };

  // No restore endpoint exists — undoing a delete recreates the view as a new row.
  const restoreView = (view: ProjectView): Promise<string> => addView(view);

  return { ready, addView, editView, removeView, restoreView, refetchViews };
}
