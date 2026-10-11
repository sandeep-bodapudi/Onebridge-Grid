# F28: Hardening and launch readiness
Priority: Must     Build step: 12     Depends on: all earlier steps
Source: PRD v1.0 section 16, PRD v1.1 section 11

## User story
As the team, we prove the product is fast, accessible, secure and compliant before launch.

## Acceptance criteria
- **Performance:** visitor page LCP 1.5 s or less on 4G (2.5 s on Slow-4G), TTFB 200 ms or less from edge, 300 KB or less before media; redirect 100 ms p95; dashboard API p95 400 ms read and 800 ms write; k6 load test at the stated scale targets with 10x spike tolerance. Results recorded.
- **Accessibility:** WCAG 2.1 AA audit of dashboards and public pages; touch targets 44 px; keyboard and screen reader pass; reduced motion; device lab matrix.
- **Security:** OWASP ASVS Level 2 checklist, dependency and container scans clean of high issues, CSP and SRI verified, RBAC audit, cross-tenant penetration test, secrets review, third-party penetration test scheduled or done.
- **DPDP:** privacy notices and consent records verified end to end; data principal rights flows (access, correction, erasure, grievance) for leads, employees and students; breach notification runbook (CERT-In 6-hour window); data processing agreement template; retention jobs verified (student IDs 30 days, analytics by plan).
- **Reliability:** backups with RPO 15 minutes and RTO 4 hours, restore drill done, SLO dashboards and alerts, on-call runbooks for each service, graceful degradation tests (analytics down, notifier down, edge cache stale).
- **Content:** Hindi copy reviewed by a native speaker; error and empty-state copy reviewed against the UI/UX specification.
- **Quality:** full end-to-end suite green (onboarding to first card in under 10 minutes, share-back to notification, offboarding, offline QR, NFC order to activation).
- A launch checklist signed by the owners of each area.

## Tests required
The above, automated where possible and recorded in `docs/launch-report.md`.

## Out of scope
ISO 27001 and SOC 2 certification (post-launch plan).
