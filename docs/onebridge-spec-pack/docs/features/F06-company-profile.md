# F06: Company onboarding and profile
Priority: Must     Build step: 2     Depends on: F01 to F04
Source: P1-ORG-01, F1 in PRD v1.1 section 4.2

## User story
As a business owner, I register my company and get a branded profile in minutes.

## Acceptance criteria
- `POST /orgs` mints `tenantId` and `businessId` (ADR-0001) and creates the Owner membership in Identity before the response returns, so the first login works. The client then refreshes its token.
- Sign up, then enter company name, industry, size, city. GSTIN is optional at signup and required for the verification badge.
- Fields: legal and display name, logo, cover, brand colours, industry, size, about, website, addresses, GSTIN, social links.
- Changes reach all cards within 60 seconds (event `org.branding_updated`).
- Plan selection exists as a step. Its position (before or after first card) is controlled by flag `payment_after_first_card`. Payment itself is built in step 5; until then the step uses a fake provider.
- Slug is unique. Changing it keeps a permanent 301 from the old slug.
- Target: first card live in under 10 minutes (median). Track `time_to_first_card`.

## States to design
Each onboarding step, validation errors, GSTIN format error, upload failures.

## API and events
`POST /orgs`, `GET|PATCH /orgs/{id}`. Events: `org.created`, `org.updated`, `org.branding_updated`.

## Data
`Organization`.

## Tests required
Slug redirect, 60-second propagation (with fake event bus), role scope on edits, GSTIN format validation.

## Out of scope
KYB verification (ops console step), multiple companies per account (Could).
