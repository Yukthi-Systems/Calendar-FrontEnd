import { useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { activeViewIdAtom } from '../atoms/project';
import { useViewList } from './useViews';

const PARAM = 'view';

// Keeps the URL's `?view=<id>` in step with the active tab: refreshing or
// sharing the link lands back on the same view, and Back/Forward move between
// views already visited this session. Native counterpart: useViewUrlSync.native.ts.
export function useViewUrlSync() {
  const { views, ready } = useViewList();
  const [activeId, setActiveId] = useAtom(activeViewIdAtom);
  const appliedFromUrl = useRef(false);

  // Once (per load): a `?view=` in the URL selects that view — after the server's
  // view list has loaded, so it's checked against real views.
  useEffect(() => {
    if (appliedFromUrl.current || !ready) {
      return;
    }
    appliedFromUrl.current = true;
    const fromUrl = new URLSearchParams(window.location.search).get(PARAM);
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
    if (url.searchParams.get(PARAM) === activeId) {
      return;
    }
    url.searchParams.set(PARAM, activeId);
    window.history.pushState({ view: activeId }, '', url);
  }, [activeId]);

  // Back/Forward.
  useEffect(() => {
    const onPopState = () => {
      const fromUrl = new URLSearchParams(window.location.search).get(PARAM);
      if (fromUrl && views.some(v => v.id === fromUrl)) {
        setActiveId(fromUrl);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [views, setActiveId]);
}
