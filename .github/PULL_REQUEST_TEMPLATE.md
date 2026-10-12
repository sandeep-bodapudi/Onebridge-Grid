## Description
<!-- Provide a brief, active-verb description of the changes and the problem solved. -->

## Requirement / Feature ID
<!-- e.g., F01, Task A, AC-A1 -->
- Requirement ID: 

## Working Protocol Checklist
- [ ] Contract first: changes to OpenAPI/events in `packages/api-contracts` before code changes
- [ ] Cross-tenant isolation test added for any data access
- [ ] Server-side authorization enforced (no client-only security)
- [ ] Error format adheres to `application/problem+json`
- [ ] Design tokens from `packages/ui-kit` used exclusively (contrast check passed)
- [ ] Touch targets >= 44px, status indicated with text/icon and not color alone
- [ ] No personal data in logs, push payloads, or analytics event names
- [ ] Tests cover happy path, failure states, empty states, and offline states
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass with zero warnings/errors
- [ ] No secrets, `.env`, or build artifacts tracked
