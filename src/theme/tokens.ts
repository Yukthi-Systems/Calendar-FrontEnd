import type { PaletteColors } from '../data/palettes';
import { mix, onColor } from './color';

// The full set of semantic colours the UI uses, derived from a palette's base
// roles. Palettes only define the nine base roles; everything else (muted
// surfaces, hover, strong border, subtle text, semantic states) is computed here
// so every palette gets a consistent set without hand-editing each one.
export interface ThemeTokens {
  bg: string;
  card: string;
  muted: string;
  hover: string;
  border: string;
  borderStrong: string;
  heading: string;
  text: string;
  subtle: string;
  accent: string;
  accentForeground: string;
  accentSoft: string;
  destructive: string;
  destructiveForeground: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  info: string;
  infoForeground: string;
}

export function deriveTokens(c: PaletteColors, dark: boolean): ThemeTokens {
  const success = dark ? '#34d399' : '#059669';
  const warning = dark ? '#fbbf24' : '#d97706';
  const info = dark ? '#60a5fa' : '#2563eb';
  return {
    bg: c.background,
    card: c.card,
    muted: mix(c.card, c.foreground, dark ? 0.055 : 0.035),
    hover: mix(c.card, c.foreground, dark ? 0.085 : 0.055),
    border: c.border,
    borderStrong: mix(c.border, c.foreground, dark ? 0.18 : 0.14),
    heading: c.foreground,
    text: c.mutedForeground,
    subtle: mix(c.mutedForeground, c.background, dark ? 0.3 : 0.25),
    accent: c.primary,
    accentForeground: c.primaryForeground,
    accentSoft: mix(c.card, c.primary, dark ? 0.16 : 0.09),
    destructive: c.destructive,
    destructiveForeground: c.destructiveForeground,
    success,
    successForeground: onColor(success),
    warning,
    warningForeground: onColor(warning),
    info,
    infoForeground: onColor(info),
  };
}
