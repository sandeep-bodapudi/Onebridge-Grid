# F23: Analytics
Priority: Must (QR source split, city, exports: Should)     Build step: 8     Depends on: F22
Source: P1-AN-01 to -05, PRD v1.0 section 19

## User story
As an employee I see how my card performs. As an admin I see it across the company.

## Acceptance criteria
- Ingestion `POST /analytics/events` (batch up to 100) replaces the stub. Events: `card_viewed`, `qr_scanned`, `nfc_tapped`, `contact_saved`, `cta_clicked`, `doc_downloaded`, `link_clicked`, `shareback_submitted`. Bot traffic filtered.
- Events appear in dashboards within 5 minutes. Counts match the source within 1%.
- Employee dashboard: my views, saves, leads, top sources, 7, 30 and 90 day trends. Mobile friendly.
- Admin dashboard: totals, by branch, department and employee, leaderboard, top products viewed. Scoped by role (a Branch Manager sees only their branch).
- Retention by plan: Starter 90 days, Business 1 year, Enterprise 2 years or more.
- Should: split by QR source tag; approximate city and device type (IP-derived city only, no precise location); CSV export and weekly email report respecting role scope.
- No cookies for visitors. A random session ID per day, not linked to identity. No personal data in event names or properties.
- If the pipeline is down, events queue and replay; card pages and redirects never fail because of analytics.
- Store: ClickHouse (a plain events table locally).

## States to design
Loading, empty, no data for range, partial data (replay in progress).

## API and events
`POST /analytics/events`, `GET /analytics/summary`, `GET /analytics/timeseries`, `GET /analytics/leaderboard`.

## Tests required
Role scope, retention deletion job, replay after outage, dedupe by eventId, accuracy test against known counts.

## Out of scope
Funnels beyond view to save to lead, BI connector, relationship health.
