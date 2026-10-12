import { Pressable } from 'react-native';
import type { PressProps } from './Press.types';

// Web: press feedback is pure CSS (web/web.css `[data-press]`), so it runs on the
// compositor and eases in/out with the same timing as hover — no JS per frame.
// Native counterpart: Press.native.tsx.
export function Press({ feedback = 'scale', ...props }: PressProps) {
  return (
    <Pressable
      {...props}
      {...({ dataSet: { press: feedback } } as object)}
    />
  );
}
