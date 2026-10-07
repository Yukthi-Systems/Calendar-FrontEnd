import { useResolvedTheme } from './useResolvedTheme';

// Raw colors for props that can't take a className (svg icons, placeholders,
// third-party components that take a theme object). Driven by the selected
// palette (src/data/palettes.ts) — keep ThemeRoot.tsx's NativeWind vars in
// step with these field names.
export const useThemeColors = () => {
  const { dark, palette } = useResolvedTheme();
  const colors = dark ? palette.dark : palette.light;
  return {
    heading: colors.foreground,
    text: colors.mutedForeground,
    accent: colors.primary,
    accentForeground: colors.primaryForeground,
    border: colors.border,
    card: colors.card,
    bg: colors.background,
    destructive: colors.destructive,
    destructiveForeground: colors.destructiveForeground,
  };
};
