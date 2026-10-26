# N06: Verified business relationships and endorsements
Priority: Must     Build phase: N-3     Depends on: N02, F25 (KYB), N08
Source: D-NETWORK, plan section 3C (the moat), section 8.1

## User story
As a company, I show which businesses we supply, buy from or partner with, confirmed by both sides, so buyers can trust us. As a buyer, I check a supplier's confirmed clients before I contact them.

## Acceptance criteria
- **Proposing.** Company A's Owner or Admin proposes a relationship with company B:
  - Types: supplier of, client of, distributor of, partner, contractor for.
  - Optional details: since (year), products or services involved (up to 200 characters), city.
- **Confirming.** Company B's Owner or Admin gets the request (N08 notification plus inbox item). They can confirm, decline, or confirm with edits to the details, which A must then accept.
- **Display.** Only confirmed relationships are shown, on both profiles. The reverse type shows automatically (A "supplier of" B means B is "client of" A).
- **Badges:**
  - "Verified relationship" when both companies are KYB-verified.
  - Otherwise "Confirmed relationship".
  - Unconfirmed proposals are never public.
- **Ending.** Either side can end a relationship at any time. It disappears from both profiles; the other side is notified. History is kept privately for 12 months for dispute handling, then deleted.
- **Hiding.** A company can mark a confirmed relationship "private". It then counts on the profile (for example "12 confirmed clients") without naming the partner.
- **Limits:** relationships per plan (plan section 5.1) are enforced. Free companies can view but not propose.
- **Endorsements:**
  - Only from a company with a confirmed relationship.
  - Up to 500 characters, written by the partner's Owner or Admin, about the relationship.
  - Shown only after the receiving company approves it.
  - The receiver can hide it at any time; the author can withdraw it.
  - No star ratings.
- **Anti-gaming:**
  - A pair of companies can have one relationship of each type.
  - Companies that share an owner (same identity person as Owner of both) cannot confirm each other. Instead they show as "Related company".
- **Search:** confirmed relationships feed search ranking and the "has verified clients" filter (N03).
- All actions write `audit.recorded`.

## States to design
No relationships yet (with a prompt to invite partners), proposal sent, proposal received, confirmed, confirmed but private, edited details awaiting acceptance, declined, ended, related company, endorsement pending approval, endorsement shown or hidden, limit reached, partner not on the network yet (invite them, N02).

## API and events
- `POST /orgs/{id}/relationships` (propose)
- `POST /orgs/{id}/relationships/{relId}:confirm`
- `POST /orgs/{id}/relationships/{relId}:decline`
- `DELETE /orgs/{id}/relationships/{relId}`
- `PATCH /orgs/{id}/relationships/{relId}` (privacy, details)
- `GET /companies/{slug}/relationships`
- `POST /orgs/{id}/endorsements`
- `POST /orgs/{id}/endorsements/{endId}:approve`
- `PATCH /orgs/{id}/endorsements/{endId}` (hide)

Events: `relationship.proposed`, `relationship.confirmed`, `relationship.ended`, `endorsement.published`.

## Data
- `Relationship` (id, fromTenantId, toTenantId, type, details, status, visibility, proposedBy, confirmedBy, confirmedAt, endedAt)
- `Endorsement` (id, relationshipId, authorTenantId, subjectTenantId, text, status)

Lives in a `graph` service. Each side reads only its own relationships plus public confirmed ones; this is enforced in the repository layer.

## Tests required
- Nothing is shown before confirmation.
- Reverse type is correct.
- Verified vs confirmed badge.
- Ending removes the relationship from both profiles.
- Private relationships are counted but not named.
- Same-owner companies cannot confirm each other.
- An endorsement requires a relationship and the receiver's approval.
- Plan limits.
- Cross-tenant: A cannot confirm on B's behalf.

## Open questions
- Should a relationship require some evidence (an invoice or PO upload, kept private) for the "Verified relationship" badge? Proposed: not in N-3; consider later.

## Out of scope
Public reviews and ratings from strangers (deliberately replaced by endorsements), trade credit or payment history.
