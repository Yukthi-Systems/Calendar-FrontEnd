import { useResolvedTheme } from './useResolvedTheme';

// For props that take a raw color instead of a className (e.g. ActivityIndicator's
// `color`). Kept separate from useThemeColors() since most call sites only need
// this one value.
export const useAccentColor = () => {
  const { dark, palette } = useResolvedTheme();
  return dark ? palette.dark.primary : palette.light.primary;
};
