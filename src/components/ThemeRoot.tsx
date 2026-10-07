import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { vars } from 'nativewind';
import { useResolvedTheme } from '../hooks/useResolvedTheme';

// Converts "#rrggbb" to the "r g b" channel string Tailwind's rgb(var(--x) /
// <alpha-value>) expects (see global.css).
const channels = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  // eslint-disable-next-line no-bitwise -- extracting R/G/B bytes from a hex int
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

// Applies the selected palette (src/data/palettes.ts) as NativeWind CSS
// variables on a root View, so every `bg-bg-main`/`text-accent`/etc. className
// in the tree picks it up — on web and native alike. This is what makes
// palette switching live instead of only a fixed light/dark pair.
export function ThemeRoot({ children }: { children: ReactNode }) {
  const { dark, palette } = useResolvedTheme();
  const colors = dark ? palette.dark : palette.light;
  const cssVars = {
    '--text': channels(colors.mutedForeground),
    '--text-h': channels(colors.foreground),
    '--bg': channels(colors.background),
    '--card': channels(colors.card),
    '--border': channels(colors.border),
    '--accent': channels(colors.primary),
    '--accent-fg': channels(colors.primaryForeground),
    '--destructive': channels(colors.destructive),
    '--destructive-fg': channels(colors.destructiveForeground),
  };

  // On web, react-native-web's <Modal> portals its content straight onto
  // document.body — it keeps the React tree (so context still works) but
  // leaves the real DOM tree this View's vars() are attached to. CSS custom
  // properties only inherit through DOM ancestry, not React portals, so any
  // modal would otherwise be stuck on the stylesheet's static fallback
  // palette. Mirroring the same variables onto the true document root fixes
  // that, since every portal still lands somewhere under <html>. Native has
  // no such portal — RN's Modal there stays in the same (React Context-based)
  // tree these vars() already reach — so this is a web-only step.
  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }
    const root = document.documentElement.style;
    Object.entries(cssVars).forEach(([key, value]) => root.setProperty(key, value));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cssVars is a fresh object each render; dark+palette.key fully determine its contents
  }, [dark, palette.key]);

  return (
    <View style={[{ flex: 1 }, vars(cssVars)]}>{children}</View>
  );
}
