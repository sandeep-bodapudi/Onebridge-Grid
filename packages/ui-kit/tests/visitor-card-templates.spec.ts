import { describe, it, expect } from 'vitest';
import { getTemplateStyle, readableTextClassOn } from '../src/components/visitor-card-templates';

const TEMPLATES = [
  'classic-charcoal',
  'bridge-orange',
  'arch-minimal',
  'keystone-dark',
  'paper-light',
  'enterprise-blue',
  'grid-mono',
  'sand-warm',
];

describe('F10 AC-2: card templates look different on the visitor page', () => {
  it('gives each of the 8 templates a distinct header, name and frame combination', () => {
    const signatures = TEMPLATES.map((id) => {
      const s = getTemplateStyle(id, '#1B2A4A');
      return JSON.stringify([s.headerClass, s.headerStyle, s.companyNameClass, s.frameClass, Boolean(s.stripeColour)]);
    });
    expect(new Set(signatures).size).toBe(TEMPLATES.length);
  });

  it('classic-charcoal uses the company brand colour on the band', () => {
    expect(getTemplateStyle('classic-charcoal', '#A1B2C3').headerStyle).toEqual({ backgroundColor: '#A1B2C3' });
  });

  it('falls back to the classic look for an unknown template id', () => {
    expect(getTemplateStyle('not-a-template', '#123456')).toEqual(getTemplateStyle('classic-charcoal', '#123456'));
  });

  it('uses the company brand text colour when one is set', () => {
    expect(getTemplateStyle('classic-charcoal', '#FFFFFF', '#393536').companyNameStyle).toEqual({ color: '#393536' });
  });

  it('orange templates never put white text on orange (AGENTS.md: orange is a fill)', () => {
    expect(getTemplateStyle('bridge-orange', '#000000').companyNameClass).toContain('text-charcoal');
  });

  describe('readableTextClassOn', () => {
    it('picks white on dark bands and charcoal on light bands', () => {
      expect(readableTextClassOn('#1B2A4A')).toBe('text-white');
      expect(readableTextClassOn('#FAF7F2')).toBe('text-charcoal');
      expect(readableTextClassOn('#F68713')).toBe('text-charcoal');
    });

    it('accepts 3-digit hex and defaults to white for invalid input', () => {
      expect(readableTextClassOn('#fff')).toBe('text-charcoal');
      expect(readableTextClassOn('not-a-colour')).toBe('text-white');
    });
  });
});
