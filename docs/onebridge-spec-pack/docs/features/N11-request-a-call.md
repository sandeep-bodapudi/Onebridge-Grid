# N11: Request a call
Priority: Must     Build phase: N-1     Depends on: N01, N02, N08, F22, F13, F26
Source: D-CONTACT, plan section 3a

## User story
As a visitor or member, I ask a company or a person to call me back at a time that suits me, without seeing their number. As a company or employee, I get call requests as leads and schedule the call.

## Acceptance criteria
- **Who can be asked:**
  - a company (routed like enquiries, F26: branch contact, then default contact)
  - an employee (through their company card; the company can see the request)
  - an individual member who allows call requests (N10)
- **The request form:**
  - topic: sales enquiry, product question, support, partnership, other
  - preferred time slots: up to 3 slots, in the receiver's business hours if set, otherwise 9:00 to 19:00 IST
  - language: English or Hindi
  - note (up to 500 characters)
  - the requester's phone number (pre-filled from their account and editable)
  - consent checkbox: "Share my number with <receiver> for this call"
- **Signed out:** visitors who are not signed in can request a call by verifying their phone with OTP first (no full account needed). This creates a light account they can complete later (N01).
- **Number privacy:**
  - The requester's number is encrypted at rest (ADR-0002) and shown only to the receiver (and, for company requests, to the company's Owner and Admins) after the receiver accepts.
  - The receiver's number is never shown to the requester.
- **Receiver actions:**
  - **Accept and schedule** (pick one of the slots, or another time). The requester is notified with the time.
  - **Propose another time.** The requester accepts or declines.
  - **Decline** with a reason (not available, not relevant, wrong person). The requester is told politely.
  - **Reply in chat instead.** Opens an N08 conversation.
- **Statuses:** requested, scheduled, rescheduling, completed, missed, declined, cancelled by requester, expired.
  - Expired: no answer within 48 hours (proposed). The requester is told and offered chat.
  - After the scheduled time the receiver marks the call completed or missed. A missed call can be rescheduled once.
- **Reminders** (F22) to both sides 15 minutes before the scheduled time.
- **Leads.** Every call request to a company or employee is a lead with source `call_request` (Phase 1 Lead model, F13 encryption and dedupe).
- **Limits:**
  - received per month on the free plan (plan section 5.1)
  - sent per month for members (plan section 5.2)
  - new accounts limited (N09)
  - a requester can have 1 open request per receiver
- **Visitor card (F12) change.** The Call and WhatsApp tiles become **Chat** and **Request a call**. "Save contact" keeps name, title, company, card link and photo, without phone or email (D-CONTACT). A card owner may opt in (off by default) to include their number for people who scan the card's QR or NFC face to face; it never appears in search, profiles or shared links (Q-NET-2).
- **Masked calling (later, behind a feature flag).** An add-on bridges the call through a telephony provider (provider interface with a fake adapter, AGENTS.md section 4), so neither side sees the other's number. Calls are not recorded unless both sides consent.

## States to design
- Requester: form (signed in, signed out with OTP), sent, scheduled (with time), new time proposed, declined, expired (offer chat), completed, missed, limit reached, receiver does not take calls (offer chat).
- Receiver: new request, accepted, needs scheduling, today's calls, completed, missed.

## API and events
- `POST /call-requests`
- `GET /me/call-requests?role=requester|receiver`
- `GET /orgs/{id}/call-requests`
- `POST /call-requests/{id}:accept`
- `POST /call-requests/{id}:propose`
- `POST /call-requests/{id}:respond-proposal`
- `POST /call-requests/{id}:decline`
- `POST /call-requests/{id}:cancel`
- `POST /call-requests/{id}:complete`
- `POST /call-requests/{id}:missed`

Events: `call_request.created`, `call_request.scheduled`, `call_request.declined`, `call_request.expired`, `call_request.completed`. All carry IDs only, no phone numbers.

## Data
`CallRequest` (id, requesterPersonId, receiverType, receiverId, tenantId?, routedSeatId?, topic, slots, language, note, encryptedPhone, phoneBlindIndex, consentVersion, status, scheduledAt?, expiresAt, createdAt). Lives with leads in the `cards` service (Phase 1 Lead owner) or a new `contact` module of `messaging` (decide in the N-1 contract plan).

## Tests required
- Routing (branch, default, member).
- The number is visible only to the receiver after acceptance, and encrypted at rest.
- Consent recorded.
- Signed-out OTP flow.
- Each status transition and expiry.
- Reminders.
- Lead created with source `call_request`.
- Limits and one open request per receiver.
- Block prevents requests.
- Cross-tenant: one company cannot see another's call requests.
- No phone numbers in events, logs or notifications.

## Open questions
- Expiry window (proposed 48 hours).
- Masked calling provider and pricing.

## Out of scope
In-app voice or video calling, call recording, IVR.
