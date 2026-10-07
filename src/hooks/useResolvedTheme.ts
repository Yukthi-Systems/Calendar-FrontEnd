import { useColorScheme } from 'react-native';
import { useAtomValue } from 'jotai';
import { themeAtom } from '../atoms/theme';
import { paletteByKey, type Palette } from '../data/palettes';

// Resolves the user's theme setting ('light' | 'dark' | 'system') against the
// OS scheme, and looks up the chosen palette — the one place both the
// NativeWind vars (ThemeRoot) and the raw-hex hooks (useThemeColors) read from,
// so they can never disagree.
export function useResolvedTheme(): { dark: boolean; palette: Palette } {
  const { mode, paletteKey } = useAtomValue(themeAtom);
  const system = useColorScheme();
  const dark = mode === 'system' ? system === 'dark' : mode === 'dark';
  return { dark, palette: paletteByKey(paletteKey) };
}
