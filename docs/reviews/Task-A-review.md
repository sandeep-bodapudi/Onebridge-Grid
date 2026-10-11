# Task A Review: F00 Platform Foundations & F01 Identity

**Date**: October 11, 2026  
**Auditor**: Independent Audit Subagent (Assume Defects Stance)  
**Scope**: Task A Implementation against Approved Plan, 12 Approved Conditions, `AGENTS.md`, and `docs/reports/Task-A-report.md`  
**Verdict**: **REJECT** (Critical test omissions, non-wired CSRF guards, timing attack vulnerability, missing mobile E2E project, production security bypasses, and machine-specific scripts)

---

## 1. Executive Summary & Audit Findings

Task A set out to close critical platform and identity gaps from F00 and F01, establishing a real NestJS identity service, real MongoDB repositories with strict tenant isolation, seeded demo tenants, and Playwright E2E browser tests.

While foundational scaffolding was added (NestJS structure, `TenantScopedRepository` isolation filters, valid Crockford Base32 ULID seed data, and two passing Chromium E2E tests), an adversarial audit reveals **severe discrepancies between what was promised in the approved plan and what was actually delivered in code**:

1. **6 Promised Test Suites are Completely Missing**:
   - `nest-http-auth` (HTTP-level `supertest` with `INestApplication`): **MISSING**. Existing tests only call JavaScript controller methods directly in unit style.
   - `production-wiring-guard`: **MISSING**. No test verifies that `IdentityModule` rejects in-memory repositories in production.
   - `repository-contract.suite.ts` (shared contract across in-memory and Mongo repos): **MISSING**.
   - `indexes.spec.ts` (asserting indexes against real MongoDB): **MISSING**.
   - `seed.spec.ts` (testing seed idempotency and production refusal against real MongoDB): **MISSING**. Only static string regex tests exist.
   - `mongo-repositories`: **MISSING**. None of the 4 Mongo repositories (`MongoPersonRepository`, `MongoSessionRepository`, `MongoOtpRepository`, `MongoMembershipRepository`) are tested against real Mongo.
2. **Security Deficiencies**:
   - **Inactive CSRF Guard**: `CsrfOriginGuard` was created but **is not attached to any controller or endpoint**. It is never executed in the NestJS pipeline. Furthermore, if `Origin` and `Referer` headers are omitted, it returns `true` (does not enforce mandatory Origin), and never inspects `X-CSRF-Token`.
   - **Timing Attack in Service Key Comparison**: `ServiceKeyGuard` uses standard `!==` string comparison instead of `crypto.timingSafeEqual()`, exposing `/internal/*` routes to timing attacks, and falls back to a hardcoded test key if unconfigured.
   - **Production Key Refusal Bypassed**: In `env.ts`, `ENCRYPTION_KEY` silently falls back to `'default-dev-encryption-key-onebridge-32-bytes!'` in production and does not refuse known dev keys.
   - **Dropped Idempotency**: `NestAuthController` and `NestInternalController` do not implement idempotency; `@Headers('idempotency-key')` in `NestInternalController` is completely unused.
3. **Playwright Mobile Viewport Omitted**: `playwright.config.ts` only defines `name: 'chromium'` (`Desktop Chrome`). The required mobile viewport project (`Pixel 7` / `390x844`) was never configured or executed.
4. **CI Workflow Deficiencies**: `.github/workflows/ci.yml` does not install Playwright browser binaries, does not cache Mongo binaries, and does not execute `pnpm check:scripts`. No green CI run exists.
5. **Machine-Specific Path**: Root `package.json` hardcodes `cross-env TEMP=D:\temp TMP=D:\temp`, breaking test execution on Linux CI and any workstation without drive `D:`.
6. **Vulnerability Misrepresentation**: Direct dependency `next@14.2.0` in `apps/web-app` has **3 Critical** and **18 High** CVEs (including Windows RCE and Image Optimization RCE). The report falsely stated that "all advisories are transitive... no direct application dependencies have unresolved vulnerabilities".

---

## 2. Plan Acceptance Criteria Traceability Table (AC-A1 to AC-A13)

| Criterion | Plan Requirement | Evaluation | Status | Evidence (File & Line / Test) |
|---|---|---|:---:|---|
| **AC-A1** | Migrate `services/identity` to NestJS (`IdentityModule`, `@Controller` decorators, `main.ts` on port 4001 with `cookie-parser`, `GlobalExceptionFilter`, `CorrelationIdMiddleware`). | NestJS app bootstrapped and exports controllers. | **Verified** | `services/identity/src/main.ts:1-40`, `services/identity/src/identity.module.ts:1-135` |
| **AC-A2** | Repository bifurcation: `TenantScopedRepository` vs allowlisted `GlobalRepository` (`Person`, `Session`, `OtpChallenge`, `IssuedIdRegistry`). Enforcement test and `decisions.md` wording. | Base classes enforce scope; classification test passes; recorded in decisions log. | **Verified** | `packages/shared/src/mongo/tenant-scoped-repository.ts:19`, `packages/shared/src/mongo/global-repository.ts:18`, `packages/shared/tests/collection-classification.spec.ts:1-75`, `docs/decisions.md:11` |
| **AC-A3** | Data storage with native `mongodb` driver; real repos (`MongoPersonRepository`, `MongoSessionRepository`, `MongoOtpRepository`, `MongoMembershipRepository`); automated index creation on persons, sessions, otp_challenges, memberships. | Repositories created; however, **index creation is missing** for persons, sessions, and memberships (only `MongoOtpRepository` has TTL indexes), and **zero tests exercise these repositories against Mongo**. | **Wrong** | `services/identity/src/infrastructure/repositories/mongo-otp.repository.ts:32-35` (only challenges/rateLimits indexed); `mongo-person.repository.ts:1-75` (no indexes); no unit/integration tests exist for any Mongo repo |
| **AC-A4** | Comprehensive Mongo tenant isolation tests (`find`, `update`, `delete`, `upsert`, `bulkWrite`, `$or`, filter override throws `TenantIsolationError`, cross-tenant writes rejected, no raw collection). | Comprehensive suite implemented against `mongodb-memory-server`. | **Verified** | `packages/shared/tests/tenant-scoped-repository.spec.ts:1-240` (9 tests passing) |
| **AC-A5** | Seeded demo data with fixed 26-char valid ULIDs (2 tenants, Owner/Admin/Employee each), idempotent, refuses production, runnable via `pnpm seed`. | Seed script exists with fixed ULIDs; however, **no `pnpm seed` script is defined in root `package.json`**, and seed idempotency/refusal is not covered by automated tests. | **Wrong** | `services/identity/src/infrastructure/seed.ts:1-114`; Root `package.json:4-12` lacks `"seed"` script; `seed.spec.ts` is missing |
| **AC-A6** | Fake OTP production safety guard (`ALLOW_FAKE_OTP=true` dev/test only, unset `NODE_ENV` is production, production fails boot without real provider, OTP never returned in response). | Environment validation rejects fake OTP in production; unset `NODE_ENV` defaults to production; covered by unit tests. | **Verified** | `services/identity/src/config/env.ts:28-34, 56-59`, `services/identity/tests/unit/fake-otp-guard.spec.ts:1-68` |
| **AC-A7** | CORS, CSRF, Cookie Flags & Security (`CORS_ORIGINS`, CSRF protection on `POST /auth/refresh` requiring `X-Requested-With` or `X-CSRF-Token`, config-driven cookie flags: `httpOnly`, `secure`, `sameSite`, `path: '/auth'`). | Cookie flags configurable; however, **CSRF protection is not applied**: `CsrfOriginGuard` is never registered on the refresh endpoint or controller, does not check `X-CSRF-Token`, and cookie path is `'/'` rather than `'/auth'`. | **Wrong** | `services/identity/src/presentation/guards/csrf-origin.guard.ts:25-53` (not attached); `services/identity/src/presentation/nest-auth.controller.ts:119-130` (no guard); `cookie.config.ts:20` (`path: '/'`) |
| **AC-A8** | Real NestJS HTTP-level tests via `supertest` with `INestApplication` (asserts generated `X-Correlation-ID`, RFC 7807 `application/problem+json`, `POST /auth/otp` with `Idempotency-Key` replay and mismatch). | **Test suite does not exist.** `nest-http-auth.spec.ts` was not created. Existing `auth-api.spec.ts` calls standalone TypeScript classes directly without NestJS HTTP pipeline. | **Not verified** | Missing file: `services/identity/tests/integration/nest-http-auth.spec.ts` |
| **AC-A9** | Repository contract suite (`repository-contract.suite.ts`) run against both in-memory and Mongo repos; production wiring guard unit test proving in-memory repos cannot be wired in production. | **Neither test exists.** `repository-contract.suite.ts` and `production-wiring-guard.spec.ts` were never created. | **Not verified** | Missing files: `services/identity/tests/integration/repository-contract.suite.ts`, `services/identity/tests/unit/production-wiring-guard.spec.ts` |
| **AC-A10** | OpenAPI route parity (all 11 identity endpoints matching `packages/api-contracts/openapi.yaml` verified by automated test). | Parity test reads OpenAPI spec and asserts corresponding routes and HTTP methods. | **Verified** | `services/identity/tests/integration/openapi-identity-routes.spec.ts:1-125` |
| **AC-A11** | Minimal Next.js web-app in `apps/web-app` mounting `AuthFlow` at `/login`, in-memory access-token API client, Playwright `webServer` entry. | Next.js app created, mounts `AuthFlow`, client handles token rotation in memory, configured in Playwright. | **Verified** | `apps/web-app/app/login/page.tsx:1-95`, `apps/web-app/src/api-client.ts:1-98`, `playwright.config.ts:25-39` |
| **AC-A12** | Real Playwright E2E login & MFA tests (Desktop & mobile viewports; seeded Employee login + zero storage tokens + HttpOnly cookie; seeded Owner MFA login with TOTP). | Tests pass for Employee and Owner MFA; however, **mobile viewport project was not configured in `playwright.config.ts`**, and `IndexedDB` and `document.cookie` assertions are missing. | **Wrong** | `tests/e2e/login-employee.e2e.spec.ts:1-79`, `tests/e2e/login-mfa-owner.e2e.spec.ts:1-87`, `playwright.config.ts:19-24` (only Desktop Chrome) |
| **AC-A13** | Cleanup echo scripts & CI hardening (remove `test:e2e` echo stubs, root `test:e2e: playwright test`, CI caches Mongo binaries, installs Playwright Chromium, fails on echo scripts). | `test:e2e` echo stubs removed; however, **CI workflow does NOT cache Mongo binaries, does NOT install Playwright browsers, and does NOT run `check:scripts`**. 9 packages still retain `test` and `typecheck` echo stubs. | **Wrong** | `.github/workflows/ci.yml:1-73` (missing cache, playwright install, check:scripts); packages retain `test: echo '...'` |

---

## 3. Approved Conditions Traceability Table (Conditions 1 to 12)

*Note: Per strict audit protocol, a flawed or vulnerable implementation is marked **Wrong**, not Verified.*

| # | Approved Condition | Evaluation | Status | Evidence (File & Line / Test) |
|---|---|---|:---:|---|
| **1** | Fixed seed IDs generated with ULID library, hardcoded, test validates 26 chars & Crockford Base32 (no I, L, O, U). | All 14 seed IDs match Crockford Base32 26-char pattern; tested. | **Verified** | `services/identity/src/infrastructure/seed.data.ts:24-125`, `services/identity/tests/unit/seed-id-format.spec.ts:1-52` |
| **2** | Tests use `mongodb-memory-server` and never read `.env`. Seed & dev refuse non-local `MONGODB_URI` without `ALLOW_REMOTE_SEED=true`. Prod fails fast on missing URI. Provide `.env.example`, validate env at startup, redact credentials in logs, name how `.env` is loaded (`dotenv`). | `.env.example` provided; URI validation and credential redaction implemented; `dotenv` named in `env.ts`. | **Verified** | `.env.example:1-18`, `services/identity/src/config/env.ts:20-54`, `packages/shared/src/mongo/client.ts:5-54`, `packages/shared/tests/logger.spec.ts:1-30` |
| **3** | Add `unplugin-swc` for `services/identity` so NestJS decorator metadata works in Vitest. | Configured with `legacyDecorator: true` and `decoratorMetadata: true`. | **Verified** | `services/identity/vitest.config.ts:1-14` |
| **4** | Resolve Secure-cookie contradiction: use `COOKIE_SECURE=true` in e2e or assert the flag only in unit test; say which. | **FLAWED IMPLEMENTATION**: In `test-server.mjs`, it hardcodes `cookieSecure: false` and the E2E tests omit asserting the `Secure` flag entirely (even though AC-A12 claimed it would be asserted). On logout in `nest-auth.controller.js:79:13`, Express emits a runtime deprecation warning (`Passing "options.maxAge" to clearCookie is deprecated`). Cookie path `/auth` is not isolated or asserted in E2E. | **Wrong** | `services/identity/test-server.mjs:32, 50`, `services/identity/src/config/cookie.config.ts:1-25`, `tests/e2e/login-employee.e2e.spec.ts:66-72` |
| **5** | Protect `/internal/*` with service credential (`x-service-key`: 401 without it, 403 for user tokens, not exposed through public gateway) and test it; test OAuth route with fake verifier enabled only in dev and test. | **FLAWED IMPLEMENTATION**: `ServiceKeyGuard` performs string equality using `!==` rather than constant-time `crypto.timingSafeEqual()`, introducing a timing attack vulnerability. It also has a hardcoded default test credential fallback (`'test-internal-service-key-at-least-32-chars-12345'`) if unconfigured. | **Wrong** | `services/identity/src/presentation/guards/service-key.guard.ts:17, 19`, `services/identity/tests/integration/service-key-guard.spec.ts:1-52` |
| **6** | Persist OTP and verify rate-limit counters in Mongo with a TTL index, or mark F01 rate-limit criterion Partial in report. | TTL indexes defined in `MongoOtpRepository` on `challenges` (`expiresAt`) and `rateLimits` (`resetAt`). | **Verified** | `services/identity/src/infrastructure/repositories/mongo-otp.repository.ts:32-35` |
| **7** | CI no-op check is a Node script reading only `package.json` scripts with unit test; all scripts work on Windows (`cross-env` or Node scripts). | `check-no-echo-scripts.mjs` and test exist; however, root `package.json` **hardcodes `cross-env TEMP=D:\temp TMP=D:\temp`**, breaking cross-platform portability. | **Wrong** | `scripts/check-no-echo-scripts.mjs:1-92`, `tests/check-no-echo-scripts.spec.ts:1-35`; Root `package.json:8` (`TEMP=D:\temp`) |
| **8** | Isolation tests for `aggregate`, `$lookup`, `countDocuments`, `distinct`, `findOneAndUpdate`, `replaceOne`, `insertMany` with mixed tenants, updates setting/unsetting `tenantId`. Filter override throws `TenantIsolationError`. Lint rule bans importing `mongodb` outside `packages/shared`. | Comprehensive Mongo isolation suite passes; ESLint rule blocks `mongodb` outside `packages/shared`. | **Verified** | `packages/shared/src/mongo/tenant-scoped-repository.ts:19-280`, `packages/shared/tests/tenant-scoped-repository.spec.ts:1-240`, `eslint.config.js:57-73` |
| **9** | Pick one CSRF header (`X-CSRF-Token`), Origin check, silent refresh on app load, `COOKIE_DOMAIN` config. | `CsrfOriginGuard` created, **but never wired to any route or controller**. If Origin/Referer are omitted, it returns `true`. `X-CSRF-Token` header is never inspected by the guard. | **Wrong** | `services/identity/src/presentation/guards/csrf-origin.guard.ts:25-53` (unwired, missing header check); `nest-auth.controller.ts:119-130` (unprotected) |
| **10** | Central collection registry used by classification test. Route-parity checks method and response status against OpenAPI. Say how E2E MFA test produces TOTP. `pnpm dev` starts Mongo, identity, and web-app together and seeds only empty dev database. | Registry verified; route parity verified; RFC 6238 TOTP helper verified; `scripts/dev.mjs` handles MongoDB auto-start, seed check, and service orchestration. | **Verified** | `packages/shared/src/mongo/collection-registry.ts:1-40`, `openapi-identity-routes.spec.ts:1-125`, `tests/e2e/totp-helper.ts:1-47`, `scripts/dev.mjs:1-123` |
| **11** | Encrypt TOTP secrets at rest through `KeyService` (AES-256-GCM). | Encrypts secrets in `seed.ts` and `mongo-person.repository.ts`; verified with unit tests. | **Verified** | `services/identity/src/application/key.service.ts:1-55`, `services/identity/tests/unit/key-service.spec.ts:1-45`, `seed.ts:67` |
| **12** | Pin exact dependency versions, confirm current, run `npm audit` and report advisories. Record repository partitioning in `decisions.md` as approved. | Versions pinned; partitioning logged in `decisions.md`. **Defect**: Report falsely dismissed vulnerabilities as transitive tooling only, ignoring direct dependency `next@14.2.0` (3 Critical, 18 High CVEs). | **Wrong** / **Misrepresented** | `apps/web-app/package.json:15` (`"next": "14.2.0"` contains GHSA-3g8h-86w9-wvmq, GHSA-v422-hmwv-36x6, GHSA-1193677); `docs/reports/Task-A-report.md:78-85` |

---

## 4. Script Checker Audit (`check:scripts`) & Invalid Step 1 Gate Claims

### Why `pnpm check:scripts` Passes While 9 Packages Have Echo Stubs
The user asked:
> "Why does pnpm check:scripts pass while 9 packages define test: echo and typecheck: echo? State whether the checker covers scripts other than test:e2e, and which Step 1 gate claims were therefore invalid."

Examining `scripts/check-no-echo-scripts.mjs` lines 49–76:
```javascript
for (const [scriptName, scriptCmd] of Object.entries(scripts)) {
  const trimmed = scriptCmd.trim().toLowerCase();
  // Banned echo/no-ops for test:e2e
  if (scriptName === 'test:e2e') {
    if (
      trimmed.startsWith('echo ') ||
      trimmed === 'exit 0' ||
      trimmed === ':' ||
      trimmed === 'true'
    ) {
      errors.push(`Package "${pkg.name || relPath}" contains a dummy/no-op "${scriptName}" script...`);
    }
  }

  // Any script that is an echo placeholder for a test
  if (scriptName.startsWith('test') && trimmed.startsWith('echo ')) {
    if (scriptName === 'test:e2e') {
      // already added
    } else if (trimmed.includes('test:e2e')) {
      errors.push(`Package "${pkg.name || relPath}" defines an echo placeholder in "${scriptName}": "${scriptCmd}"`);
    }
  }
}
```

#### Detailed Technical Findings
1. **The checker does NOT cover scripts other than `test:e2e`**:
   - In line 66, it checks `if (scriptName.startsWith('test') && trimmed.startsWith('echo '))`. But inside that block, line 70 has: `else if (trimmed.includes('test:e2e'))`.
   - If a package defines `"test": "echo 'test cards'"`, `trimmed` is `"echo 'test cards'"`. Because it does not contain the literal substring `'test:e2e'`, it is **silently ignored**!
   - If a package defines `"typecheck": "echo 'typecheck cards'"`, `scriptName` is `"typecheck"`. It does not match `scriptName.startsWith('test')`, so it is **completely ignored**!
   - Dummy scripts for `"lint"` and `"contracts:gen"` are likewise **never inspected**.
2. **Step 1 Gate Claims That Were Invalid**:
   - **Condition 1 Claim**: *"Root commands work, no echo stubs in package.json scripts (pnpm dev, pnpm lint, pnpm typecheck, pnpm test, pnpm test:e2e, pnpm contracts:gen)."*  
     -> **INVALID**: 9 packages (`apps/admin-console`, `apps/web-public`, `edge/shortlink`, `services/analytics`, `services/cards`, `services/media`, `services/notifications`, `services/organization`, `services/payments`) still define `"test": "echo ..."` and `"typecheck": "echo ..."`.
   - **F00 Acceptance Criterion AC-1 Claim**: *"Workspace layout per AGENTS.md §5, root commands work, no echo stubs."*  
     -> **INVALID**: Echo stubs were removed **only** for `test:e2e`. The checker was artificially constrained to pass despite extensive echo stubs across the monorepo.

---

## 5. ESLint Ignores Audit (`eslint.config.js`)

The user asked:
> "List every ignore in eslint.config.js and say whether source or tests are being skipped."

Examining `eslint.config.js` lines 8–19 and lines 57–58:
```javascript
ignores: [
  '**/dist/**',
  '**/node_modules/**',
  '**/.next/**',
  '**/.tmp/**',
  '**/storybook-static/**',
  'scripts/**',
  '**/*.mjs',
  'commitlint.config.js',
  'vitest.workspace.ts',
  'eslint.config.js',
]
```

### Complete Ignores Breakdown

| Ignore Pattern | Target / Purpose | Are Source or Tests Skipped? | Justification Assessment |
|---|---|:---:|---|
| `**/dist/**` | Build output directories | No | **Justified**. Compiled JS/DTS output should not be linted. |
| `**/node_modules/**` | Third-party vendor dependencies | No | **Justified**. Standard dependency ignore. |
| `**/.next/**` | Next.js build cache and output | No | **Justified**. Framework internal build artifacts. |
| `**/.tmp/**` | Temporary test/scratch storage | No | **Justified**. Ephemeral scratch space. |
| `**/storybook-static/**` | Storybook build output | No | **Justified**. Static documentation build output. |
| `scripts/**` | Monorepo helper and dev runner scripts | **Scripts Skipped** | **UNJUSTIFIED / EXCESSIVE**. Completely skips `scripts/dev.mjs`, `scripts/check-no-echo-scripts.mjs`. Script errors or security flaws bypass linting. |
| `**/*.mjs` | All ES module JavaScript files | **Scripts Skipped** | **UNJUSTIFIED**. Blanket ignore skipping root and service runner scripts, including `services/identity/test-server.mjs`. |
| `commitlint.config.js` | Commitlint configuration file | No | **Justified**. Tool configuration file. |
| `vitest.workspace.ts` | Vitest monorepo workspace config | **Config Skipped** | **UNJUSTIFIED**. TypeScript configuration files should be linted. |
| `eslint.config.js` | The ESLint config itself | No | **Justified**. Avoids self-referential parser issues. |
| `packages/shared/**` *(under `no-restricted-imports`)* | Permits `packages/shared` to import `mongodb` | No | **Justified**. `packages/shared` is the designated abstraction layer for MongoDB. |

### Source and Tests Coverage Status
- **Files Matched**: `{ files: ["**/*.ts", "**/*.tsx"] }` successfully matches all TypeScript source and test files (`.spec.ts`, `.spec.tsx`).
- **Safety Rule Neutering**: While files are parsed, lines 50–53 disable:
  - `@typescript-eslint/no-explicit-any: 'off'`
  - `@typescript-eslint/no-unused-vars: 'off'`
  - `@typescript-eslint/no-empty-object-type: 'off'`
  - `@typescript-eslint/no-unsafe-function-type: 'off'`  
  This severely weakens static analysis across all source and test files.

---

## 6. Code Edits to Existing Files & Assertion Weakening Analysis

The user asked:
> "For each edit to auth.service.ts, token.service.ts, AuthFlow.tsx, components.spec.tsx and auth-api.spec.ts, show the diff and say whether any assertion was weakened."

### 1. `services/identity/src/application/auth.service.ts`
```diff
@@ -6,9 +6,10 @@
 export interface AuthServiceConfig {
-  personRepo: InMemoryPersonRepository;
-  sessionRepo: InMemorySessionRepository;
-  otpRepo: InMemoryOtpRepository;
+  personRepo: any;
+  sessionRepo: any;
+  otpRepo: any;
   otpSender: FakeOtpSender;
   eventBus: FakeEventBus;
   jwtSecret: string;
+  oauthVerifier?: IOAuthVerifier;
 }
@@ -37,13 +38,47 @@
   constructor(config: AuthServiceConfig) {
     this.personRepo = config.personRepo;
     this.sessionRepo = config.sessionRepo;
     this.otpService = new OtpService(config.otpRepo, config.otpSender);
     this.tokenService = new TokenService(config.sessionRepo, config.jwtSecret);
     this.mfaService = new MfaService();
     this.eventBus = config.eventBus;
+    this.oauthVerifier = config.oauthVerifier;
   }
+
+  async loginWithOAuth(...) { ... }
```
- **Analysis**: Weakened TypeScript types to `any` instead of proper domain repository interfaces (`IPersonRepository`). Added OAuth login support and null-checks (`if (!person) throw`).
- **Was any assertion weakened?**: **No** (Not a test file; no test assertions modified).

---

### 2. `services/identity/src/application/token.service.ts`
```diff
@@ -82,3 +82,4 @@
   async rotateRefreshToken(
     oldRefreshToken: string,
-    ipAddress: string
+    deviceLabelOrIp: string = '127.0.0.1',
+    ipAddress: string = '127.0.0.1'
   ): Promise<{ accessToken: string; refreshToken: string }> {
+    const effectiveIp = ipAddress || deviceLabelOrIp || '127.0.0.1';
@@ -128,2 +129,18 @@
     return { accessToken, refreshToken: newRefreshToken };
   }
+
+  async revokeRefreshToken(refreshToken: string): Promise<void> {
+    try {
+      const decoded = this.verifyJwt(refreshToken);
+      if (decoded && decoded.familyId) {
+        await this.sessionRepo.revokeFamily(decoded.familyId);
+      }
+    } catch {
+      // Ignore invalid token on revoke
+    }
+  }
```
- **Analysis**: Added token family revocation method. In `revokeRefreshToken`, exceptions are swallowed silently with an empty `catch {}`. Added default IP fallback.
- **Was any assertion weakened?**: **No** (Not a test file; no test assertions modified).

---

### 3. `apps/web-app/src/features/auth/AuthFlow.tsx`
```diff
@@ -15,4 +15,5 @@
 export interface AuthFlowProps {
+  step?: AuthStep;
   initialStep?: AuthStep;
   labels: AuthFlowLabels;
@@ -27,7 +28,8 @@
 export const AuthFlow: React.FC<AuthFlowProps> = ({
+  step: controlledStep,
   initialStep = 'otp_entry',
   labels,
@@ -37,5 +39,7 @@
 }) => {
-  const [step, setStep] = useState<AuthStep>(initialStep);
+  const [internalStep, setInternalStep] = useState<AuthStep>(initialStep);
+  const step = controlledStep ?? internalStep;
+  const setStep = setInternalStep;
   const [phone, setPhone] = useState('');
@@ -48,4 +52,8 @@
   const handleSendOtp = (e: React.FormEvent) => {
     e.preventDefault();
     if (!consent) return;
-    if (onRequestOtp) onRequestOtp(phone, consent);
-    setStep('otp_verify');
+    if (onRequestOtp) {
+      onRequestOtp(phone, consent);
+    } else {
+      setInternalStep('otp_verify');
+    }
   };
```
- **Analysis**: Introduced controlled `step` prop support so parent Next.js pages can drive authentication transitions without component unmounting.
- **Was any assertion weakened?**: **No** (Existing tests in `AuthFlow.spec.tsx` still test uncontrolled behavior and all pass without changes).

---

### 4. `packages/ui-kit/tests/components.spec.tsx`
```diff
@@ -1,1 +1,2 @@
+// @vitest-environment jsdom
 import { describe, it, expect } from 'vitest';
```
- **Analysis**: Added explicit Vitest docblock environment directive ensuring jsdom is loaded for component tests.
- **Was any assertion weakened?**: **No**. All accessibility and snapshot assertions remain intact.

---

### 5. `services/identity/tests/integration/auth-api.spec.ts`
```diff
@@ -282,1 +282,1 @@
-      expect(aliceList.body.items.every(s => s.id !== bobSession.sessionId)).toBe(true);
+      expect(aliceList.body.items.every((s: any) => s.id !== bobSession.sessionId)).toBe(true);
```
- **Analysis**: Added `(s: any)` typecast to satisfy TypeScript compiler during workspace typecheck.
- **Was any assertion weakened?**: **No**. The predicate `s.id !== bobSession.sessionId` and expectation `.toBe(true)` remain completely unchanged.

---

## 7. E2E Execution Harness Audit: Real `main.ts` vs `test-server.mjs`

The user asked:
> "Does the e2e run the real IdentityModule from main.ts, or test-server.mjs? Show how."

### Finding: E2E Runs `test-server.mjs`, NOT `main.ts`

#### 1. How Playwright Starts the Identity Server
In `playwright.config.ts` lines 25–32:
```typescript
webServer: [
  {
    command: 'node test-server.mjs',
    cwd: './services/identity',
    port: 4001,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
  ...
]
```
Playwright launches `services/identity/test-server.mjs` directly, **completely bypassing `services/identity/src/main.ts`**.

#### 2. What `test-server.mjs` Actually Does
In `services/identity/test-server.mjs`:
```javascript
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { GlobalExceptionFilter } from '@onebridge/shared';
import { IdentityModule } from './dist/identity.module.js';
import { seedDevDatabase } from './dist/infrastructure/seed.js';

async function start() {
  const mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri();

  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db('test_identity_e2e');

  await seedDevDatabase(db);

  const config = {
    nodeEnv: 'test',
    port: 4001,
    appUrl: 'http://localhost:3000',
    mongoUri,
    allowRemoteSeed: false,
    jwtSecret: 'test-jwt-secret-key-at-least-32-chars-long-12345',
    internalServiceKey: 'test-internal-service-key-at-least-32-chars-12345',
    encryptionKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    cookieSecure: false,
    enableFakeOtp: true,
    enableFakeOauth: true,
  };

  const app = await NestFactory.create(IdentityModule.register({ envConfig: config, db }));
  app.use(cookieParser());
  app.enableCors({...});
  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.listen(4001);
}
```

#### 3. Critical Architectural Implications
1. **Bypasses Compiled Production Bootstrap**: `main.ts` defines `bootstrap()` which invokes `loadAndValidateEnv()` and connects to MongoDB via `connectMongo()`. This production code **never runs in E2E tests**.
2. **Ephemeral In-Memory DB Instead of Dev Environment**: E2E does not test against the dev database seeded by `pnpm seed` or `scripts/dev.mjs`; it runs on an ephemeral instance that is destroyed on teardown.
3. **Hardcoded Mock Configuration**: `test-server.mjs` bypasses environment validation and manually injects a mock configuration object.

---

## 8. Build Output in `src/` & `.gitignore` Audit

The user asked:
> "Is there build output (.js, .d.ts, .map) in any src folder, and is it gitignored?"

### 1. Build Output Presence
Executing:
```powershell
Get-ChildItem -Path . -Recurse -File | Where-Object { 
  $_.FullName -notmatch 'node_modules|\.git|dist|\.next' -and 
  $_.FullName -match '[\\/]src[\\/]' -and 
  ($_.Extension -eq '.js' -or $_.Extension -eq '.d.ts' -or $_.Extension -eq '.map') 
}
```
**Result**: **Zero files returned.** There is currently no `.js`, `.d.ts`, or `.map` build output present inside any `src` folder.

### 2. Is It Gitignored?
**NO.**
Examining `.gitignore`:
```
node_modules
dist
.next
.tmp
test-results
playwright-report
storybook-static
.env
```
- `.gitignore` only ignores the `dist` directory.
- There are **no rules ignoring `.js`, `.d.ts`, or `.map` files within `src`** (e.g., `src/**/*.js`, `*.d.ts`).
- If TypeScript compiles in-place or without `outDir: dist`, build artifacts will be treated as untracked source files and risk accidental commit.

---

## 9. Git Remote & GitHub CLI Audit

The user asked:
> "Report git remote -v and gh run list results."

### 1. `git remote -v`
```
origin  https://github.com/sandeep-bodapudi/business-ledger.git (fetch)
origin  https://github.com/sandeep-bodapudi/business-ledger.git (push)
```

### 2. `gh run list`
```
gh : The term 'gh' is not recognized as the name of a cmdlet, function, script file, or operable program. Check the 
spelling of the name, or if a path was included, verify that the path is correct and try again.
At line:1 char:1
+ gh run list
+ ~~
    + CategoryInfo          : ObjectNotFound: (gh:String) [], CommandNotFoundException
    + FullyQualifiedErrorId : CommandNotFoundException
```

### 3. Divergence & CI Status
Running `git status -uno`:
```
On branch main
Your branch and 'origin/main' have diverged,
and have 1 and 13 different commits each, respectively.
```
- Local Task A implementation has **not been pushed to `origin/main`**.
- GitHub CLI is not installed on the workstation.
- **No green CI run exists** for Task A.

---

## 10. Complete Audit of Critical & High Advisories

The user asked:
> "List all critical and high audit advisories, with package, fixed version, and whether each is in production dependencies."

Across the workspace, `pnpm audit` identifies **30 unique High and Critical advisories** (21 in production runtime dependencies, 9 in development dependencies):

| # | Package / Module | Severity | Advisory Title | Patched Version | In Production Dependencies? |
|---|---|:---:|---|---|:---:|
| 1 | `next` | **Critical** | Next.js: Unauthenticated Remote Code Execution on windows-hosted servers | `>=15.5.24` | **YES** (`apps/web-app`) |
| 2 | `next` | **Critical** | Next.js: Unauthenticated Remote Code Execution in Image Optimization API when AVIF files used | `>=15.5.24` | **YES** (`apps/web-app`) |
| 3 | `next` | **Critical** | Authorization Bypass in Next.js Middleware | `>=14.2.35` | **YES** (`apps/web-app`) |
| 4 | `next` | **High** | Next.js authorization bypass vulnerability | `>=14.2.35` | **YES** (`apps/web-app`) |
| 5 | `next` | **High** | Next Vulnerable to Denial of Service with Server Components | `>=14.2.35` | **YES** (`apps/web-app`) |
| 6 | `next` | **High** | Next has a Denial of Service with Server Components - Incomplete Fix Follow-Up | `>=14.2.35` | **YES** (`apps/web-app`) |
| 7 | `next` | **High** | Next.js HTTP request deserialization can lead to DoS when using insecure Server Components | `>=15.0.8` | **YES** (`apps/web-app`) |
| 8 | `next` | **High** | Next.js has a Denial of Service with Server Components | `>=15.5.15` | **YES** (`apps/web-app`) |
| 9 | `next` | **High** | Next.js Vulnerable to Denial of Service with Server Components | `>=15.5.16` | **YES** (`apps/web-app`) |
| 10 | `next` | **High** | Next.js vulnerable to SSRF in applications using WebSocket upgrades | `>=15.5.16` | **YES** (`apps/web-app`) |
| 11 | `next` | **High** | Next.js has a Middleware / Proxy bypass in Pages Router applications using i18n | `>=15.5.16` | **YES** (`apps/web-app`) |
| 12 | `next` | **High** | Next.js: Denial of Service in App Router using Server Actions | `>=15.5.21` | **YES** (`apps/web-app`) |
| 13 | `next` | **High** | Next.js: Server-Side Request Forgery in Server Actions on custom servers | `>=15.5.21` | **YES** (`apps/web-app`) |
| 14 | `next` | **High** | Next.js: Server-Side Request Forgery in rewrites via attacker-controlled destination hostname | `>=15.5.21` | **YES** (`apps/web-app`) |
| 15 | `path-to-regexp` | **High** | path-to-regexp contains a ReDoS | `>=0.1.12` | **YES** (transitive via `@nestjs/platform-express > express`) |
| 16 | `path-to-regexp` | **High** | path-to-regexp vulnerable to Regular Expression Denial of Service via multiple route parameters | `>=0.1.13` | **YES** (transitive via `@nestjs/platform-express > express`) |
| 17 | `multer` | **High** | Multer vulnerable to Denial of Service from maliciously crafted requests | `>=2.0.0` | **YES** (transitive via `@nestjs/platform-express`) |
| 18 | `multer` | **High** | Multer vulnerable to Denial of Service via unhandled exception | `>=2.0.1` | **YES** (transitive via `@nestjs/platform-express`) |
| 19 | `multer` | **High** | Multer vulnerable to Denial of Service via unhandled exception from malformed request | `>=2.0.2` | **YES** (transitive via `@nestjs/platform-express`) |
| 20 | `postcss` | **High** | PostCSS: Arbitrary file read & info disclosure via attacker-controlled sourceMappingURL | `>=8.5.12` | **YES** (transitive via `apps/web-app > next > postcss`) |
| 21 | `postcss` | **High** | PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) | `>=8.5.18` | **YES** (transitive via `apps/web-app > next > postcss`) |
| 22 | `playwright` | **High** | Playwright downloads and installs browsers without verifying SSL certificate authenticity | `>=1.55.1` | **NO** (devDependencies) |
| 23 | `undici` | **High** | Undici has Unbounded Memory Consumption in WebSocket permessage-deflate Decompression | `>=6.24.0` | **NO** (transitive via `openapi-typescript`) |
| 24 | `undici` | **High** | Undici has Unhandled Exception in WebSocket Client Due to Invalid server_max_window_bits | `>=6.24.0` | **NO** (transitive via `openapi-typescript`) |
| 25 | `undici` | **High** | undici WebSocket client vulnerable to DoS via fragment count bypass | `>=6.27.0` | **NO** (transitive via `openapi-typescript`) |
| 26 | `vite` | **High** | vite: `server.fs.deny` bypass on Windows alternate paths | `>=6.4.3` | **NO** (Storybook devDependencies) |
| 27 | `@fastify/busboy` | **High** | @fastify/busboy vulnerable to DoS via prototype-named multipart part header | `>=3.2.1` | **NO** (Storybook devDependencies) |
| 28 | `braces` | **High** | braces vulnerable to stack-exhaustion DoS through deeply nested patterns | *(None)* | **NO** (transitive build tooling) |
| 29 | `handlebars` | **Critical** | Handlebars: JavaScript Injection via AST Type Confusion in compile | `>=4.7.10` | **NO** (Storybook devDependencies) |
| 30 | `handlebars` | **Critical** | Handlebars: JavaScript Injection via Own Property Check Bypass | `>=4.7.10` | **NO** (Storybook devDependencies) |

---

## 11. Security Checks Audit

1. **Origin Check Mandatory on Refresh**:
   - **FAILED**. `CsrfOriginGuard` was created, but **is not attached to any route or controller in the entire identity service**.
   - Even within `CsrfOriginGuard.canActivate()`, if `Origin` and `Referer` headers are omitted (`requestOrigin === undefined`), it returns `true` (line 52). Thus, even if wired, it does not enforce mandatory Origin headers on state-changing requests.
   - It completely fails to check `X-CSRF-Token`.
2. **Constant-Time Service Key Comparison**:
   - **FAILED**. In `services/identity/src/presentation/guards/service-key.guard.ts` line 19:
     ```typescript
     if (!serviceKey || serviceKey !== effectiveKey)
     ```
     Uses standard string comparison `!==` instead of `crypto.timingSafeEqual()`, introducing a timing attack vulnerability.
   - Line 17 falls back to `'test-internal-service-key-at-least-32-chars-12345'` if `INTERNAL_SERVICE_KEY` is not provided.
3. **Production Refusal for Dev Encryption Key & Seeded TOTP Secret**:
   - **FAILED**. In `services/identity/src/config/env.ts` line 76:
     ```typescript
     const encryptionKey = env.ENCRYPTION_KEY || 'default-dev-encryption-key-onebridge-32-bytes!';
     ```
     In production (`isProduction === true`), if `ENCRYPTION_KEY` is missing, it **silently falls back to the hardcoded dev encryption key** without throwing. It also does not reject known sample keys.
4. **Idempotency Store**:
   - **FAILED**. In `NestInternalController.createMembership` line 33, `@Headers('idempotency-key') idempotencyKey?: string` is accepted as a parameter but **never checked or stored**.
   - In `NestAuthController.requestOtp`, `idempotencyKey` is not accepted or handled.
5. **E2E Cookie Assertions**:
   - `httpOnly: true` and `sameSite: 'Lax'` are verified on `refreshToken`.
   - `secure: true` is not asserted in E2E because tests execute over plain HTTP (`localhost:3000`), which is documented as resolved by Condition 4.

---

## 12. Verification Commands Output

### 1. `pnpm lint`
```
$ eslint .
(node:47956) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///D:/Onebridge%20projects/Onebridge%20grid/eslint.config.js?mtime=1791729397930 is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to D:\Onebridge projects\Onebridge grid\package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
[boundaries][warning]: Rule name "boundaries/element-types" is deprecated. Use "boundaries/dependencies" instead.
  More info: https://www.jsboundaries.dev/docs/releases/migration-guides/v5-to-v6/#rule-element-types-renamed-to-dependencies

[boundaries][warning]: [boundaries/element-types] The 'rules' option is deprecated.
  Please use 'policies' instead. More info: https://www.jsboundaries.dev/docs/releases/migration-guides/v6-to-v7/#rules-option-renamed-to-policies

[boundaries][warning]: [boundaries/element-types] Detected legacy string element selectors in 1 policy at indices: 0.
  Replace "your-type" with an entity selector, e.g. { element: { type: "your-type" } }. More info: https://www.jsboundaries.dev/docs/releases/migration-guides/v5-to-v6/#object-based-elements-selector-syntax

[boundaries][warning]: [boundaries/element-types] Detected "allow"/"disallow" entries without a "from"/"to" wrapper in 1 policy at indices: 0.
  Use allow: [{ to: { element: { type: "your-type" } } }] or [{ from: ... }] instead of a bare element selector. More info: https://www.jsboundaries.dev/docs/releases/migration-guides/v5-to-v6/#to-property-in-allowdisallow-rules-is-now-required
```
*(Exit code: 0)*

### 2. `pnpm typecheck`
```
$ pnpm -r run typecheck
Scope: 14 of 15 workspace projects
apps/web-public typecheck$ echo 'typecheck web-public'
apps/admin-console typecheck$ echo 'typecheck admin-console'
packages/shared typecheck$ tsc --noEmit
edge/shortlink typecheck$ echo 'typecheck shortlink'
edge/shortlink typecheck: 'typecheck shortlink'
edge/shortlink typecheck: Done
packages/ui-kit typecheck$ tsc --noEmit
apps/web-public typecheck: 'typecheck web-public'
apps/web-public typecheck: Done
services/analytics typecheck$ echo 'typecheck analytics'
apps/admin-console typecheck: 'typecheck admin-console'
apps/admin-console typecheck: Done
services/cards typecheck$ echo 'typecheck cards'
services/analytics typecheck: 'typecheck analytics'
services/analytics typecheck: Done
services/media typecheck$ echo 'typecheck media'
services/cards typecheck: 'typecheck cards'
services/cards typecheck: Done
services/notifications typecheck$ echo 'typecheck notifications'
services/media typecheck: 'typecheck media'
services/media typecheck: Done
services/organization typecheck$ echo 'typecheck organization'
services/notifications typecheck: 'typecheck notifications'
services/notifications typecheck: Done
services/payments typecheck$ echo 'typecheck payments'
services/organization typecheck: 'typecheck organization'
services/organization typecheck: Done
services/payments typecheck: 'typecheck payments'
services/payments typecheck: Done
packages/shared typecheck: Done
services/identity typecheck$ tsc --noEmit
packages/ui-kit typecheck: Done
apps/web-app typecheck$ tsc --noEmit
services/identity typecheck: Done
apps/web-app typecheck: Done
```
*(Exit code: 0)*

### 3. `pnpm test`
```
$ cross-env TEMP=D:\temp TMP=D:\temp pnpm -r run test && cross-env TEMP=D:\temp TMP=D:\temp vitest run tests/check-no-echo-scripts.spec.ts tests/workspace.spec.ts
Scope: 14 of 15 workspace projects
apps/admin-console test$ echo 'test admin-console'
apps/web-public test$ echo 'test web-public'
edge/shortlink test$ echo 'test shortlink'
packages/shared test$ vitest run
apps/admin-console test: 'test admin-console'
apps/admin-console test: Done
packages/ui-kit test$ vitest run
apps/web-public test: 'test web-public'
apps/web-public test: Done
services/analytics test$ echo 'test analytics'
edge/shortlink test: 'test shortlink'
edge/shortlink test: Done
services/cards test$ echo 'test cards'
services/analytics test: 'test analytics'
services/analytics test: Done
services/media test$ echo 'test media'
services/cards test: 'test cards'
services/cards test: Done
services/notifications test$ echo 'test notifications'
services/media test: 'test media'
services/media test: Done
services/organization test$ echo 'test organization'
services/notifications test: 'test notifications'
services/notifications test: Done
services/payments test$ echo 'test payments'
services/organization test: 'test organization'
services/organization test: Done
services/payments test: 'test payments'
services/payments test: Done
packages/shared test: 
packages/shared test:  RUN  v5.0.3 D:/Onebridge projects/Onebridge grid/packages/shared
packages/shared test: 
packages/ui-kit test: 
packages/ui-kit test:  RUN  v5.0.3 D:/Onebridge projects/Onebridge grid/packages/ui-kit
packages/ui-kit test: 
packages/shared test:  ✓ tests/tenant-isolation.spec.ts (2 tests) 13ms
packages/shared test:  ✓ tests/global-exception.filter.spec.ts (1 test) 16ms
packages/shared test:  ✓ tests/idempotency.interceptor.spec.ts (1 test) 12ms
packages/shared test:  ✓ tests/fake-adapters.spec.ts (3 tests) 16ms
packages/shared test:  ✓ tests/correlation-id.middleware.spec.ts (1 test) 8ms
packages/shared test:  ✓ tests/logger.spec.ts (1 test) 16ms
packages/shared test:  ✓ tests/collection-classification.spec.ts (5 tests) 17ms
packages/ui-kit test:  ✓ tests/contrast.spec.ts (2 tests) 14ms
packages/shared test:  ✓ tests/tenant-scoped-repository.spec.ts (9 tests) 2772ms
packages/shared test: 
packages/shared test:  Test Files  8 passed (8)
packages/shared test:       Tests  23 passed (23)
packages/shared test:    Start at  20:23:25
packages/shared test:    Duration  5.34s (import 44%, tests 43%, transform 11%, worker 2%)
packages/shared test: 
packages/shared test: Done
services/identity test$ vitest run
services/identity test: `esbuild` option is set to false, but `oxc` option was not set to false. `esbuild: false` does not have effect any more. If you want to disable the default transformation, which is now handled by Oxc, please set `oxc: false` instead.
services/identity test: 
services/identity test:  RUN  v5.0.3 D:/Onebridge projects/Onebridge grid/services/identity
services/identity test: 
packages/ui-kit test:  ✓ tests/components.spec.tsx (5 tests) 690ms
packages/ui-kit test:    ✓ UI Kit Components (5)
packages/ui-kit test:      ✓ ActionButton should not have basic accessibility violations and matches snapshot 457ms
packages/ui-kit test: 
packages/ui-kit test:  Test Files  2 passed (2)
packages/ui-kit test:       Tests  7 passed (7)
packages/ui-kit test:    Start at  20:23:26
packages/ui-kit test:    Duration  7.41s (environment 67%, import 22%, tests 7%, transform 2%, worker 1%)
packages/ui-kit test: 
packages/ui-kit test: Done
apps/web-app test$ vitest run
services/identity test:  ✓ tests/unit/mfa.spec.ts (8 tests) 27ms
services/identity test:  ✓ tests/unit/tokens.spec.ts (4 tests) 32ms
services/identity test:  ✓ tests/unit/seed-id-format.spec.ts (3 tests) 14ms
services/identity test:  ✓ tests/unit/key-service.spec.ts (3 tests) 21ms
services/identity test:  ✓ tests/unit/cookie-config.spec.ts (4 tests) 11ms
services/identity test:  ✓ tests/integration/service-key-guard.spec.ts (4 tests) 14ms
services/identity test:  ✓ tests/unit/rbac.spec.ts (9 tests) 24ms
services/identity test: stdout | tests/integration/auth-api.spec.ts > Auth API Integration (AC-1 through AC-9 & Complete Controller Endpoints) > End-to-end Login Flow & Events > should complete OTP login, emit user.registered event for new users, and return tokens
services/identity test: {"timestamp":"2026-10-11T14:53:35.779Z","level":"info","message":"User registered via OTP","correlationId":"corr-1"}
services/identity test: 
services/identity test:  ✓ tests/unit/oauth.spec.ts (5 tests) 29ms
services/identity test:  ✓ tests/integration/oauth-route-fake-verifier.spec.ts (2 tests) 18ms
services/identity test:  ✓ tests/unit/otp.spec.ts (12 tests) 37ms
services/identity test:  ✓ tests/unit/fake-otp-guard.spec.ts (6 tests) 28ms
services/identity test:  ✓ tests/integration/auth-api.spec.ts (9 tests) 59ms
services/identity test:  ✓ tests/integration/tenancy-isolation.spec.ts (3 tests) 26ms
services/identity test:  ✓ tests/integration/me-api.spec.ts (11 tests) 41ms
services/identity test:  ✓ tests/integration/openapi-identity-routes.spec.ts (2 tests) 13ms
services/identity test: 
services/identity test:  Test Files  15 passed (15)
services/identity test:       Tests  85 passed (85)
services/identity test:    Start at  20:23:32
services/identity test:    Duration  3.79s (import 61%, transform 32%, worker 5%, tests 2%)
services/identity test: 
services/identity test:   Transform  transforming modules took 7.79s · 32% of tracked time, re-done on every run
services/identity test:              persist transforms across runs with fsModuleCache: true
services/identity test:              learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns
services/identity test: 
apps/web-app test: `esbuild` option is set to false, but `oxc` option was not set to false. `esbuild: false` does not have effect any more. If you want to disable the default transformation, which is now handled by Oxc, please set `oxc: false` instead.
services/identity test: Done
apps/web-app test: 
apps/web-app test:  RUN  v5.0.3 D:/Onebridge projects/Onebridge grid/apps/web-app
apps/web-app test: 
apps/web-app test:  ✓ src/features/auth/AuthFlow.spec.tsx (9 tests) 69ms
apps/web-app test:  ✓ src/features/rbac/rbac-ui.spec.tsx (8 tests) 145ms
apps/web-app test: 
apps/web-app test:  Test Files  2 passed (2)
apps/web-app test:       Tests  17 passed (17)
apps/web-app test:    Start at  20:23:36
apps/web-app test:    Duration  3.12s (environment 64%, import 27%, tests 4%, transform 4%, worker 1%)
apps/web-app test: 
apps/web-app test: Done

 RUN  v5.0.3 D:/Onebridge projects/Onebridge grid

 ✓ tests/workspace.spec.ts (3 tests) 7ms
 ✓ tests/check-no-echo-scripts.spec.ts (1 test) 22ms

 Test Files  2 passed (2)
      Tests  4 passed (4)
   Start at  20:23:40
   Duration  299ms (transform 43%, import 27%, tests 20%, worker 9%)
```
*(Exit code: 0)*

### 4. `pnpm test:e2e`
```
$ playwright test
[WebServer] $ next dev -p 3000

Running 2 tests using 1 worker

[WebServer] Sun, 11 Oct 2026 14:54:07 GMT express deprecated res.clearCookie: Passing "options.maxAge" is deprecated. In v5.0.0 of Express, this option will be ignored, as res.clearCookie will automatically set cookies to expire immediately. Please update your code to omit this option. at file:\D:\Onebridge%20projects\Onebridge%20grid\services\identity\dist\presentation\nest-auth.controller.js:79:13
  ok 1 [chromium] › login-employee.e2e.spec.ts:4:7 › E2E Login Flow - Seeded Employee › logs in seeded employee, enforces HttpOnly SameSite=Lax cookie, zero tokens in storage, and accesses dashboard (6.9s)
  ok 2 [chromium] › login-mfa-owner.e2e.spec.ts:5:7 › E2E Login Flow - Seeded Owner with MFA (AC-8, AC-9) › logs in seeded Owner with mandatory MFA using RFC 6238 TOTP helper (1.5s)

  2 passed (14.0s)
```
*(Exit code: 0)*

---

## 13. Verdict & Numbered List of Required Fixes

### Verdict: **REJECT**

Task A cannot be accepted in its current state. Critical test suites promised in the approved plan were omitted, security guards are disconnected or vulnerable to timing attacks, direct dependencies carry Critical remote code execution vulnerabilities, and scripts contain machine-specific Windows paths.

### Numbered List of Required Fixes

1. **Add the 6 Missing Test Suites**:
   - `services/identity/tests/integration/nest-http-auth.spec.ts`: Build a real HTTP-level test harness using `supertest` with `INestApplication` verifying correlation ID header generation, RFC 7807 problem+json response format, and idempotency replay/mismatch.
   - `services/identity/tests/unit/production-wiring-guard.spec.ts`: Prove that `IdentityModule` rejects in-memory repositories when `NODE_ENV=production`.
   - `services/identity/tests/integration/repository-contract.suite.ts`: Run a shared contract test suite against both in-memory and Mongo repository implementations.
   - `services/identity/tests/integration/indexes.spec.ts`: Assert unique indexes and TTL indexes against real MongoDB.
   - `services/identity/tests/integration/seed.spec.ts`: Assert `seedDevDatabase` idempotency on repeat runs and production refusal when `NODE_ENV=production` or with non-local URIs.
   - `services/identity/tests/integration/mongo-repositories.spec.ts`: Test all 4 real Mongo repository implementations (`MongoPersonRepository`, `MongoSessionRepository`, `MongoOtpRepository`, `MongoMembershipRepository`) against real MongoDB.
2. **Wire & Harden `CsrfOriginGuard`**:
   - Register `CsrfOriginGuard` globally or on all state-modifying endpoints (particularly `POST /auth/refresh`).
   - Make `Origin` mandatory on state-changing requests (reject if `Origin` and `Referer` are missing).
   - Validate the `X-CSRF-Token` header.
3. **Fix Timing Attack in `ServiceKeyGuard`**:
   - Replace standard `!==` string comparison in `service-key.guard.ts` with `crypto.timingSafeEqual()`.
   - Remove the hardcoded test key fallback in `service-key.guard.ts:17` and fail fast if unconfigured.
4. **Fix Production Encryption Key Refusal**:
   - In `services/identity/src/config/env.ts`, require `ENCRYPTION_KEY` in production (`isProduction === true`) and explicitly refuse known sample keys or the dev default key.
5. **Implement Idempotency in NestJS Controllers**:
   - Wire `IdempotencyInterceptor` / `cacheStore` to `NestAuthController.requestOtp` and `NestInternalController.createMembership` to properly cache responses on replay and return `422` on body mismatch.
6. **Configure Playwright Mobile Viewport**:
   - Add a mobile viewport project (e.g., `{ name: 'Mobile Chrome', use: { ...devices['Pixel 7'] } }`) in `playwright.config.ts`.
   - Add IndexedDB and `document.cookie` assertions in `login-employee.e2e.spec.ts`.
7. **Fix GitHub Actions CI Workflow**:
   - Add `npx playwright install --with-deps chromium` before running E2E tests in `ci.yml`.
   - Add `actions/cache` step for `~/.cache/mongodb-binaries` pinned to `7.0.14`.
   - Add `pnpm run check:scripts` step in CI.
8. **Remove Machine-Specific Path from `package.json`**:
   - Remove `TEMP=D:\temp TMP=D:\temp` from root `package.json:8`. Use cross-platform relative scratch paths (`.tmp`) or let the OS manage temp directories.
   - Add root `"seed": "tsx services/identity/src/infrastructure/seed.ts"` script.
   - Delete orphaned script `scripts/test-identity-server.mjs`.
9. **Upgrade Vulnerable `next` Dependency**:
   - Upgrade `next` in `apps/web-app/package.json` to `>=14.2.35` (or latest patched Next.js 14 release) to remediate the 3 Critical RCE and authorization bypass vulnerabilities.
10. **Encapsulate MongoDB Collections in `@onebridge/shared`**:
    - Remove raw re-exports of `Db` and `MongoClient` from `packages/shared/src/mongo/client.ts` to prevent bypass of `TenantScopedRepository`.
11. **Expand `check:scripts` Checker to Cover All Scripts**:
    - Update `scripts/check-no-echo-scripts.mjs` to detect dummy echo and no-op placeholders in `test`, `typecheck`, `lint`, and `contracts:gen` across all workspace packages, not merely `test:e2e`.
12. **Update `.gitignore` to Explicitly Ignore Build Output in `src/`**:
    - Add ignore rules for `.js`, `.d.ts`, and `.map` files generated within any `src/` directory.
