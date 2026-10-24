import type { Config } from 'tailwindcss';
import uiKitConfig from '../../packages/ui-kit/tailwind.config';

// Design tokens (colours, radii, spacing, fonts) come from packages/ui-kit.
// The admin dashboard is charcoal-led by design (D-UI-PREMIUM): the root
// carries the `dark` class, so every component uses its dark styling.
// The visitor site (apps/web-public) still follows the system setting.
const config: Config = {
  ...uiKitConfig,
  // Dark styles apply under `.dark` except inside a `.light` island (the visitor card preview).
  darkMode: ['variant', '&:is(.dark *):not(.light *)'],
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}', '../../packages/ui-kit/src/**/*.{ts,tsx}'],
};

export default config;
