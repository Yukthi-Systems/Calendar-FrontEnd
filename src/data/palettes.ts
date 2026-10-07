// Ported from YSPL APPS/YCT/YCT-Mobile-App's src/constants/Colors.ts: the same
// named palettes, each with a full light + dark color set, so switching palette
// here matches switching it there. Reduced to the roles this app's tokens use
// (src/hooks/useThemeColors.ts, tailwind.config.js, global.css) — the source
// also has secondary/muted/accent/input/ring roles, but every one of those is
// always identical to another role already kept here in every palette (e.g.
// ring always equals primary, input always equals border), so carrying them
// separately would just be dead data.
export interface PaletteColors {
  background: string;
  foreground: string;
  mutedForeground: string;
  card: string;
  primary: string;
  primaryForeground: string;
  border: string;
  destructive: string;
  destructiveForeground: string;
}

export interface Palette {
  key: string;
  label: string;
  // For the picker swatch only.
  previewPrimary: string;
  previewAccent: string;
  light: PaletteColors;
  dark: PaletteColors;
}

export const PALETTES: Palette[] = [
  {
    key: 'default',
    label: 'Default',
    previewPrimary: '#aa3bff',
    previewAccent: '#c084fc',
    light: {
      background: '#ffffff',
      foreground: '#08060d',
      card: '#ffffff',
      primary: '#aa3bff',
      primaryForeground: '#ffffff',
      border: '#e5e4e7',
      mutedForeground: '#6b6375',
      destructive: '#ef4444',
      destructiveForeground: '#ffffff',
    },
    dark: {
      background: '#16171d',
      foreground: '#f3f4f6',
      card: '#1f2028',
      primary: '#c084fc',
      primaryForeground: '#16171d',
      border: '#2e303a',
      mutedForeground: '#9ca3af',
      destructive: '#ef4444',
      destructiveForeground: '#ffffff',
    },
  },
  {
    key: 'theme-whatsapp',
    label: 'WhatsApp',
    previewPrimary: '#146e29',
    previewAccent: '#29a352',
    light: {
      background: '#f0f8f1',
      foreground: '#0d2010',
      card: '#ffffff',
      primary: '#146e29',
      primaryForeground: '#ffffff',
      border: '#cde0cf',
      mutedForeground: '#6f7e71',
      destructive: '#ef4444',
      destructiveForeground: '#ffffff',
    },
    dark: {
      background: '#191f22',
      foreground: '#f2f2f2',
      card: '#222a2e',
      primary: '#29a352',
      primaryForeground: '#ffffff',
      border: '#333f43',
      mutedForeground: '#97a3a7',
      destructive: '#7a1d1d',
      destructiveForeground: '#f8fafc',
    },
  },
  {
    key: 'theme-whatsapp-web',
    label: 'WhatsApp Web',
    previewPrimary: '#00a884',
    previewAccent: '#075e54',
    light: {
      background: '#f5faf9',
      foreground: '#0c1e1c',
      card: '#ffffff',
      primary: '#00a884',
      primaryForeground: '#ffffff',
      border: '#c5e4df',
      mutedForeground: '#6c8580',
      destructive: '#ef4444',
      destructiveForeground: '#ffffff',
    },
    dark: {
      background: '#071219',
      foreground: '#e8eeef',
      card: '#121e22',
      primary: '#00a884',
      primaryForeground: '#ffffff',
      border: '#1f3038',
      mutedForeground: '#8fa4a8',
      destructive: '#7f1d1d',
      destructiveForeground: '#f8fafc',
    },
  },
  {
    key: 'theme-discord',
    label: 'Discord',
    previewPrimary: '#5865f2',
    previewAccent: '#7289da',
    light: {
      background: '#f5f5fe',
      foreground: '#141230',
      card: '#ffffff',
      primary: '#5865f2',
      primaryForeground: '#ffffff',
      border: '#d4d4f0',
      mutedForeground: '#6b6a8a',
      destructive: '#ef4444',
      destructiveForeground: '#ffffff',
    },
    dark: {
      background: '#1e2124',
      foreground: '#dcddde',
      card: '#2f3136',
      primary: '#5865f2',
      primaryForeground: '#ffffff',
      border: '#202225',
      mutedForeground: '#8e9297',
      destructive: '#ed4245',
      destructiveForeground: '#ffffff',
    },
  },
  {
    key: 'theme-slack',
    label: 'Slack',
    previewPrimary: '#6b3494',
    previewAccent: '#9b6ff5',
    light: {
      background: '#f7f5ff',
      foreground: '#180e2b',
      card: '#ffffff',
      primary: '#6b3494',
      primaryForeground: '#ffffff',
      border: '#dcd5ee',
      mutedForeground: '#6e6680',
      destructive: '#e01e5a',
      destructiveForeground: '#ffffff',
    },
    dark: {
      background: '#1a1a24',
      foreground: '#f0f0f5',
      card: '#222230',
      primary: '#9b6ff5',
      primaryForeground: '#1a1a24',
      border: '#333345',
      mutedForeground: '#95959e',
      destructive: '#e01e5a',
      destructiveForeground: '#f8fafc',
    },
  },
  {
    key: 'theme-mac',
    label: 'macOS',
    previewPrimary: '#007aff',
    previewAccent: '#30b0c7',
    light: {
      background: '#f3f8ff',
      foreground: '#0d1f30',
      card: '#ffffff',
      primary: '#007aff',
      primaryForeground: '#ffffff',
      border: '#c8dff0',
      mutedForeground: '#5a7085',
      destructive: '#ef4444',
      destructiveForeground: '#ffffff',
    },
    dark: {
      background: '#131314',
      foreground: '#f2f2f2',
      card: '#1c1c1e',
      primary: '#0a84ff',
      primaryForeground: '#ffffff',
      border: '#38383a',
      mutedForeground: '#98989a',
      destructive: '#ff453a',
      destructiveForeground: '#f8fafc',
    },
  },
  {
    key: 'theme-cyberpunk',
    label: 'Cyberpunk',
    previewPrimary: '#00adc4',
    previewAccent: '#00e5ff',
    light: {
      background: '#f3fafb',
      foreground: '#0d2a2e',
      card: '#ffffff',
      primary: '#00adc4',
      primaryForeground: '#ffffff',
      border: '#c0e8ef',
      mutedForeground: '#567a80',
      destructive: '#ef4444',
      destructiveForeground: '#ffffff',
    },
    dark: {
      background: '#0d0d1a',
      foreground: '#f2f2f2',
      card: '#161624',
      primary: '#00e5ff',
      primaryForeground: '#0d0d1a',
      border: '#252540',
      mutedForeground: '#8a8aaa',
      destructive: '#e01e5a',
      destructiveForeground: '#f8fafc',
    },
  },
  {
    key: 'theme-midnight',
    label: 'Midnight',
    previewPrimary: '#7c3aed',
    previewAccent: '#9b5cf2',
    light: {
      background: '#f6f4ff',
      foreground: '#180e2b',
      card: '#ffffff',
      primary: '#7c3aed',
      primaryForeground: '#ffffff',
      border: '#dcd5ee',
      mutedForeground: '#6e6680',
      destructive: '#ef4444',
      destructiveForeground: '#ffffff',
    },
    dark: {
      background: '#100c1a',
      foreground: '#f0eff5',
      card: '#181324',
      primary: '#9b5cf2',
      primaryForeground: '#100c1a',
      border: '#2d2748',
      mutedForeground: '#8a84a0',
      destructive: '#7a1d1d',
      destructiveForeground: '#f8fafc',
    },
  },
  {
    key: 'theme-mattermost',
    label: 'Mattermost',
    previewPrimary: '#2966cc',
    previewAccent: '#386fdb',
    light: {
      background: '#f3f6ff',
      foreground: '#0d1a40',
      card: '#ffffff',
      primary: '#2966cc',
      primaryForeground: '#ffffff',
      border: '#c3d4f0',
      mutedForeground: '#5a6a8a',
      destructive: '#ef4444',
      destructiveForeground: '#ffffff',
    },
    dark: {
      background: '#081427',
      foreground: '#dee4ec',
      card: '#111e30',
      primary: '#386fdb',
      primaryForeground: '#ffffff',
      border: '#1f2f47',
      mutedForeground: '#95a0b0',
      destructive: '#993333',
      destructiveForeground: '#f8fafc',
    },
  },
  {
    key: 'theme-ocean',
    label: 'Ocean',
    previewPrimary: '#067aa0',
    previewAccent: '#09a8d6',
    light: {
      background: '#f3f9fc',
      foreground: '#0d2030',
      card: '#ffffff',
      primary: '#067aa0',
      primaryForeground: '#ffffff',
      border: '#b8dde8',
      mutedForeground: '#5a7580',
      destructive: '#ef4444',
      destructiveForeground: '#ffffff',
    },
    dark: {
      background: '#0d1721',
      foreground: '#eef4f5',
      card: '#131e2b',
      primary: '#09a8d6',
      primaryForeground: '#0d1721',
      border: '#1e3040',
      mutedForeground: '#7fa0a8',
      destructive: '#7f1d1d',
      destructiveForeground: '#f8fafc',
    },
  },
  {
    key: 'theme-high-contrast',
    label: 'High Contrast',
    previewPrimary: '#0040cc',
    previewAccent: '#ffed0f',
    light: {
      background: '#ffffff',
      foreground: '#000000',
      card: '#ffffff',
      primary: '#0040cc',
      primaryForeground: '#ffffff',
      border: '#000000',
      mutedForeground: '#333333',
      destructive: '#cc0000',
      destructiveForeground: '#ffffff',
    },
    dark: {
      background: '#000000',
      foreground: '#ffffff',
      card: '#121212',
      primary: '#ffed0f',
      primaryForeground: '#000000',
      border: '#999999',
      mutedForeground: '#c0c0c0',
      destructive: '#ff0000',
      destructiveForeground: '#000000',
    },
  },
];

export const DEFAULT_PALETTE_KEY = 'default';

export const paletteByKey = (key: string): Palette =>
  PALETTES.find(p => p.key === key) ?? PALETTES[0];
