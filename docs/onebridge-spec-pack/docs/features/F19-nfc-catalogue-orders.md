# F19: NFC catalogue and orders
Priority: Must     Build step: 6     Depends on: F18, F20 (build F20 first: orders need proofs)
Source: P1-NFC-01, -02, -03, PRD v1.0 section 18.2

## User story
As an admin, I order branded cards for chosen people and track them to delivery.

## Acceptance criteria
- Catalogue: PVC 599, Wood or bamboo 999, Metal 2,499, replacement 449 (excl. GST). Volume discount 10% at 50 or more, 20% at 250 or more (proposals).
- Order flow: choose seats, material, design family (F20), quantity, shipping (one address or per branch), review **print proof (front and back) and approve before payment**, pay through Razorpay, GST invoice.
- Metal orders show a clear notice: QR-only design, NFC not guaranteed (decision C2).
- Chips are NTAG213/215/216 with an NDEF URL to the seat's immutable short link, write-locked after encoding (done by ops in F25).
- Status timeline visible to the customer: placed, proof approved, printing, encoding, QC, dispatched (with tracking), delivered. Updates emailed and in-app (`nfc.order_status_changed`).
- Order-to-delivery target 7 business days in metro cities (assumption, tracked).
- Bulk ordering from the employees list (extends F15 bulk actions).
- Orders for seats that are vacant or offboarded are blocked.

## States to design
Catalogue, proof review, payment, timeline, delayed order, delivered, partial shipment.

## API and events
`GET /nfc/catalogue`, `POST /nfc/orders`, `GET /nfc/orders/{id}`, `POST /nfc/orders/{id}:approve-proof`. Event: `nfc.order_status_changed`.

## Data
`NfcOrder` (Payments), line items with seatId, material, family, proofHash.

## Tests required
Cannot pay before proof approval, proof hash matches printed artwork, discount tiers, blocked seats, status transitions only forward.

## Out of scope
Phone stickers, keychains, standees (Could).
