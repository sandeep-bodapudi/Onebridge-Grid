# N05: Posts and feed
Priority: Must     Build phase: N-2     Depends on: N01, N02, N04, F22, N09
Source: D-NETWORK, plan sections 3B and 8.2 (risk 2: MSMEs do not post)

## User story
As a company or member, I share updates (products, projects, hiring, events) with my followers. As a member, I see a feed of updates from the companies and people I follow.

## Acceptance criteria
- **Authors:**
  - A member posts as themselves.
  - A company posts as the company. This is open to Owner and Admin by default; the company can allow other roles.
- **Post content:**
  - text up to 3,000 characters
  - up to 10 images
  - one PDF document (25 MB, F26 rules)
  - one YouTube or Vimeo link (F26 rules, loaded on tap)
  - or a link with a preview card
  - hashtags and @mentions of companies and members
- **Post types** with structured fields: update, product (links a catalogue item), project, hiring (role, city, apply by chat), event or expo (date, venue, stall), certificate.
- **Drafts from activity** (risk 2 mitigation). The app offers a ready draft, never auto-published, when:
  - a catalogue item is added
  - a portfolio project is added
  - a new person claims a seat (only if that person agrees)
  - an event QR code is created
  - KYB verification completes

  The author edits and publishes with one tap.
- **No contact details (D-CONTACT).** Phone numbers and email addresses in post text are detected and the author is asked to remove them ("Use chat or request a call instead"). The post cannot be published until they are removed.
- **Visibility:** public, or followers only.
- **Plan limits:** the free plan's posts per month are enforced (N02).
- **Reactions:** like, insightful, celebrate, one per member per post.
- **Comments:** one level of replies, up to 1,250 characters. The author can turn comments off or delete comments on their own post.
- **Reshare:** with an optional comment.
- **Edit and delete:** the author can edit for 24 hours, and the post shows "Edited". Deletion is always possible and removes the post from feeds and search within 60 seconds.
- **Feed ranking:**
  - Posts from followed authors, newest first, with small boosts for verified authors and posts with engagement.
  - At most 2 posts in a row from the same author.
  - Suggested posts (from the city or industry) are labelled "Suggested". Promoted posts (add-on) are labelled "Promoted".
- **Moderation:** every post and comment can be reported (N09). New accounts' posts with links are held for review (N09 rules).
- **Notifications** (F22): mentions, comments on your post, and reactions batched into a digest.
- **Analytics** for the author: impressions, reactions, comments, profile visits from the post (F23 path).

## States to design
Empty feed (suggest companies to follow in your city and industry), loading, end of feed, offline (cached feed, posting disabled), composer with draft from activity, contact details detected, post limit reached, held for review, removed by moderation, deleted, comments off.

## API and events
- `POST /posts`
- `PATCH /posts/{id}`
- `DELETE /posts/{id}`
- `GET /feed?cursor=`
- `GET /companies/{id}/posts`
- `GET /members/{handle}/posts`
- `POST /posts/{id}/reactions`
- `DELETE /posts/{id}/reactions`
- `POST /posts/{id}/comments`
- `DELETE /comments/{id}`
- `POST /posts/{id}/reshares`
- `GET /me/post-drafts`

Events: `post.published`, `post.updated`, `post.deleted`, `comment.created`, `reaction.created`.

## Data
- `Post` (id, authorType, authorId, tenantId?, type, text, media, links, mentions, hashtags, visibility, status `published` | `held` | `removed` | `deleted`, editedAt, createdAt)
- `Comment`
- `Reaction`
- `PostDraft`

Lives in the `social` service. Feed timelines are built by fan-out jobs (BullMQ), with fan-out on read for authors with very many followers.

## Tests required
- Author permissions (company roles).
- Contact detection blocks publishing.
- Edit window.
- Deletion removes the post from feed and search within 60 seconds.
- Feed order and the same-author cap.
- Labels on suggested and promoted posts.
- Free post limit.
- Held-for-review flow.
- Drafts from activity never auto-publish.
- Cross-tenant: a company admin cannot post as another company.

## Open questions
- Should companies be allowed one public business number in posts (for example a showroom line), contrary to D-CONTACT? Proposed: no.
- Edit window (proposed 24 hours) and comment length.

## Out of scope
Polls, articles and newsletters, live video, scheduled posts (later), communities and groups (AGENTS.md section 10).
