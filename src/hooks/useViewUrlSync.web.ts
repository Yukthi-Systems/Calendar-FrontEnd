import { useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { activeViewIdAtom, contentModeAtom, type ContentMode } from '../atoms/project';
import { useViewList } from './useViews';

const VIEW_PARAM = 'view';
const MODE_PARAM = 'mode';
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
