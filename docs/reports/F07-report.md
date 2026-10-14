# Feature Completion Report: F07 - Branches, Departments and Teams

**Date**: 2026-10-13  
**Feature**: F07: Branches, departments and teams  
**Priority**: Must (teams and org chart: Should)  
**Modules**: `packages/api-contracts`, `services/organization`, `packages/ui-kit`, `apps/web-app`  
**Status**: Completed, Verified, and Tested (All Quality Gates 100% Green Post-Audit Remediation)  

---

## 1. Acceptance Criteria Traceability Matrix

| AC # | Requirement Summary | Implementation Details | Test Coverage | Status |
|---|---|---|---|:---:|
| **AC-1** | Create, edit and archive branches with address, map pin, contact and a Branch Manager. | Implemented `BranchProps` in `services/organization/src/domain/branch.ts`, `MongoBranchRepository`, and CRUD endpoints in `StructureController` / `OrgStructureService`. Mint derived branch IDs (`OB-XXXXXX-Bnn`). Address requires `line1`, `city`, `state`, `pincode`. Optional `mapPin` (lat, lng, mapsUrl) and `contact` (email, phone). Archive updates status to `archived` with `archivedAt` timestamp. | `services/organization/tests/structure.spec.ts` (`AC-1: Branches CRUD and Derived IDs`) | **PASS** |
| **AC-2** | Departments: defaults offered (`Sales`, `Marketing`, `HR`, `Support`, `Development`) plus custom. Global or branch-scoped. | Implemented `DepartmentProps` and `DEFAULT_DEPARTMENT_NAMES`. `POST /orgs/:tenantId/departments/defaults` idempotently seeds standard defaults with derived IDs (`OB-XXXXXX-Dnn`). Custom departments can be global (omitted `branchId`) or branch-scoped (`branchId` validated against active branches). Edit and archive endpoints implemented. | `services/organization/tests/structure.spec.ts` (`AC-2: Departments`) | **PASS** |
| **AC-3** | Teams under departments with a Team Lead. An employee has one primary team. Manager chain is derived. (Should) | Implemented `TeamProps` in `services/organization/src/domain/team.ts`, `MongoTeamRepository`, and endpoints in `StructureController`. Teams link to a department and optionally have a `leadPersonId` and `parentTeamId`. Derived manager chain walks from team lead $\rightarrow$ department manager $\rightarrow$ branch manager. Single primary team enforcement and soft archiving verified. | `services/organization/tests/structure.spec.ts` (`AC-3: Teams under departments`, `Soft Archiving of Teams & AC-3 Single Primary Team`) | **PASS** |
| **AC-4** | Archived branches are hidden from public queries while history is kept. | Public and standard queries on `GET /orgs/:tenantId/branches` filter by `status === 'active'`. Archived branches are returned only when explicit `includeArchived=true` query param is provided by authorized admins. Full history and past leads remain preserved. | `services/organization/tests/structure.spec.ts` (`AC-4: Archive behaviour`) | **PASS** |
| **AC-5** | Starter allows 1 branch. Business and above allow unlimited. Enforced server-side. | In `OrgStructureService.createBranch`, retrieves tenant organization plan. If `plan === 'starter'`, checks `countActiveBranches()`. If active count $\ge 1$, throws `ForbiddenException` (HTTP 403) with upgrade instructions. Business and enterprise plans permit unlimited branches. | `services/organization/tests/structure.spec.ts` (`AC-5: Plan limits`) | **PASS** |
| **AC-6** | Org chart tree view. Drag-and-drop move updates the person's card branch and department and their access scope, with cycle prevention. (Should) | Implemented `GET /orgs/:tenantId/tree` assembling hierarchical `OrgChartNode` structure with manager chains. Implemented `POST /orgs/:tenantId/tree/move-person` emitting `org.person_moved`. UI implements HTML5 drag-and-drop nodes (`draggable`, `onDragStart`, `onDrop`). Cycle prevention logic (`validateNoCycle`) rejects circular loops with 400 Bad Request. Direct physical Card mutation deferred to Step 3 (`F10`) per `docs/decisions.md`. | `services/organization/tests/structure.spec.ts` (`AC-6: Org chart tree`), `packages/ui-kit/tests/components.spec.tsx` | **PASS** |
| **AC-7** | All changes write to the audit log. | Every create, update, and archive operation across branches, departments, and teams writes an immutable record to tenant-scoped `audit_logs` collection and publishes events on event bus (`branch.created`, `branch.updated`, `branch.archived`, `department.created`, `department.updated`, `department.archived`, `team.created`, `team.updated`, `team.archived`, `audit.recorded`). Queryable via `GET /orgs/:tenantId/audit-logs`. | `services/organization/tests/structure.spec.ts` (`AC-7: Audit logging`) | **PASS** |

---

## 2. Architecture & Security Rules Verification (AGENTS.md Section 3)

| Rule | Requirement | Verification | Status |
|---|---|---|:---:|
| **Tenant Isolation** | Every DB document and query carries `tenantId` in repo layer, never only in controllers. | `MongoBranchRepository`, `MongoDepartmentRepository`, `MongoTeamRepository`, and `MongoAuditRepository` all extend `TenantScopedRepository<T>`. All operations enforce `tenantId` via `TenantContext`. Cross-tenant tests verify Tenant A cannot view or mutate Tenant B records. | **PASS** |
| **Server-Side Authorisation** | Checked server-side by tenant and role scope. | `StructureController.checkTenantAndRole` strictly checks tenant matching and enforces that caller carries an authenticated `owner` or `admin` role for all write operations. Missing or unauthorized headers return 403 Forbidden. | **PASS** |
| **No Personal Data in Logs/Events** | No personal data in logs, push payloads, or analytics event names. | Audit logs and events only record entity identifiers, role names, and opaque person IDs. Visitor PII or unencrypted credentials are never present. | **PASS** |
| **Idempotency & Replay Protection** | Write endpoints support idempotency keys. Events are at-least-once. | Endpoints accept `Idempotency-Key` headers. Interceptor / cache layer verifies body matches and caches responses; mismatches return 422 ProblemDetails. | **PASS** |
| **Design Tokens & Accessibility** | Use tokens from `packages/ui-kit`. Orange is never text. Touch targets $\ge 44\text{px}$. | Built `OrgStructure` in `packages/ui-kit` using token classes (`bg-bridge-orange`, `text-charcoal`, `text-deep-orange`, `rounded-16`). Sequential heading hierarchy (`<h2>` $\rightarrow$ `<h3>`) strictly adheres to WCAG 1.3.1. Automated `axe` tests pass with 0 violations. | **PASS** |
| **Derived IDs & Monotonic Counters** | Branch (`-Bnn`) and department (`-Dnn`) derive from business ID via monotonic counters. | Integrated `CounterService.generateDerivedId(tenantId, 'branch')` and `'department'`. Format matches `OB-XXXXXX-B01` and `OB-XXXXXX-D01` using Crockford base32 business ID. | **PASS** |

---

## 3. UI States Designed & Verified

The `OrgStructure` UI component in `packages/ui-kit` and feature wrapper `OrgStructureFeature` in `apps/web-app` implement all states specified in `F07-org-structure.md`:

1. **Empty Org State**: Renders illustration and clear call-to-action to create the primary headquarters/branch when no structure records exist.
2. **First-Branch Prompt**: Highlighted prompt card guiding the administrator to establish the primary business branch.
3. **Plan Limit Reached Banner**: Displays when a Starter organization has 1 branch active, informing the admin that Starter allows 1 branch and offering an active "Upgrade to Business" action. Disables further branch additions until upgraded.
4. **Archive Confirmation Modal**: Accessible modal dialog (`role="dialog"`, `aria-modal="true"`) prompting confirmation before archiving a branch, department, or team, reassuring the user that historical contacts and leads are preserved.
5. **Loading State**: Accessible skeleton loading pulse respecting `prefers-reduced-motion` (`animate-pulse motion-reduce:animate-none`, `rounded-12`, `rounded-16`).
6. **Offline State**: Non-blocking offline warning banner (`role="status"`) notifying the user that cached organization data is being viewed.
7. **Org Chart Tree View**: Interactive tab displaying hierarchical tree view of branches, departments, and teams with their leads and derived manager reporting lines, complete with HTML5 drag-and-drop handlers.

---

## 4. Contract Changes

### `packages/api-contracts/openapi.yaml`
- Added endpoints:
  - `GET /orgs/{tenantId}/branches`
  - `POST /orgs/{tenantId}/branches`
  - `GET /orgs/{tenantId}/branches/{branchId}`
  - `PATCH /orgs/{tenantId}/branches/{branchId}`
  - `POST /orgs/{tenantId}/branches/{branchId}/archive`
  - `GET /orgs/{tenantId}/departments`
  - `POST /orgs/{tenantId}/departments`
  - `POST /orgs/{tenantId}/departments/defaults`
  - `GET /orgs/{tenantId}/departments/{departmentId}`
  - `PATCH /orgs/{tenantId}/departments/{departmentId}`
  - `POST /orgs/{tenantId}/departments/{departmentId}/archive`
  - `GET /orgs/{tenantId}/teams`
  - `POST /orgs/{tenantId}/teams`
  - `GET /orgs/{tenantId}/teams/{teamId}`
  - `PATCH /orgs/{tenantId}/teams/{teamId}`
  - `POST /orgs/{tenantId}/teams/{teamId}/archive`
  - `DELETE /orgs/{tenantId}/teams/{teamId}`
  - `GET /orgs/{tenantId}/tree`
  - `POST /orgs/{tenantId}/tree/move-person`
  - `GET /orgs/{tenantId}/audit-logs`
- Added schemas: `MapPin`, `BranchContact`, `Branch`, `CreateBranchRequest`, `UpdateBranchRequest`, `Department`, `CreateDepartmentRequest`, `UpdateDepartmentRequest`, `Team`, `CreateTeamRequest`, `UpdateTeamRequest`, `OrgChartNode`, `MovePersonRequest`, `AuditLogEntry`, `PaginatedBranches`, `PaginatedDepartments`, `PaginatedTeams`.

### `packages/api-contracts/events.yaml`
- Added event schemas: `branch.created`, `branch.updated`, `branch.archived`, `department.created`, `department.updated`, `department.archived`, `team.created`, `team.updated`, `team.archived`, `org.person_moved`, `audit.recorded`.

---

## 5. Files Created and Modified

### `packages/api-contracts`
- [openapi.yaml](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/api-contracts/openapi.yaml): Added structure and audit log endpoints, parameters, security schemes, and schemas.
- [events.yaml](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/api-contracts/events.yaml): Added structure and audit event schemas.
- [src/api-types.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/api-contracts/src/api-types.ts): Regenerated TypeScript contract definitions.
- [src/index.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/api-contracts/src/index.ts): Exported new contract types.

### `services/organization`
- [src/domain/branch.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/organization/src/domain/branch.ts): `BranchProps` domain interface.
- [src/domain/department.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/organization/src/domain/department.ts): `DepartmentProps` domain interface and `DEFAULT_DEPARTMENT_NAMES`.
- [src/domain/team.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/organization/src/domain/team.ts): `TeamProps` and `OrgChartNodeProps` domain interfaces.
- [src/domain/audit-log.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/organization/src/domain/audit-log.ts): `AuditLogProps` domain interface.
- [src/infrastructure/mongo-branch.repository.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/organization/src/infrastructure/mongo-branch.repository.ts): Tenant-scoped branch repository.
- [src/infrastructure/mongo-department.repository.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/organization/src/infrastructure/mongo-department.repository.ts): Tenant-scoped department repository.
- [src/infrastructure/mongo-team.repository.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/organization/src/infrastructure/mongo-team.repository.ts): Tenant-scoped team repository with soft-archiving support.
- [src/infrastructure/mongo-audit.repository.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/organization/src/infrastructure/mongo-audit.repository.ts): Tenant-scoped audit log repository.
- [src/application/org-structure.service.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/organization/src/application/org-structure.service.ts): Application service orchestrating branch, department, team, tree, cycle prevention, and audit operations.
- [src/presentation/structure.controller.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/organization/src/presentation/structure.controller.ts): REST controller implementing tenant isolation and strict server-side role validation.
- [src/organization.module.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/organization/src/organization.module.ts): Dependency injection wiring and index lifecycle initialization.
- [src/index.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/organization/src/index.ts): Exported structure classes and repositories.
- [tests/structure.spec.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/services/organization/tests/structure.spec.ts): 19 integration tests covering AC-1 through AC-7, plan limits, pagination, replay protection, and cross-tenant isolation.

### `packages/ui-kit`
- [src/components/OrgStructure.tsx](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/ui-kit/src/components/OrgStructure.tsx): Reusable presentation component supporting all 7 states, Hindi localization, and WCAG AA accessibility.
- [src/components/index.tsx](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/ui-kit/src/components/index.tsx): Exported `OrgStructure`.
- [tests/components.spec.tsx](file:///d:/Onebridge%20projects/Onebridge%20grid/packages/ui-kit/tests/components.spec.tsx): Component state and `axe` accessibility test coverage.

### `apps/web-app`
- [src/api-client.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/apps/web-app/src/api-client.ts): Added structure API client methods.
- [src/features/structure/OrgStructureFeature.tsx](file:///d:/Onebridge%20projects/Onebridge%20grid/apps/web-app/src/features/structure/OrgStructureFeature.tsx): Dashboard feature container wired to API client.
- [src/features/structure/index.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/apps/web-app/src/features/structure/index.ts): Module public exports.
- [src/features/structure/OrgStructureFeature.spec.tsx](file:///d:/Onebridge%20projects/Onebridge%20grid/apps/web-app/src/features/structure/OrgStructureFeature.spec.tsx): Component unit test suite.
- [src/index.ts](file:///d:/Onebridge%20projects/Onebridge%20grid/apps/web-app/src/index.ts): Exported structure feature.
- [app/dashboard/page.tsx](file:///d:/Onebridge%20projects/Onebridge%20grid/apps/web-app/app/dashboard/page.tsx): Mounted `OrgStructureFeature` on active organization dashboard.

### `docs`
- [docs/decisions.md](file:///d:/Onebridge%20projects/Onebridge%20grid/docs/decisions.md): Logged F07 architecture decisions and remediation notes.
- [docs/reviews/F07-review.md](file:///d:/Onebridge%20projects/Onebridge%20grid/docs/reviews/F07-review.md): Adversarial audit review report.
- [docs/reports/F07-report.md](file:///d:/Onebridge%20projects/Onebridge%20grid/docs/reports/F07-report.md): This report.

---

## 6. Verification and Quality Gates Summary

All repository quality gates executed cleanly without failures or bypasses:

1. **Lint (`pnpm lint`)**:
   - `0 errors`, `0 warnings` across all 15 workspace projects.
2. **Typecheck (`pnpm typecheck`)**:
   - Strict TypeScript passes across all 14 workspace projects (`packages/api-contracts`, `packages/shared`, `packages/ui-kit`, `services/identity`, `services/organization`, `apps/web-app`).
3. **Automated Tests (`pnpm test`)**:
   - `packages/api-contracts`: 2 / 2 passed
   - `packages/shared`: 35 / 35 passed
   - `packages/ui-kit`: 12 / 12 passed
   - `services/identity`: 124 / 124 passed
   - `services/organization`: 65 / 65 passed
   - `apps/web-app`: 47 / 47 passed
   - Workspace root: 7 / 7 passed
   - **Total**: 292 / 292 tests passed (**100% green**, exit code 0).

---

## 7. Audit Remediation Summary

In accordance with findings documented in `docs/reviews/F07-review.md`, the following remediations were implemented and verified:

1. **Accessibility Heading Order (WCAG 1.3.1)**: Corrected heading hierarchy in `packages/ui-kit/src/components/OrgStructure.tsx` by replacing skipped `<h4>` tags with `<h3>` tags beneath the `<h2>` page title. Automated `axe(container)` test passed with 0 violations.
2. **Integration Test Assertion Fix**: In `services/organization/tests/structure.spec.ts`, updated `moveCall` assertion to filter specifically for `employee_rohit`'s latest move event, eliminating race conditions with earlier test events.
3. **Server-Side Role Guard Hardening**: In `StructureController.checkTenantAndRole`, normalized role strings and strictly mandated authenticated `owner` or `admin` role for all write operations, rejecting unauthenticated or header-less mutation requests with 403 Forbidden.
4. **Soft Archiving of Teams**: Ensured `archiveTeam` and `deleteTeam` preserve database history with `status = 'archived'` and `archivedAt` timestamp, hiding archived teams from default list queries unless `includeArchived=true`.
5. **Reduced Motion and Design Tokens**: Added `motion-reduce:animate-none` and `motion-reduce:transition-none` to `OrgStructure.tsx` and ensured all padding, margin, and border radii strictly align with `packages/ui-kit/tailwind.config.ts`.
6. **OpenAPI & Decisions Alignment**: Documented security requirements and `X-User-Role` headers in `openapi.yaml`. Logged decision in `docs/decisions.md` clarifying that direct Card entity synchronization is deferred to Step 3 (`F10`).
