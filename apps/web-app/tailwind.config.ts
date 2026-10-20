import type { Config } from 'tailwindcss';
import uiKitConfig from '../../packages/ui-kit/tailwind.config';

// Design tokens (colours, radii, spacing, fonts) come from packages/ui-kit.
// Dark mode follows the system setting (F12: "Dark and light follow the
// system setting"); ui-kit's Storybook keeps its class-based toggle.
const config: Config = {
  ...uiKitConfig,
  darkMode: 'media',
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}', '../../packages/ui-kit/src/**/*.{ts,tsx}'],
};

export default config;
