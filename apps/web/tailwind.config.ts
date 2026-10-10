import type { Config } from 'tailwindcss';
export default {
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      paper: 'var(--paper)',
      surface: 'var(--surface)',
      ink: 'var(--ink)',
      muted: 'var(--muted)',
      line: 'var(--line)',
      accent: 'var(--accent)',
      danger: 'var(--danger)',
      transparent: 'transparent',
      current: 'currentColor',
    },
    fontFamily: {
      sans: ['Instrument Sans', 'sans-serif'],
      editorial: ['Newsreader', 'serif'],
    },
    fontSize: {
      xs: '12px',
      sm: '13px',
      base: '14px',
      lg: '16px',
      xl: '20px',
      '2xl': '28px',
      '3xl': '40px',
    },
    spacing: Object.fromEntries(
      Array.from({ length: 33 }, (_, i) => [i, `${i * 4}px`]),
    ),
    borderRadius: { none: '0', field: '6px', card: '8px', pill: '999px' },
    extend: {},
  },
  plugins: [],
} satisfies Config;
