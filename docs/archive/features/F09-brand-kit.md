# F09: Brand kit and field locks
Priority: Must     Build step: 2     Depends on: F06, F08
Source: P1-ORG-06, UI/UX Specification section 2

## User story
As an admin, I set my brand once and lock what employees cannot change.

## Acceptance criteria
- Brand kit: logo, brand colours (band, accent, text), cover image.
- Admin sets field-level locks (for example logo and colours locked, bio editable). Locked fields are greyed out for employees and rejected server-side if edited.
- Live card preview updates as the admin types.
- **Contrast validation:** if the chosen text colour on the band colour is below 4.5:1, show a warning and auto-pick charcoal or paper text. Admin cannot save an unreadable combination without accepting the auto-pick.
- Logo upload: PNG, SVG or WebP, size limit enforced, scanned and resized. Stored in S3 with CDN.
- Changes publish `org.branding_updated`.

## States to design
Upload error, contrast warning, locked field tooltip, unsaved changes.

## API and events
`PATCH /orgs/{id}/brand`, `PUT /orgs/{id}/locks`. Event: `org.branding_updated`.

## Data
`Organization.brandKit`, `Organization.fieldLocks`.

## Tests required
Locked field rejected by the API, contrast calculation edge cases, upload validation.

## Out of scope
Custom template builder.
