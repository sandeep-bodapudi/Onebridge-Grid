# Questions Log

## Q-11: Dark Mode Tokens for UI Kit (Class C)
**Feature:** F05 - UI Kit  
**Context:** AC-4 requires dark mode tokens to be defined. However, the specific hex codes for dark mode (e.g., Dark Charcoal, Dark Paper, Dark Sand) are not provided in `F05-ui-kit-tokens.md` or the PRD summary.  
**Question:** Do we have a specific dark mode palette defined by the design team, or should I generate a standard accessible dark palette (inverting light backgrounds to dark grays/blacks and adjusting text for contrast)?  
**Status:** **Open (Agent proposal pending approval)**  
**Later Features Affected:** F05 (finalizing CSS variables in ui-kit), F12 (visitor card themes), F24 (My Card PWA dark theme), F26 (public company profile).  

## Q-12: Visual Snapshot Testing Strategy (Class C)
**Feature:** F05 - UI Kit  
**Context:** The "Tests required" section lists "visual snapshot tests".  
**Question:** Should we integrate a SaaS visual regression tool (like Chromatic or Percy) into the CI pipeline, or is a local DOM/HTML snapshot testing strategy using Vitest/Storybook test runner sufficient for Phase 1?  
**Status:** **Open (Agent proposal pending approval)**  
**Later Features Affected:** F05 (Storybook visual regression workflow), CI gate automation, F12 & F24 visual budget testing.  

## Q-13: Self-Hosted Font Delivery Strategy (Class C)
**Feature:** F05 - UI Kit  
**Context:** AC-3 mandates "Manrope self-hosted with Noto Sans Devanagari fallback". While the `@font-face` CSS can be written, the actual `.woff2` files must be served.  
**Question:** Should the `.woff2` font files be bundled and published inside the `@onebridge/ui-kit` npm package itself, or should we assume consuming applications (`web-app`, `web-public`) will host these assets in their respective `public/fonts` directories?  
**Status:** **Open (Agent proposal pending approval)**  
**Later Features Affected:** F05 (ui-kit font asset publishing), F12 (web-public font hosting), F24 (web-app PWA font caching in Serwist service worker).  

## Q-14: Single Person Multiple Seats Policy (Class C)
**Feature:** F08 - Seats and people  
**Context:** AC-1 states "A person is assigned to a seat." Does OneBridge allow a single human (`Person`) to occupy multiple seats within the same company (e.g., dual roles such as Founder + Head of Product), or is a person strictly constrained to one seat per tenant?  
**Question:** Can a single person ID be assigned to more than one active seat simultaneously within the same organization?  
**Status:** **Open (Agent proposal pending approval)**  
**Later Features Affected:** F08 (seats), F14 (invite claim flow), F15 (CSV bulk import), F16 (offboarding).

## Q-15: `branch.*`/`department.*`/`team.*`/`seat.*` events publish a hardcoded `aggregateVersion: 1` (Class C)
**Feature:** F07, F08 (services/organization), consumed by F10's `ReadModelSyncService`  
**Context:** Found while building F10's read-model sync. Every `org.*` top-level event (`org.created`, `org.updated`, `org.branding_updated`) correctly publishes `aggregateVersion: saved.aggregateVersion` (a real, monotonically-incrementing value). Every `branch.*`, `department.*`, `team.*` and `seat.*` event instead hardcodes `aggregateVersion: 1` on every single emission, in `services/organization/src/application/org-structure.service.ts` and `seats.service.ts`. ADR-0003 point 3 requires consumers to "ignore stale events... apply only if aggregateVersion is greater than the stored one" — that check cannot distinguish a real update from a duplicate/out-of-order delivery for these event types today.  
**Why it matters:** Harmless right now because the only transport wired up (`InMemoryEventBus`, see D-F10-EVENTBUS) delivers synchronously and in-order, so Cards' read-model sync was written to just apply branch/seat events in arrival order rather than trust the version field. It will matter the moment a real queue (SNS/SQS, Step 12) can reorder or redeliver events.  
**Options (recommendation marked):**  
  1. **(Recommended)** Fix the emission sites in `services/organization` to publish each entity's own incrementing version (mirroring the pattern `organization.service.ts` already uses correctly for `org.*`), before the SNS/SQS adapter lands in Step 12.  
  2. Leave as-is and have every consumer re-fetch the aggregate through the owner's API whenever event order is in doubt (ADR-0003's own stated fallback) — more defensive but adds a synchronous cross-service call per event.  
**Blocked work:** None today (Cards' read-model sync has a working, arrival-order-based fallback). Blocks trusting event ordering once Step 12 introduces a real queue.

## Q-16: `org.branding_updated` has two incompatible payload shapes from two call sites (Class C)
**Feature:** F06, F09 (services/organization), consumed by F10's `ReadModelSyncService`  
**Context:** Found while building F10's read-model sync. `organization.service.ts`'s `updateOrganization()` publishes `org.branding_updated` with payload `{ orgId, businessId, brandColours, logo, cover }` (top-level fields). `brand-kit.service.ts`'s `updateBrandKit()` publishes the *same event type* with payload `{ orgId, businessId, brandKit: { logo?, brandColours, ... }, fieldLocks }` (nested under `brandKit`). `packages/api-contracts/events.yaml`'s `OrgBrandingUpdatedEvent` schema only documents the nested shape, so it does not describe what `organization.service.ts` actually sends.  
**Why it matters:** Any consumer of this event (Cards' read model today; notifications, analytics later) has to defensively check both shapes, which `ReadModelSyncService.handleOrgBrandingUpdated` now does — but that is a workaround, not a fix.  
**Options (recommendation marked):**  
  1. **(Recommended)** Pick one payload shape (the flatter `{ logo, brandColours }` is simpler for every downstream consumer) and update whichever call site doesn't match, plus the AsyncAPI schema, in a small follow-up to F09.  
  2. Keep both shapes and document the event as having two legitimate "sub-kinds"; downstream consumers should handle both indefinitely.  
**Blocked work:** None today (worked around defensively in F10). Should be resolved before F23 (Analytics) or F22 (Notifications) add their own consumers of this event, to avoid a third workaround being written independently.
  
