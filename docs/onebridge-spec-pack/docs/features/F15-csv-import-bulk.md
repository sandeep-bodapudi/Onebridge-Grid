# F15: CSV import and bulk actions
Priority: Must     Build step: 4     Depends on: F14
Source: P1-EMP-01, P1-EMP-06, P1-EMP-02

## User story
As an HR admin, I add and change many employees at once without mistakes.

## Acceptance criteria
- Upload CSV or XLSX (up to 5,000 rows). Downloadable template with columns: name, designation, department, branch, team, manager, mobile, WhatsApp, email.
- **Validation preview** before anything is saved: row-level errors (bad mobile, unknown branch, duplicate), warnings, counts. Nothing is created until the admin confirms.
- Duplicate detection by mobile and email, within the file and against existing seats.
- Import of 1,000 rows finishes in 60 seconds or less, as a background job with progress and a result report (created, skipped, failed with reasons, downloadable).
- Rows beyond the plan seat limit are rejected with a clear message. No partial silent drops.
- Optionally send invites for all created seats.
- Bulk actions on up to 5,000 seats as background jobs: change template, move branch or department, deactivate, resend invites. (Bulk NFC ordering is added in F19.)
- Custom fields (text, link, select) can be defined per company with public or internal visibility.
- Scope: Branch Managers can only act within their branch. All actions audited, with one audit entry per job plus counts.
- Idempotent: re-uploading the same confirmed file does not duplicate seats.

## States to design
Upload error, preview with errors, in progress, partial failure, completed, over limit.

## API and events
`POST /orgs/{id}/seats:import` (preview), `POST /imports/{id}:confirm`, `GET /imports/{id}`, `POST /seats:bulk`. Events per seat as in F08.

## Data
`ImportJob`, `BulkJob`, `CustomFieldDefinition`.

## Tests required
1,000-row performance test, duplicate handling, plan limit, role scope, idempotent confirm, injection in cells (formulas starting with `=` are stored as text).

## Out of scope
HRMS connectors, scheduled imports.
