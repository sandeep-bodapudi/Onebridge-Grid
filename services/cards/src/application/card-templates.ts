import { CardTemplateId, CARD_TEMPLATE_IDS } from '../domain/card.js';

export interface CardTemplateDefinition {
  id: CardTemplateId;
  name: string;
  description: string;
}

/** AC-2: 8 premium templates. */
export const CARD_TEMPLATE_CATALOG: CardTemplateDefinition[] = [
  { id: 'classic-charcoal', name: 'Classic Charcoal', description: 'Deep charcoal band, warm paper content area.' },
  { id: 'bridge-orange', name: 'Bridge Orange', description: 'Bridge orange fill accents, charcoal text (never orange on white).' },
  { id: 'arch-minimal', name: 'Arch Minimal', description: 'White background, arch-shaped header, minimal ornamentation.' },
  { id: 'keystone-dark', name: 'Keystone Dark', description: 'Dark mode first, keystone badge crown.' },
  { id: 'paper-light', name: 'Paper Light', description: 'Warm paper background, soft shadow cards.' },
  { id: 'enterprise-blue', name: 'Enterprise Blue', description: 'Muted blue band for regulated-industry customers.' },
  { id: 'grid-mono', name: 'Grid Mono', description: 'Monochrome, grid-aligned, dense information layout.' },
  { id: 'sand-warm', name: 'Sand Warm', description: 'Sand band, rounded corners, friendly tone.' },
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
