# N03: Directory and search
Priority: Must     Build phase: N-1     Depends on: N01, N02, F26
Source: D-NETWORK, plan section 3A

## User story
As a buyer, job seeker or partner, I find the right verified company or person quickly by what they do and where they are. As a business, I get found by people searching for what I sell.

## Acceptance criteria
- **Search box** on web-public and in the app. It searches:
  - companies (by name, Business ID, products, services and catalogue items)
  - people (by name, headline, skills, current company)
  - posts (N05; added when N05 ships)
- **Filters:**
  - type (company or person)
  - industry (fixed taxonomy, below)
  - city
  - verified only
  - company size band
  - "has catalogue"
- **Industry taxonomy.** A fixed list of industries and sub-categories maintained by ops (N09 console), starting with the Hyderabad launch set: manufacturing sub-sectors and business services. Companies pick up to 3.
- **Ranking:**
  - Relevance first.
  - Then a boost for verified companies, for profile completeness, for recent activity (posts and replies within 30 days), and a plan boost for Business and Enterprise ("priority in search", plan section 5.1).
  - Paid placement is always labelled "Featured" (add-on, plan section 5.3) and never mixed silently into organic results.
- **Privacy:** people appear in search only if their visibility allows it (N10). Results never include phone numbers or emails (D-CONTACT). Suspended and deleted accounts never appear.
- **Freshness:** a profile change reaches search within 60 seconds of its event.
- **Directory pages for SEO:**
  - `/directory/<city>/<industry>` and `/directory/<city>/<industry>/<sub-category>`
  - server-rendered with structured data (ItemList of Organization)
  - list only companies whose page is indexable (F26 setting)
- **Typing help.** Typo tolerance on names and products, plus autocomplete after 2 characters. Hindi text in profiles is searchable as written (no transliteration in N-1).
- **Abuse limits:** anonymous search is rate-limited per IP; scraping patterns (high request rate, sequential paging) are throttled.
- **Analytics:** search impressions and clicks are recorded as analytics events (F23 path), never with the search text tied to a person.

## States to design
Empty query (popular categories in the city), no results (with suggestions to widen filters), loading, offline, rate-limited, result list, directory page with no companies yet ("Be the first <industry> company in <city>").

## API and events
- `GET /search?q=&type=&industry=&city=&verified=&size=&page=`
- `GET /search/suggest?q=`
- `GET /directory/{city}/{industry}`
- `GET /taxonomy/industries`

Consumes `org.*`, `company_profile.updated`, `member.profile_updated`, `post.published` (N05), and moderation actions (N09).

## Data
Search index documents (company, member, post) in a `search` service backed by Meilisearch (Q-NET-4; revisit at 100,000 profiles). Taxonomy collection (global, ops-managed).

## Tests required
- Filters and ranking order (verified boost, labelled featured placement).
- Members hidden by privacy never appear.
- No contact fields in the index or results.
- 60-second freshness from events.
- Suspended and deleted accounts removed from the index.
- Rate limit on anonymous search.
- Directory pages render structured data and only indexable companies.

## Open questions
- Exact ranking weights (start simple, tune with data).

## Out of scope
Personalised recommendations, semantic or AI search (AGENTS.md section 10), map view.
