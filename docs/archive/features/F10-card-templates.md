# F10: Cards and templates
Priority: Must     Build step: 3     Depends on: F08, F09
Source: P1-CARD-01, P1-CARD-04, P1-CARD-05 (8 templates only)

## User story
As an employee, I have a premium card with my details, and my company controls the look.

## Acceptance criteria
- Each seat has one card with company branding, photo, name, designation, verification badge (when KYB verified) and action buttons.
- 8 premium templates. Changing a template keeps all content. Applies to selected cards in bulk.
- Sections: About, Products, Services, Portfolio, Gallery, Documents (PDF up to 25 MB), Social links, Company info, Branch map. Orderable and toggleable by admin, and by employee where unlocked.
- Visibility per field: public or internal.
- English and Hindi content. Visitor sees a language toggle. Missing Hindi falls back to English.
- Publishing a card fires `card.published`. The public page revalidates within 60 seconds.
- Optional admin approval before publish, controlled by a company setting.

## States to design
Draft, pending approval, published, locked field, empty section.

## API and events
`GET|PATCH /cards/{id}`, `POST /cards/{id}:publish`, `POST /cards:bulk-template`. Event: `card.published`.

## Data
`Card` (cardId, ownerType, ownerId, templateId, sections, visibility, language).

## Tests required
Template switch keeps content, lock rules, approval flow, revalidation trigger.

## Out of scope
Custom builder, wallet passes, auto-translate.
