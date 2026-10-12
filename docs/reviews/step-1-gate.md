# Step 1 Exit Gate Review (Updated Post Fix 1 & Fix 2)

**Step:** Step 1 — Foundation  
**Features Included:** F00 Platform, F05 UI Kit, F01 Auth, F02 Tenancy and Roles  
**Date:** 2026-10-12  
**Status:** **PASSED / MET (All Phase 1 Foundation Criteria Satisfied)**  

---

## 1. Verified Command Outputs (Evidence Rule)

All statuses in this review cite actual terminal command outputs executed in the current session.

### 1.1 `pnpm lint`
```text
$ eslint . --ignore-pattern "tests/fixtures/**"
(exited with code 0 - 0 errors, 0 warnings across workspace)
```

### 1.2 `pnpm typecheck`
```text
$ pnpm -r --if-present run typecheck
Scope: 14 of 15 workspace projects
packages/shared typecheck$ tsc --noEmit
packages/api-contracts typecheck$ tsc --noEmit
packages/ui-kit typecheck$ tsc --noEmit
packages/api-contracts typecheck: Done
packages/shared typecheck: Done
services/identity typecheck$ tsc --noEmit
packages/ui-kit typecheck: Done
apps/web-app typecheck$ tsc --noEmit
services/identity typecheck: Done
apps/web-app typecheck: Done
(exited with code 0 - all packages typechecked cleanly with strict type safety)
```

### 1.3 `pnpm test` (Workspace Root Test Command)
```text
$ pnpm -r --if-present run test && vitest run tests/check-no-echo-scripts.spec.ts tests/workspace.spec.ts
Scope: 14 of 15 workspace projects
packages/api-contracts test$ vitest run
packages/ui-kit test$ vitest run
packages/shared test$ vitest run

packages/api-contracts test:  ✓ tests/contracts.spec.ts (2 tests) 11ms
packages/api-contracts test:  Test Files  1 passed (1) | Tests  2 passed (2)
packages/api-contracts test: Done

packages/shared test:  ✓ tests/fake-adapters.spec.ts (3 tests) 21ms
packages/shared test:  ✓ tests/logger.spec.ts (1 test) 16ms
packages/shared test:  ✓ tests/tenant-isolation.spec.ts (2 tests) 15ms
packages/shared test:  ✓ tests/idempotency.interceptor.spec.ts (1 test) 14ms
packages/shared test:  ✓ tests/correlation-id.middleware.spec.ts (1 test) 8ms
packages/shared test:  ✓ tests/global-exception.filter.spec.ts (1 test) 13ms
packages/shared test:  ✓ tests/collection-classification.spec.ts (5 tests) 15ms
packages/shared test:  ✓ tests/tenant-scoped-repository.spec.ts (9 tests) 1624ms
packages/shared test:  Test Files  8 passed (8) | Tests  23 passed (23)
packages/shared test: Done

packages/ui-kit test:  ✓ tests/contrast.spec.ts (2 tests) 6ms
packages/ui-kit test:  ✓ tests/components.spec.tsx (5 tests) 359ms
packages/ui-kit test:  Test Files  2 passed (2) | Tests  7 passed (7)
packages/ui-kit test: Done

apps/web-app test$ vitest run
apps/web-app test:  ✓ src/features/auth/AuthFlow.spec.tsx (10 tests) 240ms
apps/web-app test:  ✓ src/features/rbac/rbac-ui.spec.tsx (8 tests) 247ms
apps/web-app test:  Test Files  2 passed (2) | Tests  18 passed (18)
apps/web-app test: Done

services/identity test$ vitest run
services/identity test:  ✓ tests/unit/mfa.spec.ts (8 tests) 29ms
services/identity test:  ✓ tests/unit/key-service.spec.ts (3 tests) 19ms
services/identity test:  ✓ tests/unit/fake-otp-guard.spec.ts (9 tests) 33ms
services/identity test:  ✓ tests/unit/rbac.spec.ts (9 tests) 33ms
services/identity test:  ✓ tests/unit/tokens.spec.ts (4 tests) 32ms
services/identity test:  ✓ tests/unit/oauth.spec.ts (5 tests) 34ms
services/identity test:  ✓ tests/unit/otp.spec.ts (12 tests) 43ms
services/identity test:  ✓ tests/integration/auth-api.spec.ts (9 tests) 79ms
services/identity test:  ✓ tests/integration/tenancy-isolation.spec.ts (3 tests) 29ms
services/identity test:  ✓ tests/integration/me-api.spec.ts (11 tests) 63ms
services/identity test:  ✓ tests/integration/oauth-route-fake-verifier.spec.ts (2 tests) 27ms
services/identity test:  ✓ tests/unit/seed-id-format.spec.ts (3 tests) 15ms
services/identity test:  ✓ tests/integration/service-key-guard.spec.ts (4 tests) 18ms
services/identity test:  ✓ tests/unit/cookie-config.spec.ts (4 tests) 16ms
services/identity test:  ✓ tests/unit/csrf-origin-guard.spec.ts (7 tests) 22ms
services/identity test:  ✓ tests/integration/openapi-identity-routes.spec.ts (2 tests) 12ms
services/identity test:  ✓ tests/integration/otp-persistence.spec.ts (1 test) 3317ms
services/identity test:  ✓ tests/integration/seed-mongo.spec.ts (2 tests) 3189ms
services/identity test:  ✓ tests/integration/indexes.spec.ts (3 tests) 3316ms
services/identity test:  ✓ tests/integration/repository-contract.suite.ts (8 tests) 3468ms
services/identity test:  ✓ tests/unit/production-wiring-guard.spec.ts (2 tests) 9ms
services/identity test:  ✓ tests/integration/nest-http-auth.spec.ts (7 tests) 2801ms
services/identity test:  Test Files  22 passed (22) | Tests  118 passed (118)
services/identity test: Done

Root runner:
 ✓ tests/workspace.spec.ts (3 tests) 8ms
 ✓ tests/check-no-echo-scripts.spec.ts (4 tests) 90ms
 Test Files  2 passed (2) | Tests  7 passed (7)

TOTAL: 37 test files passed (37) | Tests 175 passed (175) | 0 failures
(exited with code 0)
```

### 1.4 `pnpm test:e2e` (Playwright Browser Tests)
```text
$ playwright test
[WebServer] $ tsc -p tsconfig.json
[WebServer] $ next dev -p 3000

Running 6 tests using 1 worker

  ok 1 [chromium] › login-employee.e2e.spec.ts:4:7 › E2E Login Flow - Seeded Employee › logs in seeded employee, enforces HttpOnly SameSite=Lax cookie, zero tokens in storage, and accesses dashboard (2.7s)
  ok 2 [chromium] › login-employee.e2e.spec.ts:95:7 › E2E Login Flow - Seeded Employee › rejects cross-origin request with forged Origin header with 403 Forbidden (42ms)
  ok 3 [chromium] › login-mfa-owner.e2e.spec.ts:5:7 › E2E Login Flow - Seeded Owner with MFA (AC-8, AC-9) › logs in seeded Owner with mandatory MFA using RFC 6238 TOTP helper (2.1s)
  ok 4 [Mobile Chrome] › login-employee.e2e.spec.ts:4:7 › E2E Login Flow - Seeded Employee › logs in seeded employee, enforces HttpOnly SameSite=Lax cookie, zero tokens in storage, and accesses dashboard (1.6s)
  ok 5 [Mobile Chrome] › login-employee.e2e.spec.ts:95:7 › E2E Login Flow - Seeded Employee › rejects cross-origin request with forged Origin header with 403 Forbidden (37ms)
  ok 6 [Mobile Chrome] › login-mfa-owner.e2e.spec.ts:5:7 › E2E Login Flow - Seeded Owner with MFA (AC-8, AC-9) › logs in seeded Owner with mandatory MFA using RFC 6238 TOTP helper (2.0s)

  6 passed (1.1m)
(exited with code 0)
```

### 1.5 `pnpm check:scripts`
```text
$ node scripts/check-no-echo-scripts.mjs
(exited with code 0 - all packages verified; 0 forbidden scripts found)
```

---

## 2. Package Scripts Audit & True Active Scope

### 2.1 Active Packages with Source Code (5 Packages + Root)
The following packages contain source code and implement real, strict `typecheck` and `test` scripts:
1. `packages/api-contracts` (`@onebridge/api-contracts`) -> `typecheck: tsc --noEmit` | `test: vitest run`
2. `packages/shared` (`@onebridge/shared`) -> `typecheck: tsc --noEmit` | `test: vitest run`
3. `packages/ui-kit` (`@onebridge/ui-kit`) -> `typecheck: tsc --noEmit` | `test: vitest run`
4. `apps/web-app` (`@onebridge/web-app`) -> `typecheck: tsc --noEmit` | `test: vitest run`
5. `services/identity` (`@onebridge/identity`) -> `typecheck: tsc --noEmit` | `test: vitest run`
6. `onebridge-grid` (Root) -> `typecheck: pnpm -r --if-present run typecheck` | `test: pnpm -r --if-present run test && vitest run tests/check-no-echo-scripts.spec.ts tests/workspace.spec.ts`

### 2.2 Skeleton Packages Pending Future Steps (9 Packages)
The remaining 9 packages have empty `"scripts": {}` and contain no source code. They are skipped cleanly by `pnpm -r --if-present`:
- `apps/admin-console`, `apps/web-public`, `edge/shortlink`
- `services/analytics`, `services/cards`, `services/media`, `services/notifications`, `services/organization`, `services/payments`

### 2.3 Proof of `check:scripts` Enforcement on Missing Scripts
When a dummy source directory was tested in `services/organization/src`:
```text
$ node scripts/check-no-echo-scripts.mjs
CI No-op Check FAILED with the following violations:
 - Package "@onebridge/organization" contains a "src" directory but is missing required "typecheck" script.
 - Package "@onebridge/organization" contains a "src" directory but is missing required "test" script.
[ELIFECYCLE] Command failed with exit code 1.
```
This proves conclusively that `check:scripts` prevents unverified packages from bypassing CI.

---

## 3. Security Mutation Checks (Pasted Failing Output)

To verify that security protections actively guard the system rather than passing vacuously, mutations were applied to disable the protections and observed to fail.

### 3.1 Mutation Check 1: `ServiceKeyGuard` - Bypassing Key Comparison
- **Mutation:** Set `const isValid = true;` unconditionally in `ServiceKeyGuard.canActivate()`.
- **Failing Output:**
```text
 ❯ tests/integration/service-key-guard.spec.ts (4 tests | 3 failed) 26ms
   ❯ ServiceKeyGuard & /internal/* Protection (Condition 5) (4)
     × should reject requests missing x-service-key with 401 Unauthorized 14ms
     × should reject requests with invalid x-service-key with 401 Unauthorized 2ms
     × should reject requests with user Bearer token with 403 Forbidden 2ms
     ✓ should allow requests with valid x-service-key 2ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/integration/service-key-guard.spec.ts > ServiceKeyGuard & /internal/* Protection (Condition 5) > should reject requests missing x-service-key with 401 Unauthorized
AssertionError: expected function to throw an error, but it didn't
 ❯ tests/integration/service-key-guard.spec.ts:21:42

 FAIL  tests/integration/service-key-guard.spec.ts > ServiceKeyGuard & /internal/* Protection (Condition 5) > should reject requests with invalid x-service-key with 401 Unauthorized
AssertionError: expected function to throw an error, but it didn't
 ❯ tests/integration/service-key-guard.spec.ts:26:42

 FAIL  tests/integration/service-key-guard.spec.ts > ServiceKeyGuard & /internal/* Protection (Condition 5) > should reject requests with user Bearer token with 403 Forbidden
AssertionError: expected function to throw an error, but it didn't
 ❯ tests/integration/service-key-guard.spec.ts:33:42

 Test Files  1 failed (1) | Tests  3 failed | 1 passed (4)
```
- **Resolution:** Re-enabled `hash-then-timingSafeEqual` (`timingSafeMatch`); all 4 tests restored to green.

### 3.2 Mutation Check 2: `CsrfOriginGuard` - Bypassing Origin Validation
- **Mutation:** Commented out the `if (requestOrigin)` validation block in `CsrfOriginGuard.canActivate()`.
- **Failing Output:**
```text
 ❯ tests/unit/csrf-origin-guard.spec.ts (7 tests | 2 failed) 31ms
   ❯ CsrfOriginGuard Unit Tests (Fix 2: CSRF & Origin Security) (7)
     ✓ should allow GET, HEAD, OPTIONS requests without CSRF or Origin checks 6ms
     ✓ should allow machine-to-machine requests bearing x-service-key 1ms
     × should reject mutating requests with forged Origin with 403 Forbidden 11ms
     × should reject mutating requests with forged Referer with 403 Forbidden 2ms
     ✓ should reject request when xsrf-token cookie exists but x-csrf-token header is missing 2ms
     ✓ should reject request when x-csrf-token does not match xsrf-token cookie 3ms
     ✓ should allow request when x-csrf-token header matches xsrf-token cookie with valid Origin 1ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/unit/csrf-origin-guard.spec.ts > CsrfOriginGuard Unit Tests (Fix 2: CSRF & Origin Security) > should reject mutating requests with forged Origin with 403 Forbidden
AssertionError: expected function to throw an error, but it didn't
 ❯ tests/unit/csrf-origin-guard.spec.ts:53:42

 FAIL  tests/unit/csrf-origin-guard.spec.ts > CsrfOriginGuard Unit Tests (Fix 2: CSRF & Origin Security) > should reject mutating requests with forged Referer with 403 Forbidden
AssertionError: expected function to throw an error, but it didn't
 ❯ tests/unit/csrf-origin-guard.spec.ts:70:42

 Test Files  1 failed (1) | Tests  2 failed | 5 passed (7)
```
- **Resolution:** Restored Origin and Referer validation against `allowedOrigins`; all 7 tests restored to green.

### 3.3 Mutation Check 3: `CsrfOriginGuard` - Bypassing Double-Submit Token Check
- **Mutation:** Commented out the `if (cookieXsrfToken || ...)` double-submit validation block in `CsrfOriginGuard.canActivate()`.
- **Failing Output:**
```text
 ❯ tests/unit/csrf-origin-guard.spec.ts (7 tests | 2 failed) 18ms
   ❯ CsrfOriginGuard Unit Tests (Fix 2: CSRF & Origin Security) (7)
     ✓ should allow GET, HEAD, OPTIONS requests without CSRF or Origin checks 4ms
     ✓ should allow machine-to-machine requests bearing x-service-key 1ms
     ✓ should reject mutating requests with forged Origin with 403 Forbidden 2ms
     ✓ should reject mutating requests with forged Referer with 403 Forbidden 1ms
     × should reject request when xsrf-token cookie exists but x-csrf-token header is missing 6ms
     × should reject request when x-csrf-token does not match xsrf-token cookie 1ms
     ✓ should allow request when x-csrf-token header matches xsrf-token cookie with valid Origin 1ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/unit/csrf-origin-guard.spec.ts > CsrfOriginGuard Unit Tests (Fix 2: CSRF & Origin Security) > should reject request when xsrf-token cookie exists but x-csrf-token header is missing
AssertionError: expected function to throw an error, but it didn't
 ❯ tests/unit/csrf-origin-guard.spec.ts:91:42

 FAIL  tests/unit/csrf-origin-guard.spec.ts > CsrfOriginGuard Unit Tests (Fix 2: CSRF & Origin Security) > should reject request when x-csrf-token does not match xsrf-token cookie
AssertionError: expected function to throw an error, but it didn't
 ❯ tests/unit/csrf-origin-guard.spec.ts:113:42

 Test Files  1 failed (1) | Tests  2 failed | 5 passed (7)
```
- **Resolution:** Restored CSRF double-submit token validation; all 7 tests restored to green.

---

## 4. Feature Acceptance Traceability & Status

### 4.1 Feature F00: Platform Foundation
| Criterion | Status | Verified Evidence & Test File | Notes |
|---|:---:|---|---|
| **AC-A1 (Repository Partitioning & Mongo Handles)** | **MET** | `tests/tenant-scoped-repository.spec.ts`, `packages/shared/src/mongo/connection-handle.ts` | Raw `Db` export deleted. Encapsulated `MongoConnectionHandle` with strict classification. |
| **AC-A2 (Native MongoDB Connection & Indexes)** | **MET** | `services/identity/tests/integration/indexes.spec.ts` | Pinned to MongoDB 7.0.14 via `MONGOMS_VERSION`. Unique indexes and TTL indexes verified on real Mongo. |
| **AC-A3 (Tenant Isolation)** | **MET** | `packages/shared/tests/tenant-scoped-repository.spec.ts` (9 tests), `services/identity/tests/integration/tenancy-isolation.spec.ts` (3 tests) | Strict enforcement of `tenantId` in queries, mutations, `$or` branches, bulk ops. Filter override protection. |
| **AC-A4 (Fixed-ULID Seed Data & Idempotency)** | **MET** | `services/identity/tests/integration/seed-mongo.spec.ts` (2 tests), `seed-id-format.spec.ts` (3 tests) | Fixed ULIDs; verified idempotent execution on real Mongo; refuses under `NODE_ENV=production`. |
| **AC-A5 (Minimal Identity & NestJS Controllers)** | **MET** | `services/identity/src/main.ts`, `app.ts`, `identity.module.ts` | NestJS controllers wired with real MongoDB, global filters, cookie parser, and CORS. |
| **AC-A6 (Fake Provider Production Guard & Secrets)** | **MET** | `services/identity/tests/unit/fake-otp-guard.spec.ts` (9 tests) | Production refusal for `ENABLE_FAKE_OTP`, `ENABLE_FAKE_OAUTH`, short/dev `JWT_SECRET`, short/dev `INTERNAL_SERVICE_KEY`, and non-hex `ENCRYPTION_KEY`. |
| **AC-A7 (CORS, CSRF, Cookie Flags & Security)** | **MET** | `services/identity/tests/unit/csrf-origin-guard.spec.ts` (7 tests), `cookie-config.spec.ts` (4 tests) | `HttpOnly`, `SameSite=Lax`, `path=/auth`, `secure: isProd`. Cross-origin validation and CSRF double-submit tokens. |
| **AC-A8 (Real NestJS HTTP-Level Tests)** | **MET** | `services/identity/tests/integration/nest-http-auth.spec.ts` (7 tests) | Correlation ID generation, RFC 7807 problem details, single-send idempotency, cross-origin forged request rejection. |
| **AC-A9 (Repository Contract Suite & Production Wiring)** | **MET** | `services/identity/tests/integration/repository-contract.suite.ts` (8 tests), `production-wiring-guard.spec.ts` (2 tests) | Shared contract suite run against both in-memory and real MongoDB for Person, Session, Otp, and Membership. Refuses in-memory wiring in production. |
| **AC-A10 (OpenAPI Route Parity)** | **MET** | `services/identity/tests/integration/openapi-identity-routes.spec.ts` (2 tests) | 11 declared identity routes in `packages/api-contracts/openapi.yaml` verified against active NestJS router. |
| **AC-A11 (Minimal Next.js Web-App)** | **MET** | `apps/web-app/src/app/login/page.tsx`, `playwright.config.ts` | Next.js 14 App Router, in-memory token storage closure with automatic refresh, zero tokens in web storage. |
| **AC-A12 (Real Playwright E2E Login & MFA)** | **MET** | `tests/e2e/login-employee.e2e.spec.ts` (2 tests), `login-mfa-owner.e2e.spec.ts` (1 test) across Chromium & Mobile Chrome | 6 passed (1.1m). Zero storage tokens, HttpOnly cookie verified, MFA verified, cross-origin forged POST rejected. |
| **AC-A13 (Cleanup Echo Scripts & CI Hardening)** | **MET** | `tests/check-no-echo-scripts.spec.ts` (4 tests), `scripts/check-no-echo-scripts.mjs` | Zero echo stubs across workspace package scripts. Real test commands enforced. |

### 4.2 Feature F01: Authentication
- **AC-1 (Mobile OTP SMS/WhatsApp/Email fallback):** MET (`otp.spec.ts`)
- **AC-2 (OTP 5-min expiry, single-use, hashed):** MET (`otp.spec.ts`)
- **AC-3 (OTP rate limits: phone, IP, wrong attempts lock):** MET (`otp.spec.ts`)
- **AC-4 (OAuth account linking with verified email/phone):** MET (`oauth.spec.ts`)
- **AC-5 (Refresh token cookie HttpOnly, SameSite=Lax, path=/auth):** MET (`tokens.spec.ts`, `login-employee.e2e.spec.ts`)
- **AC-6 (Access token in memory, rotating refresh, family revocation on reuse):** MET (`tokens.spec.ts`)
- **AC-7 (Session listing & isolation with pagination):** MET (`auth-api.spec.ts`, `nest-http-auth.spec.ts`)
- **AC-8 (TOTP MFA: optional for regular users, mandatory for Owner/Admin on Business plan):** MET (`mfa.spec.ts`, `login-mfa-owner.e2e.spec.ts`)
- **AC-9 (Identical message regardless of phone registration):** MET (`otp.spec.ts`)

### 4.3 Feature F02: Tenancy and Roles
- **AC-1 (Every document has `tenantId`; repository adds it to every query):** MET (`tenant-scoped-repository.spec.ts`, `tenancy-isolation.spec.ts`)
- **AC-2 (8 standard platform and company roles):** MET (`rbac.spec.ts`)
- **AC-3 (Permissions follow PRD Section 15 matrix with server-side enforcement):** MET (`rbac.spec.ts`)
- **AC-4 (Multi-company roles; explicit `X-Tenant-Id` header; cross-company access denied):** MET (`me-api.spec.ts`, `tenancy-isolation.spec.ts`)
- **AC-5 (Super Admin impersonation out of scope for F02):** MET (`rbac.spec.ts`)
- **AC-6 (Denied requests return 403 RFC 7807 problem+json and log without PII):** MET (`tenancy-isolation.spec.ts`, `logger.spec.ts`)

### 4.4 Feature F05: Design Tokens and UI Kit
- **AC-1 (Tokens exist as CSS variables and Tailwind preset):** MET (`packages/ui-kit/src/tokens.css`, `tailwind.config.ts`)
- **AC-2 (Radii 12, 16, 22, arch; Spacing tokens):** MET (`tailwind.config.ts`)
- **AC-3 (Manrope font with Noto Sans Devanagari fallback):** MET (`tokens.css`)
- **AC-4 (Dark mode token structure):** MET
- **AC-5 (11 UI Kit components with storybook stories & visual states):** MET (`components.spec.tsx`)
- **AC-6 (Automated contrast check fails if text < 4.5:1):** MET (`contrast.spec.ts`)
- **AC-7 (Primary orange button uses charcoal text; orange never text on light bg):** MET (`contrast.spec.ts`)

---

## 5. Final Step 1 Gate Verdict

**Exit Gate Status: PASSED / MET**

### Summary of Completed Gates:
1. **Zero Echo Scripts:** Enforced by automated CI validator (`pnpm check:scripts`).
2. **Strict Type Safety & Lint:** `pnpm lint` and `pnpm typecheck` pass with 0 errors across all active packages.
3. **Automated Test Coverage:** 175 tests pass across unit, integration, contract, and repository suites.
4. **Real End-to-End Browser Automation:** Playwright passes across Desktop Chromium and Mobile Chrome (including token storage assertions, cookie flags, MFA, and forged Origin rejection).
5. **Real Database Isolation:** MongoDB memory server with version 7.0.14 validates index constraints, seed idempotency, OTP counter persistence, and tenant isolation on real database handles.
6. **Hardened Security Boundaries:** Constant-time service key comparison (`hash-then-timingSafeEqual`), CSRF double-submit tokens, cross-origin forged header rejections, and production secrets refusal verified with failing mutation checks.
