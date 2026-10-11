import type { Preview } from '@storybook/react';
import '../src/styles/tokens.css';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'warm-paper',
      values: [
        {
          name: 'warm-paper',
          value: '#FAF7F2',
        },
        {
          name: 'charcoal',
          value: '#393536',
        },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
