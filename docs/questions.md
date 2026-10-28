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
  

Q-NET-1 | N02 | 2026-10-26
Question: Should the directory list Hyderabad businesses that have not signed up (from public data) so owners can claim them?
Why it matters: Solves the cold start faster, but needs a legal check on using public business data and creates takedown work.
Options (with your recommendation): (a) no unclaimed listings, grow by sign-ups and invites (recommended for launch); (b) listings from public GST and registry data after legal review.
Blocked work: unclaimed listings in N02 and N03.
Decision: Resolved 2026-10-26 (founder: go with recommendations): (a) no unclaimed listings at launch; the directory grows by sign-ups and invites. Revisit after a legal review.

Q-NET-2 | N11, F12 | 2026-10-26
Question: May a card owner show their phone number to people who scan their card face to face (off by default), or are numbers always private?
Why it matters: "A scan becomes a saved contact" was the core Phase 1 promise; a saved contact without a number is weaker in person.
Options (with your recommendation): (a) owner opt-in, number shown only after a QR or NFC scan, never in search or shared links (recommended); (b) always private, chat and call requests only.
Blocked work: the F12 card buttons and vCard change in N11.
Decision: Resolved 2026-10-26: (a) owner opt-in, off by default; the number is shown only after a QR or NFC scan, never in search, profiles or shared links.

Q-NET-3 | N01–N11 | 2026-10-26
Question: Confirm the proposed numbers in the network feature files: edit and unsend window 15 min, post edit window 24 h, call request expiry 48 h, requirement auto-close 30 days, export within 72 h, deletion grace 14 days, triage 24 h, appeal 7 days, plus all plan limits in plan section 5.
Why it matters: Class C numbers (AGENTS.md section 11) must be decided by the founder.
Options: accept the proposals for the demo and revise later (recommended), or set each now.
Blocked work: none for building; values are configurable.
Decision: Resolved 2026-10-26: the proposed numbers are accepted for now (configurable; plan section 5 limits stay samples to be revised).

Q-NET-4 | N03 | 2026-10-26
Question: Search engine: OpenSearch or Meilisearch?
Why it matters: Hosting cost and operations. Meilisearch is simpler and cheaper to run at launch scale; OpenSearch scales further.
Options: Meilisearch for N-1, revisit at 100,000 profiles (recommended); OpenSearch from the start.
Blocked work: N03 implementation choice.
Decision: Resolved 2026-10-26: Meilisearch for N-1; revisit at 100,000 profiles.

## Q-17: Cloudflare Turnstile on the card share-back form (Class C)
**Context:** The card page sends no Turnstile token (there is no widget), so production share-backs are protected by rate limits only (5 per network per 15 minutes, 20 per card per hour). Setting `TURNSTILE_SECRET` today would block every share-back.
**Question:** Add the Turnstile widget to the visitor card (site key, privacy notice line) before launch, or launch on rate limits and watch for spam?
**Status:** **Open (founder)**

## Q-18: Terms of Service and Privacy Policy pages (Class A)
**Context:** Sign-up records consent to versioned terms and privacy documents and links to `/terms` and `/privacy` on the public site, which do not exist.
**Question:** Who writes them, and what are the legal entity, address and grievance officer to show? (Legal text must come from the founder or a lawyer.)
**Status:** **Open (founder); blocks launch**

## Q-19: Accounts needed for the VPS launch (Class A)
**Context:** The stack refuses to start without them.
**Question:** Google OAuth Web client ID; SMTP provider and credentials with SPF/DKIM/DMARC on onebridgecard.com; the server (IP, SSH access for the senior engineer); an S3-compatible backup bucket for rclone; which GitHub repository the server pulls from.
**Status:** **Open (founder)**
