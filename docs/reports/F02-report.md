# F02: Tenancy and Roles Implementation Report

**Feature ID:** F02  
**Feature Name:** Tenancy and Roles  
**Status:** Complete (Audit findings resolved)  
**Date:** 2026-10-11  

---

## Traceability Table

| AC Number | Requirement Description | Status | Test Names | Main Files |
|---|---|:---:|---|---|
| **AC-1** | Every document has `tenantId`. The repository layer adds it to every query. A query without a tenant context throws. | Done | `should throw TenantIsolationError if a repository query lacks a tenantId`<br>`should succeed and isolate data if tenantId is provided`<br>`should enforce complete data isolation between tenants in all repository queries (Cross-Tenant Isolation & AC-1)`<br>`should enforce tenant isolation in InMemoryMembershipRepository` | [tenant.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/shared/src/tenant.ts)<br>[in-memory-membership.repository.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/identity/src/infrastructure/repositories/in-memory-membership.repository.ts) |
| **AC-2** | Roles: Super Admin (platform), Company Owner, Company Admin, Branch Manager, Department Manager, Team Lead, Employee, Viewer/Auditor. | Done | `should correctly enumerate all 8 standard platform and company roles (AC-2)` | [roles.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/shared/src/rbac/roles.ts) |
| **AC-3** | Permissions follow the matrix in PRD v1.0 section 15. Scope (own branch, department, team, own records) is enforced server-side. Denies access by default when scope context is missing. | Done | `should permit Owner full company-wide access including billing:manage (AC-3)`<br>`should permit Admin company-wide access but restrict billing to read-only (AC-3)`<br>`should restrict Branch Manager actions to assigned branch scope and deny on missing context (AC-3)`<br>`should restrict Department Manager actions to assigned department scope and deny on missing context (AC-3)`<br>`should restrict Team Lead actions to assigned team scope and deny on missing context (AC-3)`<br>`should restrict Employee to own card and own leads, and deny on missing context (AC-3)`<br>`should restrict Viewer to read-only capabilities and deny all mutations (AC-3)`<br>`should validate scope and permission for @RequirePermission` | [roles.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/shared/src/rbac/roles.ts)<br>[guard.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/shared/src/rbac/guard.ts) |
| **AC-4** | A person can hold roles in more than one company. The active company is explicit on every request. Cross-company access is denied. | Done | `should return person and all company memberships on GET /me (AC-4)`<br>`should return memberships: [] and undefined activeTenant when person has 0 memberships (AC-4)`<br>`should explicitly switch active tenant based on X-Tenant-Id header (AC-4)`<br>`should reject cross-company access when user has no membership in requested tenant (AC-4, AC-6)` | [rbac.service.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/identity/src/application/rbac.service.ts)<br>[me.controller.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/identity/src/presentation/me.controller.ts) |
| **AC-5** | Super Admin impersonation is out of this feature (see ops console). | Done | `should treat Super Admin standard roles without active impersonation in F02 (AC-5)` | [roles.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/shared/src/rbac/roles.ts) |
| **AC-6** | Denied requests return 403 with problem+json and are logged. | Done | `should reject cross-company access when user has no membership in requested tenant (AC-4, AC-6)`<br>`should log security authorization failure without personal data (AC-6)`<br>`should throw 403 ProblemException when role does not match @RequireRole`<br>`should throw 403 ProblemException when membership is missing on guarded route` | [guard.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/shared/src/rbac/guard.ts)<br>[me.controller.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/identity/src/presentation/me.controller.ts)<br>[rbac.service.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/identity/src/application/rbac.service.ts) |

---

## Audit Findings Resolved (from `docs/reviews/F02-review.md`)

1. **Permissive Scope Fallback Fixed (Audit Finding 1):** In `packages/shared/src/rbac/roles.ts`, scoped roles (`branch_manager`, `department_manager`, `team_lead`, `employee`) now strictly deny by default (`return false`) when the required target resource identifier (`branchId`, `departmentId`, `teamId`, `ownerPersonId`) is absent.
2. **NestJS Guard & Route Decorators Implemented (Audit Finding 2):** In `packages/shared/src/rbac/guard.ts`, implemented `RbacGuard`, `@RequirePermission(...)`, and `@RequireRole(...)` checking execution context and request headers/params, throwing standard `ProblemException(403)` on denial.
3. **Idempotency Enforcement on Internal Memberships (Audit Finding 3):** In `services/identity/src/presentation/me.controller.ts`, wired `CacheStore` caching and 422 ProblemException payload conflict detection to `POST /internal/memberships`.
4. **Tenant Validation on Repository Operations (Audit Finding 4):** In `services/identity/src/infrastructure/repositories/in-memory-membership.repository.ts`, enforced tenant ID checks on `save` and `findByPersonAndOrg`, throwing `TenantIsolationError` if tenant ID is empty.
5. **Design Tokens Compliance (Audit Finding 5):** In `apps/web-app/src/features/rbac/NoPermissionPage.tsx` and `CompanySwitcher.tsx`, replaced all ad-hoc Tailwind slate classes with ui-kit tokens (`border-sand-border`, `bg-warm-paper`, `bg-sand`, `text-charcoal`). Orange is strictly used as fill on buttons (`ActionButton`) and Deep Orange `#A04E08` (`text-deep-orange`) on text.
6. **Eliminated Hardcoded Strings in UI (Audit Finding 6):** Parameterized all button, badge, and helper text across `NoPermissionPage` and `CompanySwitcher` into customizable `labels` props for full i18n support.
7. **Expanded Test Coverage (Audit Finding 7):** Separated Owner and Admin into dedicated tests in `rbac.spec.ts`; added tests for all 8 roles individually; added deny-by-default scope tests; added integration tests for `RbacGuard`, zero-membership `GET /me`, and idempotency conflict handling; and added UI tests for custom labels and empty states.

---

## Commands Run and Results

| Command | Exit Code | Result |
|---|:---:|---|
| `pnpm --filter @onebridge/api-contracts run contracts:gen` | 0 | **Pass** (Generated client types from `openapi.yaml`) |
| `pnpm --filter @onebridge/shared test` | 0 | **Pass** (9 tests passed across 6 test files) |
| `pnpm --filter @onebridge/identity test` | 0 | **Pass** (61 tests passed across 8 test files) |
| `pnpm --filter web-app test` | 0 | **Pass** (17 tests passed across 2 test files) |
| `pnpm --filter @onebridge/ui-kit test` | 0 | **Pass** (7 tests passed across 2 test files) |
| `pnpm typecheck` | 0 | **Pass** (0 TypeScript errors across all workspace packages) |
| `pnpm lint` | 0 | **Pass** (0 ESLint errors across the workspace) |
| `pnpm test` | 0 | **Pass** (all 94 workspace tests passing green) |

---

## Decisions Made (Class B Only) & Assumptions
- **`X-Tenant-Id` Request Header:** Used `X-Tenant-Id` request header for explicit active tenant designation on authenticated requests. If omitted on `GET /me`, defaults to the caller's primary/first membership (or undefined if 0 memberships).
- **Scope Modeling on Membership:** Modeled membership scopes with optional `branchId`, `departmentId`, and `teamId` attributes, evaluated server-side by `hasPermission(membership, capability, resourceContext)` directly conforming to PRD v1.0 Section 15 with fail-closed default.
- **Zero PII on Audit Emission:** Security denial event (`audit.recorded`) logs exclusively `{ action: 'authorization.denied', personId, targetTenantId, reason }` with request `correlationId`. Zero personal data (phone, name, email) is ever emitted or logged.

---

## Contract Changes Actually Made
- **`packages/api-contracts/openapi.yaml`**:
  - Added endpoint `GET /me`: Secured with `BearerAuth`, accepts optional `X-Tenant-Id` header, returns `MeResponse` containing person profile, memberships array, and active tenant context with role, permissions, and scope.
  - Added internal endpoint `POST /internal/memberships`: Synchronous membership creation/update with idempotency key support.
  - Added schemas: `Role` enum (8 roles), `Scope`, `Membership`, `ActiveTenantContext`, `MeResponse`.
  - Added `securitySchemes`: `BearerAuth` (HTTP Bearer JWT).

---

## Known Limitations and Follow-ups
- **Super Admin Impersonation:** Per AC-5 and resolved decision T9, impersonation is intentionally isolated from F02 and will be implemented in the internal ops console (F25) with consented time-bound grants.
- **Custom Roles:** Custom roles are enterprise-tier only and deferred per the feature specification.
