import { describe, it, expect } from 'vitest';
import {
  parseHex,
  sRgbToLinear,
  getRelativeLuminance,
  getContrastRatio,
  evaluateBrandContrast,
  CHARCOAL,
  WARM_PAPER,
  WCAG_AA_MIN_RATIO,
} from '../src/contrast.js';

describe('Contrast & Accessibility Utilities (contrast.ts)', () => {
  describe('parseHex edge cases', () => {
    it('parses standard 6-character hex with or without leading hash', () => {
      expect(parseHex('#1B2A4A')).toEqual([27, 42, 74]);
      expect(parseHex('1B2A4A')).toEqual([27, 42, 74]);
      expect(parseHex('#FFFFFF')).toEqual([255, 255, 255]);
      expect(parseHex('#000000')).toEqual([0, 0, 0]);
    });

    it('parses 3-character shorthand hex correctly', () => {
      expect(parseHex('#fff')).toEqual([255, 255, 255]);
      expect(parseHex('#000')).toEqual([0, 0, 0]);
      expect(parseHex('#f06')).toEqual([255, 0, 102]);
      expect(parseHex('abc')).toEqual([170, 187, 204]);
    });

    it('handles case-insensitivity in hex characters', () => {
      expect(parseHex('#ffffff')).toEqual(parseHex('#FFFFFF'));
      expect(parseHex('#abcdef')).toEqual(parseHex('#ABCDEF'));
      expect(parseHex('#f0a')).toEqual(parseHex('#F0A'));
    });

    it('returns null for invalid hex strings and non-string inputs', () => {
      expect(parseHex('')).toBeNull();
      expect(parseHex(' ')).toBeNull();
      expect(parseHex('#1')).toBeNull();
      expect(parseHex('#12')).toBeNull();
      expect(parseHex('#1234')).toBeNull();
      expect(parseHex('#12345')).toBeNull();
      expect(parseHex('#1234567')).toBeNull();
      expect(parseHex('#xyz123')).toBeNull();
      expect(parseHex('not-a-color')).toBeNull();
      expect(parseHex(null as unknown as string)).toBeNull();
      expect(parseHex(undefined as unknown as string)).toBeNull();
    });
  });

  describe('sRgbToLinear and getRelativeLuminance', () => {
    it('calculates linear RGB for low and high values correctly', () => {
      expect(sRgbToLinear(0)).toBe(0);
      expect(sRgbToLinear(255)).toBe(1);
      // Low value below 0.03928 threshold (c <= 10.016)
      expect(sRgbToLinear(5)).toBeCloseTo(5 / 255 / 12.92, 5);
      // Mid-high value
      expect(sRgbToLinear(128)).toBeGreaterThan(0.2);
    });

    it('computes relative luminance for pure black and pure white', () => {
      expect(getRelativeLuminance('#000000')).toBe(0);
      expect(getRelativeLuminance('#ffffff')).toBe(1);
    });

    it('returns 0 luminance for invalid hex inputs', () => {
      expect(getRelativeLuminance('invalid')).toBe(0);
      expect(getRelativeLuminance('')).toBe(0);
    });
  });

  describe('getContrastRatio edge cases', () => {
    it('returns 1:1 ratio for identical colors', () => {
      expect(getContrastRatio('#ffffff', '#ffffff')).toBe(1);
      expect(getContrastRatio('#000000', '#000000')).toBe(1);
      expect(getContrastRatio('#1B2A4A', '#1b2a4a')).toBe(1);
    });

    it('returns 21:1 maximum contrast ratio for pure black on pure white', () => {
      expect(getContrastRatio('#000000', '#ffffff')).toBe(21);
      expect(getContrastRatio('#ffffff', '#000000')).toBe(21);
    });

    it('is symmetric regardless of argument order', () => {
      const ratio1 = getContrastRatio('#F68713', '#1B2A4A');
      const ratio2 = getContrastRatio('#1B2A4A', '#F68713');
      expect(ratio1).toBe(ratio2);
    });

    it('handles 3-digit hex correctly in contrast calculations', () => {
      expect(getContrastRatio('#fff', '#000')).toBe(21);
      expect(getContrastRatio('#fff', '#fff')).toBe(1);
    });
  });

  describe('evaluateBrandContrast and auto-pick logic', () => {
    it('evaluates accessible combinations without warning (>= 4.5:1)', () => {
      // Navy band (#1B2A4A) with White text (#FFFFFF)
      const res = evaluateBrandContrast('#1B2A4A', '#FFFFFF');
      expect(res.isAccessible).toBe(true);
      expect(res.ratio).toBeGreaterThanOrEqual(WCAG_AA_MIN_RATIO);
      expect(res.warning).toBeUndefined();
    });

    it('detects inaccessible combinations (< 4.5:1) and emits warning with auto-pick', () => {
      // Bridge Orange (#F68713) with White text (#FFFFFF) has ~2.5:1 contrast
      const res = evaluateBrandContrast('#F68713', '#FFFFFF');
      expect(res.isAccessible).toBe(false);
      expect(res.ratio).toBeLessThan(WCAG_AA_MIN_RATIO);
      expect(res.warning).toContain('Contrast ratio');
      expect(res.warning).toContain('4.5:1 required');
      // On light orange, Charcoal (#393536) provides better contrast than Warm Paper
      expect(res.autoPickColor).toBe(CHARCOAL);
      expect(res.autoPickRatio).toBeGreaterThanOrEqual(WCAG_AA_MIN_RATIO);
    });

    it('auto-picks Warm Paper (#FAF7F2) on dark band colors', () => {
      // Dark Charcoal band (#222222) with Black text (#000000)
      const res = evaluateBrandContrast('#222222', '#000000');
      expect(res.isAccessible).toBe(false);
      expect(res.autoPickColor).toBe(WARM_PAPER);
      expect(res.autoPickRatio).toBeGreaterThanOrEqual(WCAG_AA_MIN_RATIO);
    });

    it('respects exact 4.5:1 threshold boundary', () => {
      // Test around the 4.5 boundary
      const exact45 = evaluateBrandContrast('#767676', '#ffffff');
      expect(exact45.ratio).toBeCloseTo(4.54, 1);
      expect(exact45.isAccessible).toBe(true);

      const below45 = evaluateBrandContrast('#777777', '#ffffff');
      expect(below45.ratio).toBeLessThan(4.5);
      expect(below45.isAccessible).toBe(false);
    });
  });
});
