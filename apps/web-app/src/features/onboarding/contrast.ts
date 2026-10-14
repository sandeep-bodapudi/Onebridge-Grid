/**
 * WCAG 2.1 Contrast Calculation & Auto-Adjustment Helper
 * Enforces OneBridge Rule: Orange is a fill, never a text color.
 * Primary/Secondary colors must pass WCAG AA contrast against text.
 */

function parseHex(hex: string): [number, number, number] | null {
  const cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return isNaN(r) || isNaN(g) || isNaN(b) ? null : [r, g, b];
  }
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return isNaN(r) || isNaN(g) || isNaN(b) ? null : [r, g, b];
  }
  return null;
}

function sRgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function getRelativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb;
  return (
    0.2126 * sRgbToLinear(r) +
    0.7152 * sRgbToLinear(g) +
    0.0722 * sRgbToLinear(b)
  );
}

export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export interface ContrastValidationResult {
  ratio: number;
  isAccessible: boolean;
  recommendedTextColor: string;
  warning?: string;
}

export function validateBrandContrast(bgHex: string): ContrastValidationResult {
  const charcoal = '#393536';
  const white = '#FFFFFF';

  const charcoalRatio = getContrastRatio(bgHex, charcoal);
  const whiteRatio = getContrastRatio(bgHex, white);

  // If charcoal has >= 4.5:1 ratio, pick charcoal
  // Otherwise if white has >= 4.5:1, pick white
  let recommendedTextColor = charcoalRatio >= whiteRatio ? charcoal : white;
  let ratio = Math.max(charcoalRatio, whiteRatio);

  const cleanBg = bgHex.toUpperCase();
  // Check if it is Orange fill (#F68713 or similar vibrant orange)
  const isVibrantOrange =
    cleanBg.startsWith('#F6') ||
    cleanBg.startsWith('#E6') ||
    cleanBg.startsWith('#FF7') ||
    cleanBg.startsWith('#FF8');

  if (isVibrantOrange) {
    recommendedTextColor = charcoal;
    ratio = charcoalRatio;
  }

  const isAccessible = ratio >= 4.5;
  let warning: string | undefined;

  if (!isAccessible) {
    warning = `Contrast ratio is ${ratio.toFixed(1)}:1 (minimum 4.5:1 required). Text adjusted to ${recommendedTextColor === charcoal ? 'Charcoal' : 'White'} for maximum legibility.`;
  }

  return {
    ratio,
    isAccessible,
    recommendedTextColor,
    warning,
  };
}
