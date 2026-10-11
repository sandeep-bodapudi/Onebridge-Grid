# F24: My Card PWA
Priority: Must (shortcuts, share target, app badge: Should)     Build step: 9     Depends on: F13, F22, F23
Source: PRD v1.1 section 7 (all), UI/UX Specification screen 2, P1-PWA-01 to -11

## User story
As an employee, I show my QR and share my card in two taps, even offline.

## Acceptance criteria
**App identity and install**
- One manifest for all customers (OPEN-D): id, name and short_name "OneBridge", display standalone, portrait, theme Bridge Orange, background Warm Paper, start_url `/my-card?source=pwa`, scope `/my-card/`, icons 192, 512 and maskable (arch glyph). Company logo appears inside the app, not on the icon.
- Served from its own scope so the service worker never touches admin screens. Visitor pages and the admin dashboard are not installable.
- Android and desktop Chromium: custom install prompt after the first successful card share, never in the first session. iPhone: "Share, then Add to Home Screen" guide. Dismissal respected for 14 days.

**Offline and sync**
- Works offline: show card and QR, share through the OS share sheet, browse the last 50 synced leads (read only), capture a lead manually (queued). Needs connection: edit profile, order NFC, billing, fresh analytics.
- QR generated on the device from the short link, cached as SVG. It works regardless of sync state.
- Caching: shell precached and versioned; `GET /cards/me` stale-while-revalidate in IndexedDB; leads network-first with fallback to the last 50; images cache-first (60 entries, 30 days); auth and billing network-only; analytics batched and queued.
- Write queue in IndexedDB with idempotency key per action. Flushes on reconnect and on every app open (iOS has no Background Sync). Exponential backoff; an action is dropped only after 7 days and the user is told. Visible chip: "N changes waiting to sync" and time of last sync. Profile edits are not allowed offline.
- `POST /leads:sync`: idempotent batch upload of manually captured leads (source `manual`).

**Updates**
- A new service worker waits. An "Update available" banner reloads only when tapped or at the next cold start. A security-critical release can force an update.

**Push**
- Web Push with VAPID. The permission prompt appears in context (after the user turns on lead alerts or after the first lead), never on first load. Quiet hours and per-event preferences apply. iOS push only for installed PWAs on 16.4 or later; otherwise the fallback channels in F22 are used.
- `POST /push-subscriptions`, `DELETE /push-subscriptions/{id}`.

**Security**
- Cached: own card, QR target, last 50 leads. Lead phone and email are encrypted in IndexedDB with a non-extractable WebCrypto key.
- **Cache wipe** on logout, session revocation, seat unassignment or offboarding, plan lapse, and 14 days without a successful sync. Online devices wipe within about a minute via push and on the next request; offline devices wipe at next connection or at 14 days. The test verifies no lead data remains.
- Access token in memory, refresh cookie httpOnly Secure SameSite=Lax. Nothing sensitive in localStorage. CSP and subresource integrity on all scripts; the service worker handles same-origin requests only.

**Screen (reference screen 2)**
- Greeting, sync chip, update banner, hero QR in an arch frame with short link, source-tag selector and full-screen button; share row (WhatsApp, copy link, email signature, NFC hint hidden on iPhone and informational only); stat tiles (views, saves, new leads, 7 days); latest leads with an "Untouched 24 h" warning chip, call and WhatsApp actions; bottom bar Card, Leads, Stats, Profile.

**Budgets**
- Initial JavaScript 150 KB gzipped or less. QR visible within 300 ms after the shell loads (installed, offline). LCP 2.0 s or less and time to interactive 3.5 s or less on Slow-4G with a 2 GB Android. Lighthouse PWA installability passes, performance 90 or more, accessibility 95 or more.
- Device-lab matrix (Android 9+ with 2 GB, iPhone iOS 15+ with push on 16.4+, desktop Chrome and Edge) run every release; deviations documented.

## States to design
Offline, N changes waiting, update available, install prompt, iOS guide, card not activated, push permission request, no leads, wiped session.

## Tests required
Airplane-mode QR, queue idempotency and ordering, wipe on every trigger, update flow, install criteria, bundle size budget in CI, encrypted store check.

## Out of scope
Web NFC read or write (moved to the Phase 2 native app), Background Sync on iOS.
