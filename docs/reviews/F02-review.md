# F02: Tenancy and Roles — Audit & Review

**Date:** 2026-10-11  
**Auditor:** Independent Code Agent  
**Target:** Feature F02 (Tenancy and Roles)  
**Status:** Audit Complete  

---

## 1. Acceptance Criteria Check

| AC | Requirement | Status | Evidence & Defects |
|---|---|:---:|---|
| **AC-1** | Every document has `tenantId`. The repository layer adds it to every query. A query without a tenant context throws. | **Partial / Wrong** | `packages/shared/tests/tenant-isolation.spec.ts` verifies `findMany` throws without `tenantId`. However: (1) `InMemoryMembershipRepository.findByPersonId` ([in-memory-membership.repository.ts:9](file:///d:/Onebridge%20projects/Onebridge%20grid/services/identity/src/infrastructure/repositories/in-memory-membership.repository.ts#L9)) queries directly without tenant context or throwing; (2) `save` in `InMemoryMembershipRepository` does not validate that `tenantId` is present before writing. |
| **AC-2** | Roles: Super Admin (platform), Company Owner, Company Admin, Branch Manager, Department Manager, Team Lead, Employee, Viewer/Auditor. | **Verified** | `rbac.spec.ts` (`should correctly enumerate all 8 standard platform and company roles (AC-2)`). Verified in `packages/shared/src/rbac/roles.ts:1-10`. |
| **AC-3** | Permissions follow the matrix in PRD v1.0 section 15. Scope (own branch, department, team, own records) is enforced server-side. | **Partial / Wrong** | While `rbac.spec.ts` tests positive/negative scoped assertions, `hasPermission` ([roles.ts:260, 265, 270, 275](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/shared/src/rbac/roles.ts#L260-L275)) contains a security defect: when `resourceContext` or its scope ID is omitted (`!resourceContext?.branchId`), it returns `true` for scoped roles instead of denying access. |
| **AC-4** | A person can hold roles in more than one company. The active company is explicit on every request. Cross-company access is denied. | **Verified** | Verified in `me-api.spec.ts` (`should return person and all company memberships on GET /me (AC-4)`, `should explicitly switch active tenant based on X-Tenant-Id header (AC-4)`) and `tenancy-isolation.spec.ts` (`should reject cross-company access when user has no membership in requested tenant (AC-4, AC-6)`). |
| **AC-5** | Super Admin impersonation is out of this feature (see ops console). | **Verified** | Verified in `rbac.spec.ts` (`should treat Super Admin standard roles without active impersonation in F02 (AC-5)`). Super Admin permissions are strictly bounded and impersonation is deferred to F25. |
| **AC-6** | Denied requests return 403 with problem+json and are logged. | **Verified** | Verified in `tenancy-isolation.spec.ts` (`should reject cross-company access when user has no membership in requested tenant (AC-4, AC-6)`, `should log security authorization failure without personal data (AC-6)`). Returns RFC 7807 403 with `correlationId` and logs audit event without PII. |

---

## 2. Rule Violations (AGENTS.md Section 3)

| Rule | Status | Evidence |
|---|:---:|---|
| **Every query and document carries tenantId** | **Fail** | `InMemoryMembershipRepository.findByPersonId` and `findByPersonAndOrg` bypass tenant check. `InMemoryMembershipRepository.save` does not check for missing tenantId before saving. |
| **Server-side authorisation** | **Fail** | `hasPermission` in `roles.ts` grants permission (`return true`) if `resourceContext?.branchId` (or dept/team/owner) is omitted, allowing unauthorized scoped actions if caller omits resource context. |
| **Seats belong to company** | **Pass** | N/A to F02. |
| **No personal data in logs/events** | **Pass** | Verified in `tenancy-isolation.spec.ts`: audit denial payload contains only `{ action, personId, targetTenantId, reason }`; no name, phone, or email logged. |
| **Phone/email of visitors encrypted at rest** | **Pass** | N/A to F02. |
| **Access token in memory / Refresh cookie / No localStorage** | **Pass** | No localStorage used in `web-app` RBAC components. |
| **Student ID images to separate encrypted bucket** | **Pass** | N/A to F02. |
| **Record consent with timestamp** | **Pass** | N/A to F02. |
| **Short links immutable** | **Pass** | N/A to F02. |
| **Disabled chips resolve to neutral page** | **Pass** | N/A to F02. |
| **Contract first: change OpenAPI before code** | **Pass** | `openapi.yaml` updated and client types generated before implementation. |
| **Idempotency on write endpoints** | **Fail** | `POST /internal/memberships` accepts `_idempotencyKey?: string` in [me.controller.ts:52](file:///d:/Onebridge%20projects/Onebridge%20grid/services/identity/src/presentation/me.controller.ts#L52) but never caches or validates it against `CacheStore`. |
| **Modules never read each other's DB** | **Pass** | `services/identity` and `packages/shared` access only their own boundaries. |
| **Errors use application/problem+json** | **Pass** | Denials throw `ProblemException` mapped to RFC 7807 problem details with `correlationId`. |
| **Lists are paginated** | **Pass** | `memberships` on `GET /me` is a small bounded set representing the caller's own company memberships. |
| **Correlation ID on every request** | **Pass** | Passed into `getMe`, `ProblemException`, and audit event. |
| **Additive changes only** | **Pass** | All OpenAPI schema additions were strictly additive. |
| **Feature flag for unfinished features** | **Pass** | Core RBAC is complete; custom roles marked out of scope. |
| **Design tokens from ui-kit only** | **Fail** | [NoPermissionPage.tsx:35](file:///d:/Onebridge%20projects/Onebridge%20grid/apps/web-app/src/features/rbac/NoPermissionPage.tsx#L35) and [CompanySwitcher.tsx:82, 98, 108](file:///d:/Onebridge%20projects/Onebridge%20grid/apps/web-app/src/features/rbac/CompanySwitcher.tsx#L82) use default Tailwind palette classes (`border-slate-200`, `border-slate-300`, `bg-slate-100`, `hover:bg-slate-50`) instead of tokens (`border-sand-border`, `bg-sand`, `bg-warm-paper`). |
| **Orange never as text colour** | **Pass** | `CompanySwitcher.tsx` uses `text-deep-orange` for text links/checkmarks and `bg-bridge-orange` for buttons. |
| **Touch targets 44px or more** | **Pass** | Verified with `min-h-[44px]` on all action buttons and dropdown options. |
| **No hard-coded strings (i18n)** | **Fail** | [NoPermissionPage.tsx:36, 45](file:///d:/Onebridge%20projects/Onebridge%20grid/apps/web-app/src/features/rbac/NoPermissionPage.tsx#L36) contains hardcoded English strings: `"Restricted"`, `"Role: "`. [CompanySwitcher.tsx:80](file:///d:/Onebridge%20projects/Onebridge%20grid/apps/web-app/src/features/rbac/CompanySwitcher.tsx#L80) contains hardcoded `"Select Company: "`. |

---

## 3. Invented Behaviour

1. **Permissive Fallback on Scoped Roles:** `hasPermission` in `packages/shared/src/rbac/roles.ts:260-277` defaults to `return true` when scope IDs are missing in `resourceContext`. This was not requested and introduces a security defect for scoped roles.
2. **Ignored Idempotency Parameter:** `MeController.createInternalMembership` accepts `_idempotencyKey?: string` but discards it without caching.

---

## 4. Missing States or Tests

1. **Missing NestJS Guard & Decorators:** F02 specification lines 19-20 explicitly state: `"Guard and decorator on every service."`. `packages/shared/src/rbac/guard.ts` only exports a standalone helper function `assertPermission`, with no NestJS `CanActivate` guard and no `@RequireRole` or `@RequirePermission` decorators.
2. **Missing Individual Tests per Role:** Feature spec states `"One test per role against the permission matrix"`. Currently, Company Owner and Company Admin share a single test in `rbac.spec.ts`.
3. **Missing Empty Membership State Test:** `GET /me` when a registered person has 0 memberships (newly registered user prior to company invite/onboarding) is not tested in `me-api.spec.ts`.

---

## 5. Report Accuracy

- **Claim on AC-1:** Report marks AC-1 as "Done". However, `InMemoryMembershipRepository` does not enforce tenant ID check on `findByPersonId`, and `save` does not throw when tenant ID is absent.
- **Claim on AC-3:** Report marks AC-3 as "Done". However, `hasPermission` permits scoped users to perform unscoped actions when `resourceContext` is omitted (`!resourceContext?.branchId`).
- **Claim on Design Tokens:** Report states tokens were strictly adhered to. However, `border-slate-200`, `border-slate-300`, and `bg-slate-100` are hardcoded Tailwind default palette classes rather than `@onebridge/ui-kit` design tokens (`sand`, `sand-border`, `warm-paper`).
- **Claim on Idempotency:** Report claims write endpoints accept idempotency keys; `createInternalMembership` ignores the idempotency key without executing cache checks.

---

## 6. Verification Commands & Results

| Command | Exit Code | Result |
|---|:---:|---|
| `pnpm lint` | 0 | **Pass** (0 ESLint errors) |
| `pnpm typecheck` | 0 | **Pass** (0 TypeScript errors across all 14 workspace packages) |
| `pnpm test` | 0 | **Pass** (82/82 tests passed across workspace: 52 identity, 14 web-app, 9 shared, 7 ui-kit) |

---

## 7. Verdict & Required Fixes

**Verdict:** **Accept with fixes**

### Required Fixes:
1. **Fix Permissive Scope Defect in `hasPermission` (AC-3, Security Rule):**
   - In `packages/shared/src/rbac/roles.ts`, scoped roles (`branch`, `department`, `team`, `own`) must strictly require a matching `resourceContext` identifier. If `resourceContext` or the required scope ID is missing, `hasPermission` must return `false` (deny by default).
2. **Implement NestJS RBAC Guard and Decorators (Feature Spec lines 19-20):**
   - Provide `@RequirePermission(capability: Capability)` and `@RequireRole(role: Role)` decorators and a corresponding `RbacGuard` in `packages/shared/src/rbac/guard.ts`.
3. **Enforce `Idempotency-Key` on `POST /internal/memberships` (Rule 12):**
   - Integrate `IdempotencyInterceptor` / `CacheStore` in `MeController.createInternalMembership` so repeated calls with the same key replay the cached result or return 422 ProblemDetails on body divergence.
4. **Enforce Tenant Context in `InMemoryMembershipRepository` (AC-1, Rule 1):**
   - Ensure `save` throws `TenantIsolationError` if `tenantId` (or `orgId`) is missing.
   - Clarify or partition person-level membership queries so tenant isolation rules remain consistent.
5. **Replace Slate Classes with Design Tokens (Design Rule):**
   - In `NoPermissionPage.tsx` and `CompanySwitcher.tsx`, replace `border-slate-200`, `border-slate-300`, `bg-slate-100`, `hover:bg-slate-50` with `border-sand-border`, `bg-sand/30`, `hover:bg-sand/50`, and `bg-warm-paper`.
6. **Eliminate Hardcoded Strings in UI Components (i18n Rule):**
   - In `NoPermissionPage.tsx`, move `"Restricted"` and `"Role: "` into `labels` (`labels.restrictedBadge`, `labels.rolePrefix`).
   - In `CompanySwitcher.tsx`, move `"Select Company: "` into `labels.selectCompanyPrefix`.
7. **Strengthen Role-by-Role Permission Matrix Unit Tests (Spec requirement):**
   - Ensure `rbac.spec.ts` has dedicated test cases for each of the 8 roles individually against the Section 15 matrix.
