/**
 * WCAG 2.1 AA Contrast Calculation and Auto-Pick Utility
 *
 * Implements contrast ratio validation according to WCAG 2.1 specifications:
 * - Relative luminance calculation per IEC 61966-2-1 / ITU-R BT.709.
 * - Contrast ratio = (L1 + 0.05) / (L2 + 0.05), range [1, 21].
 * - Standard text requires >= 4.5:1.
 *
 * Per OneBridge design rules (AGENTS.md Section 3 & UI/UX spec Section 2):
 * - Orange is a fill, never a text colour.
 * - Auto-pick colours are Charcoal (#393536) and Warm Paper (#FAF7F2).
 */

export const CHARCOAL = '#393536';
export const WARM_PAPER = '#FAF7F2';
export const WCAG_AA_MIN_RATIO = 4.5;

export function parseHex(hex: string): [number, number, number] | null {
  if (!hex || typeof hex !== 'string') return null;
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return isNaN(r) || isNaN(g) || isNaN(b) ? null : [r, g, b];
  }
  if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return isNaN(r) || isNaN(g) || isNaN(b) ? null : [r, g, b];
  }
  return null;
}

export function sRgbToLinear(c: number): number {
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

export interface ContrastEvaluation {
  ratio: number;
  isAccessible: boolean;
  autoPickColor: string;
  autoPickRatio: number;
  warning?: string;
}

export function evaluateBrandContrast(bandHex: string, textHex: string): ContrastEvaluation {
  const currentRatio = getContrastRatio(bandHex, textHex);
  const isAccessible = currentRatio >= WCAG_AA_MIN_RATIO;

  const charcoalRatio = getContrastRatio(bandHex, CHARCOAL);
  const paperRatio = getContrastRatio(bandHex, WARM_PAPER);

  // Auto-pick recommendation chooses between Charcoal and Warm Paper
  const autoPickColor = charcoalRatio >= paperRatio ? CHARCOAL : WARM_PAPER;
  const autoPickRatio = Math.max(charcoalRatio, paperRatio);

  let warning: string | undefined;
  if (!isAccessible) {
    warning = `Contrast ratio between text (${textHex}) and band (${bandHex}) is ${currentRatio.toFixed(1)}:1 (minimum ${WCAG_AA_MIN_RATIO}:1 required). Auto-pick recommendation is ${autoPickColor === CHARCOAL ? 'Charcoal (#393536)' : 'Warm Paper (#FAF7F2)'} (${autoPickRatio.toFixed(1)}:1).`;
  }

  return {
    ratio: Math.round(currentRatio * 100) / 100,
    isAccessible,
    autoPickColor,
    autoPickRatio: Math.round(autoPickRatio * 100) / 100,
    warning,
  };
}
