/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  // Follows the OS color scheme on every platform (web: prefers-color-scheme).
  darkMode: 'media',
  theme: {
    extend: {
      // Same token names as YFS-FrontEnd (bg-bg-main, text-text-heading, bg-accent, …);
      // values are RGB channels in global.css so opacity modifiers (bg-accent/10) work.
      colors: {
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-foreground': 'rgb(var(--accent-fg) / <alpha-value>)',
        'border-main': 'rgb(var(--border) / <alpha-value>)',
        'bg-main': 'rgb(var(--bg) / <alpha-value>)',
        'bg-card': 'rgb(var(--card) / <alpha-value>)',
        'text-main': 'rgb(var(--text) / <alpha-value>)',
        'text-heading': 'rgb(var(--text-h) / <alpha-value>)',
        destructive: 'rgb(var(--destructive) / <alpha-value>)',
        'destructive-foreground': 'rgb(var(--destructive-fg) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
