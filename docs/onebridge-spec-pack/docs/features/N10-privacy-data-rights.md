# N10: Privacy settings, export and delete
Priority: Must     Build phase: N-1     Depends on: N01, N08, N11, F28
Source: D-NETWORK (individuals as full members), plan risk 7, DPDP Act 2023

## User story
As a member, I control who can see my profile, message me and request a call, and I can download or delete my data. As OneBridge, we meet DPDP obligations from the first network release.

## Acceptance criteria
- **Privacy settings** (member), with defaults in brackets:

  | Setting | Options |
  |---|---|
  | Profile visible to | everyone / signed-in members (signed-in members) |
  | Search engines may index my profile | yes / no (no) |
  | Appear in member search | yes / no (yes) |
  | Who can message me | everyone (requests from strangers) / people I follow and verified companies / nobody (everyone, with requests) |
  | Who can request a call from me | nobody / people I follow / verified companies (nobody) |
  | Read receipts | on / off (on) |
  | Show when I am online | on / off (on) |
  | Show follower and following lists | yes / no (yes) |
  | Hide individual work history entries | per entry |
- **Company privacy:** company-level settings for who can message the company (everyone with requests, or verified only), and the F26 search-engine setting.
- **Contact details** are never public under any setting (D-CONTACT).
- **Export:**
  - A member requests an export.
  - Within 72 hours (proposed) they get a link to a ZIP of their data: profile, work history, posts, comments, reactions, follows, personal conversations, call requests they made, consents, privacy settings and media.
  - Company-owned conversations are listed as metadata only (the company holds them).
  - The link works for 7 days and needs sign-in.
- **Delete account:**
  - The member deletes their account after confirming with an OTP.
  - A 14-day grace period (proposed) lets them cancel; then data is erased.
  - Erased: profile, posts, comments, reactions, follows, personal conversations (their side) and media.
  - Kept: company-owned conversations and leads, with the member's name replaced by "Former member" (company ownership, AGENTS.md section 3), plus records the law requires (audit of consents, moderation actions).
  - Seats the member held become vacant through F16 offboarding.
- **Consents** are recorded with version and time: terms, member privacy notice, call-request number sharing (N11), drafts that mention them (N05). Withdrawing a consent is possible where it is not needed for the service.
- **Grievance:** a published grievance officer contact and in-app grievance form (DPDP and IT Rules), acknowledged within 24 hours and resolved within the legal period.
- **Data minimisation:** no field beyond those in N01 is collected for members; analytics events never carry names, phones, emails or message text.

## States to design
Settings page (each setting with a plain-language explanation), export requested, export ready, export expired, delete confirmation, deletion pending (with cancel), account deleted, grievance submitted.

## API and events
- `GET /me/privacy`
- `PUT /me/privacy`
- `POST /me/exports`
- `GET /me/exports/{id}`
- `POST /me/deletion` (OTP)
- `DELETE /me/deletion` (cancel)
- `POST /grievances`

Events: `member.privacy_changed`, `member.export_requested`, `member.deletion_scheduled`, `member.deleted`. Every service consumes `member.deleted` and erases or anonymises its own data.

## Data
- `PrivacySettings` (personId, settings, updatedAt)
- `ExportJob`
- `DeletionRequest`
- `Grievance`
- `Consent` (personId, type, version, grantedAt, withdrawnAt?)

## Tests required
- Each setting enforced in its module (profile, search, chat, call requests, receipts, presence).
- Defaults correct for new members.
- Export contains only the member's data.
- Deletion erases across every service and keeps company-owned records anonymised.
- Grace period cancel works.
- No personal data in analytics or logs.

## Open questions
- Export delivery time and deletion grace period (proposed 72 hours and 14 days).
- Grievance officer name and contact (legal).

## Out of scope
Data portability imports from other networks, granular per-post audience lists.
