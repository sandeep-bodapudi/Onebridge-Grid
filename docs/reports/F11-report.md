# Feature Completion Report: F11 - Short Links and QR Codes

**Date**: 2026-10-14  
**Feature**: F11: Short links and QR codes  
**Priority**: Must  
**Modules**: `packages/api-contracts`, `packages/shared`, `packages/ui-kit`, `services/cards`, `edge/shortlink`, `apps/web-app`  
**Status**: Completed and fully verified following independent audit remediation. 500/500 tests passing workspace-wide (`services/cards`: 84/84, `edge/shortlink`: 6/6, `packages/ui-kit`: 39/39, `apps/web-app`: 61/61, `services/identity`: 124/124, `services/organization`: 115/115, `packages/shared`: 62/62, `packages/api-contracts`: 2/2, root: 7/7). Lint and typecheck clean with 0 errors.

---

## 1. Acceptance Criteria Traceability

| AC # | Requirement (from `F11-short-links-qr.md`) | Implementation | Verification / Test |
|---|---|---|---|
| **AC-1** | Short link format: domain + unique code (e.g., `1b.co/r/x8Fk2LpQ`). Immutable once created. Destination can be updated. | `generateBase62Code(8)` creates an 8-character Base62 code in `services/cards/src/domain/short-link.ts`. The repository and domain entities enforce that `code` is immutable once saved. Calling `repointShortLink` updates `destinationUrl` while leaving `code` and `shortUrl` unaltered. | `services/cards/tests/short-link.domain.spec.ts` ("generates 8-character Base62 code and marks it immutable upon creation", "allows updating destinationUrl while preserving the short link code"), `services/cards/tests/short-link-http.spec.ts` ("PATCH /cards/:cardId/qr/:qrId updates destination without mutating code") |
| **AC-2** | Branded QR code: Level H error correction (allows logo placement), custom brand color, center logo, downloadable in PNG, SVG, PDF. Scannable at 2 cm. | `generateBrandedQrSvg`, `generateBrandedQrPng`, and `generateBrandedQrPdf` in `services/cards/src/domain/qr-generator.ts`. Configures `errorCorrectionLevel: 'H'` (30% error recovery). Composites center circular logo badge into PNG using `pngjs` and embeds into SVG via vector circle elements within 30% error budget. PDF generator draws vector QR module rectangles (`re`, `f`) directly into the PDF 1.4 graphics stream. Verified with automated `jsQR` decode tests. | `services/cards/tests/qr-generator.spec.ts` ("generates valid SVG with Level H error correction and dark brand colour", "embeds center logo in SVG", "renders high-resolution PNG buffer with center logo", "decodes generated PNG with center logo using jsQR successfully", "generates valid PDF buffer with vector QR modules"), `services/cards/tests/short-link-http.spec.ts` ("GET /cards/:cardId/qr/:file downloads SVG, PNG, and PDF assets", "GET /cards/:cardId/qr/:file supports direct browser download with ?tenantId query param") |
| **AC-3** | Redirect at edge: sub-100ms redirect via Cloudflare Worker with KV cache. If card inactive/disabled, shows neutral page (no personal data). | Cloudflare Worker implemented in `edge/shortlink/src/worker.ts` with KV caching (`CACHE_MAX_AGE_MS = 60000`). Active links respond with 302 redirect directly from KV. Inactive, disabled, or unactivated links return `NEUTRAL_INACTIVE_HTML` with HTTP 200, containing zero personal identifiers (no names, phone numbers, emails, or company details). Client component `NeutralInactivePage` in `@onebridge/ui-kit` provides matching styling using token-only classes. | `edge/shortlink/tests/worker.spec.ts` ("redirects to destination within sub-100ms via KV cache", "renders neutral inactive page with 0 personal data when link is disabled or unactivated", "renders neutral inactive page when code is not found"), `packages/ui-kit/tests/components.spec.tsx` (NeutralInactivePage suite) |
| **AC-4** | Source-tagged links: create tagged links (e.g., `?src=standee`, `?src=brochure`) for tracking where scans happen. | `POST /cards/{cardId}/qr` creates source-tagged short links with specific `source` tags (e.g., `standee`, `brochure`, `email_sig`). When the visitor opens `1b.co/r/{code}`, the edge worker captures the source tag into analytics telemetry and redirects to destination. | `services/cards/tests/short-link-http.spec.ts` ("creates source-tagged short link and returns 201 Created"), `edge/shortlink/tests/worker.spec.ts` ("dispatches anonymous scan analytics event via ctx.waitUntil with deviceType and without visitor PII or userAgent") |
| **AC-5** | Standee templates: pre-built, printable counter standee designs with QR code, company logo, and "Scan to save contact". A4 and A5 sizes. | `generateStandeeSvg` and `generateStandeePdf` in `services/cards/src/domain/qr-generator.ts` with A4 ($210 \times 297\text{ mm}$) and A5 ($148 \times 210\text{ mm}$) dimensions, 3mm bleed margin, crop marks, contrast-compliant brand header, center vector QR graphic on white card stage, and bilingual "Scan to save contact / संपर्क सहेजने के लिए स्कैन करें" copy. Endpoints `GET /orgs/:tenantId/qr/standee` and `GET /orgs/:tenantId/branches/:branchId/qr/standee` protected with `TenantAuthGuard`. | `services/cards/tests/qr-generator.spec.ts` ("generates printable A4 and A5 standee SVG templates with crop marks and bleed", "generates printable A4 and A5 standee PDF templates with vector QR graphics"), `services/cards/tests/short-link-http.spec.ts` ("GET /orgs/:tenantId/qr/standee downloads company standee template when authenticated", "GET /orgs/:tenantId/branches/:branchId/qr/standee downloads branch standee template when authenticated", "rejects cross-tenant standee download with 403 Forbidden") |
| **AC-6** | Short link repointing: update where a short link points without changing the QR code. If repointing to an external URL, requires company admin approval. | In `domain/short-link.ts`, changing destination URL checks `isExternalUrl(newDestination)`. If destination is external, requires Company Admin / Owner role; non-admin callers receive 403 Forbidden. `PATCH /cards/{cardId}/qr/{qrId}` enforces server-side role validation. Short link code remains immutable. | `services/cards/tests/short-link.domain.spec.ts` ("rejects external destination if caller is an employee without admin privileges", "allows company admin to directly repoint to external destination"), `services/cards/tests/short-link-http.spec.ts` ("PATCH /cards/:cardId/qr/:qrId rejects external destination for employee", "PATCH /cards/:cardId/qr/:qrId allows admin to repoint to external destination") |
| **AC-7** | Scans fire analytics event with source tag, device type, approximate location (city-level), timestamp. No visitor PII collected. | Edge worker captures scan events including `code`, `tenantId`, `cardId`, `source`, `deviceType` (coarsely classified as `mobile`, `tablet`, `desktop`, or `unknown`), `location: { city, country }`, and ISO timestamp. Personal identifiers (visitor IP, names, phone numbers) and raw `User-Agent` / `Referer` strings are strictly stripped. Dispatched non-blockingly via `ctx.waitUntil` to `POST /analytics/events` (returns 202 Accepted). Origin also exposes `POST /analytics/events`. | `edge/shortlink/tests/worker.spec.ts` ("dispatches anonymous scan analytics event via ctx.waitUntil with deviceType and without visitor PII or userAgent"), `services/cards/tests/short-link-http.spec.ts` ("POST /analytics/events accepts telemetry payload with 202 Accepted") |
| **AC-8** | SSRF protection: destination URL must be validated (no private IPs, no loopback, no internal domains). | `validateSafeDestinationUrl` in `domain/short-link.ts` parses destination URL, enforces `http:` or `https:`, rejects `localhost`, `.local`, `.internal`, `.lan`, private IPv4 blocks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback (`127.0.0.0/8`, `::1`), link-local (`169.254.0.0/16`), and AWS metadata (`169.254.169.254`). Violations throw `UnsafeDestinationUrlError` (RFC 7807 400 Bad Request). | `services/cards/tests/short-link.domain.spec.ts` ("rejects private IPs, loopback, internal hostnames, and invalid schemes with SSRF protection"), `services/cards/tests/short-link-http.spec.ts` ("rejects SSRF destinations (localhost, private IP) with 400 Bad Request") |
| **AC-9** | QR code minimum size: generated assets specify minimum print size (2x2 cm for reliable scanning) in documentation/download instructions. | Generated standees and download assets embed a minimum scannable size indicator ($\ge 2\times 2\text{ cm}$ / 300 DPI / $\ge 240\text{ px}$). The UI `QrDownloadModal` explicitly displays the 2 cm scannable requirement on the print preset option, and standalone downloads include size guidelines. | `services/cards/tests/qr-generator.spec.ts` ("includes minimum 2x2 cm scannable size guidelines in standee layout"), `packages/ui-kit/tests/components.spec.tsx` ("renders download options and calls onDownload with chosen format and resolution") |

---

## 2. Architecture & Security Rules (AGENTS.md Section 3)

| Rule | Status | Implementation Verification |
|---|---|---|
| **Every document/query carries `tenantId`** | **PASS** | `MongoShortLinkRepository` enforces tenant filtering for all authenticated operational paths via `TenantScopedRepository<ShortLinkProps>` and `TenantContext`. The single unauthenticated lookup method `findByCodeGlobal` is explicitly isolated to the public redirect pipeline. |
| **Authorisation checked server-side** | **PASS** | `ShortLinkController` guards all management and standee endpoints (`GET /orgs/:tenantId/qr/standee`, `GET /orgs/:tenantId/branches/:branchId/qr/standee`) with `TenantAuthGuard`, rejecting cross-tenant callers with 403 Forbidden. External repointing requires `caller.role === 'admin' \|\| caller.role === 'owner'`. |
| **No personal data in logs, push payloads, or analytics events** | **PASS** | `edge/shortlink` extracts coarse `deviceType` (`mobile`, `tablet`, `desktop`, `unknown`) and strips raw `User-Agent` and `Referer` strings completely. Visitor IP addresses, phone numbers, and emails are never logged or forwarded to `POST /analytics/events`. |
| **Neutral inactive page shows NO personal data** | **PASS** | When a link is inactive, disabled, unactivated, or non-existent, the edge worker and `NeutralInactivePage` render a generic placeholder showing only "Card or link inactive" and OneBridge Grid branding. No employee or company data is exposed. |
| **Direct browser downloads without custom headers** | **PASS** | `GET /cards/:cardId/qr/:file` supports `?tenantId=...` query parameter alongside `X-Tenant-Id` header, enabling standard browser tab downloads via `window.open`. |
| **Idempotency on write endpoints** | **PASS** | `POST /cards/:cardId/qr` and `PATCH /cards/:cardId/qr/:qrId` support `Idempotency-Key` header with in-memory caching. Duplicate requests return cached responses; payload mismatches return RFC 7807 422 Unprocessable Entity. |
| **Errors use `application/problem+json`** | **PASS** | All exception handlers in `ShortLinkController` throw NestJS exceptions mapped to RFC 7807 problem details with `type`, `title`, `status`, and `detail`. Origin `GET /links/:code` returns 404 Problem Details when missing. |
| **Design tokens and Orange rules** | **PASS** | `NeutralInactivePage`, `QrDownloadModal`, and `SourceTagManager` in `@onebridge/ui-kit` use design tokens exclusively (`bg-sand`, `text-charcoal`, `border-sand-border`, `text-charcoal/70`, `text-charcoal/40`, `font-body`, `bg-bridge-orange text-charcoal`, `text-deep-orange`, touch targets $\ge 44\text{px}$). |
| **Bilingual copy** | **PASS** | Standee templates render `"Scan to save contact / संपर्क सहेजने के लिए स्कैन करें"`. |
| **Short links are immutable** | **PASS** | Short link code generation is strictly immutable; repointing updates destination URL without modifying the 8-character Base62 code. |

---

## 3. Test Execution Summary

All tests executed cleanly with zero failures across the entire repository:

```bash
pnpm test
```

| Project / Package | Test Files | Tests Passed | Status |
|---|---|---|---|
| `edge/shortlink` | 1 | 6 | Pass |
| `packages/api-contracts` | 1 | 2 | Pass |
| `packages/shared` | 12 | 62 | Pass |
| `packages/ui-kit` | 2 | 39 | Pass |
| `services/cards` | 6 | 84 | Pass |
| `services/identity` | 23 | 124 | Pass |
| `services/organization` | 8 | 115 | Pass |
| `apps/web-app` | 9 | 61 | Pass |
| Workspace root | 2 | 7 | Pass |
| **Total** | **64** | **500** | **100% Pass** |

Quality gate validation:
- `pnpm lint`: Pass (0 errors, 0 warnings across all 15 workspace packages).
- `pnpm typecheck`: Pass (clean compile across all 14 TypeScript packages).

---

## 4. Audit Findings Remediated (Post-Review Fixes)

Following independent adversarial review in `docs/reviews/F11-review.md`, the following 10 items were fully remediated and verified:

1. **Standee and Branded PDF Vector QR Code Rendering**:
   - `services/cards/src/domain/qr-generator.ts` updated to compute Level H module matrices using `QRCode.create` and stream vector module rectangles (`re`, `f`) directly into PDF 1.4 objects. Branded QR downloads and counter standees now contain crisp, scalable vector QR graphics on the white card stage.
2. **PNG Branded QR Code Center Logo Compositing**:
   - Integrated `pngjs` to composite the circular brand logo overlay onto high-resolution PNG QR buffers within the Level H 30% error correction budget.
3. **Automated QR Decode Test**:
   - Added automated tests in `services/cards/tests/qr-generator.spec.ts` using `jsqr` to parse generated PNG pixel buffers and assert that the exact short link URL is decoded successfully despite center logo obstruction.
4. **Analytics Telemetry PII Removal**:
   - In `edge/shortlink/src/worker.ts`, stripped raw `User-Agent` and `Referer` strings from analytics dispatch payloads. Added `parseDeviceType` to send only coarse `deviceType` (`mobile`, `tablet`, `desktop`, `unknown`).
5. **Standee Endpoint Security**:
   - Added `@UseGuards(TenantAuthGuard)` to `GET /orgs/:tenantId/qr/standee` and `GET /orgs/:tenantId/branches/:branchId/qr/standee` in `short-link.controller.ts`, verifying that the caller's tenant context matches `:tenantId` and rejecting cross-tenant requests with 403 Forbidden.
6. **Browser Direct Download Support**:
   - Updated `GET /cards/:cardId/qr/:file` in `short-link.controller.ts` to accept `?tenantId=...` query parameter when headers are absent, allowing standard `window.open` downloads from the browser tab.
7. **Standee Bilingual Copy**:
   - Updated standee SVG and PDF generation to render `"Scan to save contact / संपर्क सहेजने के लिए स्कैन करें"`.
8. **Design Token Violations in `NeutralInactivePage`**:
   - Replaced all hardcoded hex values (`#FAF7F2`, `#1B2A4A`, `#E5E7EB`, `#6B7280`, `#9CA3AF`) with `@onebridge/ui-kit` design tokens (`bg-sand`, `text-charcoal`, `border-sand-border`, `text-charcoal/70`, `text-charcoal/40`, `font-body`).
9. **Origin Shortlink Resolution & Missing HTTP Tests**:
   - Added comprehensive HTTP integration tests in `services/cards/tests/short-link-http.spec.ts` covering origin `GET /r/:code` (302 redirect, 200 inactive, 404 missing), origin `GET /links/:code` (200 JSON, 404 problem details), branch standee downloads, cross-tenant rejection, direct browser query-param downloads, and `POST /analytics/events` (202 Accepted).
10. **Accurate Report Documentation**:
    - Replaced all outdated and inaccurate test references with verified, passing test names matching the test suites.

---

## 5. Scope Boundaries & Next Steps

- **Out of Scope (per feature spec)**: Custom template builder, Web NFC reading/writing, native mobile apps, and wallet passes are deferred to future phases.
- **Next Feature**: F12 (Visitor Card Page) will build upon the public card resolution and visitor routing established here.
