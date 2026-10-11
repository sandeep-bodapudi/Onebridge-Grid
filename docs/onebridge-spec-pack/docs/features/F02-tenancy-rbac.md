# F02: Tenancy and roles
Priority: Must     Build step: 1     Depends on: F01
Source: P1-EMP-04, PRD v1.0 section 15, section 16.3

## User story
As a company, I need my data fully isolated, and each person limited to what their role allows.

## Acceptance criteria
- Every document has `tenantId`. The repository layer adds it to every query. A query without a tenant context throws.
- Roles: Super Admin (platform), Company Owner, Company Admin, Branch Manager, Department Manager, Team Lead, Employee, Viewer/Auditor.
- Permissions follow the matrix in PRD v1.0 section 15. Scope (own branch, department, team, own records) is enforced server-side.
- A person can hold roles in more than one company. The active company is explicit on every request. Cross-company access is denied.
- Super Admin impersonation is out of this feature (see ops console).
- Denied requests return 403 with problem+json and are logged.

## States to design
No permission page, company switcher (if more than one).

## API and events
Guard and decorator on every service. `GET /me` returns person, memberships, active tenant, permissions.

## Data
`Membership` (personId, orgId, role, scope ids).

## Tests required
Cross-tenant isolation test that every service must pass. One test per role against the permission matrix. Scope tests (Branch Manager sees only their branch).

## Out of scope
Custom roles (Enterprise, later).
