import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}', './.storybook/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'bridge-orange': 'rgb(var(--color-bridge-orange) / <alpha-value>)',
        charcoal: 'rgb(var(--color-charcoal) / <alpha-value>)',
        'charcoal-deep': 'rgb(var(--color-charcoal-deep) / <alpha-value>)',
        'warm-paper': 'rgb(var(--color-warm-paper) / <alpha-value>)',
        sand: 'rgb(var(--color-sand) / <alpha-value>)',
        'deep-orange': 'rgb(var(--color-deep-orange) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        error: 'rgb(var(--color-error) / <alpha-value>)',
        info: 'rgb(var(--color-info) / <alpha-value>)',
        'sand-border': 'rgb(var(--color-sand-border) / <alpha-value>)',
      },
      borderRadius: {
        '12': '12px',
        '16': '16px',
        '22': '22px',
        arch: '9999px 9999px 0 0',
      },
      spacing: {
        '4': '4px',
        '8': '8px',
        '12': '12px',
        '16': '16px',
        '20': '20px',
        '24': '24px',
        '32': '32px',
      },
      fontFamily: {
        body: ['Manrope', 'Noto Sans Devanagari', 'sans-serif'],
      },
      fontWeight: {
        regular: '400',
        bold: '700',
        extrabold: '800',
      },
    },
  },
  plugins: [],
};

export default config;
