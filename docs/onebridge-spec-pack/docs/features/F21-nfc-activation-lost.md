# F21: NFC activation and lost cards
Priority: Must     Build step: 6     Depends on: F19, F11
Source: P1-NFC-04, P1-NFC-05, PRD v1.1 section 7.6

## User story
As an employee, I tap my new card to activate it. As an admin, I can disable a lost card at once.

## Acceptance criteria
- Chip states: unactivated, active, disabled (lost or stolen).
- **Activation:** the employee taps the card on their own phone while signed in (or scans the card QR). This binds the chip UID to their seat. A chip binds to one seat only, and only the seat's own person (or an admin) can activate it. No Web NFC is used; the tap just opens a page.
- Unactivated chips show "This card is not active yet" with no personal data.
- Lost or stolen: employee or admin marks it lost. Chip is disabled; the tap shows the neutral "This card is inactive" page with no personal data. The admin can reassign, or reorder a replacement at 449.
- Disabled status reaches the edge within 60 seconds (ADR-0003).
- All actions are audited. Events `nfc.chip_activated`, `nfc.chip_disabled`.
- Offboarding re-points chips through the short link, never by re-encoding.

## States to design
Unactivated page, activation success, wrong person, already bound, lost confirmation, inactive page.

## API and events
`POST /nfc/chips/{uid}:activate`, `POST /nfc/chips/{uid}:disable`, `POST /nfc/chips/{uid}:reassign`.

## Tests required
Cannot activate someone else's chip, double activation, disabled chip leaks nothing, stale-cache window respected, audit written.

## Out of scope
Reading or writing tags in the browser, in-app NFC.
