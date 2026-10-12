import { Pressable } from 'react-native';
import type { PressProps } from './Press.types';

const FEEDBACK = {
  scale: 'active:opacity-80 active:scale-[0.97]',
  subtle: 'active:opacity-85',
  none: '',
} as const;

// iOS/Android: NativeWind's `active:` modifiers give the pressed state (there's no
// hover). Web counterpart: Press.web.tsx.
export function Press({ feedback = 'scale', className, ...props }: PressProps) {
  return (
    <Pressable
      {...props}
      className={`${className ?? ''} ${FEEDBACK[feedback]}`}
    />
  );
}
