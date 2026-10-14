# Step 2 Exit Gate Review

**Step:** Step 2 — Organisation  
**Features Included:** F06 Company Onboarding, F03 Business ID, F07 Org Structure (Branches, Departments, Teams), F08 Seats and People, F09 Brand Kit, F04 Audit Log  
**Date:** 2026-10-13  
**Status:** **NOT MET (Blocked on `test:e2e` Next.js Webpack Import Extension Defect)**  

---

## 1. Step 2 Exit Gate Conditions Check

Per `docs/onebridge-spec-pack/docs/PLAN.md` (Row 12), the Step 2 exit gate mandates:

> *"A new company can sign up, get an Owner membership before the first response returns, create branches and seats, set a brand kit with contrast protection, and see audit entries."*

| # | Exit Gate Condition | Status | Evidence (File, Line, and Test Name) |
|---|---|:---:|---|
| 1 | **A new company can sign up** | **Met** | `services/organization/src/application/organization.service.ts:102-177` (`createOrganization`) generates opaque ULID `tenantId`, unique Crockford Base32 `businessId` (`OB-XXXXXX`) with collision retry loop, and saves organization.<br>**Test Evidence:** `services/organization/tests/organization-http.spec.ts:38` (`POST /orgs creates organization and returns 201 Created`). |
| 2 | **Get an Owner membership before the first response returns** | **Met** | `services/organization/src/application/organization.service.ts:145-168` invokes `this.identityClient.createInitialMembership({ tenantId, personId, role: 'owner' })` synchronously prior to returning HTTP 201 Created. If Identity fails, the issued Business ID is voided and the endpoint fails with 503.<br>**Test Evidence:** `services/organization/tests/organization-http.spec.ts:77` (`POST /orgs calls identityClient to create initial Owner membership synchronously before returning`). |
| 3 | **Create branches** | **Met** | `services/organization/src/application/org-structure.service.ts:60-105` (`createBranch`) mints monotonic derived branch IDs (`OB-XXXXXX-B01`) via `CounterService` and enforces plan branch limits server-side.<br>**Test Evidence:** `services/organization/tests/structure.spec.ts:39` (`creates a branch with derived branch ID`). |
| 4 | **Create seats** | **Met** | `services/organization/src/application/seats.service.ts:93-165` (`createSeat`) mints monotonic derived seat IDs (`OB-XXXXXX-E0001`), binds digital card URL/NFC chip metadata, and enforces plan seat limits.<br>**Test Evidence:** `services/organization/tests/seats.spec.ts:46` (`AC-1: Seat attributes and bindings` - `creates a seat with derived seat ID and default status`). |
| 5 | **Set a brand kit with contrast protection** | **Met** | `services/organization/src/application/brand-kit.service.ts:70-176` (`updateBrandKit`) invokes `evaluateBrandContrast(band, text)`. Rejects non-accessible contrast with 400 Bad Request RFC 7807 problem details or auto-picks readable text when `acceptAutoPick: true`.<br>**Test Evidence:** `services/organization/tests/brand-kit.spec.ts:70, 94` (`validates contrast WCAG AA 4.5:1 on brandColours and rejects with 400 Bad Request`, `auto-picks readable text colour when acceptAutoPick is true`). |
| 6 | **See audit entries** | **Met** | `services/organization/src/application/audit-log.service.ts:148-187` (`listAuditLogs`) lists append-only audit entries with plan retention filtering and query filters (`actor`, `action`, `entity`, `startDate`, `endDate`). UI table rendered in `packages/ui-kit/src/components/AuditLogViewer.tsx` and mounted on `apps/web-app/app/dashboard/page.tsx`.<br>**Test Evidence:** `services/organization/tests/audit-log.spec.ts:214-258` (`filters by actor via GET /orgs/:id/audit`, `filters by action`, `filters by entity ID or type`, `filters by date range`). |

---

## 2. Quality Gates Command Outputs

### 2.1 `pnpm lint`
- **Exit Code:** `0`
- **Result:** **Pass**
```text
$ eslint . --ignore-pattern "tests/fixtures/**"
(exited with code 0 - 0 errors, 0 warnings across workspace)
```

### 2.2 `pnpm typecheck`
- **Exit Code:** `0`
- **Result:** **Pass**
```text
$ pnpm -r --if-present run typecheck
Scope: 14 of 15 workspace projects
packages/api-contracts typecheck: Done
packages/shared typecheck: Done
packages/ui-kit typecheck: Done
services/identity typecheck: Done
services/organization typecheck: Done
apps/web-app typecheck: Done
(exited with code 0 - all 14 workspace projects typechecked cleanly)
```

### 2.3 `pnpm test`
- **Exit Code:** `0`
- **Result:** **Pass**
- **Test Summary:** 389 passed across 54 test files (100% green)
```text
Test Suites Breakdown:
- @onebridge/shared:       55 passed (11 test files)
- @onebridge/ui-kit:       32 passed (2 test files, including jest-axe accessibility)
- @onebridge/identity:    124 passed (23 test files)
- @onebridge/organization: 115 passed (8 test files)
- @onebridge/web-app:      56 passed (8 test files)
- Root workspace tests:     7 passed (2 test files)
Total: 389 passed, 0 failed
```

### 2.4 `pnpm test:e2e`
- **Exit Code:** `1`
- **Result:** **Fail (Blocked on Webpack Module Resolution in UI Kit Components)**
- **Failure Output:**
```text
$ playwright test
[WebServer] $ tsc -p tsconfig.json
[WebServer] $ next dev -p 3000
[WebServer]  ⨯ ../../packages/ui-kit/src/components/AuditLogViewer.tsx:2:1
[WebServer] Module not found: Can't resolve './ActionButton.js'
[WebServer]   1 | import React, { useState, useEffect } from 'react';
[WebServer] > 2 | import { cn, ActionButton } from './ActionButton.js';
[WebServer]     | ^
[WebServer]   3 |
[WebServer]   4 | export interface AuditLogItem {
[WebServer]   5 |   id: string;
[WebServer] 
[WebServer] https://nextjs.org/docs/messages/module-not-found
[WebServer] 
[WebServer] Import trace for requested module:
[WebServer] ../../packages/ui-kit/src/components/index.tsx
[WebServer] ../../packages/ui-kit/src/index.ts
[WebServer] ./src/features/auth/AuthFlow.tsx
[WebServer] ./app/login/page.tsx
Error: Timed out waiting 120000ms from config.webServer.
```
- **Root Cause Analysis:**
  In `packages/ui-kit/src/components/AuditLogViewer.tsx:2`, `SeatsManagement.tsx:2`, `OrgStructure.tsx:2`, and `BrandKitManager.tsx:2`, the import statement uses:
  `import { cn, ActionButton } from './ActionButton.js';`
  Next.js App Router Webpack does not resolve `.js` file extensions to TypeScript JSX (`ActionButton.tsx`) within symlinked workspace packages without extensionless import syntax (`from './ActionButton'`). When `apps/web-app` attempts to compile `/login` (which imports from `@onebridge/ui-kit`), Webpack fails with `Module not found`, causing Next.js dev server startup to hang and Playwright webServer initialization to timeout after 120 seconds.

---

## 3. Open Items in `docs/questions.md`

Every open question currently in `docs/questions.md` is catalogued below, along with the later features it impacts:

| Question ID | Title & Class | Context Summary | Status | Later Features Affected |
|---|---|---|:---:|---|
| **Q-11** | Dark Mode Tokens for UI Kit (Class C) | `F05-ui-kit-tokens.md` AC-4 mandates dark mode tokens, but specific hex codes for dark mode (Dark Charcoal, Dark Paper, Dark Sand) were not provided in design specs. Proposed generating standard accessible dark palette. | **Open** (Pending approval) | **F05** (finalizing CSS variables in ui-kit), **F12** (visitor card themes), **F24** (My Card PWA dark theme), **F26** (public company profile). |
| **Q-12** | Visual Snapshot Testing Strategy (Class C) | `F05` "Tests required" lists visual snapshot tests. Proposed local DOM/HTML snapshot testing using Vitest/Storybook test runner rather than cloud SaaS (Chromatic/Percy) for Phase 1. | **Open** (Pending approval) | **F05** (Storybook visual regression workflow), CI gate automation, **F12** & **F24** visual budget testing. |
| **Q-13** | Self-Hosted Font Delivery Strategy (Class C) | `F05` AC-3 mandates Manrope self-hosted with Noto Sans Devanagari fallback. Proposed hosting font `.woff2` files in consuming applications (`web-app`, `web-public`) `public/fonts` directories rather than bundling within `@onebridge/ui-kit`. | **Open** (Pending approval) | **F05** (ui-kit font asset publishing), **F12** (`web-public` font hosting), **F24** (`web-app` PWA font caching in Serwist service worker). |
| **Q-14** | Single Person Multiple Seats Policy (Class C) | `F08` AC-1 states "A person is assigned to a seat." Clarification needed whether a single person ID can be assigned to multiple active seats within the same company simultaneously (e.g. dual roles). | **Open** (Pending approval) | **F08** (seats), **F14** (invite claim flow), **F15** (CSV bulk import), **F16** (offboarding). |

---

## 4. Exit Gate Summary & Next Remediation Step

- **Functional Exit Criteria:** **All 6 Met** (Company signup, synchronous Owner membership, branch creation, seat creation, brand kit contrast protection, and audit log inspection).
- **Unit & Integration Quality Gates:** `pnpm lint`, `pnpm typecheck`, `pnpm test` **Passed (100% Green)**.
- **E2E Gate:** **Failed** due to `.js` extension import mismatch in UI Kit components (`AuditLogViewer.tsx`, `SeatsManagement.tsx`, `OrgStructure.tsx`, `BrandKitManager.tsx`).

### Required Fix to Pass Step 2 Exit Gate:
Update `ActionButton.js` imports to extensionless `from './ActionButton'` across the four UI Kit component files so Next.js Webpack can resolve `ActionButton.tsx`.
