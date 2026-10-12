/** @type {import('tailwindcss').Config} */
// Design tokens — see CLAUDE.md "Design system". Colour values are RGB channels set at
// runtime by src/components/ThemeRoot.tsx (fallbacks in global.css), so opacity
// modifiers (bg-accent/10) work.
const token = name => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: ['./App.tsx', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  // Follows the OS color scheme on every platform (web: prefers-color-scheme).
  darkMode: 'media',
  // hover: styles only where a real pointer can hover — no sticky hover on touch.
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      colors: {
        accent: token('accent'),
        'accent-foreground': token('accent-fg'),
        'accent-soft': token('accent-soft'),
        'border-main': token('border'),
        'border-strong': token('border-strong'),
        'bg-main': token('bg'),
        'bg-card': token('card'),
        muted: token('muted'),
        hover: token('hover'),
        'text-main': token('text'),
        'text-heading': token('text-h'),
        'text-subtle': token('text-subtle'),
        destructive: token('destructive'),
        'destructive-foreground': token('destructive-fg'),
        success: token('success'),
        'success-foreground': token('success-fg'),
        warning: token('warning'),
        'warning-foreground': token('warning-fg'),
        info: token('info'),
        'info-foreground': token('info-fg'),
      },
      // [size, line-height] in px. 14px body, 11px floor — no arbitrary text-[Npx].
      fontSize: {
        '2xs': ['11px', '14px'],
        xs: ['12px', '16px'],
        sm: ['13px', '18px'],
        base: ['14px', '20px'],
        lg: ['16px', '22px'],
        xl: ['20px', '26px'],
        '2xl': ['24px', '30px'],
        '3xl': ['30px', '36px'],
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
        '3xl': '20px',
      },
    },
  },
  plugins: [],
};
