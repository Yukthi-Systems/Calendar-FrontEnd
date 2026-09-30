import { useEffect, useRef } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import {
  activeViewIdAtom,
  projectHydratedAtom,
  viewsAtom,
} from '../atoms/project';

const PARAM = 'view';

// Keeps the URL's `?view=<id>` in step with the active tab: refreshing or
// sharing the link lands back on the same view, and Back/Forward move between
// views already visited this session. Native counterpart: useViewUrlSync.native.ts.
export function useViewUrlSync() {
  const [views] = useAtom(viewsAtom);
  const hydrated = useAtomValue(projectHydratedAtom);
  const [activeId, setActiveId] = useAtom(activeViewIdAtom);
  const appliedFromUrl = useRef(false);

  // Once (per load): a `?view=` in the URL wins over whatever local storage
  // restored — a deep link should go where it says, not where you left off.
  // Waits for hydration so it's checking the real view list, not the mock
  // seed the atoms start with before storage has been read.
  useEffect(() => {
    if (appliedFromUrl.current || !hydrated) {
      return;
    }
    appliedFromUrl.current = true;
    const fromUrl = new URLSearchParams(window.location.search).get(PARAM);
    if (fromUrl && fromUrl !== activeId && views.some(v => v.id === fromUrl)) {
      setActiveId(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

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
