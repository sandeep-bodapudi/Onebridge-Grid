# OneBridge Grid

OneBridge Grid is a digital business identity platform for Indian businesses. The company owns the identity, the cards, and the relationships, while employees act as custodians. Its core promise is that an NFC tap or QR scan turns a real-world interaction into a saved contact and a company-owned lead without requiring any app download or visitor login.

## Workspace Layout

The repository is structured as a pnpm monorepo with strict module boundaries:

```text
apps/
  web-public/        # Public visitor card pages and company profiles
  web-app/           # Admin dashboard and My Card PWA modules
  admin-console/     # Internal operations console

services/
  identity/          # Auth (OTP, MFA, OAuth), persons, sessions, RBAC
  organization/      # Companies, branches, departments, teams, seats
  cards/             # Digital cards, QR codes, leads, templates
  payments/          # Billing, subscriptions, GST invoices
  notifications/     # SMS, WhatsApp, email, push dispatch
  analytics/         # Role-scoped event analytics and ingestion

packages/
  ui-kit/            # Design tokens, accessible components, Storybook
  api-contracts/     # OpenAPI specifications and generated TypeScript types
  shared/            # Shared utilities, repository base classes, fake adapters

docs/                # Architecture plans, ADRs, decisions log, feature specs
```

## Prerequisites

- **Node.js**: v20 or higher
- **pnpm**: v9 or higher

## Commands

Run these from the repo root:

```bash
pnpm install       # Install workspace dependencies
pnpm dev           # Start local dev server with fake providers & demo seed
pnpm lint          # Lint all workspaces (ESLint)
pnpm typecheck     # Typecheck all workspaces (TypeScript)
pnpm test          # Run unit and integration test suites
pnpm test:e2e      # Run Playwright end-to-end tests
```

Local development uses deterministic fake provider adapters (such as `FakeOtpSender` and `FakeEventBus`) and automatically starts with seeded demo tenants, persons, and memberships.

## Production deployment

Production runs on one VPS with Docker Compose behind Caddy (HTTPS on `onebridgecard.com`): one `api` container with every service (`scripts/prod-api.mjs`), the two Next apps, and MongoDB as a single-node replica set. Settings live in `.env` (template: `.env.production.example`). Deploy with `./deploy/deploy.sh`; the first deployment is in [deploy/DEPLOYMENT-GUIDE.md](deploy/DEPLOYMENT-GUIDE.md) and day-to-day operations (backups, restore, rollback, monitoring) in [deploy/RUNBOOK.md](deploy/RUNBOOK.md). What is still pending, with instructions: [docs/plans/pending-work.md](docs/plans/pending-work.md). The hosted Render demo (`render.yaml`, `scripts/single-*.mjs`) keeps working until the VPS is live.

## Documentation & Contributing

- [Implementation Plan](docs/onebridge-spec-pack/docs/PLAN.md): Phase 1 build order, dependency graph, and exit gates.
- [Contributing Guide](CONTRIBUTING.md): Non-negotiable rules, coding standards, and definition of done.

## Security

**Never commit real credentials, tokens, or production secrets.** Use [`.env.example`](.env.example) as the template for local environment variables. Sensitive data (visitor contact details, offline lead records) must be encrypted at rest, and all repository commits undergo pre-merge secret scanning.
