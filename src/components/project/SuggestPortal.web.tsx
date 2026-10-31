import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Renders straight into document.body — sidesteps every ancestor's own CSS
// stacking context (RN Web gives every View position: relative by default,
// so a merely-higher z-index on a nested dropdown can still lose to a later,
// unrelated sibling subtree; see EventInviteesSection.tsx). A portal escapes
// that entirely instead of fighting it with more z-index.
export function SuggestPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') {
    return null;
  }
  return createPortal(children, document.body);
}
