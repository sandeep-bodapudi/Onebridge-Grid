# N01: Member accounts and personal profiles
Priority: Must     Build phase: N-1     Depends on: F01, F14
Source: D-NETWORK (individuals are full members), `docs/plans/business-network-plan.md` section 3F

## User story
As a professional, I join OneBridge Grid without needing a company, build a profile that shows who I am and where I have verifiably worked, and use it to follow, post and talk to businesses.

## Acceptance criteria
- **Sign-up without a company.** Anyone can join with phone OTP, email OTP (added in F14) or Google/Microsoft sign-in (F01). No membership in a company is needed. Terms and the member privacy notice are accepted at sign-up and recorded with timestamp and notice version.
- **Age.** Sign-up asks the member to confirm they are 18 or older (DPDP: no data of children without verifiable parental consent). Under-18 sign-up is refused.
- **Profile fields:**
  - name (required, up to 80 characters)
  - handle (unique, used in the profile URL)
  - headline (up to 120)
  - photo
  - cover image
  - city
  - about (up to 2,000)
  - skills (up to 30, up to 40 characters each)
  - languages
  - work history
- **Handle.** Lowercase letters, digits and hyphens. Changing the handle keeps the old URL redirecting, as company slugs do (F06).
- **Verified work history.** When a person claims a seat (F14 `seat.assigned`), an entry appears automatically: company, seat title, start date. Offboarding (F16) sets the end date.
  - Verified entries are marked "Verified by <Company>".
  - The member can hide a verified entry but cannot edit its company, title or dates.
- **Self-added history.** Members can add past roles themselves. These are clearly labelled "Not verified". A self-added entry may name a company on the network but never shows that company's verified mark.
- **No public contact details (D-CONTACT).** Phone and email are never shown on the profile, in search or in any API response to other users. Contact goes through chat (N08) or call requests (N11), as the member's privacy settings allow (N10).
- **Public profile page** at `/in/<handle>` on web-public, with these states:
  - Visible to everyone, or to signed-in members only (N10).
  - Search-engine indexing is **off by default** for individuals; the member can turn it on.
- **Profile completeness:** the member's own view shows a checklist (photo, headline, city, about, one skill). It is never shown to others.
- **One account, many seats.** A member who holds seats in several companies has one profile. Their company cards stay company-owned (F14 notice); the profile belongs to the member.
- English and Hindi interface; profile text is shown as written (no auto-translate, AGENTS.md section 10).
- Every profile change writes `member.profile_updated` (no personal data in the event beyond IDs and changed field names).

## States to design
New member (empty profile), incomplete, complete, members-only visibility, handle taken, suspended (N09), deactivated or deleted (N10), profile not found.

## API and events
- `GET /me/profile`
- `PUT /me/profile`
- `POST /me/work-history`
- `PATCH /me/work-history/{id}`
- `DELETE /me/work-history/{id}` (self-added only; verified entries can only be hidden)
- `GET /members/{handle}` (public view, respects N10 settings)

Events: `member.registered`, `member.profile_updated`, `member.work_history_changed`. Consumes `seat.assigned`, `seat.status_changed` (offboarded).

## Data
- `MemberProfile` (personId, handle, previousHandles, name, headline, photoUrl, coverUrl, city, about, skills, languages, visibility, indexable, createdAt, updatedAt)
- `WorkHistoryEntry` (id, personId, source `seat` | `self`, tenantId?, seatId?, companyName, title, startDate, endDate?, hidden)

Profiles live in a new `profiles` service (MongoDB). Identity keeps authentication only.

## Tests required
- Sign-up without a company, with and without the age confirmation.
- Handle rules: uniqueness and redirect after a change.
- A verified entry appears on seat claim, gets its end date on offboarding, and cannot be edited.
- A self-added entry is labelled unverified.
- No phone or email in any profile response.
- Visibility and indexing honoured on the public page.
- Cross-tenant: one company's admins cannot read another company's seat history through a profile.

## Open questions
- Should members also add education and certifications in N-1, or later?
- Handle change frequency limit (proposed: no limit, old handles redirect).

## Out of scope
Member Pro subscription billing (priced later), recommendations ("people you may know"), skill endorsements, résumé import.
