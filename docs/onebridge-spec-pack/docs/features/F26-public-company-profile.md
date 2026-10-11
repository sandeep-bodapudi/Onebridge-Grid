# F26: Public company profile and enquiries
Priority: Must (employee directory: Should)     Build step: 11     Depends on: F10, F13, F25
Source: P1-PROF-01 to -05, P1-QR-04

## User story
As a visitor, I can see a company's verified profile, products and work, and send an enquiry.

## Acceptance criteria
- Public page: brand header, verification badge, about, branches with directions links, departments and key contacts, products, services, portfolio, gallery, documents, social links, contact actions.
- SEO toggle (indexable or not), schema.org Organization or LocalBusiness, Open Graph previews.
- Catalogue: name, images, description, price or price on request, category, enquiry button. 50 items on Starter, unlimited on Business and above.
- Portfolio and case studies with images and YouTube or Vimeo embeds (CSP allows only those frames), client logos. Media in WebP or AVIF, lazy-loaded.
- Documents up to 25 MB; downloads tracked.
- Employee directory showing the public subset chosen by the admin (Should).
- **Enquiry** (product or general) creates a `Lead` with source `company_enquiry` using the same encryption and spam protection as F13, routed to the right owner (branch or admin rules, default Company Admin).
- Company and branch QR codes with A4 and A5 standee print templates point here.
- Performance as F12. Hindi Should.

## States to design
Unverified company, no products, offline, lapsed plan (basic profile), archived branch hidden.

## API and events
`GET /public/o/{slug}`, `POST /public/o/{slug}/enquiry`. Events: `lead.created`.

## Tests required
Structured data validity, item limits per plan, enquiry encryption and rate limits, archived branches hidden, lapsed behaviour.

## Out of scope
Reviews, Google Business integration (Could).
