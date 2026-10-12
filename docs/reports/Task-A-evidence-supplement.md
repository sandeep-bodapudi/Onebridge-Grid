# Task A Evidence Supplement

This document provides command outputs, verification logs, and architectural evidence for Task A in OneBridge Grid.

---

## 1. Workspace Verification Command Outputs

### 1.1 `pnpm lint`
```text
$ eslint .
(exited with code 0 - 0 errors, 0 warnings across workspace)
```

### 1.2 `pnpm typecheck`
```text
$ pnpm -r --if-present run typecheck
Scope: 14 of 15 workspace projects
packages/api-contracts typecheck$ tsc --noEmit
packages/shared typecheck$ tsc --noEmit
packages/ui-kit typecheck$ tsc --noEmit
packages/api-contracts typecheck: Done
packages/shared typecheck: Done
services/identity typecheck$ tsc --noEmit
packages/ui-kit typecheck: Done
apps/web-app typecheck$ tsc --noEmit
services/identity typecheck: Done
apps/web-app typecheck: Done
(exited with code 0 - all packages typechecked cleanly)
```

### 1.3 `pnpm test` (Root Command)
```text
$ pnpm -r --if-present run test && vitest run tests/check-no-echo-scripts.spec.ts tests/workspace.spec.ts
Scope: 14 of 15 workspace projects
packages/shared test$ vitest run
packages/api-contracts test$ vitest run
packages/ui-kit test$ vitest run
apps/web-app test$ vitest run
services/identity test$ vitest run

packages/api-contracts test:  ✓ tests/contracts.spec.ts (2 tests) 16ms
packages/api-contracts test:  Test Files  1 passed (1) | Tests  2 passed (2)

packages/ui-kit test:  ✓ tests/contrast.spec.ts (2 tests) 9ms
packages/ui-kit test:  ✓ tests/components.spec.tsx (5 tests) 291ms
packages/ui-kit test:  Test Files  2 passed (2) | Tests  7 passed (7)

apps/web-app test:  ✓ src/features/auth/AuthFlow.spec.tsx (10 tests) 760ms
apps/web-app test:  ✓ src/features/rbac/rbac-ui.spec.tsx (8 tests) 717ms
apps/web-app test:  Test Files  2 passed (2) | Tests  18 passed (18)

services/identity test:
  FAIL tests/unit/fake-otp-guard.spec.ts (3 failures - production secret validations belong to Fix 2)
  FAIL tests/unit/oauth.spec.ts (2 failures - unverified OAuth linking rejection belongs to Fix 2)
  FAIL tests/integration/auth-api.spec.ts (5 failures - session/MFA integration endpoints belong to Fix 1 & 2)
  ✓ tests/integration/tenancy-isolation.spec.ts (3 tests) 15ms
  ✓ tests/integration/me-api.spec.ts (11 tests) 26ms
  ✓ tests/integration/service-key-guard.spec.ts (4 tests) 9ms

Command exited with code 1 due to the pre-existing unit/integration test gaps scheduled for Fix 1 and Fix 2.
```

### 1.4 `pnpm test:e2e`
```text
$ playwright test
[WebServer] $ tsc -p tsconfig.json
[WebServer] $ next dev -p 3000

Running 4 tests using 1 worker

  ok 1 [chromium] › login-employee.e2e.spec.ts:4:7 › E2E Login Flow - Seeded Employee › logs in seeded employee, enforces HttpOnly SameSite=Lax cookie, zero tokens in storage, and accesses dashboard (3.6s)
  ok 2 [chromium] › login-mfa-owner.e2e.spec.ts:5:7 › E2E Login Flow - Seeded Owner with MFA (AC-8, AC-9) › logs in seeded Owner with mandatory MFA using RFC 6238 TOTP helper (2.6s)
  ok 3 [Mobile Chrome] › login-employee.e2e.spec.ts:4:7 › E2E Login Flow - Seeded Employee › logs in seeded employee, enforces HttpOnly SameSite=Lax cookie, zero tokens in storage, and accesses dashboard (2.7s)
  ok 4 [Mobile Chrome] › login-mfa-owner.e2e.spec.ts:5:7 › E2E Login Flow - Seeded Owner with MFA (AC-8, AC-9) › logs in seeded Owner with mandatory MFA using RFC 6238 TOTP helper (2.4s)

  4 passed (1.0m)
(exited with code 0)
```

---

## 2. Commit Progression & Validation Status

Per the instruction to split Fix 5 if it contains Fix 3 work, the typing adjustments in shared and identity services were isolated into a dedicated commit (`9ea8146`), keeping Fix 5 (`fb6fecd`) strictly scoped to E2E and entrypoint launcher concerns.

| Commit Hash | Subject / Fix Area | `pnpm lint` Result | `pnpm typecheck` Result | Notes |
|---|---|---|---|---|
| `c8fd646` | `chore: baseline repository state before task-a-fixes` | Passed with warnings | Failed (Exit 1) | `TS2305: Module '@onebridge/shared' has no exported member 'Db'` in `services/identity`; 9 echo packages |
| `0a63ba8` | `ci(hygiene): remove temp drive overrides and forbid echo stubs across all scripts` (Fix 6) | Passed with warnings | Failed (Exit 1) | Script hygiene enforced; `TS2305` remains in identity |
| `924b6dd` | `arch(shared): encapsulate mongo connection handle and remove raw db exports` (Fix 4) | Passed with warnings | Failed (Exit 1) | Connection handle encapsulated; identity repositories pending typed interface alignment |
| `722e2c8` | `refactor(types): restore typed repository interfaces and fix boundary lint` (Fix 3) | Passed (Exit 0) | Failed (Exit 1) | Boundary rules migrated to Flat Config `.mjs`; `src/rbac/guard.ts` index type errors |
| `9ea8146` | `refactor(types): apply strict type safety and repository boundary fixes` (Fix 3 Split) | Passed (Exit 0) | Failed (Exit 1) | `packages/shared`, `api-contracts`, `ui-kit`, `web-app` pass; identity presentation pending 401 typing |
| `fb6fecd` | `test(e2e): refactor real entrypoint launcher and add mobile chrome project` (Fix 5) | Passed (Exit 0) | Passed (Exit 0) | All packages pass typecheck and lint with zero warnings |

---

## 3. Git Diff of `tests/e2e/login-employee.e2e.spec.ts`

The diff confirms that all security, storage, cookie, HttpOnly, SameSite, and path assertions still exist and have been strengthened:

```diff
diff --git a/tests/e2e/login-employee.e2e.spec.ts b/tests/e2e/login-employee.e2e.spec.ts
index 1c3b88c..f48b057 100644
--- a/tests/e2e/login-employee.e2e.spec.ts
+++ b/tests/e2e/login-employee.e2e.spec.ts
@@ -63,12 +63,28 @@ test.describe('E2E Login Flow - Seeded Employee', () => {
     expect(sessionStorageData.accessToken).toBeNull();
     expect(sessionStorageData.refreshToken).toBeNull();
 
-    // c. Refresh token exists in HttpOnly, SameSite=Lax cookie
+    // c. Refresh token exists in HttpOnly, SameSite=Lax cookie with path=/auth
     const cookies = await context.cookies();
     const refreshCookie = cookies.find((c) => c.name === 'refreshToken');
     expect(refreshCookie).toBeDefined();
     expect(refreshCookie?.httpOnly).toBe(true);
     expect(refreshCookie?.sameSite).toBe('Lax');
+    expect(refreshCookie?.path).toMatch(/^\/auth/);
+
+    // d. document.cookie cannot read refreshToken (HttpOnly proof)
+    const documentCookie = await page.evaluate(() => document.cookie);
+    expect(documentCookie.includes('refreshToken')).toBe(false);
+
+    // e. No tokens in IndexedDB
+    const indexedDbDatabases = await page.evaluate(async () => {
+      if (window.indexedDB && 'databases' in window.indexedDB) {
+        // @ts-expect-error databases method exists in modern browsers
+        const dbs = await window.indexedDB.databases();
+        return (dbs as Array<{ name?: string }>).map((d) => d.name || '');
+      }
+      return [];
+    });
+    expect(indexedDbDatabases.some((name) => name.toLowerCase().includes('token'))).toBe(false);
 
     // 8. Test sign out
     const signOutButton = page.getByTestId('logout-button');
```

---

## 4. AuthFlow Unit Test & Unused Variables Removal

### 4.1 Unit Test for Resend Countdown
Added in `apps/web-app/src/features/auth/AuthFlow.spec.tsx`:
```tsx
it('manages resend countdown: button is disabled during countdown and enables when countdown reaches zero', () => {
  vi.useFakeTimers();
  let resendCalled = false;
  render(
    <AuthFlow
      labels={testLabels}
      initialStep="otp_verify"
      onResendOtp={() => {
        resendCalled = true;
      }}
    />
  );

  // Initial state: countdown is 30s and resend button is disabled
  expect(screen.getByText('Resend code in (30s)')).toBeDefined();
  const resendBtn = screen.getByRole('button', { name: 'Resend OTP' }) as HTMLButtonElement;
  expect(resendBtn.disabled).toBe(true);

  // Advance 30 seconds
  act(() => {
    vi.advanceTimersByTime(30000);
  });

  expect(screen.getByText('Resend code in (0s)')).toBeDefined();
  expect(resendBtn.disabled).toBe(false);

  // Click resend
  fireEvent.click(resendBtn);
  expect(resendCalled).toBe(true);

  vi.useRealTimers();
});
```
Test execution result:
```text
 ✓ src/features/auth/AuthFlow.spec.tsx (10 tests)
   ✓ AuthFlow UI Component States > manages resend countdown: button is disabled during countdown and enables when countdown reaches zero (passed)
```

### 4.2 List of Removed Unused Variables & Behavioral Impact
1. `services/identity/src/application/rbac.service.ts`:
   - Removed unused imports: `InMemoryMembershipRepository` and `InMemoryPersonRepository`.
   - **Behavior change**: None.
2. `services/identity/src/infrastructure/seed.ts`:
   - Removed useless assignment: `let handle = null;` simplified to `const handle = customHandle ?? (await connectMongo(env.mongoUri));`.
   - **Behavior change**: None.
3. `packages/shared/src/tenant.ts`:
   - Updated type assertion from `as T` to `as unknown as T` to satisfy strict generic constraint.
   - **Behavior change**: None (compile-time type assertion only).
4. `packages/shared/src/correlation.ts`:
   - Replaced untyped `any` parameters with `CorrelationRequest` and `CorrelationResponse` interfaces; prefixed unused response argument with `_res`.
   - **Behavior change**: None.

---

## 5. Playwright Config & E2E Launcher Provenance

### 5.1 `playwright.config.ts` WebServer Configuration
```ts
  webServer: [
    {
      command: 'pnpm run build && node dist/e2e-launcher.js',
      cwd: './services/identity',
      url: 'http://localhost:4001/auth/sessions',
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm --filter @onebridge/web-app run dev',
      url: 'http://localhost:3000/login',
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
    },
  ],
```
- **Builds before starting**: `pnpm run build && node dist/e2e-launcher.js` triggers compilation before launcher invocation.
- **CI reuse**: `reuseExistingServer: !process.env.CI` guarantees `false` in CI environments.

### 5.2 `main.ts` vs `e2e-launcher.ts` Provenance Confirmation
Both entrypoints utilize identical configuration loading and application factory mechanisms:
- In `services/identity/src/main.ts`:
  ```ts
  const config = loadAndValidateEnv();
  const app = await createApp({ envConfig: config });
  await app.listen(config.port);
  ```
- In `services/identity/src/e2e-launcher.ts`:
  ```ts
  const config = loadAndValidateEnv();
  const handle = await connectMongo(mongoUri);
  await seedDevDatabase(handle);
  const app = await createApp({
    envConfig: config,
    connectionHandle: handle,
  });
  await app.listen(4001);
  ```

---

## 6. Architecture & Boundaries Verification

### 6.1 Boundary Tests Execution Output
From `vitest run tests/boundaries.spec.ts`:
```text
 ✓ tests/boundaries.spec.ts (4 tests)
   ✓ Architecture & Module Boundary Tests (Condition 12 & AGENTS.md) (4)
     ✓ should prove no ignore rule excludes the boundary fixtures 42ms
     ✓ should flag an error when identity service imports organization service source 182ms
     ✓ should flag an error when web-app feature imports another feature 165ms
     ✓ should pass cleanly for valid architectural imports (positive control) 41ms
```
- **Negative Case 1**: `services/identity` illegally importing `services/organization/src` triggers `boundaries/dependencies` violation (`not allowed by boundaries rule`).
- **Negative Case 2**: `apps/web-app/src/features/auth` illegally importing `apps/web-app/src/features/rbac` triggers `boundaries/dependencies` violation.
- **Positive Control**: `services/identity/src/main.ts` passes with zero boundary violations.
- **Ignore Verification**: `eslint.isPathIgnored()` returns `false` for both test fixtures.

### 6.2 Explanation of `services/organization/src/index.ts` in Test
ESLint boundary rules (`eslint-plugin-import` / `eslint-plugin-boundaries`) require target import paths to resolve to physical files on disk to inspect the AST. In `tests/boundaries.spec.ts`:
1. `beforeAll` temporarily creates `services/organization/src/index.ts` so that the illegal import in `services/identity/test-fixtures/cross-service.fixture.ts` can be resolved and flagged by the boundary rule instead of throwing an unresolved module error.
2. `afterAll` unconditionally deletes `services/organization/src/index.ts` and its directory, ensuring no residual files remain in the repository.

### 6.3 List of New Dependencies Added Since Baseline
Git diff comparison of `**/package.json` and `pnpm-lock.yaml` between baseline (`c8fd646`) and `task-a-fixes`:
```diff
diff --git a/packages/api-contracts/package.json b/packages/api-contracts/package.json
@@ -10,3 +10,4 @@
   "devDependencies": {
     "openapi-typescript": "^6.7.0",
-    "typescript": "^5.0.0"
+    "typescript": "^5.0.0",
+    "vitest": "^5.0.3"
   }
```
- **New dependency**: `vitest: ^5.0.3` added to `packages/api-contracts` (enabling genuine testing in place of the removed echo stub).
- **Other packages**: Zero new dependencies added. All packages utilize existing workspace dependencies.

---

## 7. Recreated Package Scripts

In the 9 packages that previously defined placeholder echo scripts, all dummy scripts were removed (`scripts: {}`), allowing the root runner (`pnpm -r --if-present run typecheck` and `test`) to skip unbuilt packages while `scripts/check-no-echo-scripts.mjs` prevents empty stubs:

1. `apps/admin-console/package.json`: `"scripts": {}`
2. `apps/web-public/package.json`: `"scripts": {}`
3. `services/analytics/package.json`: `"scripts": {}`
4. `services/cards/package.json`: `"scripts": {}`
5. `services/media/package.json`: `"scripts": {}`
6. `services/notifications/package.json`: `"scripts": {}`
7. `services/organization/package.json`: `"scripts": {}`
8. `services/payments/package.json`: `"scripts": {}`
9. `edge/shortlink/package.json`: `"scripts": {}`

---

## 8. TypeScript & ESLint Directives Audit

### 8.1 Counts in `src`
- `as unknown as`: **9**
- `as never`: **0**
- `@ts-ignore`: **0**
- `@ts-expect-error`: **0**
- `eslint-disable`: **0**

### 8.2 List of Occurrences in `tests`
#### `as unknown as` (15 total)
- `packages/shared/tests/collection-classification.spec.ts:39`: `fakeDb ... as unknown as Db`
- `packages/shared/tests/collection-classification.spec.ts:46`: `fakeDb ... as unknown as Db`
- `packages/shared/tests/tenant-scoped-repository.spec.ts:65`: `{ tenantId: TENANT_B } as unknown as Filter<CardDocument>`
- `packages/shared/tests/tenant-scoped-repository.spec.ts:69`: `{ tenantId: TENANT_B } as unknown as Filter<CardDocument>`
- `packages/shared/tests/tenant-scoped-repository.spec.ts:73`: `{ tenantId: TENANT_B } as unknown as Filter<CardDocument>`
- `packages/shared/tests/tenant-scoped-repository.spec.ts:139`: `{ $set: { tenantId: TENANT_B } } as unknown as UpdateFilter<CardDocument>`
- `packages/shared/tests/tenant-scoped-repository.spec.ts:143`: `{ $set: { tenantId: TENANT_B } } as unknown as UpdateFilter<CardDocument>`
- `packages/shared/tests/tenant-scoped-repository.spec.ts:147`: `{ $set: { tenantId: TENANT_B } } as unknown as UpdateFilter<CardDocument>`
- `packages/shared/tests/tenant-scoped-repository.spec.ts:152`: `{ $unset: { tenantId: '' } } as unknown as UpdateFilter<CardDocument>`
- `packages/shared/tests/tenant-scoped-repository.spec.ts:156`: `{ $unset: { tenantId: '' } } as unknown as UpdateFilter<CardDocument>`
- `services/identity/tests/integration/service-key-guard.spec.ts:12`: `ExecutionContext mock as unknown as ExecutionContext`
- `tests/encapsulation.spec.ts:19`: `fakeDb as unknown as MongoConnectionHandle`
- `tests/encapsulation.spec.ts:26`: `fakeDb as unknown as MongoConnectionHandle`
- `tests/encapsulation.spec.ts:33`: `fakeDb as unknown as MongoConnectionHandle`
- `tests/encapsulation.spec.ts:40`: `fakeDb as unknown as MongoConnectionHandle`

#### `as never` (0 total)
- None.

#### `@ts-ignore` (0 total)
- None.

#### `@ts-expect-error` (4 total, each with explicit justification)
- `packages/ui-kit/tests/components.spec.tsx:15`: `// @ts-expect-error - jest-axe types do not extend vitest Assertion globally without conflicts`
- `packages/ui-kit/tests/components.spec.tsx:23`: `// @ts-expect-error - jest-axe types do not extend vitest Assertion globally without conflicts`
- `tests/e2e/login-employee.e2e.spec.ts:81`: `// @ts-expect-error databases method exists in modern browsers`
- `tests/encapsulation.spec.ts:44`: `// @ts-expect-error Property 'collection' is protected and only accessible within class 'GlobalRepository<T>' and its subclasses.`

#### `eslint-disable` (0 total)
- None.

---

## 9. CI Workflow (`.github/workflows/ci.yml`)

### 9.1 File Content
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  validate:
    name: Validate, Scripts, Lint, Typecheck, Test, E2E
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Cache MongoDB Binary
        uses: actions/cache@v4
        with:
          path: |
            ~/.cache/mongodb-binaries
            ${{ github.workspace }}/.tmp/mongodb-binaries
          key: ${{ runner.os }}-mongodb-7.0.14
          restore-keys: |
            ${{ runner.os }}-mongodb-

      - name: Install Playwright Browsers
        run: npx playwright install --with-deps chromium

      - name: Script Check (No-Op & Echo Checker)
        run: pnpm run check:scripts

      - name: Typecheck
        run: pnpm run typecheck

      - name: Lint
        run: pnpm run lint

      - name: Unit & Contract Tests
        run: pnpm run test

      - name: E2E Tests
        run: pnpm run test:e2e

  security:
    name: Security Scan & Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Production Dependency Security Audit
        run: pnpm audit --prod --audit-level=high

      - name: Run Secret Scan
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  build:
    name: Build & Preview Deploy
    runs-on: ubuntu-latest
    needs: validate
    steps:
      - uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Build
        run: pnpm -r --if-present run build
```

### 9.2 Execution Status
**CI has not run.** In accordance with non-negotiable user instructions ("Do not push"), no commits have been pushed to remote branches.

---

## 10. `git ls-files` Untracked Check

Execution of `git ls-files` verifying that build artifacts, temporary directories, local data directories, and environment secret files are not tracked in git:

```bash
git ls-files -- dist .tmp .dev-data .env .env.local "*/dist" "*/*/.tmp"
```
**Output**: Empty (0 files returned).

Filtering all tracked repository files:
```powershell
git ls-files | Where-Object { $_ -match '(^|/)dist/' -or $_ -match '(^|/)\.tmp/' -or $_ -match '(^|/)\.dev-data/' -or $_ -match '^\.env$' -or $_ -match '^\.env\.local$' }
```
**Output**: Empty (0 files returned).

---

## 11. Spec Documents Verification in `docs/spec`

Output of `git ls-files docs/spec`:
```text
docs/spec/Digital_Identity_Platform_Architecture.png
docs/spec/OneBridge Grid PRD v1.1.pdf
docs/spec/OneBridge_Card_Artwork_With_Bleed.pdf
docs/spec/OneBridge_Grid_Ecosystem.pptx
docs/spec/OneBridge_Grid_PRD.docx
docs/spec/OneBridge_Grid_PRD.pdf
docs/spec/OneBridge_Grid_UI_UX_Specification.pdf
docs/spec/OneBridge_Printed_Card_Designs.pdf
docs/spec/README.md
docs/spec/decisions.md
docs/spec/images/ob-ui-01-visitor-card.png
docs/spec/images/ob-ui-02-my-card-pwa.png
docs/spec/images/ob-ui-03-admin-handover.png
docs/spec/ob-card-designs-overview.png
```

All four original source documents (`Digital_Identity_Platform_Architecture.png`, `OneBridge_Grid_Ecosystem.pptx`, `OneBridge_Grid_PRD.docx`, `OneBridge_Grid_PRD.pdf`) are tracked and verified present under `docs/spec/`.
