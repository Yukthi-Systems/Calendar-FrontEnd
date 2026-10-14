import { useMemo } from 'react';
import { useResolvedTheme } from './useResolvedTheme';
import { deriveTokens } from '../theme/tokens';
import { tone } from '../theme/color';

// Raw colors for props that can't take a className (svg icons, placeholders,
// third-party components that take a theme object). Same values ThemeRoot.tsx
// applies as NativeWind vars — both read src/theme/tokens.ts.
export const useThemeColors = () => {
  const { dark, palette } = useResolvedTheme();
  return useMemo(
    () => ({ ...deriveTokens(dark ? palette.dark : palette.light, dark), dark }),
    [dark, palette],
  );
};

// Badge colours for a status/tag hex, adjusted for the current theme.
export const useTone = () => {
  const { dark } = useResolvedTheme();
  return (color: string) => tone(color, dark);
};
