# N09: Moderation, reporting and blocking
Priority: Must     Build phase: N-1 (basics), grows with each phase     Depends on: F25 (ops console), F04
Source: D-NETWORK, plan section 3G and risks 5 and 9

## User story
As a member or company, I can report abuse and block people so the network stays professional and safe. As the OneBridge ops team, we review reports and act quickly and fairly.

## Acceptance criteria
- **Report** any of: member profile, company profile, post, comment, message, requirement, endorsement, call request.
  - Reasons: spam, fake profile or company, scam or fraud, harassment, hate or violence, sexual content, misleading information, intellectual property, other (with text).
  - The reporter is never revealed to the reported party.
- **Block** a member or company. Effects in both directions:
  - no follows
  - no messages or call requests
  - no mentions
  - they cannot see each other's posts, comments or members-only profiles

  A company can block, and so can a member. Unblocking is possible from settings.
- **Ops review queue** in the ops console (F25):
  - reports grouped by target, with context (the content, prior reports, account age, verification)
  - priority: scam and fraud, and harassment, first
  - target: every report triaged within 24 hours (proposed)
- **Actions (ops):** dismiss, remove content, warn, restrict (no posting, messaging or requirements for a period), suspend, ban.
  - Every action needs a reason, is written to the audit log (F04) and notifies the affected account with the rule broken and how to appeal.
- **Appeals:** the affected account can appeal once per action. A different ops reviewer decides within 7 days (proposed).
- **Automatic protection:**
  - **New-account limits** for the first 7 days or until KYB or phone verification: lower caps on follows, message requests, posts with links and requirements. Values are configurable.
  - **Spam signals:** identical messages to many people, many message requests ignored or blocked, link-heavy posts. These trigger temporary limits and send the account to review.
  - **Contact detection** (D-CONTACT) in posts and requirements (N05, N07).
  - **Holding:** posts from accounts under review are held, not published.
- **Fake companies:** a company reported as fake loses search placement until review; verified status is re-checked by KYB (F25).
- **Taxonomy and featured listings** (N03) are managed in the same console.
- **Transparency:** a public "Community rules" page in English and Hindi, linked from every report screen.
- **Metrics** for ops: reports per day, time to triage, actions by type, appeal outcomes. No personal data in metrics.

## States to design
Report form, report sent, already reported, blocked (both sides' views), content removed (author's view and others' view), account restricted (with end date), suspended, banned, appeal form, appeal decided.

## API and events
- `POST /reports`
- `POST /blocks`
- `DELETE /blocks/{id}`
- `GET /me/blocks`
- `POST /appeals`
- Ops: `GET /ops/moderation/queue`, `POST /ops/moderation/actions`, `POST /ops/moderation/appeals/{id}:decide`

Events: `report.created`, `moderation.action_taken`, `account.restricted`, `account.suspended`. Every service consumes these to hide or limit content.

## Data
- `Report` (id, reporterId, targetType, targetId, reason, text, status, createdAt)
- `Block` (blockerType, blockerId, blockedType, blockedId, createdAt)
- `ModerationAction` (id, targetType, targetId, action, reason, reviewerId, until?, createdAt)
- `Appeal`

Lives in a `moderation` service. Ops access follows F25 role rules.

## Tests required
- Reporter anonymity.
- Block effects in every module (follow, chat, call request, posts, mentions).
- New-account limits applied and lifted.
- Spam signal triggers.
- Every action audited and notified.
- Appeal handled by a different reviewer.
- Removed content disappears from feed and search within 60 seconds.

## Open questions
- Triage and appeal time targets (proposed 24 hours and 7 days).
- Grievance officer contact for DPDP and IT Rules (shared with N10).

## Out of scope
Automated AI content classification (AGENTS.md section 10), community moderators from outside OneBridge.
