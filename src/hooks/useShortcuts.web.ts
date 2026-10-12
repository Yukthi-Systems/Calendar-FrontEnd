import { useEffect, useRef } from 'react';

export type Shortcuts = Record<string, () => void>;

// Single-key app shortcuts on web ('n', '/', …). Ignored while typing in a field,
// with a modifier held, or while a dialog is open (RNW marks those aria-modal).
// Native counterpart: useShortcuts.native.ts (no-op — no hardware keyboard focus).
export function useShortcuts(map: Shortcuts) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) {
        return;
      }
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.isContentEditable)
      ) {
        return;
      }
      if (document.querySelector('[aria-modal="true"]')) {
        return;
      }
      const fn = ref.current[e.key.toLowerCase()];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
