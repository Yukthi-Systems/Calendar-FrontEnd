export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeSettings {
  mode: ThemeMode;
  paletteKey: string;
}

// Stored on the server in the user's private_info.settings.theme — read and
// written through src/hooks/useUsers.ts (useTheme / useSetTheme).
