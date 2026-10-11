# Revised Implementation Plan: Task A

This plan addresses all requirements from your review, detailing **Task A only**. No code has been written.

---

## Complete F00 Acceptance Criteria Status Table

| AC | Requirement | Status | Notes / Phase Mapping |
|---|---|:---:|---|
| **AC-1** | Workspace layout per AGENTS.md §5, root commands work, no echo stubs | **Partial** | Root commands work, but `test:e2e` scripts contain echo stubs. Addressed in **Task A**. |
| **AC-2** | `pnpm dev` runs real servers with seeded demo tenants (2 tenants, owner/admin/employee each) | **Missing** | Addressed in **Task A** (`pnpm dev`, `pnpm seed`). |
| **AC-3** | GitHub Actions CI: lint, typecheck, unit, contract, build, security, fail on echo/mock stubs | **Partial** | Configured locally; echo-stub failure, contract checks, and real remote runs addressed in **Task C**. |
| **AC-4** | Cross-tenant isolation test framework | **Partial** | Currently tested only against in-memory arrays. Addressed in **Task A** against real MongoDB. |
| **AC-5** | Commitlint & release automation | **Done** | `commitlint.config.js`, `.husky/pre-commit`, `release-please.yml` verified. |
| **AC-6** | Feature flags (server/client evaluation, per-tenant overrides) | **Missing** | Addressed in **Task C** (dashboard shell & providers). |
| **AC-7** | Transactional outbox (survives worker crash, signed idempotent calls per ADR-0003) | **Missing** | Addressed in **Task B** (using `MongoMemoryReplSet`). |
| **AC-8** | Idempotency (`Idempotency-Key`, 24h cache, 422 on body mismatch) | **Done** | `IdempotencyInterceptor` & `InMemoryCacheStore` verified across F00/F01/F02. |
| **AC-9** | Correlation ID (`X-Correlation-ID` edge-to-log propagation) | **Done** | `correlation-id.middleware.spec.ts` & `logger.spec.ts` verified. |
| **AC-10** | Error format (`application/problem+json` RFC 7807 with correlationId) | **Done** | `ProblemException` and `GlobalExceptionFilter` verified. |
| **AC-11** | Log scrubbing (no phone or email in structured logs) | **Done** | `logger.spec.ts` verified (`[REDACTED EMAIL]`, `[REDACTED PHONE]`). |
| **AC-12** | ESLint module boundary rules (negative tests) | **Partial** | Boundaries configured in ESLint; negative/positive test suites added in **Task C**. |
| **AC-13** | Config service (no hardcoded domains) | **Partial** | Environment defaults exist; cookie/CORS hardening added in **Task A**, full service in **Task C**. |
| **AC-14** | Pre-commit secret scanning | **Done** | Verified in pre-commit hook and CI gitleaks step. |
| **AC-15** | Media service (type/size limits, sanitization, virus scan, signed URLs) | **Missing** | Addressed in **Task B** (`sharp`, `isomorphic-dompurify`). |
| **AC-16** | Provider interfaces with fake adapters (`Notifier`, `PaymentGateway`, etc.) | **Done** | `packages/shared/src/fakes.ts` (10 deterministic fake adapters). |
| **AC-17** | Deterministic fakes with failure simulation | **Done** | `packages/shared/tests/fake-adapters.spec.ts`. |
| **AC-18** | `PlanLimits` per tenant configurable in dev/test | **Done** | `FakePlanLimits.getForTenant` verified. |
| **AC-19** | Analytics ingestion stub (`POST /analytics/events`, queue & replay) | **Missing** | Addressed in **Task B**. |
| **AC-20** | OpenAPI 3.1 & domain event schemas in `packages/api-contracts` | **Partial** | Types generated, but package lacks test/typecheck scripts. Addressed in **Task B**. |
| **AC-21** | Dashboard shell (`apps/web-app` layout, module registry, error boundary) | **Missing** | Addressed in **Task C**. |
| **AC-22** | Real Playwright browser test for login with fake OTP | **Missing** | Addressed in **Task A**. |

---

# PLAN FOR TASK A: Real NestJS Identity, Real MongoDB Repositories, Seeded Tenants & E2E Login

## 1. Scope (Task A Acceptance Criteria)

- **AC-A1 (NestJS Identity Service Architecture):**
  - **What Identity uses today:** Standalone TypeScript classes (`AuthController`, `MeController`, domain entities, in-memory repositories). It has no NestJS modules, no HTTP server bootstrap, no `@Controller()` or route decorators, and its dev script is `echo 'dev identity'`.
  - **Target architecture:** Migrate `services/identity` to a real NestJS application: `IdentityModule`, NestJS controller routing decorators (`@Controller('auth')`, `@Controller('me')`, `@Controller('internal')`), and `src/main.ts` using `NestFactory.create()` with `@nestjs/platform-express`, `cookie-parser`, `GlobalExceptionFilter`, and `CorrelationIdMiddleware` listening on port `4001`. Standalone Express is not used.
- **AC-A2 (Repository Architecture: `TenantScopedRepository` vs. Allowlisted `GlobalRepository`):**
  - **`TenantScopedRepository<T>`:** Enforces `tenantId` from `TenantContext.getTenantId()`. Every document has `tenantId`. All queries without tenant context throw `TenantIsolationError`. Used by all tenant-bound collections (`memberships`, and future `orgs`, `seats`, `cards`, etc.).
  - **`GlobalRepository<T>`:** Allowlisted base class strictly reserved for platform-scoped entities that exist prior to or across tenants:
    1. `Person`: Global user profile spanning multiple companies (`AGENTS.md` rule: "A person can hold roles in more than one company").
    2. `Session`: Global user authentication sessions and refresh token families.
    3. `OtpChallenge`: Ephemeral pre-auth verification challenges tied to phone number before tenant identity is known.
    4. `IssuedIdRegistry`: Platform-wide uniqueness registry (e.g. Business ID minting).
  - **Enforcement test:** `packages/shared/tests/collection-classification.spec.ts` lists every MongoDB collection and fails if any collection is not classified as either `TenantScopedRepository` or allowlisted `GlobalRepository`.
  - **Decisions Log:** Propose explicit wording for `docs/decisions.md` regarding this partitioning model.
- **AC-A3 (Where Data is Stored & Mongo Driver):**
  - **Storage:** Stored in MongoDB. In development, it connects to local MongoDB via `MONGODB_URI` (`mongodb://127.0.0.1:27017/onebridge_dev`), or starts an embedded replica set via `scripts/dev-launcher.ts` storing data in `.dev-data/mongo` (which is added to `.gitignore`).
  - **Driver:** Official native `mongodb` driver (`^6.0.0`) with typed collections (pinned MongoDB server version: `7.0.14`).
  - **Real Repositories:** `MongoPersonRepository`, `MongoSessionRepository`, `MongoOtpRepository` (extending `GlobalRepository`), and `MongoMembershipRepository` (extending `TenantScopedRepository`).
  - **Indexes:** Automated index creation:
    - `persons`: Unique index on `phone`, sparse unique on `email`.
    - `sessions`: Index on `userId`, index on `familyId`, TTL index on `expiresAt`.
    - `otp_challenges`: Index on `phone`, TTL index on `expiresAt` (5 min).
    - `memberships`: Compound unique index on `{ tenantId: 1, personId: 1 }`.
    - Idempotency and rate-limiting stores remain in-memory for Task A; documented and marked **Partial** until Redis adapter in later hardening.
- **AC-A4 (Comprehensive Tenant Isolation Tests):**
  - Tests against real MongoDB via `mongodb-memory-server`:
    - `findMany` / `findOne`: Queries only return records matching context `tenantId`.
    - `updateOne` / `updateMany`: Cannot update another tenant's documents even if filter matches document ID.
    - `deleteOne` / `deleteMany`: Cannot delete another tenant's documents.
    - `upsert`: Automatically injects context `tenantId`; cannot overwrite another tenant's document ID.
    - `bulkWrite`: Every operation strictly enforces context `tenantId`.
    - `$or` queries: Context `tenantId` is wrapped outside `$or` (`{ tenantId, $or: [...] }`).
    - `tenantId` override attempt: Passing `{ tenantId: 'malicious' }` in query filter is overridden by context or throws.
    - Cross-tenant writes: Attempting to insert a document with mismatched `tenantId` throws `TenantIsolationError`.
    - `tenantId` from context only: Injected exclusively via `TenantContext.getTenantId()`.
    - No raw collection exposed: Consumers cannot bypass tenant sanitization.
- **AC-A5 (Seeded Demo Data):**
  - Fixed valid 26-character ULIDs for all entities.
  - Seeds two companies (`tenant-alpha`: `01JD2XALPHA0000000000000001`, `tenant-beta`: `01JD2XBETA0000000000000002`), each populated with an Owner, Admin, and Employee user.
  - Idempotent: Re-running `pnpm seed` updates/skips without duplicates or errors.
  - Refuses to run if `NODE_ENV === 'production'` or if `NODE_ENV` is unset.
  - Documented in `README.md` and runnable via `pnpm seed`.
- **AC-A6 (Fake OTP Production Safety Guard):**
  - Controlled by single flag: `ALLOW_FAKE_OTP=true`.
  - Allowed **only** when `NODE_ENV === 'development'` or `NODE_ENV === 'test'`. Unset `NODE_ENV` strictly counts as production.
  - Production fails to boot without a real OTP provider configured.
  - Fake OTP is never returned in any response body, header, or error message.
  - Verified by automated unit tests.
- **AC-A7 (CORS, CSRF, Cookie Flags & Security):**
  - CORS allowlist configured via `CORS_ORIGINS` (defaults to `http://localhost:3000`).
  - CSRF protection on `POST /auth/refresh`: requires custom header `X-Requested-With: XMLHttpRequest` or `X-CSRF-Token`.
  - Config-driven cookie flags: `httpOnly: true`, `secure: isProd`, `sameSite: 'Lax'`, `path: '/auth'`.
  - Verified with a dedicated unit test.
- **AC-A8 (Real NestJS HTTP-Level Tests):**
  - Uses `supertest` with `INestApplication`:
    - Asserts missing `X-Correlation-ID` header is generated and returned.
    - Asserts errors return RFC 7807 `application/problem+json` with `correlationId`.
    - Asserts `POST /auth/otp` with `Idempotency-Key` returns cached response on identical replay and 422 on payload mismatch.
- **AC-A9 (Repository Contract Suite & Production Wiring Guard):**
  - Shared contract suite `repository-contract.suite.ts` runs against both `InMemoryMembershipRepository` and `MongoMembershipRepository`.
  - Unit test proves that `IdentityModule` throws if in-memory repositories are wired when `NODE_ENV=production`.
- **AC-A10 (OpenAPI Route Parity):**
  - Serves 11 identity endpoints:
    `POST /auth/otp`, `POST /auth/verify`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/sessions`, `DELETE /auth/sessions/:id`, `POST /auth/mfa/setup`, `POST /auth/mfa/verify`, `POST /auth/oauth/:provider`, `GET /me`, `POST /internal/memberships`.
  - Automated test reads `packages/api-contracts/openapi.yaml` and asserts that every declared identity path exists in the NestJS routing table.
- **AC-A11 (Minimal Next.js Web-App):**
  - Minimal Next.js app in `apps/web-app`:
    - Mounts `AuthFlow` UI component at `/login`.
    - In-memory access-token API client (stores access token in memory/React closure, automatically triggers `/auth/refresh` upon 401).
    - Configured as Playwright `webServer` entry in `playwright.config.ts`.
- **AC-A12 (Real Playwright E2E Login & MFA Tests):**
  - Uses Playwright Chromium and a mobile viewport project (`Pixel 7` / `390x844`).
  - Test 1: Seeded Employee login (`+919876543212`) with fake OTP.
    - Asserts successful login.
    - Asserts `localStorage` and `sessionStorage` contain **zero tokens**.
    - Asserts `IndexedDB` contains **zero tokens**.
    - Asserts `document.cookie` does not expose `refreshToken` (verifying `HttpOnly`).
    - Asserts context cookies contain `refreshToken` with `HttpOnly`, `SameSite=Lax`, `Secure`.
  - Test 2: Seeded Owner login (`+919876543210`) triggers MFA challenge; enters valid TOTP code; logs in.
- **AC-A13 (Cleanup Echo Scripts & CI Hardening):**
  - Remove all `"test:e2e": "echo ..."` scripts across all packages. Packages with nothing to test do not define `test:e2e`.
  - Root `package.json` defines `"test:e2e": "playwright test"`.
  - `.github/workflows/ci.yml`:
    - Caches MongoDB binaries (`~/.cache/mongodb-binaries`, version pinned to `7.0.14`).
    - Installs Playwright Chromium: `npx playwright install --with-deps chromium`.
    - Fails the build if any `package.json` contains `echo`, `true`, `exit 0`, `:`, or `--passWithNoTests`.
    - Preview deploy reported as **Not met** (remote deployment is not configured; git remote status documented).

---

## 2. Out of Scope for Task A

- Transactional outbox crash recovery with replica set (Task B).
- Media service (`sharp`, SVG sanitization, quarantine pipeline) (Task B).
- Analytics ingestion queue and replay (Task B).
- Dashboard shell navigation, module registry, and full app shell (Task C).
- ESLint boundary tests (Task C).

---

## 3. Contract Changes (Task A)

No new endpoints or schema changes. All 11 identity endpoints are implemented to match the existing definitions in `packages/api-contracts/openapi.yaml`.

---

## 4. Files Created or Changed (Task A)

### Module: `packages/shared`
- `src/mongo/mongo-repository.ts` (Create): `TenantScopedRepository<T>` and `GlobalRepository<T>` base classes.
- `src/mongo/mongo-client.ts` (Create): Native MongoDB driver client factory.
- `src/mongo/indexes.ts` (Create): Index creation definitions for Identity and platform collections.
- `tests/collection-classification.spec.ts` (Create): Test verifying every collection is strictly classified.
- `tests/tenant-scoped-repository.spec.ts` (Create): Comprehensive MongoDB tenant isolation tests (find, update, delete, upsert, bulk, $or, override protection, no raw collection).
- `tests/repository-contract.suite.ts` (Create): Shared contract suite run against in-memory and MongoDB repositories.

### Module: `services/identity`
- `src/identity.module.ts` (Create): NestJS module.
- `src/main.ts` (Create): NestJS bootstrap entrypoint listening on port 4001 with CORS, cookie-parser, CSRF protection, and filters.
- `src/config/auth-env.ts` (Create): Configuration and environment validation (fake OTP production guard).
- `src/config/cookie.config.ts` (Create): Config-driven cookie flags.
- `src/infrastructure/repositories/mongo-person.repository.ts` (Create): Real MongoDB Person repository.
- `src/infrastructure/repositories/mongo-session.repository.ts` (Create): Real MongoDB Session repository.
- `src/infrastructure/repositories/mongo-otp.repository.ts` (Create): Real MongoDB OTP repository.
- `src/infrastructure/repositories/mongo-membership.repository.ts` (Create): Real MongoDB Membership repository.
- `src/infrastructure/seed.ts` (Create): Seed script using fixed valid ULIDs, idempotent, refusing to run in production.
- `tests/unit/fake-otp-guard.spec.ts` (Create): Unit tests for fake OTP production rejection and missing provider failure.
- `tests/unit/cookie-config.spec.ts` (Create): Unit tests for config-driven cookie flags.
- `tests/unit/production-wiring-guard.spec.ts` (Create): Unit test proving in-memory repositories cannot be wired in production.
- `tests/integration/nest-http-auth.spec.ts` (Create): Real NestJS HTTP-level tests via `supertest` (correlation ID, problem+json, idempotency replay).
- `tests/contract/openapi-identity-routes.spec.ts` (Create): Route parity test verifying all OpenAPI paths exist in NestJS router.
- `package.json` (Modify): Add NestJS dependencies, native `mongodb`, `supertest`, `cookie-parser`; remove `test:e2e` echo script.

### Module: `apps/web-app`
- `src/app/login/page.tsx` (Create): Next.js page mounting `AuthFlow`.
- `src/lib/api-client.ts` (Create): In-memory access-token API client with automatic token refresh.
- `next.config.js` / `src/app/layout.tsx` (Create): Minimal Next.js configuration and layout.
- `package.json` (Modify): Add `next`, `react`, `react-dom`; remove `test:e2e` echo script.

### Module: Root & CI
- `playwright.config.ts` (Create): Playwright configuration with Chromium and mobile viewport projects, referencing `webServer` for port 4001 (Identity) and port 3000 (web-app).
- `tests/e2e/login-employee.e2e.spec.ts` (Create): Browser test for seeded Employee login, storage and cookie checks.
- `tests/e2e/login-mfa-owner.e2e.spec.ts` (Create): Browser test for seeded Owner MFA login flow.
- `tests/e2e/dev-env.e2e-spec.ts` (Delete): Remove empty placeholder.
- `scripts/dev-launcher.ts` (Create): Development server launcher managing `MongoMemoryReplSet` when no external MongoDB is present.
- `.gitignore` (Modify): Add `.dev-data/`.
- `docs/decisions.md` (Modify): Record repository partitioning decision (`TenantScopedRepository` vs. `GlobalRepository`).
- `.github/workflows/ci.yml` (Modify): Add Playwright Chromium installation, Mongo binary cache, and echo/no-op script rejection check.
- Remove `"test:e2e": "echo ..."` from all remaining packages' `package.json`.

---

## 5. Tests (Task A)

| Test Name | Level | What it asserts |
|---|:---:|---|
| `login-employee.e2e.spec.ts` | E2E (Playwright) | Desktop & mobile viewports: logs in seeded Employee; asserts 0 tokens in `localStorage`, `sessionStorage`, `IndexedDB`; asserts `document.cookie` does not expose `refreshToken`; asserts `refreshToken` cookie is `HttpOnly`, `SameSite=Lax`, `Secure`. |
| `login-mfa-owner.e2e.spec.ts` | E2E (Playwright) | Logs in seeded Owner; asserts MFA challenge triggered; enters valid TOTP; asserts successful authentication and security cookies. |
| `fake-otp-guard.spec.ts` | Unit | Refuses to start when `ALLOW_FAKE_OTP=true` and `NODE_ENV` is unset or `production`; fails production without real provider; asserts OTP is never returned in response. |
| `cookie-config.spec.ts` | Unit | Verifies cookie flags across development and production configurations. |
| `collection-classification.spec.ts` | Unit | Lists all MongoDB collections; asserts each is classified as `TenantScopedRepository` or allowlisted `GlobalRepository`; fails on unclassified collection. |
| `tenant-scoped-repository.spec.ts` | Integration (Real Mongo) | Comprehensive isolation: `find`, `update`, `delete`, `upsert`, `bulkWrite`, `$or`, filter override protection, cross-tenant rejection, tenantId from context only, no raw collection. |
| `repository-contract.suite.ts` | Integration | Shared contract suite run against `InMemoryMembershipRepository` and `MongoMembershipRepository`. |
| `production-wiring-guard.spec.ts` | Unit | Asserts NestJS application bootstrap throws if in-memory repositories are wired in production. |
| `indexes.spec.ts` | Integration (Real Mongo) | Asserts unique and TTL indexes are created and enforce constraints on real MongoDB. |
| `nest-http-auth.spec.ts` | Integration (Supertest) | HTTP-level NestJS assertions: generated `X-Correlation-ID`, RFC 7807 `application/problem+json`, `Idempotency-Key` replay and mismatch, CSRF rejection on refresh. |
| `openapi-identity-routes.spec.ts` | Contract | Asserts every OpenAPI identity path maps to an active NestJS route handler. |
| `seed.spec.ts` | Integration (Real Mongo) | Asserts fixed ULIDs, idempotency on repeated run, and refusal to run in production. |

---

## 6. States to Build (Task A)

- **API Startup States:**
  - Successful launch state (NestJS listening, MongoDB connected, indexes ensured, seed verified).
  - Fatal configuration failure state (aborting if fake OTP or in-memory repositories are detected in production).
- **Web-App AuthFlow States:**
  - Phone entry state.
  - OTP verification state.
  - MFA challenge state.
  - Authenticated session state.

---

## 7. Dependencies on Fakes

- `FakeOtpSender`: Used only when `ALLOW_FAKE_OTP=true` in development/test.
- `mongodb-memory-server`: Provides real MongoDB instance (version pinned to `7.0.14`) for tests and dev launcher.

---

## 8. Proposed Dependencies List & Rationale

| Dependency | Package | Rationale |
|---|---|---|
| `@playwright/test` | Root (dev) | User approved. Browser automation framework for desktop & mobile E2E tests. |
| `mongodb-memory-server` | `packages/shared`, Root (dev) | User approved. Embedded real MongoDB server (pinned to 7.0.14) for tests & dev launcher. |
| `tsx` | Root, `services/identity` (dev) | User approved. TypeScript execution engine for dev launcher, seed scripts, NestJS main. |
| `mongodb` (`^6.0.0`) | `packages/shared`, `services/identity` | Official native MongoDB driver for real `MongoRepository` base classes and indexes. |
| `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express` | `services/identity` | Required to run Identity on real NestJS per instruction (1) and AGENTS.md §4. |
| `@nestjs/testing` | `services/identity` (dev) | Required for NestJS testing module creation in integration tests. |
| `reflect-metadata` | `services/identity` | Required peer dependency for NestJS decorator reflection. |
| `supertest` & `@types/supertest` | `services/identity` (dev) | Required for HTTP-level integration testing of NestJS pipeline (correlation ID, error filter). |
| `cookie-parser` & `@types/cookie-parser` | `services/identity` | Required for parsing and setting HttpOnly refresh cookies in NestJS HTTP pipeline. |
| `next` (`^14.2.0`) | `apps/web-app` | Minimal Next.js framework to mount `AuthFlow` and support Playwright `webServer`. |
| `react` & `react-dom` | `apps/web-app` | Required dependencies for Next.js runtime and UI components. |
| `@swc/core` & `@vitejs/plugin-react` | `apps/web-app` (dev) | Fast SWC compilation of React/JSX components for Vitest component tests. |

---

## 9. Proposed Wording for `docs/decisions.md` (Repository Partitioning)

> **[2026-10-11] Repository Partitioning Model: TenantScopedRepository vs. GlobalRepository (Class A)**  
> All repository access in OneBridge Grid is strictly bifurcated to prevent cross-tenant data leakage:  
> 1. **`TenantScopedRepository<T>`**: Default base class for all business entities (memberships, organizations, branches, seats, cards, leads, audit entries). Automatically resolves and injects `tenantId` exclusively from `TenantContext.getTenantId()`. Any query without active tenant context throws `TenantIsolationError`. Raw MongoDB collections are never exposed to service layers.  
> 2. **`GlobalRepository<T>`**: An allowlist-only base class restricted to platform-level entities that inherently exist outside or across tenant boundaries:  
>    - `Person`: Global user identity spanning multiple organizations.  
>    - `Session`: Global user authentication sessions and refresh token families.  
>    - `OtpChallenge`: Ephemeral pre-authentication challenges prior to tenant selection.  
>    - `IssuedIdRegistry`: Platform-wide uniqueness registries (e.g. Business ID minting).  
> A dedicated test (`collection-classification.spec.ts`) verifies every MongoDB collection against this allowlist and fails the build on any unclassified collection.

---

## 10. Risks (Task A)

- **MongoDB Binary Download:** `mongodb-memory-server` requires binary download on fresh environments; cached via GitHub Actions cache to prevent CI timeouts.
- **Port Coordination:** Dev server ports (`4001` for Identity, `3000` for Next.js web-app) configured with environment overrides to prevent local port conflicts.

---

I will wait for your approval of this revised plan for **Task A** before writing any code.