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
        control: '6px',
        panel: '10px',
        sheet: '14px',
        // Transition aliases mapped strictly to Span tokens (no arches)
        '12': '6px',
        '16': '10px',
        '22': '14px',
        arch: '10px',
      },
      fontSize: {
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['14px', { lineHeight: '20px' }],
        base: ['16px', { lineHeight: '24px' }],
        lg: ['20px', { lineHeight: '28px' }],
        xl: ['24px', { lineHeight: '32px' }],
        '2xl': ['32px', { lineHeight: '40px' }],
        '3xl': ['40px', { lineHeight: '48px' }],
      },
      fontFamily: {
        body: ['var(--font-manrope)', 'var(--font-noto)', 'Manrope', 'Noto Sans Devanagari', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontWeight: {
        regular: '400',
        semibold: '600',
        bold: '700',
      },
      boxShadow: {
        overlay: '0 12px 32px rgba(30, 30, 30, 0.16)',
        sheet: '0 -8px 24px rgba(30, 30, 30, 0.14)',
        dropdown: '0 6px 20px rgba(30, 30, 30, 0.12)',
      },
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.2, 0, 0, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
