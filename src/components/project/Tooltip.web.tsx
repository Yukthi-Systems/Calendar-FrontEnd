import type { ReactNode } from 'react';

// A real browser tooltip (the native `title` attribute) on hover. react-native-web's
// own <View>/<Pressable> don't forward `title` to the DOM, so this renders a plain
// HTML element directly — safe here since this file only ever runs in the web
// bundle. `display: contents` keeps it invisible to layout: the wrapper takes no
// box of its own, so wrapping something in a Tooltip never shifts its size or
// position. Native counterpart: Tooltip.native.tsx (a no-op; there's no hover there).
export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div title={label} style={{ display: 'contents' }}>
      {children}
    </div>
  );
}
