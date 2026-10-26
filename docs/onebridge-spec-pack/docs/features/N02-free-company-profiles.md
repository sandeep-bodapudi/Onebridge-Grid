# N02: Free company profiles
Priority: Must     Build phase: N-1     Depends on: F06, F03, F26, F17
Source: D-NETWORK (free basic company profiles), plan section 5.1

## User story
As a business owner, I put my company on the network for free, so it can be found, followed and contacted, and I can upgrade to paid seats and cards later without starting again.

## Acceptance criteria
- **Free plan.** A company can be created on plan `free` through the existing onboarding (F06). It gets a Business ID (F03) at once, and an Owner membership is created before the first response returns, as for paid plans.
- **Free limits via `PlanLimits`.** The sample values are in plan section 5.1, and every limit is configurable per plan:
  - no seats and no employee cards
  - 1 branch
  - posts per month
  - catalogue items
  - company inbox users
  - call requests per month
  - requirement responses per month
  - leads history window
- **Limit reached.** When a free company reaches a limit, the action is refused with a message naming the limit and the plan that removes it. Nothing already published is hidden.
- **Profile content** reuses F26 (about, website, social links, catalogue, services, portfolio, clients, documents, branches, SEO). Free companies get the same page with the free limits applied.
- **Upgrade keeps everything.** Upgrading to Starter or Business (F17) keeps the Business ID, slug, profile, followers, posts and conversations. Downgrading keeps content; anything over the free limits becomes read-only, as over-limit seats do (F08).
- **One company, one listing.** A GSTIN can belong to only one company. Signing up with a GSTIN already in use shows "This company is already on OneBridge Grid" and offers to request access from its owner. The owner is notified through N08; the requester is not told who the owner is.
- **Verified badge** only after KYB (F25), for free and paid alike. Unverified companies are labelled "Not verified yet" on their profile and get the new-account limits of N09.
- **Contact (D-CONTACT).** The free profile shows Chat and Request a call buttons, never phone numbers or emails. Messages go to the company inbox (N08).
- Plan changes write `org.plan_changed` and `audit.recorded`.

## States to design
New free company, profile incomplete, limit reached (each limit), duplicate GSTIN, access requested, unverified, verified, upgraded, downgraded with read-only items, suspended (N09).

## API and events
- Extends `POST /orgs` with `plan: free`.
- `GET /orgs/{id}/limits`: current usage against plan limits.
- `POST /orgs/access-requests` (GSTIN plus message).
- `POST /orgs/{id}/access-requests/{requestId}:decide` (Owner approves or declines).

Events: `org.created` (plan free), `org.plan_changed`, `org.access_requested`.

## Data
- `Organization.plan` gains `free`.
- `AccessRequest` (id, tenantId, requesterPersonId, message, status, createdAt, decidedAt, decidedBy)

## Tests required
- Free company creation with a Business ID and Owner membership.
- Each free limit enforced server-side, with the right message.
- Upgrade and downgrade keep content.
- Duplicate GSTIN blocked and the access-request flow works.
- The requester never learns the owner's identity or contact details.
- No phone or email on the free profile.

## Open questions
- **Unclaimed listings.** Should the directory list Hyderabad businesses that have not signed up (from public data), so owners can claim them? This needs a legal check on using public business data. Not built until decided.
- Final free-tier limits (plan section 5.1 holds sample values).

## Out of scope
Importing listings from third-party directories, paid "claim your listing" campaigns.
