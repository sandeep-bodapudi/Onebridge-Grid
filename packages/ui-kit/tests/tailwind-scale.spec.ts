import { describe, it, expect } from 'vitest';
import config from '../tailwind.config';

describe('Tailwind Design Token Scale Guards (Span Language)', () => {
  it('does NOT override standard Tailwind spacing with custom pixel values', () => {
    // Spacing override broke Tailwind utility scale (e.g. w-24 becoming 24px instead of 96px)
    const extend = config.theme?.extend as Record<string, unknown> | undefined;
    expect(extend?.spacing).toBeUndefined();
  });

  it('does NOT contain arch borderRadius token', () => {
    const extend = config.theme?.extend as Record<string, unknown> | undefined;
    const borderRadius = extend?.borderRadius as Record<string, string> | undefined;
    expect(borderRadius?.arch).not.toBe('9999px 9999px 0 0');
  });

  it('defines the strict Span corner radii tokens (control, panel, sheet)', () => {
    const extend = config.theme?.extend as Record<string, unknown> | undefined;
    const borderRadius = extend?.borderRadius as Record<string, string> | undefined;
    expect(borderRadius?.control).toBe('6px');
    expect(borderRadius?.panel).toBe('10px');
    expect(borderRadius?.sheet).toBe('14px');
  });

  it('does NOT include font weight 800 (extrabold) in font weights', () => {
    const extend = config.theme?.extend as Record<string, unknown> | undefined;
    const fontWeight = extend?.fontWeight as Record<string, string> | undefined;
    expect(fontWeight?.extrabold).toBeUndefined();
    expect(fontWeight?.regular).toBe('400');
    expect(fontWeight?.semibold).toBe('600');
    expect(fontWeight?.bold).toBe('700');
  });

  it('enforces the 12/14/16/20/24/32/40 type scale without font sizes smaller than 12px', () => {
    const extend = config.theme?.extend as Record<string, unknown> | undefined;
    const fontSize = extend?.fontSize as Record<string, [string, unknown]> | undefined;
    expect(fontSize?.xs?.[0]).toBe('12px');
    expect(fontSize?.sm?.[0]).toBe('14px');
    expect(fontSize?.base?.[0]).toBe('16px');
    expect(fontSize?.lg?.[0]).toBe('20px');
    expect(fontSize?.xl?.[0]).toBe('24px');
    expect(fontSize?.['2xl']?.[0]).toBe('32px');
    expect(fontSize?.['3xl']?.[0]).toBe('40px');
  });
});
