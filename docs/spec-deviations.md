# Spec deviations

Places where the built product intentionally differs from the spec pack in `docs/onebridge-spec-pack/`. Each one is a founder decision; read it before "fixing" the code back to the spec.

| Spec | What it says | What we build instead | Decision |
|---|---|---|---|
| UI/UX Specification v1.0, §1–§6 | The arch, keystone, arc and bridge-span motif is the core brand element ("The arch is the memorable element"). Radii 12/16/22 and a full arch. | The "Span" language: straight lines, a span line with square end nodes, a trapezoid keystone tag, a monospace Business ID nameplate. Radii 6/10/14 px. No arches or curves. Same colour palette. | D-UI-REDESIGN |
| F12 visitor page, AC line 9 | "Arch header, keystone badge at the crown." | A straight brand band with the span line along its base, and the keystone tag beside the photo. | D-UI-REDESIGN |
| F13 share-back, AC "arc animation" | On success the page shows an arc animation. | A span line fills between the visitor and the card owner (a fade under reduced motion). | D-UI-REDESIGN |
| UI/UX Specification, typography | Manrope ExtraBold (800) for headings. | Weights 400, 600 and 700 only; nothing below 12 px. | D-UI-REDESIGN, D-D1-FOUNDATIONS-COMPLETE |

Stored identifiers keep their original names (`arch-minimal`, `keystone-dark` card templates); only what people see changed.
