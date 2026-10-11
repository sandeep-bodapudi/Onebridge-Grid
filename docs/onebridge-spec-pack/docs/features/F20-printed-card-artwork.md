# F20: Printed card artwork and proofs
Priority: Must     Build step: 6     Depends on: F09, F11
Source: Printed Card Designs document, P1-NFC-01, decisions C1 and C2

## User story
As an admin, I see exactly how each card will print, and ops receive print-ready files.

## Acceptance criteria
- Three families in MVP: **small business**, **medium employee**, **owner and leadership**. Large-employee and student printed cards are out of MVP.
- Print system: trim 90 x 54 mm landscape, 3 mm corner radius for PVC, 3 mm bleed (artwork 96 x 60 mm), text and QR at least 4 mm inside trim, QR at least 20 mm on a light plate with clear border (25 mm on the small-business back), text 6 pt or larger, lines 0.25 pt or thicker, dark text on orange, never white.
- Default family: Starter seats get small business; Business employee seats get medium employee; Company Owner role (or seats marked leadership) gets owner family; admins can override per seat or in bulk.
- Brand kit slots recolour the medium family: band colour, accent colour, logo, text colour. Structure and the keystone mark stay constant. Contrast validation from F09 applies (4.5:1 minimum).
- Server generates a print PDF with bleed and crop marks for every card from seat data. Same short link and QR on reprint after a role change.
- **Proof:** front and back preview that the admin approves. The approved proof is stored with a hash; the print file must match it.
- Wood and metal also get a one-colour engraving version. Metal uses the QR-only design. Keep metallic foil and ink off the NFC ring area.
- Source colour is sRGB. Ops note: printers convert to CMYK; a physical proof is required before the first production run and the vendor is asked for the nearest spot colour for Bridge Orange (checklist item in F25).
- Sample or placeholder data is labelled as sample.

## States to design
Proof preview front and back, family override, contrast warning, missing logo.

## API and events
`POST /nfc/proofs`, `GET /nfc/proofs/{id}`, `GET /nfc/orders/{id}/print.pdf` (ops only).

## Tests required
Dimensions and bleed of generated PDF, QR decodes at minimum size, text size minimums, family defaults, proof hash match, engraving version has one colour.

## Out of scope
Custom artwork upload, student and large-employee families, spot UV and foil specification (vendor sample step).
