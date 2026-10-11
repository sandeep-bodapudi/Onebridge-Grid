# F12: Visitor card page
Priority: Must     Build step: 3     Depends on: F10, F11
Source: P1-CARD-02, UI/UX Specification section 4 and 7, PRD v1.1 section 9.1

## User story
As a visitor, I open a card without an app or login and save the contact in one tap.

## Acceptance criteria
- Layout per reference screen 1: arch header, keystone badge at the crown, photo, name, designation, company, branch, verified chip.
- Save contact downloads a vCard (3.0 or 4.0) with photo and company. Opens the native add-contact on iOS and Android.
- WhatsApp opens click-to-chat with a prefilled greeting. Call, Email and Directions work.
- LCP 1.5 s or less on 4G. Page weight 300 KB or less before media. Served from edge cache (ISR).
- English and Hindi toggle. Dark and light follow the system setting.
- No tracking cookies. Anonymous analytics only. Bots filtered.
- States: loading skeleton, unactivated NFC card, inactive or lost card (no personal data), offboarded employee ("moved on, contact X" or redirect), slow connection.
- Share-back panel below the actions (see F13).

## States to design
All states above, using the draft copy in UI/UX Specification section 7.

## API and events
`GET /public/c/{slug}`. Product events: `card_viewed`, `contact_saved`, `cta_clicked`.

## Tests required
vCard validity on iOS and Android, state rendering, Lighthouse performance budget in CI, no personal data on inactive pages, accessibility checks.

## Out of scope
Public company profile (F26), reviews.
