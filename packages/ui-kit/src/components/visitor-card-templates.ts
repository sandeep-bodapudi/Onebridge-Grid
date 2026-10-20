/**
 * F10 AC-2: the 8 card templates must look different on the visitor page.
 * Each template decides how the header band, the company name and the card
 * frame look. Colours come from design tokens (Tailwind classes); a
 * company's own brand colour is used only by the templates built around it.
 */

export interface TemplateStyle {
  /** Tailwind classes for the header band. */
  headerClass: string;
  /** Inline style for the header band (only for brand-colour templates). */
  headerStyle?: Record<string, string>;
  /** Classes for the company name shown in the band. */
  companyNameClass: string;
  /** Company's own brand text colour, when it set one (brand-colour templates). */
  companyNameStyle?: Record<string, string>;
  /** Extra classes for the card frame. */
  frameClass: string;
  /** Optional brand-colour stripe under the band. */
  stripeColour?: string;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Charcoal or white, whichever reads better on the given background. */
export function readableTextClassOn(backgroundHex: string): 'text-charcoal' | 'text-white' {
  const rgb = hexToRgb(backgroundHex);
  if (!rgb) return 'text-white';
  const l = luminance(rgb);
  const contrastWithWhite = 1.05 / (l + 0.05);
  const charcoal = luminance([57, 53, 54]);
  const contrastWithCharcoal = (Math.max(l, charcoal) + 0.05) / (Math.min(l, charcoal) + 0.05);
  return contrastWithCharcoal >= contrastWithWhite ? 'text-charcoal' : 'text-white';
}

const NAME = 'font-extrabold text-lg tracking-wide uppercase';

export function getTemplateStyle(templateId: string, brandBand: string, brandText?: string): TemplateStyle {
  const brandTextClass = brandText ? '' : readableTextClassOn(brandBand);
  const brandNameStyle = brandText ? { color: brandText } : undefined;

  switch (templateId) {
    case 'bridge-orange':
      return { headerClass: 'bg-bridge-orange', companyNameClass: `${NAME} text-charcoal`, frameClass: '' };
    case 'arch-minimal':
      return {
        headerClass: 'bg-warm-paper dark:bg-charcoal',
        companyNameClass: `${NAME} text-charcoal dark:text-warm-paper`,
        frameClass: '',
        stripeColour: brandBand,
      };
    case 'keystone-dark':
      return {
        headerClass: 'bg-charcoal-deep',
        companyNameClass: `${NAME} text-warm-paper`,
        // The card body switches to VisitorCard's dark theme for this template.
        frameClass: 'border-charcoal',
        stripeColour: brandBand,
      };
    case 'paper-light':
      return { headerClass: 'bg-sand dark:bg-charcoal', companyNameClass: `${NAME} text-charcoal dark:text-warm-paper`, frameClass: '' };
    case 'enterprise-blue':
      return { headerClass: 'bg-info', companyNameClass: `${NAME} text-white`, frameClass: '' };
    case 'grid-mono':
      return { headerClass: 'bg-charcoal', companyNameClass: `${NAME} text-warm-paper tracking-[0.2em]`, frameClass: '!rounded-none' };
    case 'sand-warm':
      return {
        headerClass: '',
        headerStyle: { background: `linear-gradient(160deg, ${brandBand} 0%, rgb(var(--color-sand)) 100%)` },
        companyNameClass: `${NAME} ${brandTextClass}`.trim(),
        companyNameStyle: brandNameStyle,
        frameClass: '',
      };
    case 'classic-charcoal':
    default:
      // The company's brand colour on the band (the original look).
      return {
        headerClass: '',
        headerStyle: { backgroundColor: brandBand },
        companyNameClass: `${NAME} ${brandTextClass}`.trim(),
        companyNameStyle: brandNameStyle,
        frameClass: '',
      };
  }
}
