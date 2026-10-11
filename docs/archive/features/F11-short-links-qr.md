# F11: Short links and QR codes
Priority: Must     Build step: 3     Depends on: F10
Source: P1-QR-01, P1-QR-02, P1-QR-03, P1-QR-05, PRD v1.1 section 6.9

## User story
As an employee, my QR and NFC always work, and I can see where each scan came from.

## Acceptance criteria
- Every card has a short link `obg.in/<8 char>`. The code is immutable. Only the destination can change.
- Edge worker resolves in 100 ms p95 or better from a cached code-to-destination map. Works if the origin is down.
- Disabled or unactivated chips resolve to a neutral page with no personal data.
- Branded QR: logo in centre, brand colours, error correction level H when a logo is present. Download as PNG, SVG and PDF in print resolution. Scannable at 2 cm.
- Multiple QR codes per card with source tags (for example "Expo 2026 standee"). Scans carry the source into analytics.
- Company and branch QR with A4 and A5 standee templates.
- External destinations need Company Admin approval and a URL safety check. Only OneBridge pages by default.
- Redirects record a scan event without delaying the redirect.

## States to design
Neutral inactive page, QR download options, source tag manager.

## API and events
`GET /r/{code}` (edge), `POST /cards/{id}/qr`, `GET /cards/{id}/qr/{qrId}.{png|svg|pdf}`. Events: `shortlink.created`, `shortlink.repointed`.

## Data
`ShortLink` (code, targetType, targetId, source, status).

## Tests required
Immutability, repoint, edge cache invalidation, QR decode test on generated images, external destination blocked without approval, redirect works with analytics down.

## Out of scope
Custom domains (Enterprise, later).
