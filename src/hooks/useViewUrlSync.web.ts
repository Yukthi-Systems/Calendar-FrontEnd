import { useEffect, useRef } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  activeViewIdAtom,
  contentModeAtom,
  itemsAtom,
  selectedItemIdAtom,
  tasksLoadingAtom,
  type ContentMode,
} from '../atoms/project';
import { useViewList } from './useViews';

const VIEW_PARAM = 'view';
const MODE_PARAM = 'mode';
const TASK_PARAM = 'task';
const isMode = (v: string | null): v is ContentMode => v === 'tasks' || v === 'recurring';

// Keeps the URL's `?view=<id>&mode=<tasks|recurring>` in step with the active tab
// and the Tasks/Recurring switch: refreshing or sharing the link lands back on the
// same view and mode, and Back/Forward move between ones already visited this
// session. Native counterpart: useViewUrlSync.native.ts.
export function useViewUrlSync() {
  const { views, ready } = useViewList();
  const [activeId, setActiveId] = useAtom(activeViewIdAtom);
  const [mode, setMode] = useAtom(contentModeAtom);
  const appliedFromUrl = useRef(false);
  const appliedTaskFromUrl = useRef(false);
  const items = useAtomValue(itemsAtom);
  const tasksLoading = useAtomValue(tasksLoadingAtom);
  const setSelectedId = useSetAtom(selectedItemIdAtom);

  // Once (per load): a `?view=` in the URL selects that view — after the server's
  // view list has loaded, so it's checked against real views. `?mode=` is already
  // applied — contentModeAtom seeds itself from the URL on first render (see
  // atoms/project.ts) — so there's nothing to do for it here.
  useEffect(() => {
    if (appliedFromUrl.current || !ready) {
      return;
    }
    appliedFromUrl.current = true;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get(VIEW_PARAM);
    if (fromUrl && fromUrl !== activeId && views.some(v => v.id === fromUrl)) {
      setActiveId(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Once (per load): a `?task=` in the URL opens that task — e.g. clicking a
  // push notification (see web/firebase-messaging-sw.js's notificationclick).
  // Waits for `?view=` above to actually land (if there was one) so itemsAtom
  // holds the right view's tasks before checking, rather than whatever was
  // loaded a moment earlier; a task not found among them (a sub-task never
  // expanded, or from a view not shared with this viewer) just doesn't open —
  // no error, since there's nothing wrong, just nothing more to go on here.
  useEffect(() => {
    if (appliedTaskFromUrl.current || !ready || tasksLoading) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const taskFromUrl = params.get(TASK_PARAM);
    if (!taskFromUrl) {
      return;
    }
    const viewFromUrl = params.get(VIEW_PARAM);
    if (viewFromUrl && activeId !== viewFromUrl) {
      return;
    }
    appliedTaskFromUrl.current = true;
    if (items.some(i => i.id === taskFromUrl)) {
      setSelectedId(taskFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tasksLoading, items, activeId]);

  // Keep the URL in step with the active tab (pushState, so Back/Forward work).
  useEffect(() => {
    if (!activeId) {
      return;
    }
    const url = new URL(window.location.href);
    if (url.searchParams.get(VIEW_PARAM) === activeId) {
      return;
    }
    url.searchParams.set(VIEW_PARAM, activeId);
    window.history.pushState({ view: activeId, mode }, '', url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Same, for the Tasks/Recurring switch.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get(MODE_PARAM) === mode) {
      return;
    }
    url.searchParams.set(MODE_PARAM, mode);
    window.history.pushState({ view: activeId, mode }, '', url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Back/Forward.
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get(VIEW_PARAM);
      if (fromUrl && views.some(v => v.id === fromUrl)) {
        setActiveId(fromUrl);
      }
      const modeFromUrl = params.get(MODE_PARAM);
      if (isMode(modeFromUrl)) {
        setMode(modeFromUrl);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [views, setActiveId, setMode]);
}
