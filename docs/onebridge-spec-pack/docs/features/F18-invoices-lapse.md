# F18: GST invoices and plan lapse
Priority: Must     Build step: 5     Depends on: F17
Source: P1-BILL-03, P1-BILL-07

## User story
As a finance contact, I get correct GST invoices. As an owner, a lapsed plan degrades gracefully.

## Acceptance criteria
- GST-compliant invoice: company GSTIN, HSN/SAC, CGST and SGST for same state or IGST otherwise, numbering per financial year without gaps, credit notes. Legal entity name and address from config (OPEN: Q5).
- Invoices are emailed automatically and downloadable as PDF. Subscription and NFC order charges can share an invoice where possible.
- **Lapse:** for 30 days cards stay live and only admins see a renewal banner. After 30 days cards show the company's basic profile. The Business ID is never released. Data is never deleted silently.
- On lapse the My Card app wipes its offline lead cache (see F24).
- Renewal restores everything immediately.

## States to design
Invoice list, invoice detail, renewal banner (admin only), lapsed visitor page.

## API and events
`GET /invoices`, `GET /invoices/{id}.pdf`. Events: `invoice.issued`, `subscription.status_changed`.

## Tests required
Tax split by state, numbering across financial years, credit note, lapse timeline with fake clock, visitors never see the banner.

## Out of scope
E-invoicing (IRN) integration; decide later.
