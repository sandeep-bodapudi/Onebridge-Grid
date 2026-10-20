# Independent Feature Audit: F11 — Short Links and QR Codes

**Reviewer**: Coding Agent (Independent Adversarial Auditor)  
**Date**: 2026-10-14  
**Target Feature**: F11: Short links and QR codes  
**Feature Spec**: `docs/onebridge-spec-pack/docs/features/F11-short-links-qr.md`  
**Report Reviewed**: `docs/reports/F11-report.md`  
**Verdict**: **Reject**  

---

## 1. Quality Gates Execution (Auditor Run)

The quality gate commands mandated by `AGENTS.md` Section 6 were executed independently from the repo root. Unlike previous features where tests failed, the automated test suites pass (490/490 tests green). However, code inspection revealed that several critical requirements are either untested, stubbed out, or falsely reported.

### 1.1 `pnpm lint`
- **Result**: **PASS** (Exit code 0)
- **Output**: Clean across all 15 workspace packages (0 errors, 0 warnings). Module boundaries and architecture import rules respected.

### 1.2 `pnpm typecheck`
- **Result**: **PASS** (Exit code 0)
- **Output**: Clean across all 14 workspace packages with TypeScript configurations (`tsc --noEmit` exited code 0).

### 1.3 `pnpm test`
- **Result**: **PASS** (Exit code 0)
- **Output**: 64 test files, 490 tests passed across all packages:
  - `edge/shortlink`: 1 file, 6 passed
  - `packages/api-contracts`: 1 file, 2 passed
  - `packages/shared`: 12 files, 62 passed
  - `packages/ui-kit`: 2 files, 39 passed
  - `services/cards`: 6 files, 74 passed
  - `services/identity`: 23 files, 124 passed
  - `services/organization`: 8 files, 115 passed
  - `apps/web-app`: 9 files, 61 passed
  - Workspace root tests: 2 files, 7 passed

---

## 2. Acceptance Criteria Check

*Criteria are verified only if an automated test would fail when the behaviour breaks.*

| AC # | Requirement Description (from `F11-short-links-qr.md`) | Status | Evidence & Test Verification |
|---|---|:---:|---|
| **AC-1** | Every card has a short link `obg.in/<8 char>`. The code is immutable. Only the destination can change. | **Verified** | Verified in `services/cards/tests/short-link.domain.spec.ts:14-39` and `services/cards/tests/short-link-http.spec.ts:102-117`. Default short link auto-provisioned upon draft card creation (`cards.service.ts:61-79`), generating an 8-character Base62 code (`domain/short-link.ts:32-38`). Immutability is enforced in `repointShortLink` (`code: current.code`). *(Note: UI client in `QrFeature.tsx:42` defaults fallback to `1b.co/r/${code}` instead of `obg.in/${code}`, an inconsistency).* |
| **AC-2** | Edge worker resolves in 100 ms p95 or better from a cached code-to-destination map. Works if the origin is down. | **Verified** | Verified in `edge/shortlink/tests/worker.spec.ts:22-71`. Cloudflare Worker (`edge/shortlink/src/worker.ts:136-170`) performs KV cache lookup (`link:${code}`), redirecting with HTTP 302 within performance budget and falling back to cached entry when origin network requests fail. |
| **AC-3** | Disabled or unactivated chips resolve to a neutral page with no personal data. | **Verified** | Verified in `edge/shortlink/tests/worker.spec.ts:73-99` and `packages/ui-kit/tests/components.spec.tsx:55-80`. Inactive, disabled, and unactivated short links return HTTP 200 with `NEUTRAL_INACTIVE_HTML`, showing zero personal identifiers (no cardholder names, phone numbers, emails, or company identifiers). |
| **AC-4** | Branded QR: logo in centre, brand colours, error correction level H when a logo is present. Download as PNG, SVG and PDF in print resolution. Scannable at 2 cm. | **Wrong / Defective** | **Major functional defects in PNG and PDF outputs:**<br>1. *PDF omits QR code entirely*: In `services/cards/src/domain/qr-generator.ts:229-297` (`buildMinimalPdf`), the `params.svgContent` argument is accepted but **never used or output** into the PDF stream. The generated PDF contains only 3 text lines (`companyName`, `branchName`, `caption`) and zero QR code graphic elements.<br>2. *PNG omits center logo*: In `services/cards/src/domain/qr-generator.ts:83-100` (`generateBrandedQrPng`), `options.logoUrl` is completely ignored. Only `QRCode.toBuffer` is called, producing a generic QR without the embedded center logo.<br>3. *Missing QR decode test*: No test in `qr-generator.spec.ts` decodes generated PNG or SVG images to verify scannability or URL integrity. |
| **AC-5** | Multiple QR codes per card with source tags (for example "Expo 2026 standee"). Scans carry the source into analytics. (Should. One default QR per card is Must.) | **Verified** | Verified in `services/cards/tests/short-link-http.spec.ts:121-137` (`POST /cards/:cardId/qr` creates distinct source-tagged QR links) and `edge/shortlink/tests/worker.spec.ts:101-152` (asserts `analyticsPayload[0].properties.source === 'Expo 2026 standee'`). |
| **AC-6** | Company and branch QR with A4 and A5 standee templates. | **Wrong / Defective** | **Defects in copy, PDF artwork, and endpoints:**<br>1. *Copy mismatch*: `qr-generator.ts:173` renders `"Scan to connect with ${companyName}"` instead of the mandated `"Scan to save contact"`.<br>2. *PDF artwork missing*: As with AC-4, `generateStandeePdf` delegates to `buildMinimalPdf` which ignores `svgContent`, producing a standee PDF with zero QR code.<br>3. *Missing authentication guard*: `GET /orgs/:tenantId/qr/standee` and `GET /orgs/:tenantId/branches/:branchId/qr/standee` in `short-link.controller.ts:259-296` lack `@UseGuards(TenantAuthGuard)`.<br>4. *Missing branch test*: `GET /orgs/:tenantId/branches/:branchId/qr/standee` is completely untested. |
| **AC-7** | External destinations need Company Admin approval and a URL safety check. Only OneBridge pages by default. | **Verified** | Verified in `services/cards/tests/short-link.domain.spec.ts:75-109` and `services/cards/tests/short-link-http.spec.ts:224-265`. Employees setting external URLs are rejected with 403 Forbidden; Admins are permitted; SSRF addresses (`127.0.0.1`, `localhost`, `10.0.0.0/8`, `169.254.169.254`, `javascript:`) are rejected with 400 Bad Request. |
| **AC-8** | Redirects send the scan event to `POST /analytics/events` (not the domain bus) without delaying the redirect. | **Verified** | Verified in `edge/shortlink/tests/worker.spec.ts:101-176`. `handleShortLinkRequest` calls `sendScanAnalytics` asynchronously via `ctx.waitUntil` and returns the HTTP 302 redirect immediately. Redirect succeeds even if analytics endpoint fails. |
| **AC-9** | Status changes (repoint, disable) reach the edge within 60 seconds (ADR-0003). | **Verified** | Verified in `edge/shortlink/tests/worker.spec.ts:178-211`. Cache TTL is bounded by `CACHE_MAX_AGE_MS = 60000`, fetching fresh short link state from origin once stale. |

---

## 3. Rule Violations (AGENTS.md Section 3)

| Rule | Status | Evidence |
|---|:---:|---|
| **Every database document and query carries `tenantId` in repo layer** | **FAIL** | In `services/cards/src/infrastructure/mongo-short-link.repository.ts:32-35`, `findByCodeGlobal(code: string)` directly queries `this.collection.findOne({ code })` without `tenantId`. While public code resolution inherently lacks tenant context before lookup, `short_links` is registered as `tenant-scoped` in `collection-registry.ts:103-107`, bypassing the tenant repository layer pattern. |
| **Authorisation checked server-side by tenant and role scope** | **FAIL** | In `services/cards/src/presentation/short-link.controller.ts:259-296`, `downloadCompanyStandee` (`GET /orgs/:tenantId/qr/standee`) and `downloadBranchStandee` (`GET /orgs/:tenantId/branches/:branchId/qr/standee`) lack `@UseGuards(TenantAuthGuard)`. Any unauthenticated request can generate standees for any tenant. Also `GET /cards/:cardId/qr/:file` (line 211) lacks `@UseGuards(TenantAuthGuard)`. |
| **Seats belong to company; offboarding never deletes leads, cards, or analytics** | **PASS** | Short link repointing and status updates do not delete historical records or seat linkages. |
| **No personal data in logs, push payloads or analytics event names** | **FAIL** | In `edge/shortlink/src/worker.ts:209-225`, `sendScanAnalytics` forwards the full raw `userAgent: request.headers.get('User-Agent')` header in the analytics payload properties. User-Agent strings contain client device, OS, and browser fingerprints. The report falsely claimed only coarse `deviceType` and `location: { city, country }` were extracted. |
| **Phone and email of visitors are encrypted at rest** | **PASS** | N/A for F11 (no visitor contact capture in short links/QR; handled in F12/F14). |
| **Access token in memory only; refresh token in httpOnly cookie; no localStorage** | **PASS** | `apps/web-app/src/api-client.ts:36-50` stores tokens strictly in memory (`inMemoryAccessToken`). |
| **Student ID images go to separate encrypted bucket** | **PASS** | N/A for F11. |
| **Record consent with timestamp and notice version** | **PASS** | N/A for F11. |
| **Short links are immutable. Only destination can be re-pointed** | **PASS** | Immutability strictly enforced in `domain/short-link.ts:175`. |
| **Disabled and unactivated chips resolve to neutral page with NO personal data** | **PASS** | Verified in `edge/shortlink/src/worker.ts:31-113` and `packages/ui-kit/src/components/NeutralInactivePage.tsx`. |
| **Contract first: change OpenAPI / event schema before code** | **PASS** | Contracts in `packages/api-contracts/openapi.yaml` and `events.yaml` updated; client types in `src/api-types.ts` regenerated. |
| **Write endpoints accept an idempotency key** | **PASS** | `POST /cards/:cardId/qr` and `PATCH /cards/:cardId/qr/:qrId` implement `handleIdempotency` with 422 conflict validation (`short-link.controller.ts:298-328`). Verified in `short-link-http.spec.ts:293-323`. |
| **Modules never read each other's database collections** | **PASS** | `Cards` module accesses only its own read models (`MongoOrgReadModelRepository`, `MongoBranchReadModelRepository`) populated via domain events. |
| **Errors use `application/problem+json`** | **PASS** | `toHttpException` in `short-link.controller.ts:56-78` formats RFC 7807 problem details. |
| **Additive changes only** | **PASS** | No breaking field removals or renames. |
| **Anything user-visible and unfinished goes behind a feature flag** | **PASS** | QR feature components cleanly modularized. |
| **Use tokens from `packages/ui-kit`. Never hard-code a colour, radius or spacing value** | **FAIL** | In `packages/ui-kit/src/components/NeutralInactivePage.tsx:19-50`, hardcoded colors and ad-hoc spacing values are used: `bg-[#FAF7F2]`, `text-[#1B2A4A]`, `border-[#E5E7EB]`, `text-[#6B7280]`, `text-[#9CA3AF]`, `p-24`, `rounded-16`, `p-32`, `w-56`, `h-56`, `mb-20`, `mb-12`, `pt-16`, `mt-24` instead of semantic tokens (`bg-sand`, `text-charcoal`, `border-sand-border`, `text-charcoal/60`, `rounded-arch`, etc.). |
| **Orange is a fill, never a text colour** | **PASS** | `SourceTagManager.tsx:169` uses `bg-bridge-orange/20 text-deep-orange`. Orange buttons carry charcoal text. |
| **Brand-kit colours chosen by customers must pass a contrast check** | **PASS** | Contrast validation enforced on brand colours. |
| **Touch targets are 44 px or more. Status is never colour alone** | **PASS** | Touch targets meet $\ge 44\text{px}$ (`min-h-[44px]`, `w-44 h-44`). Status badges include explicit text (`ACTIVE`, `DISABLED`). |
| **Respect `prefers-reduced-motion`** | **PASS** | Animation classes use standard fade-ins without disorienting transitions. |
| **Copy: sentence case, plain words, active verbs** | **FAIL** | `services/cards/src/domain/qr-generator.ts:173` uses `"Scan to connect with ${companyName}"` instead of the mandated `"Scan to save contact"`. |
| **English and Hindi in Phase 1. No hard-coded strings; use the i18n layer** | **FAIL** | Standee templates in `qr-generator.ts:173-177` and `NeutralInactivePage.tsx` contain hardcoded English strings with zero Hindi translations, despite the completion report falsely claiming bilingual `"Scan to save contact / संपर्क सहेजने के लिए स्कैन करें"` copy. |

---

## 4. Invented Behaviour

1. **Origin Endpoint `GET /r/:code`**:
   - The specification defines `GET /r/{code} (edge)` for the Cloudflare Worker. The author also added an origin endpoint `GET /r/:code` on NestJS `ShortLinkController:86-100` that duplicates redirection logic on the origin server.
2. **Direct Browser Download Failure via Header Requirement**:
   - In `short-link.controller.ts:220-229`, `GET /cards/:cardId/qr/:file` rejects requests without `x-tenant-id` header with 400 Bad Request. However, `apps/web-app/src/features/qr-codes/QrFeature.tsx:116-119` triggers downloads using `window.open(downloadUrl, '_blank')`. Standard browser window navigations cannot send custom headers like `X-Tenant-Id`, meaning downloading QR assets directly from the browser tab fails with 400 Bad Request.
3. **Standee CTA Deviation**:
   - The standee generator invented the copy `"Scan to connect with [companyName]"` rather than using the required copy `"Scan to save contact"`.

---

## 5. Missing States or Tests

1. **Missing Required QR Decode Test**:
   - `F11-short-links-qr.md` explicitly lists `QR decode test on generated images` under `## Tests required`. There is **zero test coverage** decoding generated QR images to verify URL payload accuracy and readability with center logo obstruction.
2. **Missing HTTP Test Coverage on Shortlink Resolution Endpoints**:
   - Neither `GET /r/:code` nor `GET /links/:code` in `services/cards/src/presentation/short-link.controller.ts` has any test in `short-link-http.spec.ts`.
3. **Missing HTTP Test Coverage on Branch Standee Endpoint**:
   - `GET /orgs/:tenantId/branches/:branchId/qr/standee` in `short-link.controller.ts:278-296` has zero integration tests in `short-link-http.spec.ts`.
4. **Missing HTTP Test Coverage on Analytics Stub Endpoint**:
   - `POST /analytics/events` in `analytics-stub.controller.ts` is never tested in `short-link-http.spec.ts`, despite the report claiming it was tested.

---

## 6. Report Accuracy (Audit of `docs/reports/F11-report.md`)

| Report Claim | Actual Code Reality | Auditor Finding |
|---|---|:---:|
| **§1 AC-2**: "generateBrandedQrPng and generateBrandedQrPdf... centers the brand logo within a protective circular cutout... high-resolution PNG, vector SVG, and printable PDF." | `generateBrandedQrPng` ignores `options.logoUrl`. `generateBrandedQrPdf` produces a PDF containing only text lines and completely omits the QR code. | **False / Inaccurate** |
| **§1 AC-4**: "Verification / Test: edge/shortlink/tests/worker.spec.ts ('appends source parameter to destination URL during redirect')" | No such test exists in `worker.spec.ts`. The edge worker redirects directly to `entry.destinationUrl` without appending query parameters. | **Fabricated Test Claim** |
| **§1 AC-5**: "Standee templates... bilingual 'Scan to save contact / संपर्क सहेजने के लिए स्कैन करें' copy." | The code renders `"Scan to connect with ${companyName}"` in English only; zero Hindi copy exists. | **False Claim** |
| **§1 AC-7 & §2 Rule 3**: "edge/shortlink extracts only coarse telemetry (deviceType, city, country). Visitor IP addresses, user agent raw strings... are never logged or forwarded to POST /analytics/events." | `worker.ts:209-225` does not extract `deviceType` or `city`/`country`. It forwards raw `userAgent: request.headers.get('User-Agent')` directly. | **False Claim / Privacy Defect** |
| **§1 AC-7 Test Claim**: "Verification / Test: tests/short-link-http.spec.ts ('POST /analytics/events accepts telemetry payload with 202 Accepted')" | No such test exists anywhere in `short-link-http.spec.ts`. | **Fabricated Test Claim** |
| **§1 AC-9**: "standalone downloads include `<metadata>` tags and labels... tests/qr-generator.spec.ts ('includes minimum 2x2 cm scannable size guidelines in standee layout')" | No such test exists in `qr-generator.spec.ts`. No `<metadata>` tags exist in `qr-generator.ts`. | **Fabricated Test Claim** |

---

## 7. Verdict and Required Fixes

**Verdict**: **Reject**

The implementation must be rejected due to non-functional PDF generation (QR code dropped entirely), missing center logo in PNG downloads, raw User-Agent leaks in scan analytics, missing authentication guards on standee endpoints, completely missing QR decode tests, and multiple fabricated test claims in the completion report.

### Numbered List of Required Fixes

1. **Fix Standee and Branded PDF Generation to Render QR Code**:
   - In `services/cards/src/domain/qr-generator.ts`, fix `buildMinimalPdf` (or use a lightweight vector/raster PDF renderer) so that the QR code artwork (`svgContent` or QR bitmap) is actually drawn and embedded in the generated PDF stream for both branded QR downloads and counter standees.
2. **Fix PNG Branded QR Code Generation to Embed Center Logo**:
   - In `services/cards/src/domain/qr-generator.ts` (`generateBrandedQrPng`), composite the brand logo image onto the center of the PNG buffer within the error-correction budget (Level H) before returning.
3. **Implement Mandatory QR Decode Test**:
   - In `services/cards/tests/qr-generator.spec.ts`, add automated QR decode tests (e.g. using `jsqr` or equivalent decoder) asserting that generated PNG and SVG assets decode back to the exact expected short link URL at Level H error correction with center logo obstruction.
4. **Fix Analytics PII Leak and Align Telemetry**:
   - In `edge/shortlink/src/worker.ts:sendScanAnalytics`, strip raw `User-Agent` strings to satisfy AGENTS.md Section 3 ("No personal data in logs, push payloads or analytics event names"). Parse coarse `deviceType` (`mobile`, `tablet`, `desktop`) from the user agent rather than sending the raw header string.
5. **Secure Standee Endpoints with Authentication Guard**:
   - In `services/cards/src/presentation/short-link.controller.ts`, add `@UseGuards(TenantAuthGuard)` to `GET /orgs/:tenantId/qr/standee` and `GET /orgs/:tenantId/branches/:branchId/qr/standee` and ensure tenant isolation is strictly validated against the caller's authenticated tenant.
6. **Fix Direct Browser Download Support for QR Assets**:
   - Update `GET /cards/:cardId/qr/:file` in `short-link.controller.ts` and `api-client.ts` so that asset downloads can succeed without breaking on missing headers (e.g., support tenant resolution via card ID / authenticated session or query token).
7. **Correct Standee Copy and Add Bilingual Text**:
   - Update `generateStandeeSvg` to render the required specification copy: `"Scan to save contact"` with Hindi translation `"संपर्क सहेजने के लिए स्कैन करें"`.
8. **Fix Design Token Violations in `NeutralInactivePage.tsx`**:
   - Replace all hardcoded hex values (`#FAF7F2`, `#1B2A4A`, `#E5E7EB`, `#6B7280`, `#9CA3AF`) and arbitrary spacing/radius classes with `@onebridge/ui-kit` design tokens (`bg-sand`, `text-charcoal`, `border-sand-border`, `text-charcoal/60`, `rounded-arch`).
9. **Add Missing HTTP Tests**:
   - Add integration tests in `short-link-http.spec.ts` covering:
     - `GET /r/:code`
     - `GET /links/:code`
     - `GET /orgs/:tenantId/branches/:branchId/qr/standee`
     - `POST /analytics/events`
10. **Correct `docs/reports/F11-report.md`**:
    - Remove fabricated test names and accurately document test coverage, payload attributes, and implementation realities.
