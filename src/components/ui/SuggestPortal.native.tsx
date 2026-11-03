import type { ReactNode } from 'react';

// Native has no DOM/portal to escape to, and doesn't share Web's "every View
// defaults to position: relative" stacking quirk (see the .web counterpart),
// so rendering in place — absolute-positioned relative to its own anchor —
// already works correctly. Just pass children through.
export function SuggestPortal({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
