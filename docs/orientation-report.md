# Orientation Report

## A. Restatement
**What we are building:** OneBridge Grid Phase 1: a digital business identity and relationship platform for Indian businesses. Core promise: physical card scans/taps become company-owned leads seamlessly, with no app or login required for the visitor.

**10 rules from AGENTS.md section 3 most likely to be broken by accident:**
1. Failing to include `tenantId` in every database document and enforcing it at the repository layer.
2. Checking authorisation in the UI but forgetting to enforce it by tenant and role scope server-side.
3. Leaking personal data into logs, push payloads, or analytics event names.
4. Putting the access token or lead data in `localStorage` instead of memory and encrypted storage.
5. Not making write endpoints idempotent or not providing an idempotency key.
6. Modules reading each other's database collections directly instead of using public APIs or events.
7. Making destructive API changes (renaming/removing fields) instead of additive changes.
8. Using hard-coded colours, border-radii, or spacing instead of `ui-kit` tokens.
9. Using orange as a text colour on light backgrounds, which fails contrast requirements.
10. Forgetting to respect `prefers-reduced-motion` and showing arc animations instead of simple fades.

## B. Conflicts
**1. Build Order of Foundation & Organisation Steps**
- **Files:** `AGENTS.md` (lines 142-143) vs `docs/PLAN.md` (lines 11-12).
- **Conflict:** `AGENTS.md` lists "audit log" (F04) and "Business ID" (F03) as part of Step 1 (Foundation). However, `PLAN.md` omits them from Step 1 and explicitly lists them in Step 2 (Organisation).

*(No other direct contradictions found between the active source of truth files; most superseded plans have been correctly addressed in `decisions.md`.)*

## C. Gaps
- **F06**: Dimensions, aspect ratios, or exact resolution limits for the company logo and cover image are not specified.
- **F07**: Maximum number of departments and teams allowed per branch is not specified.
- **F11**: Exact pixel dimensions or DPI required for downloading the QR code in print resolution are not specified.
- **F14**: Fallback behavior if an invited user has no phone number or email (e.g. if the single provided channel fails).
- **F17**: Behavior when a Starter plan (capped at 25 seats) attempts to add a 26th seat (seamless upgrade flow vs hard block).
- **F19**: Replacement price material scope (it says "replacement 449", but doesn't clarify if this covers Wood/Metal cards as well as PVC).
- **F22**: Exact default schedule for "quiet hours" is not specified.
- **F25**: Duration of the SLA timer for KYB manual review and NFC fulfilment QC is not specified.
- **F26**: The mechanism by which the admin selects the "public subset" of employees for the directory (e.g., individual seat toggles vs department selection) is not specified.

## D. Risky requirements
1. **CSV import speed & invites (F15):** "Import of 1,000 rows finishes in 60 seconds or less... Optionally send invites for all created seats." If sending invites is synchronous with the import job, 1,000 external API calls to MSG91/Email providers will likely exceed the 60-second limit and hit rate limits. Invites must be aggressively queued.
2. **10-second notification SLA (F13, F22):** "New-lead notification reaches the owner in under 10 seconds." While internal queues can easily meet this, external dependencies (WhatsApp Business API or SMS networks) are outside our control and may breach this SLA.
3. **Lead Duplicate Detection via Blind Index (ADR-0002, F13):** `HMAC-SHA256(indexKey, tenantId + "|" + E.164 phone)` relies entirely on perfect E.164 normalization. If a visitor enters their phone number in varying formats and the normalization library is inconsistent, the blind index will fail to catch duplicates.
4. **PWA offline wipe (F16, F24):** "Access to company data is revoked within 1 minute... and a wipe signal is sent to the person's installed My Card app". An offline PWA cannot receive a push/wipe signal immediately. While F24 notes that offline devices wipe at the next connection or at 14 days, the 1-minute expectation might set false assumptions for admins.
