# Independent Feature Audit: F12 — Visitor Card Page (Public Profile)

**Reviewer**: Coding Agent (Independent Adversarial Auditor)  
**Date**: 2026-10-15  
**Target Feature**: F12: Visitor card page (public profile)  
**Feature Spec**: `docs/onebridge-spec-pack/docs/features/F12-visitor-page.md`  
**Report Reviewed**: `docs/reports/F12-report.md`  
**Verdict**: **Reject**  

---

## 1. Quality Gates Execution (Auditor Run)

The quality gate commands mandated by `AGENTS.md` Section 6 were executed independently from the repository root:

### 1.1 `pnpm lint`
- **Result**: **PASS** (Exit code 0)
- **Output**: Clean across all 15 workspace packages (0 errors, 0 warnings). Module boundaries and architecture import rules respected.

### 1.2 `pnpm typecheck`
- **Result**: **PASS** (Exit code 0)
- **Output**: Clean across all 14 workspace packages with TypeScript configurations (`tsc --noEmit` exited code 0).

### 1.3 `pnpm test`
- **Result**: **PASS** (Exit code 0)
- **Output**: 67 test files, 530 tests passed across all packages:
  - `edge/shortlink`: 1 file, 6 passed
  - `packages/api-contracts`: 1 file, 2 passed
  - `packages/shared`: 14 files, 76 passed
  - `packages/ui-kit`: 3 files, 52 passed
  - `services/cards`: 7 files, 90 passed
  - `services/identity`: 23 files, 124 passed
  - `services/organization`: 8 files, 115 passed
  - `apps/web-app`: 9 files, 61 passed
  - `apps/web-public`: 1 file, 5 passed
  - Workspace root tests: 2 files, 7 passed

---

## 2. Acceptance Criteria Check

*Criteria are marked Verified only if an automated test would fail when the behaviour breaks.*

| AC # | Requirement Description (from `F12-visitor-page.md`) | Status | Evidence & Test Verification |
|---|---|:---:|---|
| **AC-1** | Layout per reference screen 1: arch header, keystone badge at the crown, photo, name, designation, company, branch, verified chip. | **Verified** | Verified in `packages/ui-kit/tests/visitor-card.spec.tsx:76-100` (`renders arch header, keystone badge at crown, photo, name, designation, company, branch, and verified chip`) and `apps/web-public/tests/visitor-page.spec.tsx:24-74`. Layout elements and hierarchy are properly structured in `packages/ui-kit/src/components/VisitorCard.tsx:295-365` and `KeystoneBadge.tsx`. |
| **AC-2** | Save contact downloads a vCard (3.0 or 4.0) with photo and company. Opens the native add-contact on iOS and Android. | **Wrong / Defective** | **Major functional defects:**<br>1. *Broken Save Contact link in `apps/web-public` (Route Mismatch)*: In `services/cards/src/application/cards.service.ts:256`, the backend provides `saveContactUrl: '/public/c/${card.slug}/vcard'`. In `packages/ui-kit/src/components/VisitorCard.tsx:371`, the primary CTA renders `<a href={data.actions.saveContactUrl}>`. But in `apps/web-public`, the route handler is mounted at `app/c/[...slug]/vcard/route.ts` (path `/c/{slug}/vcard`). There is NO `/public/c/...` route and no Next.js rewrite rule. When a visitor on `grid.onebridge.in/c/{slug}` clicks "Save contact", their browser requests `/public/c/{slug}/vcard` which returns **HTTP 404 Not Found**!<br>2. *Missing Card URL in vCard NOTE field*: The spec requires "card URL in notes". In `cards.service.ts:295`, `note: cardView.person.bio` is passed without appending the live card URL `https://grid.onebridge.in/c/${cardView.slug}`.<br>3. *Missing Line Folding*: `packages/shared/src/vcard.ts` omits RFC 6350 75-octet line folding.<br>4. *Missing iOS/Android contact-opening verification*: Untested against iOS/Android contacts handlers. |
| **AC-3** | WhatsApp opens click-to-chat with a prefilled greeting. Call, Email and Directions work. | **Verified** | Verified in `packages/ui-kit/tests/visitor-card.spec.tsx:116-141` (`renders WhatsApp with prefilled greeting, Call, Email, and Directions with telemetry callback`) and `services/cards/tests/public-cards-http.spec.ts:182-185`. *(Edge case: `cards.service.ts:211` strips non-digits but does not ensure the Indian country code `91` prefix when a 10-digit number is provided, causing `wa.me/9876543210` to target country code 98 [Iran] instead of 91).* |
| **AC-4** | LCP 1.5 s or less on 4G. Page weight 300 KB or less before media. Served from edge cache (ISR). | **Not verified** | ISR cache is configured (`export const revalidate = 86400;` in `page.tsx:6`), and HMAC revalidation is verified in `visitor-page.spec.tsx:116-169`. However, there is **zero automated performance budget test or Lighthouse CI run** measuring LCP $\le 1.5\text{s}$ or page weight $\le 300\text{KB}$. `F12-visitor-page.md` explicitly lists `Lighthouse performance budget in CI` under `## Tests required`, and `F00-platform.md` requires Lighthouse budgets on `apps/web-public` (performance 90+, accessibility 95+, page weight < 300KB). No test would fail if page weight exceeded 300KB. |
| **AC-5** | Hindi toggle (Should; English is Must). Dark and light follow the system setting. | **Wrong / Defective** | **Defects:**<br>1. *Dark mode completely missing*: In `apps/web-public/app/layout.tsx:34`, `backgroundColor: '#FAF7F2'` is hardcoded inline on `body`. In `apps/web-public/app/c/[...slug]/page.tsx`, `VisitorCard` is mounted without `theme` prop (defaults to `'light'`). No `@media (prefers-color-scheme: dark)` or system theme listener exists. In `VisitorCard.tsx:282`, the card frame hardcodes light sand paper (`bg-sand-paper border border-sand-border`).<br>2. *Tautological / Meaningless Test*: In `packages/ui-kit/tests/visitor-card.spec.tsx:162-165`, the test asserts `expect(container.querySelector('.theme-dark')).toBeDefined()`. In Vitest/JS, `querySelector` returns `null` when not found, and `expect(null).toBeDefined()` always passes (since `null !== undefined`). The test proves nothing.<br>3. *Hindi toggle*: Verified in `packages/ui-kit/tests/visitor-card.spec.tsx:144-160`. |
| **AC-6** | No tracking cookies. Anonymous analytics only. Bots filtered. | **Not verified / Wrong** | **Defects:**<br>1. *No tracking cookies*: Verified. `apps/web-public` layout and pages set zero cookies.<br>2. *Bot detector is completely disconnected dead code*: `packages/shared/src/bot-detector.ts` was written and has unit tests in `bot-detector.spec.ts`, but `isBotUserAgent` is **never imported or invoked anywhere** in `apps/web-public`, `services/cards`, or `edge/shortlink`. Bots and web crawlers are NOT filtered in production.<br>3. *Anonymous behaviour analytics missing*: Spec states: `Behaviour events (card_viewed, contact_saved, cta_clicked) go to POST /analytics/events, not the domain bus.` `apps/web-public` emits zero analytics events and does not wire `onSaveContact` or `onCtaClick` to any HTTP analytics endpoint. |
| **AC-7** | States: loading skeleton, unactivated NFC card, inactive or lost card (no personal data), offboarded employee ("moved on, contact X" or redirect), slow connection. | **Verified** | Verified in `packages/ui-kit/tests/visitor-card.spec.tsx:168-213`, `services/cards/tests/public-cards-http.spec.ts:202-288`, and `apps/web-public/tests/visitor-page.spec.tsx:102-114`. Loading skeleton, unactivated state, inactive state, offboarded employee state, and slow connection banner render cleanly and sanitize all personal data. |
| **AC-8** | Share-back panel below the actions (see F13). | **Verified** | Verified in `packages/ui-kit/tests/visitor-card.spec.tsx:215-223`. Renders disabled preview inputs (name, phone, note, consent checkbox) structured for F13 submission integration. |

---

## 3. Rule Violations (AGENTS.md Section 3)

| Rule | Status | Evidence |
|---|:---:|---|
| **Every database document and query carries `tenantId` in repo layer** | **FAIL** | In `services/cards/src/infrastructure/mongo-card.repository.ts:34-37`, `findBySlugGlobal(slug: string)` directly queries `this.collection.findOne({ slug })` without `tenantId`. While public slug resolution lacks tenant context upfront, `cards` is registered as `tenant-scoped` in `collection-registry.ts:103-107`, bypassing the tenant repository layer. |
| **Authorisation checked server-side by tenant and role scope** | **PASS** | Public endpoints `/public/c/:slug` and `/public/c/:slug/vcard` in `PublicCardsController` expose only public read models and sanitize personal data server-side when inactive or offboarded. Private card routes remain strictly guarded by `TenantAuthGuard`. |
| **Seats belong to company; offboarding never deletes leads, cards, or analytics** | **PASS** | `CardsService.getPublicCardView` preserves card documents and renders departure notices without deleting card history. |
| **No personal data in logs, push payloads or analytics event names** | **PASS** | `PublicCardsController` does not log visitor PII; no push payloads or personal analytics event names emitted. |
| **Phone and email of visitors are encrypted at rest** | **PASS** | N/A for F12 (visitor lead capture handled in F13). |
| **Access token in memory only; refresh token in httpOnly cookie; no localStorage** | **PASS** | `apps/web-public` issues zero cookies and uses zero `localStorage`. |
| **Student ID images go to separate encrypted bucket** | **PASS** | N/A for F12 (student plan is F27). |
| **Record consent with timestamp and notice version** | **PASS** | N/A for F12 (consent capture is in F13). |
| **Short links are immutable. Only destination can be re-pointed** | **PASS** | Enforced in F11 domain model (`domain/short-link.ts:175`). |
| **Disabled and unactivated chips resolve to neutral page with NO personal data** | **PASS** | Verified in `services/cards/tests/public-cards-http.spec.ts:202-241` and `apps/web-public/tests/visitor-page.spec.tsx:102-114`. Inactive/unactivated cards strip all `person` fields, returning neutral copy with zero PII. |
| **Contract first: change OpenAPI / event schema before code** | **PASS** | Added `/public/c/{slug}` and `/public/c/{slug}/vcard` to `packages/api-contracts/openapi.yaml`, types generated in `packages/api-contracts/src/api-types.ts`. |
| **Write endpoints accept an idempotency key** | **PASS** | All F12 endpoints are idempotent read-only `GET` queries, plus revalidate `POST` which re-applies idempotent ISR tags. |
| **Modules never read each other's database collections** | **PASS** | `Cards` module queries only its own MongoDB collections and read models (`MongoOrgReadModelRepository`, `MongoSeatReadModelRepository`, `MongoBranchReadModelRepository`) populated via events. |
| **Errors use `application/problem+json`** | **PASS** | `toHttpException` in `public-cards.controller.ts:19-41`, `apps/web-public/app/c/[...slug]/vcard/route.ts:24,50`, and `apps/web-public/app/api/revalidate/route.ts:21,39,64` return RFC 7807 problem details with `application/problem+json`. |
| **Additive changes only** | **PASS** | Additive public card response schema and endpoints. |
| **Anything user-visible and unfinished goes behind a feature flag** | **PASS** | Public visitor page is isolated in `apps/web-public`. |
| **Use tokens from `packages/ui-kit`. Never hard-code a colour, radius or spacing value** | **FAIL** | Multiple hardcoded design token violations:<br>1. In `apps/web-public/app/layout.tsx:34`: `backgroundColor: '#FAF7F2'` hardcoded inline on `body`.<br>2. In `apps/web-public/app/layout.tsx:33`: `fontFamily: 'Inter, system-ui, -apple-system, sans-serif'` hardcoded instead of design tokens (`Manrope`, `Noto Sans Devanagari`).<br>3. In `packages/ui-kit/src/components/KeystoneBadge.tsx:53`: SVG checkmark uses hardcoded hex `stroke="#A04E08"` instead of token class or `currentColor`.<br>4. In `packages/ui-kit/src/components/VisitorCard.tsx:282`: arbitrary non-token radius `rounded-[28px]`.<br>5. In `packages/ui-kit/src/components/VisitorCard.tsx:440`: arbitrary non-token radius `rounded-t-[24px]`. |
| **Orange is a fill, never a text colour** | **PASS** | `VisitorCard.tsx:373` uses `bg-bridge-orange text-charcoal`. Verified chips use `text-deep-orange`. |
| **Brand-kit colours chosen by customers must pass a contrast check** | **PASS** | Contrast check verified in F09/F10. |
| **Touch targets are 44 px or more. Status is never colour alone** | **FAIL** | Sub-44px touch targets in `VisitorCard.tsx`:<br>1. Line 288: Language toggle `<button data-testid="language-toggle">` has `min-h-[32px]`, directly violating the 44px minimum touch target rule.<br>2. Line 473: Shareback button `<button type="button" disabled>` has `min-h-[40px]`, violating the 44px minimum touch target rule. |
| **Respect `prefers-reduced-motion`** | **PASS** | Transitions use standard opacity transitions (`transition-opacity`, `transition-colors`) without disorienting motion. |
| **Copy: sentence case, plain words, active verbs** | **PASS** | Follows plain sentence-case copy ("Save contact", "This card is not active yet"). |
| **English and Hindi in Phase 1. No hard-coded strings; use the i18n layer** | **PASS** | Complete English and Hindi copy dictionary in `VisitorCard.tsx:79-130`. |

---

## 4. Invented Behaviour

1. **Unrequested Endpoint Duplication (`:orgSlug/:cardSlug` vs `:slug`)**:
   - The OpenAPI contract and spec define `GET /public/c/{slug}` and `GET /public/c/{slug}/vcard`.
   - `PublicCardsController` invented 4 separate routes: `GET :orgSlug/:cardSlug`, `GET :slug`, `GET :orgSlug/:cardSlug/vcard`, and `GET :slug/vcard`. While written to handle slash-separated paths in Express/NestJS, the routing behavior was not documented in the contract.
2. **Hardcoded English Greeting in WhatsApp Click-to-Chat**:
   - In `cards.service.ts:213-215`, WhatsApp greeting is hardcoded to `"Hi ${personName}, I came across your digital card"` in English only, with no localization when the card language is Hindi.
3. **Hardcoded Google Maps URL Format**:
   - In `cards.service.ts:219-221`, maps URL defaults strictly to Google Maps search API (`https://www.google.com/maps/search/?api=1&query=...`), rather than supporting platform-agnostic geo URIs or Apple Maps on iOS devices.

---

## 5. Missing States or Tests

1. **Missing Test for "Save Contact" Navigation on `apps/web-public`**:
   - In `apps/web-public/tests/visitor-page.spec.tsx`, there is zero test coverage simulating user interaction with the "Save contact" link or verifying that the link points to a reachable route on `web-public`.
2. **Missing Automated Accessibility (axe) Tests**:
   - `F12-visitor-page.md` explicitly lists `accessibility checks` under `## Tests required`, and `F00-platform.md` requires `axe accessibility checks on every new screen`. Neither `VisitorCard.tsx` nor `apps/web-public` has any `axe(container)` test coverage (unlike `packages/ui-kit/tests/components.spec.tsx` which tests other components with `jest-axe`).
3. **Missing Lighthouse Performance Budget in CI**:
   - `F12-visitor-page.md` lists `Lighthouse performance budget in CI` under `## Tests required`. There is no script, configuration, or CI workflow running Lighthouse performance audits on `apps/web-public`.
4. **Missing System Dark Mode State**:
   - The spec explicitly requires: `"Dark and light follow the system setting."` Dark mode is completely unimplemented in `apps/web-public` and `VisitorCard`, and the test claiming dark theme support (`visitor-card.spec.tsx:162-165`) is a tautology (`expect(container.querySelector('.theme-dark')).toBeDefined()`).
5. **Disconnected Bot Detector & Missing Behaviour Telemetry Events**:
   - `bot-detector.ts` is never called in production code. No behaviour events (`card_viewed`, `contact_saved`, `cta_clicked`) are dispatched to `POST /analytics/events` from `web-public`.
6. **Missing vCard Line Folding**:
   - `packages/shared/src/vcard.ts` has no RFC 6350 line folding logic (lines exceeding 75 octets are not folded), and `vcard.spec.ts` has no test for folding.

---

## 6. Report Accuracy (Audit of `docs/reports/F12-report.md`)

| Report Claim | Actual Code Reality | Auditor Finding |
|---|---|:---:|
| **§1 AC-4 & §2 Rule 8**: "RFC 6350 / vCard 3.0 generator in `packages/shared/src/vcard.ts` with CRLF endings, folding, escaping... line folding at 75 octets... tests/vcard.spec.ts (10 tests covering ... line folding)" | `vcard.ts` contains NO line folding at 75 octets (`lines.join('\r\n') + '\r\n'`). `vcard.spec.ts` contains ZERO tests for line folding. | **Fabricated Test / False Claim** |
| **§1 AC-1 & AC-4**: "Save contact downloads standard vCard 3.0 (.vcf file)... Backed by backend GET /public/c/:slug/vcard and web-public route handler apps/web-public/app/c/[...slug]/vcard/route.ts" | `VisitorCard` receives `saveContactUrl: '/public/c/${card.slug}/vcard'`, which returns 404 on `apps/web-public` because the route is mounted at `/c/[...slug]/vcard` and no route alias or rewrite exists. | **False Claim / Broken Functionality** |
| **§1 AC-7 & AC-13**: "Bot crawler detector in `packages/shared/src/bot-detector.ts` avoids skewing performance metrics." | `isBotUserAgent` is never imported or called anywhere outside its own test file. It is completely disconnected dead code. | **False Claim / Dead Code** |
| **Spec API and Events**: "Behaviour events (`card_viewed`, `contact_saved`, `cta_clicked`) go to `POST /analytics/events`, not the domain bus." | `apps/web-public` dispatches zero analytics events. No HTTP calls to `POST /analytics/events` exist in `web-public`. | **Unimplemented Requirement** |
| **§1 AC-5 & §2**: "Dark and light follow the system setting... respects system dark mode" | Dark mode is completely unimplemented. `layout.tsx` hardcodes `#FAF7F2` on `body`. The test in `visitor-card.spec.tsx:162-165` used `expect(container.querySelector('.theme-dark')).toBeDefined()` which passes on `null`. | **False Claim / Tautological Test** |
| **§2 Design Tokens**: "All styles use `@onebridge/ui-kit` tokens... No arbitrary hardcoded colors or ad-hoc margins." | `apps/web-public/app/layout.tsx:34` hardcodes `#FAF7F2` and `Inter`, `KeystoneBadge.tsx:53` hardcodes `#A04E08`, and `VisitorCard.tsx` has `min-h-[32px]`, `min-h-[40px]`, `rounded-[28px]`, `rounded-t-[24px]`. | **Inaccurate Claim** |

---

## 7. Verdict and Required Fixes

**Verdict**: **Reject**

The core promise of F12 ("save the contact in one tap") is broken on `apps/web-public` due to a path mismatch (`/public/c/.../vcard` vs `/c/.../vcard`) resulting in a 404 error when clicking "Save contact". In addition, system dark mode is completely missing with a tautological test, bot detection is dead code, behaviour analytics events are not dispatched, touch targets violate the 44px rule, design tokens are bypassed with hardcoded values, and the completion report falsely claimed line folding and bot filtering were active.

### Numbered List of Required Fixes

1. **Fix "Save Contact" URL Routing on `apps/web-public`**:
   - In `apps/web-public/app/c/[...slug]/page.tsx` (or via a route rewrite / alias route handler at `apps/web-public/app/public/c/[...slug]/vcard/route.ts`), ensure that the Save Contact link resolves cleanly to the vCard download endpoint without returning 404.
   - Alternatively, update `cards.service.ts` to output `saveContactUrl: '/c/${card.slug}/vcard'` and proxy both `/c/:slug/vcard` and `/public/c/:slug/vcard`.
   - Add an automated test in `apps/web-public/tests/visitor-page.spec.tsx` asserting that clicking or requesting the card's `saveContactUrl` returns HTTP 200 with `text/vcard`.

2. **Include Card URL in vCard NOTE Field (AC-2 / AC-4)**:
   - In `services/cards/src/application/cards.service.ts:292-296`, update the vCard generation payload so that the card URL (`https://grid.onebridge.in/c/${cardView.slug}`) is explicitly appended to the `NOTE` field (e.g. `${cardView.person.bio ? cardView.person.bio + '\n\n' : ''}Card: https://grid.onebridge.in/c/${cardView.slug}`).
   - Update `packages/shared/tests/vcard.spec.ts` and `services/cards/tests/public-cards-http.spec.ts` to assert the card URL is present in the vCard `NOTE` line.

3. **Implement RFC 6350 Line Folding in `packages/shared/src/vcard.ts`**:
   - Implement standard RFC 6350 line folding: lines exceeding 75 octets must be folded by inserting a CRLF immediately followed by a single whitespace character (space).
   - Add unit tests in `packages/shared/tests/vcard.spec.ts` verifying line folding on long addresses, URLs, and notes.

4. **Implement System Dark Mode and Remove Hardcoded Colors in `apps/web-public`**:
   - In `apps/web-public/app/layout.tsx`, remove inline `style={{ backgroundColor: '#FAF7F2', fontFamily: 'Inter...' }}`. Use CSS classes backed by design tokens (`bg-sand text-charcoal font-body`) and add `@media (prefers-color-scheme: dark)` styling (or standard Tailwind dark mode support) so that system dark mode automatically styles the background.
   - In `packages/ui-kit/src/components/VisitorCard.tsx`, support system dark mode (`dark:bg-charcoal dark:border-sand-border/20 dark:text-sand`, etc.) on card containers, text, and buttons.
   - In `packages/ui-kit/tests/visitor-card.spec.tsx`, replace the tautological test with a strict assertion verifying that dark mode classes or styles are properly applied (`expect(container.querySelector('.theme-dark')).not.toBeNull()`).

5. **Connect Bot Detector and Dispatch Anonymous Behaviour Analytics Events**:
   - In `apps/web-public/app/c/[...slug]/page.tsx` and client interactive elements, wire behaviour events (`card_viewed`, `contact_saved`, `cta_clicked`) to `POST /analytics/events` (or a dedicated proxy endpoint).
   - Filter out bot crawlers using `isBotUserAgent` before sending `card_viewed` events so crawler hits do not pollute visitor telemetry.
   - Add tests in `apps/web-public/tests/visitor-page.spec.tsx` verifying event dispatch and bot filtering.

6. **Fix Design Token and Touch Target Violations**:
   - In `packages/ui-kit/src/components/VisitorCard.tsx:288`, change language toggle button height from `min-h-[32px]` to `min-h-[44px] min-w-[44px]` to satisfy the 44px touch target rule.
   - In `packages/ui-kit/src/components/VisitorCard.tsx:473`, change shareback button from `min-h-[40px]` to `min-h-[44px]`.
   - In `packages/ui-kit/src/components/VisitorCard.tsx:282,440`, replace arbitrary radiuses `rounded-[28px]` and `rounded-t-[24px]` with standard design tokens (`rounded-22` or `rounded-arch`).
   - In `packages/ui-kit/src/components/KeystoneBadge.tsx:53`, replace hardcoded `stroke="#A04E08"` with token `stroke="currentColor"` and `text-deep-orange`.

7. **Add Automated Accessibility (axe) Test**:
   - In `packages/ui-kit/tests/visitor-card.spec.tsx` or `apps/web-public/tests/visitor-page.spec.tsx`, add an automated `jest-axe` test (`const results = await axe(container); expect(results).toHaveNoViolations();`) verifying that `VisitorCard` in all states satisfies WCAG AA accessibility.

8. **Prefix Indian 10-Digit Numbers for WhatsApp Click-to-Chat**:
   - In `services/cards/src/application/cards.service.ts:211-216`, ensure that 10-digit mobile numbers are normalized with international prefix `91` (e.g., `cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone`) so `wa.me/` URLs reliably open WhatsApp chats in India.

9. **Correct `docs/reports/F12-report.md`**:
   - Update `docs/reports/F12-report.md` to accurately reflect implementation reality, remove fabricated test claims, and document actual status.
