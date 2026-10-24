import { CardTemplateId, CARD_TEMPLATE_IDS } from '../domain/card.js';

export interface CardTemplateDefinition {
  id: CardTemplateId;
  name: string;
  description: string;
}

/** AC-2: 8 premium templates. */
export const CARD_TEMPLATE_CATALOG: CardTemplateDefinition[] = [
  { id: 'classic-charcoal', name: 'Company colour', description: 'Your brand colour across the header, warm paper below.' },
  { id: 'bridge-orange', name: 'Bridge orange', description: 'OneBridge orange header with charcoal text.' },
  { id: 'arch-minimal', name: 'Span minimal', description: 'Light header with a thin brand-colour stripe. Quiet and clean.' },
  { id: 'keystone-dark', name: 'Night', description: 'Dark card with a brand-colour stripe.' },
  { id: 'paper-light', name: 'Sand', description: 'Soft sand header, charcoal text.' },
  { id: 'enterprise-blue', name: 'Enterprise blue', description: 'Muted blue header for banks, insurance and healthcare.' },
  { id: 'grid-mono', name: 'Grid mono', description: 'Charcoal header with an orange span line. Square corners.' },
  { id: 'sand-warm', name: 'Deck', description: 'Sand header under a solid brand-colour deck.' },
];

export function listCardTemplates(): CardTemplateDefinition[] {
  return CARD_TEMPLATE_CATALOG;
}

export function getCardTemplate(id: CardTemplateId): CardTemplateDefinition {
  const found = CARD_TEMPLATE_CATALOG.find((t) => t.id === id);
  if (!found) throw new Error(`Unknown card template "${id}"`);
  return found;
}

export { CARD_TEMPLATE_IDS };
