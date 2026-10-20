# Step 3 (Cards) — Exit Gate Review

**Features:** F10 Cards and templates, F11 Short links and QR, F12 Visitor page, F13 Share-back and leads
**Date:** 2026-10-20
**Branch:** `feat/step-3-cards-f10` (also carries Step 2, which is not yet merged to `main`)
**Verdict:** **Functionally met; two gate conditions partially met** (budgets are measured but not enforced in CI; analytics ingestion acknowledges but does not queue). The full service test suite has not yet been run in CI for this branch — see §3.

How this was verified: unlike earlier reviews, every condition below was exercised against the **running stack** (`pnpm dev`) in a real browser and with HTTP calls, not only through unit tests. That surfaced integration defects no test caught (§4).

---

## 1. Exit gate (PLAN.md, Step 3)

> *A published card is reachable by short link, visitor page meets the budgets in CI, share-back creates an encrypted lead (ADR-0002), analytics events use the ingestion path, read models update from events.*

| # | Condition | Status | Evidence |
|---|---|:---:|---|
| 1 | Published card reachable by short link | **Met** | Live: card published from the dashboard; its default QR `http://localhost:3001/r/<code>` returned **302** to `/c/sahyadri-steel-works/<seat>`. Before this step's fixes the destination was `/<slug>` (404) and on non-`obg.in` hosts every link was parked in `pending_approval` (D-SHORTLINK-BASE). Tests: `short-link.domain.spec.ts` (7 new, run locally), `apps/web-public/tests/short-link-route.spec.ts` (4, run locally). |
| 2 | Visitor page meets the budgets **in CI** | **Partially met** | Measured on a production build: `/c/[org]/[person]` first-load JS **102 kB** (budget: page weight ≤ 300 KB before media). Not enforced in CI: there is no Lighthouse/budget job, so LCP ≤ 1.5 s on 4G is **not measured**. The page is server-rendered per request, not ISR/edge-cached as F12 asks. |
| 3 | Share-back creates an encrypted lead (ADR-0002) | **Met** | Live: `POST /api/shareback` → **201**, lead stored with `encryptedPayload { kid, iv, authTag, ciphertext }`; the visitor's name does not appear in plaintext in the stored document. |
| 4 | Analytics events use the ingestion path | **Partially met** | The visitor page sends `card_viewed`, `contact_saved`, `cta_clicked` to `web-public /api/analytics` → cards `POST /analytics/events` (not the domain bus), bots filtered. The cards endpoint is a stub that acknowledges and **drops** events; PLAN.md says the stub should *queue* them until Step 8. |
| 5 | Read models update from events | **Met** | Live: creating a company and a seat through the API produced `org_read_models` and a draft card via `org.created` / `seat.created` on the shared `InMemoryEventBus`. Requires `pnpm dev` (one process); production needs the SNS/SQS adapter (Step 12, D-F10-EVENTBUS). |

## 2. Feature review findings (docs/reviews/F10–F13)

All "Required fixes" from the four independent reviews were checked against the code. Resolved, either by the earlier session or in this one: F10 1–10, F11 1–9, F12 1–8, F13 1–4. Open: the report-accuracy items (F11 #10, F12 #9, F13 #5) — the F10–F13 reports still describe the code as it was when reviewed.

## 3. Quality gates

| Gate | Result |
|---|---|
| `pnpm lint` | Pass (includes a new rule rejecting `./Foo.js` imports in Next-consumed packages, after this bug broke the build twice) |
| `pnpm typecheck` | Pass (16 projects) |
| `pnpm test` | **Not fully run locally.** Packages that need NestJS decorator metadata (`services/*`, `apps/web-app`, `apps/web-public`) cannot load `@swc/core` on this Windows machine. Run locally and passing: shared 113, ui-kit 85, edge 6, api-contracts 2, plus the decorator-free cards/identity/web-app/web-public specs via a plain vitest config (42 + 5 + 3 + 4). **CI only runs on PRs to `main`; it has not run on this branch.** |
| `pnpm test:e2e` | Pass, 6/6, against the composed dev stack |
| Cross-tenant isolation | Covered in cards/organization HTTP specs (CI) |
| Visitor page axe | Pass for all 8 templates and the inactive/unactivated states |

## 4. Integration defects found and fixed in this review

Each was invisible to unit tests and reviews because the parts had never run together:

1. `apps/web-public` never routed: `c/[...slug]/vcard` is invalid in Next.js.
2. Neither web app compiled Tailwind or loaded design tokens — both rendered as unstyled HTML; dark mode then inverted twice.
3. Organization and cards trusted `X-User-Role` headers from the browser (anyone could act as owner) while the real dashboard got 403 on every admin action → D-SERVICE-AUTH.
4. `pnpm dev` failed on Windows and only started 2 of 6 processes; services in separate processes never received each other's events.
5. Identity's seed wrote malformed organizations the organization service could not read.
6. Visitor site called port 4002 (organization) instead of 4003 (cards).
7. Concurrent session refreshes revoked the user's session on reload.
8. All 8 templates rendered identically; employee-facing card editing UI did not exist; onboarding and QR features were built but not reachable from the dashboard.
9. Error handlers turned every error into a 400 with the internal message (including database errors and visitors' phone numbers).

## 5. Remaining before Step 3 can be called closed

1. **Run CI**: open a PR from `feat/step-3-cards-f10` to `main` (the GitHub CLI is not available on this machine). Treat any service-test failure there as a Step 3 blocker.
2. **Budgets in CI** (condition 2): add a job that builds `web-public`, serves a seeded card and asserts page weight and LCP; make the visitor route ISR/edge-cacheable.
3. **Analytics stub should queue** (condition 4): buffer events for replay in Step 8.
4. **Update F10–F13 reports** to match the code.
5. Known, logged, not blocking: standee QRs target the company profile page (F26, Step 11); the `/r` route on non-edge hosts records no scan analytics; organization `branch.*`/`seat.*` events still publish `aggregateVersion: 1` (Q-15); two `org.branding_updated` payload shapes (Q-16); services do not check session revocation (short-lived tokens).
