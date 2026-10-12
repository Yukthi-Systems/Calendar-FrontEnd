import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { vars } from 'nativewind';
import { useResolvedTheme } from '../hooks/useResolvedTheme';
import { channels } from '../theme/color';
import { deriveTokens } from '../theme/tokens';

// Applies the selected palette (src/data/palettes.ts) as NativeWind CSS
// variables on a root View, so every `bg-bg-main`/`text-accent`/etc. className
// in the tree picks it up — on web and native alike. This is what makes
// palette switching live instead of only a fixed light/dark pair. The derived
// roles (muted, hover, success, …) come from src/theme/tokens.ts.
export function ThemeRoot({ children }: { children: ReactNode }) {
  const { dark, palette } = useResolvedTheme();
  const t = deriveTokens(dark ? palette.dark : palette.light, dark);
  const cssVars = {
    '--text': channels(t.text),
    '--text-h': channels(t.heading),
    '--text-subtle': channels(t.subtle),
    '--bg': channels(t.bg),
    '--card': channels(t.card),
    '--muted': channels(t.muted),
    '--hover': channels(t.hover),
    '--border': channels(t.border),
    '--border-strong': channels(t.borderStrong),
    '--accent': channels(t.accent),
    '--accent-fg': channels(t.accentForeground),
    '--accent-soft': channels(t.accentSoft),
    '--destructive': channels(t.destructive),
    '--destructive-fg': channels(t.destructiveForeground),
    '--success': channels(t.success),
    '--success-fg': channels(t.successForeground),
    '--warning': channels(t.warning),
    '--warning-fg': channels(t.warningForeground),
    '--info': channels(t.info),
    '--info-fg': channels(t.infoForeground),
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
    const root = document.documentElement;
    Object.entries(cssVars).forEach(([key, value]) =>
      root.style.setProperty(key, value),
    );
    // Native form controls (date/time pickers, scrollbars) follow the theme too.
    root.style.colorScheme = dark ? 'dark' : 'light';
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cssVars is a fresh object each render; dark+palette.key fully determine its contents
  }, [dark, palette.key]);

  return (
    <View style={[{ flex: 1 }, vars(cssVars)]}>{children}</View>
  );
}
