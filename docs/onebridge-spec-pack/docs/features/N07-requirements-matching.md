# N07: Buyer requirements and matching
Priority: Should     Build phase: N-4     Depends on: N02, N03, N08, F22
Source: D-NETWORK, plan section 3D (revenue)

## User story
As a buyer, I post what I need and get responses from relevant verified suppliers without sharing my phone number. As a supplier, I see requirements that match what I sell and respond through chat.

## Acceptance criteria
- **Posting.** A member, or a company acting through Owner, Admin or an allowed role, posts a requirement with:
  - product or service (required)
  - industry and sub-category (taxonomy, N03)
  - quantity and unit
  - delivery city (required)
  - needed by (date)
  - budget range (optional, can be hidden from suppliers)
  - description (up to 2,000 characters)
  - up to 5 attachments (images or PDF)
- **No contact details (D-CONTACT).** Phone and email in the text or attachments' file names are refused, as in N05.
- **Visibility:**
  - "Matched suppliers only" (default): only matched suppliers see it.
  - "Public": also listed on a public requirements board for the city and industry.
  - The buyer's identity can be shown, or hidden as "A verified buyer in <city>" until the buyer replies to a supplier.
- **Matching** happens when posted and again whenever new suppliers join the category. It uses taxonomy, city or service area, catalogue keywords and verification:
  - Verified suppliers are matched first.
  - Matched suppliers are notified (F22) once, without the budget unless the buyer allows it.
- **Responding:**
  - A supplier responds with a short quote message (price, availability, lead time, note), which opens a chat (N08) between supplier and buyer.
  - Responding uses one requirement response from the supplier's plan allowance (plan section 5.1). The supplier can buy extra responses (add-on, plan section 5.3).
- **Buyer view:**
  - The buyer sees responses side by side: supplier name, verified badge, confirmed relationships count (N06), quote fields.
  - The buyer can shortlist, reply, decline (the supplier is told politely) or close the requirement.
- **Lifecycle:**
  - open, then closed (buyer closes, chooses a supplier or cancels)
  - auto-closes 30 days after "needed by", or 30 days after posting if no date
  - the buyer is reminded 3 days before auto-close
- **Leads:** each response a supplier makes, and each buyer reply, appear in the supplier's leads inbox with source `requirement` (Phase 1 Lead stays the only lead model).
- **Spam limits:**
  - requirements per member per month (plan section 5.2)
  - new accounts limited (N09)
  - identical requirements posted repeatedly are blocked
- **Analytics:** match counts, response rate and time to first response (phase N-4 exit metric) are recorded through F23.

## States to design
- Buyer: composer, contact details detected, posting limit reached, open with no responses yet, responses received, shortlisted, closed, auto-closed.
- Supplier: matched list empty, new match, response allowance used up, responded, declined by buyer.

## API and events
- `POST /requirements`
- `PATCH /requirements/{id}`
- `POST /requirements/{id}:close`
- `GET /requirements/{id}`
- `GET /me/requirements`
- `GET /orgs/{id}/matched-requirements`
- `POST /requirements/{id}/responses`
- `POST /requirements/{id}/responses/{respId}:shortlist`
- `POST /requirements/{id}/responses/{respId}:decline`
- `GET /board/{city}/{industry}`

Events: `requirement.posted`, `requirement.matched`, `requirement.responded`, `requirement.closed`.

## Data
- `Requirement`
- `RequirementMatch` (requirementId, tenantId, score, notifiedAt)
- `RequirementResponse` (id, requirementId, tenantId, quote fields, conversationId, status)

Lives in a `requirements` module of the `social` service. There are no payments or orders: AGENTS.md section 10 still excludes a marketplace.

## Tests required
- Matching by taxonomy, city and verification.
- Budget hidden unless allowed.
- Response allowance decremented and enforced.
- Buyer identity hidden until reply.
- Auto-close and reminder.
- Contact detection.
- Leads created with source `requirement`.
- Cross-tenant: a supplier sees only requirements matched to it, or public ones.

## Open questions
- Response allowance per plan and add-on price (plan section 5).
- Auto-close period (proposed 30 days).

## Out of scope
Orders, payments, escrow, invoices between buyer and supplier, auctions or reverse bidding.
