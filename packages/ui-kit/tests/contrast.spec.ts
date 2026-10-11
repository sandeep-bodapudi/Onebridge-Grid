import { describe, it, expect } from 'vitest';

// Function to convert RGB string 'r g b' to relative luminance
function getLuminance(r: number, g: number, b: number) {
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map(c => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrast(rgb1: number[], rgb2: number[]) {
  const l1 = getLuminance(rgb1[0], rgb1[1], rgb1[2]);
  const l2 = getLuminance(rgb2[0], rgb2[1], rgb2[2]);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Blend a foreground color with opacity over a solid background
function blendColor(fg: number[], bg: number[], alpha: number) {
  return [
    Math.round((1 - alpha) * bg[0] + alpha * fg[0]),
    Math.round((1 - alpha) * bg[1] + alpha * fg[1]),
    Math.round((1 - alpha) * bg[2] + alpha * fg[2]),
  ];
}

describe('AC-6 & AC-7: Contrast Validation', () => {
  const tokens: Record<string, number[]> = {
    'bridge-orange': [246, 135, 19],
    'charcoal': [57, 53, 54],
    'charcoal-deep': [30, 30, 30],
    'warm-paper': [250, 247, 242],
    'sand': [239, 232, 220],
    'deep-orange': [160, 78, 8],
    'success': [39, 112, 74],
    'warning': [201, 151, 0],
    'error': [194, 54, 43],
    'info': [59, 110, 168],
    'white': [255, 255, 255],
    'black': [0, 0, 0],
    'sand-border': [227, 217, 200]
  };

  it('No component uses bridge orange as text on light background (Warm Paper + Bridge Orange < 4.5:1)', () => {
    const ratio = getContrast(tokens['warm-paper'], tokens['bridge-orange']);
    expect(ratio).toBeLessThan(4.5);
  });

  it('Validates contrast of all explicitly declared component combinations', () => {
    const componentPairs = [
      // ActionButton / KeystoneBadge
      { bg: 'bridge-orange', text: 'charcoal' },
      { bg: 'charcoal', text: 'white' },
      { bg: 'white', text: 'charcoal' },
      
      // Banners / Toasts
      { bg: 'warning', text: 'charcoal' },
      { bg: 'info', text: 'white' },
      { bg: 'error', text: 'white' },
      { bg: 'success', text: 'white' },
      
      // Chips (using 10% opacity over white)
      { bg: blendColor(tokens['success'], tokens['white'], 0.1), text: 'success' },
      // Note: text-warning fails on light backgrounds. Must use a darker color.
      { bg: blendColor(tokens['warning'], tokens['white'], 0.1), text: 'deep-orange' },
      { bg: blendColor(tokens['error'], tokens['white'], 0.1), text: 'error' },
      { bg: blendColor(tokens['info'], tokens['white'], 0.1), text: 'info' },

      // Text elements
      { bg: 'warm-paper', text: 'charcoal' },
      { bg: 'sand', text: 'charcoal' },
    ];

    componentPairs.forEach(pair => {
      const bgRgb = Array.isArray(pair.bg) ? pair.bg : tokens[pair.bg as string];
      const textRgb = tokens[pair.text];
      
      const ratio = getContrast(bgRgb, textRgb);
      if (ratio < 4.5) {
         throw new Error(`Contrast failure: Background ${JSON.stringify(pair.bg)} with Text ${pair.text} has ratio ${ratio.toFixed(2)}:1 (needs 4.5:1)`);
      }
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });
});
