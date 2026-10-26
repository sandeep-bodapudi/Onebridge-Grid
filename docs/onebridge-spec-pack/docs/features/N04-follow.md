# N04: Follow
Priority: Must     Build phase: N-1     Depends on: N01, N02
Source: D-NETWORK, plan section 3B

## User story
As a member, I follow companies and people so their updates reach me. As a company, I see who follows me and follow other companies as the company.

## Acceptance criteria
- **Who can follow whom:**
  - A member follows companies and other members.
  - A company follows other companies, acting as the company. This needs Owner or Admin, or a role the company allows to post (N05).
- **Follow and unfollow** take effect immediately and are idempotent (following twice is one follow).
- **Follower counts** are public on company profiles. On member profiles they are shown only if the member allows it (N10).
- **Follower lists:**
  - A company's Owner and Admins see the list of members and companies following it.
  - A member sees their own followers; others see a member's follower list only if the member allows it.
- **Blocking** (N09) removes any follow in both directions and prevents new ones.
- **Notifications** (F22): a new follower notifies the followed member or company. Notifications are batched to at most one digest a day per receiver after the first 5 in a day, and carry no personal data in push text beyond a display name.
- **Feed:** following is what the feed is built from (N05).
- **Rate limit:** follows per account per day are capped to stop follow-spam. The cap is configurable; new accounts get a lower cap (N09).
- Every follow and unfollow writes an event; analytics counts follows by source (profile, search, card scan, post).

## States to design
Not following, following, follow pending a block check (immediate refusal if blocked), follow limit reached, empty follower list, follower list hidden by privacy.

## API and events
- `PUT /follows/{targetType}/{targetId}` (follow)
- `DELETE /follows/{targetType}/{targetId}` (unfollow)
- `GET /companies/{id}/followers`
- `GET /members/{handle}/followers`
- `GET /me/following`

Events: `follow.created`, `follow.removed`.

## Data
`Follow` (id, followerType `member` | `company`, followerId, targetType, targetId, source, createdAt). Unique on (follower, target). Lives in the `social` service.

## Tests required
- Idempotent follow.
- A company follows only through an allowed role.
- Follower list visibility rules.
- Block removes and prevents follows.
- Daily cap.
- Notification batching.
- Cross-tenant: a company admin cannot follow as another company.

## Open questions
- Daily follow cap values for new and established accounts.

## Out of scope
Two-way "connections" for members (the business trust graph is N06), suggested follows.
