// Small colour helpers for deriving theme tokens and tinted badges from a palette's
// base hex values. Everything takes and returns "#rrggbb" unless noted.

type RGB = [number, number, number];

const toRgb = (hex: string): RGB => {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h
      .split('')
      .map(c => c + c)
      .join('');
  }
  const n = parseInt(h.slice(0, 6), 16);
  // eslint-disable-next-line no-bitwise -- extracting R/G/B bytes from a hex int
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const toHex = ([r, g, b]: RGB) =>
  `#${[r, g, b]
    .map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0'))
    .join('')}`;

// "r g b" — the channel string Tailwind's rgb(var(--x) / <alpha-value>) expects.
export const channels = (hex: string) => toRgb(hex).join(' ');

// Linear blend: t = 0 → a, t = 1 → b.
export const mix = (a: string, b: string, t: number) => {
  const x = toRgb(a);
  const y = toRgb(b);
  return toHex([0, 1, 2].map(i => x[i] + (y[i] - x[i]) * t) as RGB);
};

export const alpha = (hex: string, a: number) => {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

// WCAG relative luminance, 0 (black) … 1 (white).
export const luminance = (hex: string) => {
  const [r, g, b] = toRgb(hex).map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// Black or white, whichever reads better on `bg`.
export const onColor = (bg: string) =>
  luminance(bg) > 0.45 ? '#0b0b0f' : '#ffffff';

export interface Tone {
  // Tinted fill, readable text, and a slightly stronger outline — for badges,
  // status chips and calendar events coloured by status/priority/tag.
  bg: string;
  fg: string;
  border: string;
  solid: string;
}

// A status/priority/tag hex turned into a badge that reads well on either theme,
// instead of `${hex}22` (washed out in dark mode, low-contrast text in light).
export const tone = (color: string, dark: boolean): Tone => ({
  bg: alpha(color, dark ? 0.2 : 0.12),
  fg: dark ? mix(color, '#ffffff', 0.35) : mix(color, '#000000', 0.3),
  border: alpha(color, dark ? 0.4 : 0.3),
  solid: color,
});
