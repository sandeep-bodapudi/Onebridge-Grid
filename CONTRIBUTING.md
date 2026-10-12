# Contributing to OneBridge Grid

Welcome to OneBridge Grid. This repository implements Phase 1 of the digital business identity platform for Indian businesses.

## Guiding Principles & Source of Truth

All development must strictly adhere to the following sources of truth in priority order:
1. `.agent/AGENTS.md` (Project Instructions)
2. `docs/decisions.md` (Resolved Architectural & Product Decisions)
3. `docs/features/*.md` (Feature Acceptance Criteria)
4. PRD v1.1 and UI/UX Specification

## Non-Negotiable Rules

### Data & Security
- **Tenant Isolation**: Every database document and query must carry `tenantId`. Enforced in the repository layer, never only in controllers.
- **Server-Side Authorization**: UI only hides what the server already denies.
- **Privacy & Encryption**: Phone numbers and emails of visitors are encrypted at rest. Offline lead data on device uses non-extractable WebCrypto keys.
- **Tokens**: Access tokens are kept in memory only; refresh tokens are stored in `httpOnly`, `Secure`, `SameSite=Lax` cookies. Never store tokens or lead data in `localStorage`.
- **Short Links**: Short links are immutable; only destinations can be repointed.

### Architecture & Contracts
- **Contract-First**: OpenAPI specs and event schemas in `packages/api-contracts` must be updated before modifying code.
- **Module Boundaries**: Modules must never read each other's database collections or cross domain boundaries.
- **Strict Typing**: TypeScript strict mode is enabled across the entire workspace. No `any`, `as never`, or unapproved `@ts-ignore`.
- **Zero Echo Stubs**: Scripts must execute real tooling; placeholder stubs (`echo`, `true`, `exit 0`) are strictly forbidden.

### Design Standards
- Use tokens from `packages/ui-kit` exclusively. Never hard-code color, radius, or spacing values.
- Orange (`#FF5B00`) is a fill color, never a text color. Buttons with orange backgrounds use charcoal text. Orange text on light backgrounds uses Deep Orange `#A04E08`.
- Minimum touch target size is 44px. Status indicators must never rely on color alone.

## Development Commands

```bash
pnpm install
pnpm dev            # Starts local development services with fake providers
pnpm lint           # ESLint across all workspace packages
pnpm typecheck      # Typecheck across all workspace packages
pnpm test           # Unit and integration test suites
pnpm test:e2e       # Playwright end-to-end tests
pnpm contracts:gen  # Regenerate clients from OpenAPI specifications
```

## Definition of Done

Before submitting a pull request:
1. Feature acceptance criteria met and verified with automated tests.
2. `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass cleanly with zero warnings/errors.
3. Cross-tenant isolation tests included for any data access changes.
4. Mutation checks verified for security-critical guards.
5. All UI states (loading, empty, error, offline) implemented with accessibility verified.
6. Structured telemetry logs added without personal data.
7. Feature branch follows `feature/<id>-<name>` branching off latest `main`.
