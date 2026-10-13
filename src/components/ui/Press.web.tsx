import { Pressable } from 'react-native';
import type { PressProps } from './Press.types';

// Web: press feedback is pure CSS (web/web.css `[data-press]`), so it runs on the
// compositor and eases in/out with the same timing as hover — no JS per frame.
//
// react-native-web 0.21 no longer maps `accessibilityState` onto the DOM, so
// selected tabs, checked boxes and expanded toggles were silent to screen readers.
// Translate it to the aria-* props it does forward. Native counterpart:
// Press.native.tsx (iOS/Android read accessibilityState directly).
export function Press({ feedback = 'scale', accessibilityState, ...props }: PressProps) {
  const a = accessibilityState ?? {};
  const aria = {
    ...(a.selected !== undefined ? { 'aria-selected': a.selected } : null),
    ...(a.checked !== undefined ? { 'aria-checked': a.checked } : null),
    ...(a.expanded !== undefined ? { 'aria-expanded': a.expanded } : null),
    ...(a.busy !== undefined ? { 'aria-busy': a.busy } : null),
    ...(a.disabled !== undefined ? { 'aria-disabled': a.disabled } : null),
  };
  return (
    <Pressable
      {...props}
      accessibilityState={accessibilityState}
      {...(aria as object)}
      {...({ dataSet: { press: feedback } } as object)}
    />
  );
}
