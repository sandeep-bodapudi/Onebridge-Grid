# OneBridge Grid as a business identity network: product plan and validation

Status: **v0.3, direction approved by the founder on 2026-10-26** (decisions in section 9; v0.3 adds the private contact model and sample pricing). Feature files and contracts come next; code follows them.
Conflicts with the current spec: AGENTS.md section 10 (connections, directory, messaging, communities, reviews and marketplace are out of scope for Phase 1) and decisions.md (no free plan). Approving this plan means changing both.

---

## 1. The idea in one paragraph

Today OneBridge Grid sells **company-owned digital cards** to businesses. The new direction: make it the **place where every Indian business presents its identity professionally and gets found**. Each company gets a verified public profile, its people appear under it, it posts updates, follows and connects with other companies, receives enquiries and builds a visible trust record. Think "LinkedIn, but company-first, verified, built for Indian MSMEs, in English and Hindi".

What makes it different from LinkedIn, IndiaMART or Google is **trust**: a verified Business ID, real employees on company-owned seats, and business relationships confirmed by both sides.

## 2. What we already have, and how it becomes the network

| Built today | Role in the network |
|---|---|
| Business ID and KYB verified badge (F03, F25) | The trust layer: only verified companies get full reach, reviews and relationship badges |
| Company page (F26): catalogue, work, clients, documents, branches | The company profile, now discoverable |
| Seats and cards (F08, F10) | People profiles under each company; a person's career is the history of seats they held |
| QR, NFC, short links (F11, F21) | The offline door into the network: every scan opens a profile that can be followed |
| Share-back and enquiries (F13, F26) | Messaging and enquiries between businesses start here |
| Brand kit, audit log, plans, analytics | Unchanged; analytics grows to cover reach, followers and engagement |

Roughly half of what a business network needs exists. Everything that makes it social is missing: discovery, follow, feed, connections, messaging, reviews, moderation.

## 3. What is new

**A. Discovery**
- Public directory and search by category, city, product and verification status.
- SEO company pages that rank for "TMT bars supplier Pune".

**B. Follow and updates**
- Anyone can follow a company.
- Companies post updates: new product, completed project, hiring, offer, event or expo stall, certificate.
- A home feed shows updates from followed companies plus suggested companies.

**C. Trust graph (the moat)**
- One company says "X is our supplier" or "X is our client". When the other confirms, both profiles show the verified relationship.
- Endorsements and reviews come only from connected, verified companies, so they can't be faked by strangers.

**D. Enquiries and requirements (the money)**
- A buyer posts a requirement (what, quantity, city).
- Matching verified suppliers are notified and respond.
- Each enquiry becomes a lead in the company's lead inbox, as now.

**E. Real-time chat and call requests (founder decision: no public phone numbers)**
- Phone numbers and emails are **never shown publicly**. People reach a company or an employee in two ways: **chat** or **request a call**. Section 3a describes the full contact model.
- Real-time chat like LinkedIn messaging: one-to-one and person-to-company, typing indicator, read receipts, attachments, online status.
- Company inbox: conversations sent to the company are shared by its team, assigned to a person, and stay with the company when that person leaves (like cards and leads).

**F. People (founder decision: individuals are full members)**
- Anyone can join with a personal profile: name, photo, headline, city, skills, and their verified work history.
- Work history is built from seats: a seat a person claimed (F14) shows as a verified role at that company. Self-added past roles show as unverified.
- Individuals can follow companies and people, post, comment, react and message.
- A person's profile belongs to the person. Their company card and the company's leads still belong to the company (the F14 notice explains this split).
- Privacy controls from day one: who can see contact details, who can message, profile visibility, export and delete (DPDP).

**G. Moderation and safety**
- Report, review queue, spam limits on posts and enquiries, and banning unverified spammers.
- Built into the ops console (F25).

## 3a. Contact model: chat and call requests instead of phone numbers

**Rule:** no profile, card, company page, post or search result shows a phone number or email address to the public.

### Who can be contacted, and how

| Target | Chat | Request a call |
|---|---|---|
| A company | Yes, goes to the company inbox (routed like enquiries: branch contact, then default contact) | Yes, routed the same way |
| An employee (through their company card) | Yes, the conversation belongs to the company and is visible to admins | Yes, the employee gets the request; the company can see it |
| An individual member | Yes, if their privacy setting allows it (everyone, connections only, or nobody) | Only if they turn call requests on |

### Message requests (spam control, as on LinkedIn)
- A first message from someone you are not connected to arrives as a **request**. The receiver can accept, ignore or block.
- Until accepted, the sender can send only one message, with no links or attachments.
- Verified companies and confirmed business relationships skip the request step.
- Limits on new accounts: a cap on new conversations per day (number to decide).

### Request a call
1. The visitor taps **Request a call** and picks a topic (sales enquiry, product, support, other), preferred time slots, language (English or Hindi), and an optional note.
2. The visitor's number goes only to the person or team that receives the request, with the visitor's recorded consent. It is encrypted at rest, like leads today.
3. The receiver gets a notification and can **accept** (picks a time, the visitor is told), **propose another time**, or **decline with a reason**.
4. Status the visitor sees: requested, scheduled for <time>, completed, declined, expired after 48 hours with no answer (number to decide).
5. Every call request is also a **lead** in the company's lead inbox (source `call_request`).
6. Later option, an add-on: **masked calling** (the call is bridged through a provider so neither side sees the other's number). It needs a telephony provider such as Exotel or Knowlarity behind the existing provider interface pattern.

### What changes on today's visitor card (F12)
| Today | With the contact model |
|---|---|
| Call and WhatsApp buttons dial the person's number | **Chat** and **Request a call** buttons |
| "Save contact" downloads a vCard with phone and email | vCard keeps name, title, company, card link and photo; **no phone or email** unless the card owner chooses to share them |
| Share-back form sends the visitor's details to the card owner | Becomes "Request a call" or the first chat message |

**Decided (Q-NET-2, 2026-10-26):** owner opt-in, as proposed below. **Original question:** the original promise was "a scan becomes a saved contact". A saved contact without a phone number is less useful when meeting someone face to face. Proposed: a card owner can choose **"show my number to people I meet"** (off by default). When it is on, the number appears only after a QR or NFC scan, never on search, profiles or shared links. The founder decides.

### Real-time chat: technical outline
- A `messaging` service with WebSocket connections (Socket.IO or native WebSocket), Redis pub/sub so it scales across servers, and MongoDB for conversations and messages.
- Messages encrypted at rest, per tenant for company inboxes.
- Delivery: online through the socket; offline through notifications (F22: push, email, WhatsApp) without message content in the notification.
- Moderation: report and block in every conversation; reported messages go to the ops queue (N09).
- Export and delete of a person's messages (N10, DPDP).

## 4. Who it is for and why they would join

| User | Job they hire it for | Single-player value (works with no network) | Network value |
|---|---|---|---|
| MSME owner | Look credible, keep relationships when staff leave | Cards, leads that stay, company page | Get found, verified relationships, enquiries |
| Sales head | See what the field team produces | Rep and event analytics | Enquiries from buyers searching the network |
| Buyer and procurement | Find reliable suppliers fast | None | Search verified suppliers, see confirmed clients, post requirements |
| Multi-branch business | Route customers to the right branch | Branch QR pages, enquiry routing | Local discovery |
| Job seeker or partner | Check a company is real | None | Verified profile, real employees |

The plan depends on **single-player value first**: the paid card and lead product must be worth buying on its own, before the network exists.

## 5. Business model and sample pricing

**Everything in this section is a sample for discussion. The founder decides prices, limits and which features sit in which plan later.** Prices exclude 18% GST. The paid company prices match the existing F17 plans.

### 5.1 Company plans

| | Free | Starter | Business | Enterprise |
|---|---|---|---|---|
| **Sample price** | ₹0 | ₹199 per seat a month (₹159 yearly) | ₹349 per seat a month (₹279 yearly) | Contact sales (from about ₹450 per seat, 100 seats minimum) |
| Seats | Profile only, no seats | 1 to 25 | 10 to 1,000 | 100 or more |
| Company profile in directory and search | Basic | Full | Full, priority in search | Full, priority in search |
| Verified badge (after KYB) | Yes | Yes | Yes | Yes |
| Branches | 1 | 1 | Unlimited | Unlimited |
| Posts per month | 2 | Unlimited | Unlimited | Unlimited |
| Followers, follow others | Yes | Yes | Yes | Yes |
| Catalogue items | 10 | 50 | Unlimited | Unlimited |
| Digital cards, QR, NFC for employees | No | Yes | Yes | Yes |
| Chat: company inbox | Receive and reply, 1 inbox user | Inbox for every seat | Shared inbox, assignment, saved replies | Plus SLA timers and routing rules |
| Request a call: receive | 5 a month | Unlimited | Unlimited, routed by branch | Unlimited, custom routing |
| Leads inbox and export | View last 30 days | Yes | Yes, with source tags | Yes, plus CRM export or API |
| Verified business relationships | View only | Up to 10 | Unlimited | Unlimited |
| Respond to buyer requirements | 3 a month | 20 a month | 100 a month | Custom |
| Analytics | Profile views total | Card and profile analytics | Full analytics, team and branch | Plus data export |
| Brand kit and template lock | No | Yes | Yes | Yes |
| Admin roles and audit log | Owner only | Yes | Yes | Yes, plus SSO later |

### 5.2 Individual member plans

| | Free member | Member Pro (sample) |
|---|---|---|
| **Sample price** | ₹0 | ₹149 a month or ₹1,199 a year |
| Personal profile and verified work history | Yes | Yes |
| Follow companies and people, post, comment, react | Yes | Yes |
| Chat with connections | Yes | Yes |
| New message requests to people you are not connected to | 5 a month | 50 a month |
| Request a call from a company | 3 a month | 20 a month |
| See who viewed your profile | Last 3 viewers | Full list for 90 days |
| Post requirements as a buyer | 2 a month | 20 a month |
| Profile badge | None | Pro badge |

### 5.3 Add-ons (any paid company plan)

| Add-on | Sample price |
|---|---|
| Promoted post (boost to a city or industry) | ₹499 per post, 7 days |
| Featured listing in a category and city | ₹1,999 a month |
| Extra requirement responses | ₹999 for 25 |
| Masked calling (bridged calls, numbers hidden both ways) | ₹2 per minute plus ₹499 a month per company |
| NFC cards and printed cards | Per order (F19, F20) |

### 5.4 Pricing principles
- **Free must be useful but incomplete:** enough to appear, be found and reply, not enough to run a sales team.
- **Charge for outcomes:** more conversations, call requests, requirement responses and visibility. Never charge to see your own leads.
- **Individuals stay free to join.** Member Pro is optional and should never block basic networking.

## 6. Phasing

**Founder decision: the network is built now, in parallel with the remaining core.** Two tracks run at the same time:

- **Track A, sellable core:** Steps 4 and 5 of the current plan (invite and claim, import, offboarding, billing), then NFC and print, notifications, analytics and the rest of Phase 1.
- **Track B, network:** the phases below, starting with phase 1 immediately.

Shared foundations come first in Track B because both tracks need them: notifications (F22), search, media storage and moderation.

| Phase | Scope | Exit metric (decide go or stop) |
|---|---|---|
| **0. Finish the sellable core** | Step 4 to 5 of the current plan: invite and claim, import, offboarding, billing | 10 paying companies, 200 active seats |
| **1. Discoverable** | Free company profiles, personal member profiles, public directory and search, SEO, follow, **real-time chat and request a call** (the only way to make contact, since numbers are private) | 1,000 company profiles in the launch cluster; 20% of profiles get a follow or enquiry in 30 days |
| **2. Alive** | Company updates, home feed, notifications | 30% of active companies post at least monthly |
| **3. Trusted** | Supplier and client relationships, confirmation, endorsements, verification push | 25% of paying companies have 1 or more confirmed relationship |
| **4. Transacting** | Buyer requirements, matching, add-on credits | Requirement-to-response rate above 50%; add-on revenue above 10% of total |
| **5. People** | Employee profiles with seat history, hiring posts | Decided after phase 3 data |

**Founder decision: launch in Hyderabad, manufacturing and services.** Go wide only after the directory is full there. A directory that is full in one city beats an empty national one. Demo data and the seed move to a Hyderabad set of companies and people (all fictional).

## 7. What changes in the product and architecture

**New services**
- `social`: posts, follows, feed.
- `graph`: relationships, endorsements.
- `search`: directory index.
- `messaging`: company inbox.
- `moderation`: reports, queue, actions.

**New infrastructure**
- A search index (OpenSearch or Meilisearch).
- Feed fan-out jobs (Redis and BullMQ, already in the stack plan).
- Media storage for post images.
- Rate limits and spam scoring on posts and enquiries.

**Public site grows**
- From card and company pages to directory, search, profiles, posts and requirement pages, with SEO.

**Dashboard grows**
- Feed, followers, relationships, inbox, requirements, post composer, moderation reports.

**Rules that stay**
- Tenant isolation, company-owned data, encryption of visitors' phone and email, no personal data in logs, contract first.
- New public data, such as posts and relationships, is explicitly public and needs consent and moderation.

**Engineering size**
- The remaining Phase 1 plan is about 13 features.
- The network adds roughly another 12 to 15 features of similar size.
- This is at least **2.5 times the remaining work**, which is why the phasing above has go or stop gates.

## 8. Validation: does this plan hold up?

### 8.1 What is strong
1. **Real wedge.** No major player combines verified business identity, company-owned employee profiles and two-sided confirmed B2B relationships.
   - LinkedIn is person-first, English-heavy and weak for MSMEs.
   - IndiaMART and TradeIndia are lead marketplaces with widely reported lead-quality and spam complaints.
   - Google Business Profile is consumer and local.
2. **The offline entry point is unusual.** Every card scan, NFC tap and branch standee brings a real visitor to a profile. Most networks have to buy that traffic.
3. **Much is already built.** Verification, company pages, seats, leads and analytics are the hardest trust pieces, and they exist.

### 8.2 What is weak or risky (ranked)

| # | Risk | Severity | Why | Mitigation |
|---|---|---|---|---|
| 1 | **Cold start** | Critical | A network with few companies is useless to buyers, and with no buyers is useless to sellers | Single-player value first; one city and one industry; pre-fill profiles for paying customers' suppliers and clients (with invites) |
| 2 | **MSMEs do not post** | High | Most small business owners do not create content regularly; an empty feed kills "social" | Make posts nearly automatic: new catalogue item, completed project, expo QR, new joiner become update drafts with one-tap publish |
| 3 | **Focus and runway** | **Critical (founder chose parallel tracks)** | The scope at least doubles the work in flight before revenue | Hard rule: Track A's billing (Step 5) is never blocked by Track B; review both tracks every two weeks against the phase metrics; cut Track B scope first if runway is tight |
| 4 | **Free tier eats revenue** | High | Companies may stay free forever | Keep the money features paid (seats, leads, routing, analytics, requirement credits); limit free enquiries |
| 5 | **Spam and fake companies** | High | Open networks attract them; IndiaMART-style spam would destroy the trust promise | Verification gates reach; unverified accounts get limits; moderation built in phase 1, not later |
| 6 | **LinkedIn and Google react** | Medium | Big players can copy features | They are unlikely to build verified Indian MSME relationships with Hindi-first UX and offline cards soon; stay niche-deep |
| 7 | **People data and DPDP** | **High (founder chose individuals as full members)** | Personal profiles, posts, messages and work history are personal data at scale | Privacy settings in the first release, consent recorded at sign-up, export and delete (bring F28 DPDP flows forward), grievance officer contact, no contact details public by default |
| 9 | **Moderation load** | High | Individuals posting and messaging bring harassment, fake profiles and scams, not just spam | Report and block from the first release; rate limits for new accounts; verified-only messaging to people who did not opt in; an ops moderation queue |
| 8 | **Two products confuse buyers** | Medium | "Is it a card app or a network?" | One message: "the verified identity of your business, online and offline" |

### 8.3 Assumptions that must be tested before building phase 1

| Assumption | Test | Pass if |
|---|---|---|
| Buyers would search a verified B2B directory instead of IndiaMART or Google | 10 to 15 interviews with procurement people in the launch niche, plus a landing page with a mock directory | 6 or more say they would use it; landing page converts above 5% to a waitlist |
| Owners will keep a profile current and post | Concierge test: we post on behalf of 20 companies for 4 weeks and watch who engages | 30% or more respond to or reshare activity |
| Confirmed supplier and client relationships matter to buyers | Show buyers two mock profiles, one with confirmed clients | Most pick and trust the one with confirmed relationships |
| Owners will pay for seats before the network exists | Phase 0 sales | 10 paying companies |
| A free profile turns into paid seats | Track in phase 1 | 5% or more of free profiles upgrade within 90 days |

### 8.4 Verdict

**Original verdict (v0.1):** the direction is sound, but the order is the whole game.
- Building a full social network now, before the card and lead product has paying customers, is the single biggest risk to the company.
- The right plan is:
  1. Finish and sell the core (phase 0).
  2. Make profiles public and searchable (phase 1), which reuses most of the existing work.
  3. Add social features only when the phase gates show real usage.
- Treat this as **"network-ready"**, not "social network first".

**After the founder's decisions (v0.2):** the founder chose parallel tracks and individuals as full members. That is a valid bet on speed and network size, and it raises two risks to critical and high (rows 3, 7 and 9 above). The plan stays viable if:
1. Billing (Step 5) ships on schedule regardless of the network track.
2. Privacy, reporting and blocking ship in the **first** network release, not later.
3. Each phase is judged on its exit metric, and Track B scope is cut first when time runs short.

## 9. Founder decisions (2026-10-26)

| Question | Decision | Recommended was |
|---|---|---|
| Direction | Business identity network: approved | |
| Order | **Network now, in parallel** with the core | Core first |
| Free tier | **Yes**, free basic company profile (reverses "no free plan") | Yes |
| People | **Individuals as full members** | Only as part of a company |
| Launch niche | **Hyderabad, manufacturing and services** | |

Added 2026-10-26: **no public phone numbers or emails**; contact is through **real-time chat** and **request a call** (section 3a).

Still open:
- All prices, limits and plan contents in section 5: samples only, to be decided.
- Masked calling provider and price.
- How long a call request waits before it expires.

## 10. Next steps

1. Decisions recorded in `docs/decisions.md` (D-NETWORK); AGENTS.md section 10 and PLAN.md updated to the new scope.
2. Write feature files for the network, each with acceptance criteria, in the spec format:
   - N01 member accounts and personal profiles
   - N02 free company profiles and claiming
   - N03 directory and search
   - N04 follow
   - N05 posts and feed
   - N06 relationships and endorsements
   - N07 requirements and matching
   - N08 real-time chat and message requests
   - N11 request a call (and later masked calling)
   - N09 moderation, reporting and blocking
   - N10 privacy, export and delete
3. Contracts first (OpenAPI and events) for network phase 1, then build. Track A continues with F14 (in progress), F15 and F16.
