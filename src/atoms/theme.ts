import { atom } from 'jotai';
import { DEFAULT_PALETTE_KEY } from '../data/palettes';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeSettings {
  mode: ThemeMode;
  paletteKey: string;
}

// Persisted by src/services/projectStore.ts alongside the rest of the account
// settings (profile, views, …).
export const themeAtom = atom<ThemeSettings>({
  mode: 'system',
  paletteKey: DEFAULT_PALETTE_KEY,
});
