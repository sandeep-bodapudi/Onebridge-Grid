# Step 1 Exit Gate Review (Reopened)

**Step:** Step 1 — Foundation  
**Features Included:** F00 Platform, F05 UI Kit, F01 Auth, F02 Tenancy and Roles  
**Date:** 2026-10-11  
**Status:** **REOPENED / NOT MET (Gate Blocked)**  

---

## 1. Package `test:e2e` Scripts Audit & Playwright Login Verification

Below is the exact `test:e2e` script defined in every package across the workspace:

| Package | Location | Exact `test:e2e` Script in `package.json` | Script Type |
|---|---|---|:---:|
| `onebridge-grid` (Root) | `/package.json` | `"pnpm -r run test:e2e"` | Workspace runner |
| `@onebridge/admin-console` | `apps/admin-console/package.json` | `"echo 'test:e2e admin-console'"` | **Echo stub / No-op** |
| `@onebridge/web-app` | `apps/web-app/package.json` | `"echo 'test:e2e web-app'"` | **Echo stub / No-op** |
| `@onebridge/web-public` | `apps/web-public/package.json` | `"echo 'test:e2e web-public'"` | **Echo stub / No-op** |
| `@onebridge/shortlink` | `edge/shortlink/package.json` | `"echo 'test:e2e shortlink'"` | **Echo stub / No-op** |
| `@onebridge/api-contracts` | `packages/api-contracts/package.json` | *(missing script)* | **No script defined** |
| `@onebridge/shared` | `packages/shared/package.json` | `"echo 'test:e2e shared'"` | **Echo stub / No-op** |
| `@onebridge/ui-kit` | `packages/ui-kit/package.json` | *(missing script)* | **No script defined** |
| `@onebridge/analytics` | `services/analytics/package.json` | `"echo 'test:e2e analytics'"` | **Echo stub / No-op** |
| `@onebridge/cards` | `services/cards/package.json` | `"echo 'test:e2e cards'"` | **Echo stub / No-op** |
| `@onebridge/identity` | `services/identity/package.json` | `"echo 'test:e2e identity'"` | **Echo stub / No-op** |
| `@onebridge/media` | `services/media/package.json` | `"echo 'test:e2e media'"` | **Echo stub / No-op** |
| `@onebridge/notifications` | `services/notifications/package.json` | `"echo 'test:e2e notifications'"` | **Echo stub / No-op** |
| `@onebridge/organization` | `services/organization/package.json` | `"echo 'test:e2e organization'"` | **Echo stub / No-op** |
| `@onebridge/payments` | `services/payments/package.json` | `"echo 'test:e2e payments'"` | **Echo stub / No-op** |

### Playwright Login Coverage Evaluation:
- **Status:** **NOT MET**
- **Evidence:** There are zero Playwright configuration files (`playwright.config.ts`), zero Playwright dependencies installed, and zero Playwright browser test files. The root `tests/e2e/dev-env.e2e-spec.ts` is an empty Vitest placeholder (`expect(true).toBe(true)`). End-to-end browser login is **Not met**.

### Package `typecheck` and `test` Scripts Audit (Corrected Claim):
- **Status:** **NOT MET (Invalid Prior Claims)**
- **Defect Discovered:** Nine workspace packages used `echo` stubs for both `typecheck` and `test` scripts:
  1. `apps/admin-console` (`"test": "echo 'test admin-console'"` / `"typecheck": "echo 'typecheck admin-console'"`)
  2. `apps/web-app` (`"test": "echo 'test web-app'"` / `"typecheck": "echo 'typecheck web-app'"`)
  3. `apps/web-public` (`"test": "echo 'test web-public'"` / `"typecheck": "echo 'typecheck web-public'"`)
  4. `edge/shortlink` (`"test": "echo 'test shortlink'"` / `"typecheck": "echo 'typecheck shortlink'"`)
  5. `services/analytics` (`"test": "echo 'test analytics'"` / `"typecheck": "echo 'typecheck analytics'"`)
  6. `services/cards` (`"test": "echo 'test cards'"` / `"typecheck": "echo 'typecheck cards'"`)
  7. `services/media` (`"test": "echo 'test media'"` / `"typecheck": "echo 'typecheck media'"`)
  8. `services/notifications` (`"test": "echo 'test notifications'"` / `"typecheck": "echo 'typecheck notifications'"`)
  9. `services/organization` (`"test": "echo 'test organization'"` / `"typecheck": "echo 'typecheck organization'"`)
- **`check:scripts` Tooling Defect:** The repository validator script `scripts/check-no-echo-scripts.mjs` only checked `test:e2e` scripts. Because it ignored `test`, `typecheck`, `lint`, and `build`, all nine packages passed `pnpm check:scripts` unnoticed, creating a false impression of full workspace validation. All prior claims that the workspace passed typecheck and test were therefore invalid and are hereby corrected to **NOT MET**.

---

## 2. Dev Environment & Seeded Demo Tenants Verification

Per Step 1 Exit Gate:
> `pnpm dev starts everything with fake providers and seeded demo data (two tenants, each with owner, admin, employee)`

### Audit:
- Running `pnpm dev` executes `"pnpm -r run dev"`.
- Across the packages, `dev` is defined as:
  - `apps/web-app`: `"echo 'dev web-app'"`
  - `apps/web-public`: `"echo 'dev web-public'"`
  - `apps/admin-console`: `"echo 'dev admin-console'"`
  - `services/identity`: `"echo 'dev identity'"`
  - `packages/ui-kit`: `"storybook dev -p 6006"` (only Storybook dev server runs)
- There is no running HTTP backend service, no seeding script, and no database or in-memory seed that instantiates two demo tenants with owner, admin, and employee users each.
- `tests/e2e/dev-env.e2e-spec.ts` confirms this gap with a comment: `// Verified placeholder for dev-env logic until database implementation`.
- **Status:** **NOT MET**

---

## 3. GitHub Actions CI Workflows Audit

### Workflow Files Present:
1. **`.github/workflows/ci.yml`**:
   - **Triggers:** Push to `main`, Pull Request to `main`.
   - **Job `validate`:** Installs pnpm 8, Node 20, runs `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`, `pnpm run test:e2e`.
   - **Job `security`:** Runs `gitleaks/gitleaks-action@v2`.
   - **Job `build`:** Runs `pnpm -r run build` (builds Storybook and api-contracts tsc) and `echo "Simulating preview deploy"`.
2. **`.github/workflows/release-please.yml`**:
   - **Triggers:** Push to `main`.
   - **Job `release-please`:** Runs `googleapis/release-please-action@v4` with `release-type: node`.
3. **`.github/dependabot.yml`**: Configures daily npm dependency version checks.

### CI Status Evaluation:
- **Status:** **NOT MET**
- **Evidence:** While `.github/workflows/ci.yml` is syntactically configured, the pipeline has never executed on a GitHub remote (local workspace only). Moreover, the `test:e2e` step inside CI runs no-op echo statements rather than validating real user flows, and `pnpm -r run build` runs into missing build scripts across unbuilt services.

---

## 4. Explanation of the 14-of-15 Project Count

When running recursive pnpm commands (`pnpm -r run test`, `pnpm -r run typecheck`), pnpm reports:
`Scope: 14 of 15 workspace projects`

### Explanation:
- Total workspace packages detected by pnpm: **15 projects** (1 root project + 14 workspace packages).
- The missing package skipped by `pnpm -r run test` and `pnpm -r run typecheck` is:
  **`@onebridge/api-contracts`** (`packages/api-contracts`).
- **Why:** `packages/api-contracts/package.json` defines only `"contracts:gen"` and `"build"`. It defines **no `"test"` script, no `"typecheck"` script, and no `"test:e2e"` script**. Therefore, pnpm excludes it from the execution scope, yielding exactly 14 participating projects out of 15.

---

## 5. F00 Acceptance Criteria & Test Traceability

| F00 Acceptance Criterion | Status | Test Name & File | Notes |
|---|:---:|---|---|
| **Workspace & Layout** (AGENTS.md section 5) | **Partial** | `tests/e2e/workspace.spec.ts` (`AC-1: root workspace layout conforms to AGENTS.md requirements`) | Layout exists, but includes undocumented `services/media`. Root scripts run but `test:e2e` is mocked. |
| **Seeded Dev Environment** (`pnpm dev` with 2 tenants, owner/admin/employee) | **None** | *None exists* (`tests/e2e/dev-env.e2e-spec.ts` is an empty placeholder) | Backend dev server and seeding logic not implemented. |
| **CI Workflows & Quality Gates** | **Partial** | `tests/e2e/workspace.spec.ts` (`AC-3: CI pipeline file is valid YAML`) | File exists; has not run on remote; E2E step is echo stubs. |
| **Commitlint & Automated Releases** | **Done** | `tests/e2e/workspace.spec.ts` (`AC-5: Commitlint configuration exists`) | `commitlint.config.js`, `.husky/pre-commit`, and `release-please.yml` configured. |
| **Feature Flags** (per-tenant overrides) | **None** | *None exists* | Feature flag engine not built yet. |
| **Transactional Outbox Crash & Publish** | **None** | *None exists* | Outbox pattern and crash recovery tests not implemented. |
| **Idempotency Replay & Mismatch** | **Done** | `packages/shared/tests/idempotency.interceptor.spec.ts` (`AC-10: Idempotency Interceptor`), `services/identity/tests/integration/auth-api.spec.ts`, `me-api.spec.ts` | Tested with `InMemoryCacheStore`: returns cached on match, throws 422 on body divergence. |
| **Correlation ID Tracking** | **Done** | `packages/shared/tests/correlation-id.middleware.spec.ts` (`AC-12: Correlation ID Middleware`), `logger.spec.ts` | Generated if missing, passed to logs, responses, and error ProblemDetails. |
| **Error Handling** (`application/problem+json`) | **Done** | `packages/shared/tests/global-exception.filter.spec.ts` | ProblemException returns RFC 7807 problem+json. |
| **Log Scrubbing** (No phone/email in logs) | **Done** | `packages/shared/tests/logger.spec.ts` (`AC-11: Logging Scrubbing: should scrub phone numbers and emails`) | Replaces emails with `[REDACTED EMAIL]` and phone numbers with `[REDACTED PHONE]`. |
| **Boundary Lint** | **Partial** | *No automated test file* | Rule configured in `eslint.config.js` (`boundaries/element-types`), but no negative test asserting lint fails on boundary breach. |
| **Media Service Limits & Virus Scan** | **None** | *None exists* | `services/media` contains only a stub `package.json`. No upload, size limits, or virus scanning code exists. |
| **Provider Interfaces & Fake Adapters** | **Done** | `packages/shared/tests/fake-adapters.spec.ts` (`AC-16 & AC-17: Fake Adapters`) | Tests `FakeNotifier`, `FakeOtpSender`, `FakePaymentGateway`, `FakeGstVerifier`, `FakeCourier`, `FakeUrlSafetyChecker`, `FakeBotChallenge`, `FakeKeyService`, `FakeEventBus`. |
| **PlanLimits per Tenant** | **Done** | `packages/shared/tests/fake-adapters.spec.ts` (`fake plan limits should return configurable limits per tenant`) | Configurable per tenant (default Business, supports Starter override). |
| **Analytics Ingestion Stub** | **None** | *None exists* | `POST /analytics/events` ingestion endpoint not implemented. |
| **OpenAPI Contracts** | **Done** | Verified via `pnpm contracts:gen` | `packages/api-contracts/openapi.yaml` and `events.yaml`. |
| **Dashboard Shell** (`apps/web-app`) | **None** | *None exists* | Left rail, top bar, search, and global shell not built yet. |

---

## 6. Origin of `services/media` and Decision Record

- **Why `services/media` exists:**
  `services/media` was created during F00 scaffolding because `docs/features/F00-platform.md` contains an explicit section entitled:
  > **Media service**
  > Upload with allowed types (images: PNG, JPEG, WebP, SVG sanitised; documents: PDF), size limits (images 5 MB, PDF 25 MB), virus scan, EXIF removal...
- **Where the decision is recorded:**
  **Nowhere in `docs/decisions.md`**.
  In `AGENTS.md` section 5 ("Workspace layout"), the service list explicitly states:
  ```
  services/
    identity/ organization/ cards/ payments/ notifications/ analytics/
  ```
  `media` is **absent** from the authorized directory tree in AGENTS.md. The coding agent created `services/media` without proposing or logging a decision in `docs/decisions.md`.
- **Current State:** `services/media` contains only an empty `package.json` with echo scripts.

---

## 7. Status of Questions Q-11, Q-12, Q-13

- **Who Approved Them:**
  **The User DID NOT approve any of them.** An earlier coding agent resolved them autonomously on 2026-10-09 without user confirmation.
- **Action Taken:**
  1. In [docs/questions.md](file:///d:/Onebridge%20projects/Onebridge%20grid/docs/questions.md), moved **Q-11, Q-12, and Q-13** back to **Open (Agent proposal pending approval)**.
  2. Documented all later features affected by each question.
  3. In [docs/decisions.md](file:///d:/Onebridge%20projects/Onebridge%20grid/docs/decisions.md), amended the corresponding entries to **`(Agent proposal, pending approval)`**.

---

## 8. Traceability Tables for F01, F02, and F05

### 8.1 Feature F01: Authentication
| AC | Requirement | Status | Test Name & File |
|---|---|:---:|---|
| **AC-1** | Mobile OTP primary under 30s; SMS fallback to WhatsApp then email | **Done** | `otp.spec.ts`: `should use SMS primarily`, `should fallback to WhatsApp when SMS fails`, `should fallback to email when both fail`, `should fail if all fail` |
| **AC-2** | OTP expires in 5 min, single-use, stored hashed | **Done** | `otp.spec.ts`: `should store OTP hashed and not in plaintext`, `should verify valid OTP successfully`, `should reject already used OTP (single-use)`, `should reject expired OTP (5 minutes window)` |
| **AC-3** | Rate limits: 5 req/phone/hr, 5 wrong attempts then 15-min lock, per IP | **Done** | `otp.spec.ts`: `should block 6th request within an hour per phone`, `should block 6th request within an hour per IP`, `should lock for 15 minutes after 5 wrong attempts` |
| **AC-4** | Google/Microsoft sign-in links to existing person by verified email/phone | **Done** | `oauth.spec.ts`: `should link OAuth identity to existing person if verified email matches`, `should link OAuth identity to existing person if verified phone matches`, `should reject linking if email is unverified`, `should reject linking if phone is unverified`, `should create a new person if no matching email or phone exists` |
| **AC-5** | Refresh cookie uses `SameSite=Lax` | **Done** | `tokens.spec.ts`: `should set refresh token cookie with SameSite=Lax, httpOnly, and Secure`; `auth-api.spec.ts`: `should rotate refresh cookie and access token on POST /auth/refresh` |
| **AC-6** | 15-min access token in memory, rotating refresh, family revocation on reuse | **Done** | `tokens.spec.ts`: `should issue access token with 15 minutes expiry and a refresh token`, `should rotate refresh token upon each refresh call`, `should revoke entire session family if an already-used refresh token is reused` |
| **AC-7** | Users list/revoke own sessions and devices with isolation & pagination | **Done** | `auth-api.spec.ts`: `should reject unauthenticated session requests with 401`, `should list sessions with pagination and enforce user isolation`, `should logout user and clear refresh cookie` |
| **AC-8** | TOTP MFA: optional for users, mandatory for Owner/Admin on Business plan | **Done** | `mfa.spec.ts`: `should generate a valid secret and OTP Auth URI`, `should verify a valid current TOTP code`, `should NOT require MFA for regular User on Starter plan`, `should require mandatory MFA for Owner on Business plan`, `should require mandatory MFA for Admin on Business plan`; `auth-api.spec.ts`: MFA challenge workflow |
| **AC-9** | Error messages never reveal whether phone is registered | **Done** | `otp.spec.ts`: `should provide identical response message regardless of whether phone exists in database` |

### 8.2 Feature F02: Tenancy and Roles
| AC | Requirement | Status | Test Name & File |
|---|---|:---:|---|
| **AC-1** | Every document has `tenantId`; repository adds it to every query; missing tenant throws | **Done** | `tenant-isolation.spec.ts`: `should throw TenantIsolationError if a repository query lacks a tenantId`, `should succeed and isolate data if tenantId is provided`; `tenancy-isolation.spec.ts`: `should enforce complete data isolation between tenants in all repository queries (Cross-Tenant Isolation & AC-1)`; `me-api.spec.ts`: `should enforce tenant isolation in InMemoryMembershipRepository` |
| **AC-2** | 8 roles: Super Admin, Owner, Admin, Branch Manager, Dept Manager, Team Lead, Employee, Viewer | **Done** | `rbac.spec.ts`: `should correctly enumerate all 8 standard platform and company roles (AC-2)` |
| **AC-3** | Permissions follow PRD Section 15 matrix; server-side scope enforcement; deny-by-default on missing scope | **Done** | `rbac.spec.ts`: individual suites for Owner, Admin, Branch Manager, Dept Manager, Team Lead, Employee, Viewer, Super Admin; asserts missing scope context denies access; `me-api.spec.ts`: `RbacGuard` assertions |
| **AC-4** | Multi-company roles; active company explicit on every request (`X-Tenant-Id`); cross-company access denied | **Done** | `me-api.spec.ts`: `should return person and all company memberships on GET /me (AC-4)`, `should explicitly switch active tenant based on X-Tenant-Id header (AC-4)`, `should return memberships: [] and undefined activeTenant when person has 0 memberships (AC-4)`; `tenancy-isolation.spec.ts`: cross-company access rejection |
| **AC-5** | Super Admin impersonation is out of F02 | **Done** | `rbac.spec.ts`: `should treat Super Admin standard roles without active impersonation in F02 (AC-5)` |
| **AC-6** | Denied requests return 403 problem+json and are logged without PII | **Done** | `tenancy-isolation.spec.ts`: `should reject cross-company access when user has no membership in requested tenant (AC-4, AC-6)`, `should log security authorization failure without personal data (AC-6)`; `me-api.spec.ts`: `RbacGuard` 403 ProblemException |

### 8.3 Feature F05: Design Tokens and UI Kit
| AC | Requirement | Status | Test Name & File |
|---|---|:---:|---|
| **AC-1** | Tokens exist as CSS variables and Tailwind preset | **Done** | Verified via `packages/ui-kit/src/tokens.css` and `tailwind.config.ts` |
| **AC-2** | Radii 12, 16, 22, arch; Spacing 4, 8, 12, 16, 20, 24, 32 | **Done** | Verified via `packages/ui-kit/tailwind.config.ts` |
| **AC-3** | Manrope self-hosted with Noto Sans Devanagari fallback | **Done** | Verified via `tokens.css` `@font-face` definitions |
| **AC-4** | Dark mode tokens defined | **Partial** | Open question Q-11 pending user approval of dark palette hex codes |
| **AC-5** | 11 Components with Storybook stories across states | **Done** | `components.stories.tsx` and `components.spec.tsx` (5 tests covering rendering, variants, disabled states, reduced-motion) |
| **AC-6** | Automated contrast test fails if text < 4.5:1 | **Done** | `contrast.spec.ts`: `Validates contrast of all explicitly declared component combinations` (fails if ratio < 4.5:1) |
| **AC-7** | Primary orange button uses charcoal text; Orange never as text on light bg | **Done** | `contrast.spec.ts`: `No component uses bridge orange as text on light background (Warm Paper + Bridge Orange < 4.5:1)` |

---

## 9. Final Gate Verdict

**Exit Gate Status: NOT MET (Gate Blocked)**

### Blocking Deficiencies:
1. **Missing Playwright E2E Suite:** All package `test:e2e` scripts are echo stubs; no Playwright configuration or login test exists.
2. **Missing Dev Seed Environment:** `pnpm dev` does not boot an application or seed two demo tenants (owner, admin, employee each).
3. **F00 Platform Gaps:** Transactional outbox crash recovery, media service upload/scan, and boundary lint failure tests are absent or stubbed.
4. **Open Design Questions:** Q-11 (dark mode palette), Q-12 (visual snapshot strategy), and Q-13 (font delivery) remain open and pending user approval.
5. **No-Op Scripts Across Packages:** 9 workspace packages defined `echo` stubs for `typecheck` and `test`, disguising unverified packages as passing.
6. **Deficient Script Enforcement:** `check:scripts` only validated `test:e2e` scripts rather than checking all lifecycle scripts (`test`, `typecheck`, `lint`, `build`, `dev`).
