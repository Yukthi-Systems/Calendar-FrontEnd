import type { ReactNode } from 'react';

// No-op on iOS/Android — there's no hover there, so a tooltip has nothing to
// respond to. `label` is accepted (and ignored) so call sites don't need to
// branch by platform. Web counterpart: Tooltip.web.tsx.
export function Tooltip({ children }: { label: string; children: ReactNode }) {
  return children;
}
