# Plan: UI redesign and hosted prototype

**Date:** 2026-10-21
**Branch:** `feat/step-3-cards-f10`
**Scope:** close Step 3, rebuild the whole UI and UX in a new design language, then publish a hosted prototype for investors and customers. Step 4 (F14 onwards) stays out of scope.

---

## Status (2026-10-24)

| Phase | Status | Notes |
|---|---|---|
| A-close | Mostly done | Budgets enforced in CI (re-measured: 105.6 KB, LCP 761 ms); analytics buffered. **Open:** CI run on a PR to `main` (founder opens it), F10–F13 reports not yet updated. |
| D0 | Done | `docs/concepts/span-concept.html` |
| D1 | Done | Fonts, Tailwind scale, tokens, component library |
| D2 | Done | Shell rebuilt again on 2026-10-24 (icons, More sheet, user menu); OTP boxes fixed for SMS autofill |
| D3 | Done | Follow-up fixes in D-D3-FOLLOW-UP (readable band text, no clipped names, share-back sheet) |
| D4 | Done | All admin pages plus Overview and Leads; backend `GET /cards`, `/stats/overview`, `/leads` (D-D4-ADMIN) |
| D5 | Mostly done | Unit tests updated and passing, axe on every template, light/dark and 375 px checked in a browser. **Open:** service HTTP specs and e2e need CI (swc does not load on this machine). |
| B1–B2 | Done | `scripts/demo-seed.mjs`, `scripts/demo-server.mjs`, passcode gate, one-tap demo sign-in, leads panel, reset endpoint |
| B3 | Ready, not deployed | `render.yaml` + `docs/demo/hosting.md`. Needs the founder's Render account and secrets. |
| B4 | Not started | Real Android and iPhone check after deploy |
| B5 | Done | `docs/demo/presenter-script.md` |

Bugs found and fixed while building the prototype: phone numbers not normalised (two accounts per number), second phone-only sign-up crashing, branch and address never reaching cards, published-card edits not refreshing the visitor page, a render loop in the card editor (D-PHONE-E164, D-EVENT-PAYLOADS, D-PUBLISHED-EDIT-REVALIDATE).

## 1. Goals

1. **Make the prototype look and feel investor-grade.** The UX audit on 2026-10-20 scored the current UI 4.5/10, so the redesign comes before hosting.
2. **Remove the arch and curve motif everywhere** and replace it with a new design language. The colour theme stays exactly the same.
3. **Fix every finding from the UX audit** (section 6 maps findings to fixes).
4. **Host the prototype online with a shareable link** that demonstrates four flows:
   - the admin dashboard journey
   - the visitor card on a phone, opened by scanning a QR code
   - share-back to lead
   - QR downloads and standees

## 2. Decisions already made

| Decision | Choice |
|---|---|
| Design direction | New "Span" language: straight lines, no arches or curves. Same palette. |
| Approval gate | A clickable design concept (D0) is approved before any code is rebuilt |
| New dependencies | `lucide-react` (icons, MIT); self-hosted Manrope and Noto Sans Devanagari (OFL) |
| Avatar shape | Rounded square |
| "Assign person" | Hidden for now. Admins fill card details directly; show "Invite by phone, coming soon". No F14 work. |
| Service auth | D-SERVICE-AUTH (already shipped) |

**Spec deviation.** UI/UX Specification v1.0 makes the arch the core brand element, and F12's acceptance criteria require an "arch header, keystone badge at the crown". Both are overridden by the founder. Log **D-UI-REDESIGN** in `docs/decisions.md`, and add a deviation note next to the spec so later work does not bring the arch back.

---

## 3. Order of work

| Phase | What | Effort (sessions) |
|---|---|---|
| A-close | Remaining Step 3 items | 1 |
| D0 | Design concept for approval | ½ |
| D1 | Foundations and component library | 1 |
| D2 | App shell, sign in, onboarding | 1 |
| D3 | Visitor card and its states | 1 |
| D4 | Admin pages | 2 |
| D5 | Quality pass | ½ |
| B | Hosted prototype | 2 |
| **Total** | | **≈ 9** |

**Why this order:**
- Investors will judge the prototype on the UI, so the redesign comes before hosting.
- Closing Step 3 first means the redesign starts from a branch that has passed CI.
- A-close and D0 can run in parallel.

---

## 4. Phase A-close: finish Step 3

From `docs/reviews/step-3-gate.md` §5:

1. **Run CI.** The founder opens a PR from `feat/step-3-cards-f10` to `main` (there is no `gh` CLI on this machine). Any service-test failure is a blocker.
2. **Budgets in CI.** Add a job that:
   - builds `web-public`
   - serves a seeded card
   - asserts first-load JS ≤ 300 KB and LCP ≤ 1.5 s on simulated 4G (Lighthouse CI)

   Also make the visitor route ISR / edge-cacheable.
3. **Queue analytics.** The analytics stub buffers events in Mongo so they can be replayed in Step 8. At the moment it drops them.
4. **Update the F10–F13 reports** to match the code.
5. **Commit the `scripts/dev.mjs` port variables** (`WEB_APP_PORT`, `WEB_PUBLIC_PORT`).

**Done when:** CI is green on the PR and gate conditions 2 and 4 read "Met".

---

## 5. UI redesign

### 5.1 Design language: "Span"

The logo is a bridge, and the product is called Grid. The new design uses the straight deck of the bridge plus a modular grid, with no arches.

| Element | Treatment |
|---|---|
| Span line | A charcoal hairline with a small square node at each end. Used for section dividers, progress (it fills from one end to the other) and the share-back "connection" animation. |
| Keystone tag | The verified mark becomes a small trapezoid chip. It keeps the keystone meaning without a curve. |
| Grid | Content sits in modular tiles separated by 1px Sand hairlines. No nesting deeper than 2 levels. |
| Business ID nameplate | `OB-T15EH7` shown in monospace on a Sand plate. The signature element on the dashboard, the visitor card and print. |
| Corners | 6px for controls, 10px for panels, 14px for sheets. Nothing larger, nothing arched. |
| Colour discipline | Charcoal gives structure. Bridge Orange appears once per screen, as the main action and key numbers. Orange text is always Deep Orange. |

**Palette (unchanged):**

| Token | Value |
|---|---|
| Bridge Orange | `#F68713` |
| Charcoal | `#393536` |
| Charcoal Deep | `#1E1E1E` |
| Warm Paper | `#FAF7F2` |
| Sand | `#EFE8DC` |
| Sand Border | `#E3D9C8` |
| Deep Orange | `#A04E08` |
| Success | `#27704A` |
| Warning | `#C99700` |
| Error | `#C2362B` |
| Info | `#3B6EA8` |

**The four moods from the spec stay.** Visitor is warm and expressive. Employee is quick and compact. Admin is calm and charcoal-led. Ops is utilitarian.

### 5.2 D0: design concept (approval gate)

A clickable concept page (hosted HTML) with four screens:

1. Visitor card on a phone
2. Dashboard overview
3. People list
4. Card editor with live preview

Shown in light and dark, at 375px and 1280px.

**Exit:** the founder approves the direction or asks for changes. No code is rebuilt before this.

### 5.3 D1: foundations

- **Fonts.** Self-host Manrope (400/600/700) and Noto Sans Devanagari as woff2 in both apps through `next/font/local`, with system fallbacks.
- **Spacing.** Remove the ui-kit `extend.spacing` override that turns `w-24` into 24px, so the default Tailwind scale applies again. Every component class must be migrated in the same change. Add a lint/test guard so it doesn't come back.
- **Type scale.** 12 / 14 / 16 / 20 / 24 / 32 / 40. Weights 400, 600 and 700 only (no 800). Nothing smaller than 12px. Sentence case everywhere.
- **Surfaces.** Two levels (page and panel). Hairline borders. Shadows only on overlays.
- **Motion.**
  - Tokens: 150ms and 200ms, standard easing, transform and opacity only.
  - `prefers-reduced-motion` switches to fades or no motion. This covers all skeletons, not just 4 of 16.
- **Focus.** A 2px charcoal outline with a 2px offset, visible on every interactive element.
- **Dark mode.** Charcoal Deep background and a lighter panel. Every text token is checked for contrast in both themes (this fixes the invisible sign-in heading).
- **Component library** (`packages/ui-kit`, rebuilt):
  - **Actions:** button (primary, secondary, ghost, destructive; 44px minimum height, 56px for primary on mobile), icon button with tooltip
  - **Forms:** form field (label, hint, error; validates on blur and clears on edit), select, segmented control, OTP input
  - **Display:** status chip, table (sticky header, row actions, responsive stacked rows), tabs, toast, empty state, skeleton
  - **Overlays:** slide-over panel and confirm dialog, both with focus trap, Escape to close and focus restore. The confirm dialog names the item and uses a destructive verb.
  - **Brand pieces:** stat tile, Business ID nameplate, keystone tag, span progress, QR preview, phone frame preview
  - **Layout:** app shell

  Every component gets tests for its states (loading, empty, error, disabled) and an axe check.

### 5.4 D2: app shell, sign in, onboarding

- **Shell, desktop.**
  - Charcoal left rail with Overview, Cards, People, Branches and teams, Brand kit, Audit log.
  - Company switcher and Business ID nameplate at the bottom.
  - User menu at the top right.
- **Shell, mobile.**
  - Top bar with company name and avatar.
  - Bottom bar with the 4 main sections; the rest under "More".
  - No wrapping tabs.
- **Greeting.** Uses the person's name, never their phone number.
- **Sign in.**
  - Desktop: brand panel beside the form, with the span line and a sample card. Mobile: a single column.
  - Phone field with the +91 prefix.
  - 6-box OTP entry: labelled, autofocused, accepts pasting the full code, has a resend timer and a "Change number" link.
- **Onboarding.**
  - A 3-step stepper with span progress: company, your card, plan.
  - Live card preview beside the form on desktop and below it on mobile.
  - Validation on blur.
  - Ends with "Your card is ready" plus a QR.

### 5.5 D3: visitor card (`apps/web-public`)

**Mobile first (375px):**
- **Header.** A band in the company brand colour with a span line along its base. Rounded-square photo, name at 32px, role, company, and the keystone tag when verified.
- **Bottom action bar** (fixed, safe-area aware): "Save contact" (primary) and WhatsApp.
- **Contact tiles.** Call, Email and Directions as three equal tiles, which fixes the lopsided buttons.
- **Content sections.** About, products, services, links and branch, rendered from the card's enabled sections in order. At the moment the bio and sections don't render at all.
- **Share-back.**
  - A "Share your details" button opens a bottom sheet. The form is no longer always expanded.
  - On success, the span line animates to connect visitor and owner (a fade under reduced motion).
- **Footer.** Business ID nameplate and "Made with OneBridge".
- **Templates.** All 8 re-expressed as colourways and layout variants without arches. Each one must pass axe and contrast checks.
- **State pages from spec §7** in the same language:
  - not activated
  - inactive
  - employee left (with a handover contact)
  - plan lapsed
  - offline / slow connection
  - not found

**Performance budget unchanged:** first-load JS ≤ 300 KB. Fonts are subset and preloaded.

### 5.6 D4: admin pages

| Page | New design |
|---|---|
| **Overview (new)** | Four stat tiles (cards published / seats, views, saves, leads), a 30-day trend, the latest activity in readable sentences, and a "Next steps" checklist for new companies. |
| **Cards** | A searchable list of people on the left. On the right, the editor with tabs (details, sections, template) and a live phone-frame preview of the real visitor card. Field validation. After publishing, the primary button becomes "Save changes" and "Unpublish" moves to a menu. Real short link shown as a copyable field. |
| **QR and standees** | A visible QR preview. Download PNG/SVG/PDF and standee buttons with plain labels. Disabling a QR asks for confirmation. No 10px pills and no overflow at 1280px. |
| **People** | A table of name, title, branch, card status and actions, with search and a single row of status filters. "Add seat" opens a slide-over. "Offboard" asks for confirmation that names the person and explains the handover. Real card links from the cards service; no fake `onebridge.in/c/<seatId>`. "Assign person" is hidden (see §2). |
| **Branches and teams** | Two lists with "Add branch" / "Add team" buttons and empty states. The org chart is an indented tree. No tabs inside tabs. Branch creation errors are shown instead of failing silently. |
| **Brand kit** | Settings on the left and a preview of a real card on the right. Logo upload has a proper placeholder. Plain-language contrast check ("Text on this colour is easy to read"). One combined lock system. Save sits at the bottom in a sticky bar. |
| **Audit log** | A table of time, person name and a readable action ("Priya created the seat Head of Sales"). Filters use dropdowns (person, action, date), not typed IDs. Raw IDs are hidden behind a "Details" disclosure. |

### 5.7 Backend changes the redesign needs

1. **Person names for display.** Add `GET /internal/persons?ids=` (identity) or a `members` list endpoint on the organization service. Contract first in `packages/api-contracts`, with tenant scoping. Used by People, Audit log and the greeting.
2. **Real card URLs on seats.** The People page gets each card's slug from the cards service (`GET /cards?seatIds=`) instead of building a fake URL.
3. **Overview stats.** Card counts come from the cards service. Views and saves come from the queued analytics (A-close item 3), with "Collecting data" shown until Step 8.

### 5.8 D5: quality pass

- **Re-run the UX audit.** All 10 hard-gate checks must pass. Target score ≥ 8/10.
- **Screenshots** at 375, 768 and 1280, in light and dark, for every page. No horizontal overflow.
- **Accessibility.**
  - axe on every page and template
  - keyboard-only walkthrough of each demo flow
  - screen reader spot check
- **Tests.**
  - Update the Playwright e2e tests for the new screens.
  - Component tests stay green; none disabled.
- **Speed.** Lighthouse on a production build of `web-public`.

---

## 6. Audit findings → where they are fixed

| Finding | Fixed in |
|---|---|
| Fonts don't load | D1 fonts |
| Spacing tokens override Tailwind (24px avatar) | D1 spacing |
| Weight 800 headings, 10–11px text | D1 type scale |
| Arch clips headings and dialog text | D1 / Span language (no arches) |
| Boxes nested 3–4 deep, too much orange | D1 surfaces, colour discipline |
| Raw IDs, event codes, localhost links, fake seat URLs, placeholder brand preview | D4 + §5.7 |
| No shell, tabs wrap to 3 lines, greeting shows phone | D2 |
| QR Disable and Offboard have no confirmation | D1 confirm dialog, D4 |
| "Assign person" needs a typed ID | §2 decision, D4 |
| QR: no preview, 10px pills, 73px overflow | D4 QR |
| Branches: no empty state or add button, nested tabs, overflow | D4 |
| Audit filters need typed IDs | D4 + §5.7 |
| Brand kit: Save at top, jargon, broken logo icon, two lock systems | D4 |
| Visitor card: bio and sections missing, share-back always open, lopsided buttons | D3 |
| Dialogs: no focus trap or Escape | D1 slide-over / dialog |
| Reduced motion only partly honoured | D1 motion |
| Title Case buttons | D1 copy rules, D5 check |
| Card editor: no validation, "Publish" stays primary | D4 Cards |
| Dark mode sign-in heading invisible | D1 dark mode |
| OTP field unlabelled, no autofocus | D2 sign in |

---

## 7. Hosted prototype (Phase B)

### 7.1 B1: demo build

- **One composed services process** (identity, organization and cards sharing the `InMemoryEventBus`, as in `scripts/dev.mjs`), packaged with a production start script.
- **Realistic seed through the public APIs** (not direct DB writes), so read models and events are correct:
  - 1 company
  - 3 branches and 2 teams
  - 8 seats with published cards across several templates
  - QR codes
  - a few leads and audit entries
- **Deterministic reseed on every boot**, so the demo always starts clean.

### 7.2 B2: demo mode

- **Access passcode** on the dashboard. The visitor card stays public.
- **"Demo" login.** One tap signs in as the demo owner. OTP stays fake (`123456`). There is no real SMS.
- **Read-only leads list** behind flag `demo_leads_panel` (needs a decision, see §8), so the share-back → lead flow can be shown end to end.
- **A "Reset demo" action** for the presenter.

### 7.3 B3: deploy

- **Render, three services:**
  1. the services process
  2. `web-app`
  3. `web-public`
- **Environment variables:**
  - real `JWT` secret and internal service key
  - `WEB_PUBLIC_URL`, `SHORT_LINK_BASE_URL` and `APP_URL` set to the Render hosts
  - `NODE_ENV=production`
- **Data.** Mongo either in-memory with reseed on boot (simplest) or MongoDB Atlas free tier. Recommendation: in-memory plus reseed, since nothing in the demo has to persist.
- **Security.** HTTPS only. CORS limited to the two web hosts. No personal data in logs (AGENTS.md).

### 7.4 B4: device check

- **Scan the printed QR** with an Android phone (Chrome) and an iPhone (Safari).
- **Check each of these:** Save contact (vCard), WhatsApp and Call links, the share-back sheet, and the lead appearing on the dashboard.
- **Desktop check:** the dashboard on a 1280px laptop and a projector resolution (1920px).

### 7.5 B5: presenter kit

- **A one-page demo script** covering the four flows, about 6 minutes in total.
- **A printable standee and a QR sheet** for the live scan.
- **Fallback material:** a recorded walkthrough video and screenshots, in case the network fails.

**Done when:** the founder can open the link, sign in with the passcode, and run all four flows on a real phone without help.

---

## 8. Open decisions

| # | Question | Recommendation |
|---|---|---|
| 1 | Show a read-only leads list behind `demo_leads_panel`? (Leads management is outside F13.) | Yes. Without it, share-back → lead can't be shown. |
| 2 | Render plan: paid (~$21/month) or free (services sleep, cold start of 30–60 s)? | Paid for the weeks of investor meetings |
| 3 | Demo company name | Keep "Sahyadri Steel Works" (fictional) |
| 4 | Render account: does the founder create it, or give access? | Founder creates it and shares deploy access |
| 5 | Spec deviation D-UI-REDESIGN: also update the UI/UX spec PDF, or only add a note? | A note now; revise the spec PDF after D5 |

## 9. Risks

| Risk | Mitigation |
|---|---|
| Removing the spacing override changes every existing component at once | Done in D1 before any screen work, with a screenshot comparison of each component |
| Unit tests for services and web apps can't run locally (`@swc/core` on this Windows machine) | Rely on CI for every redesign PR; keep the temporary no-swc config for decorator-free specs |
| Redesign grows into Step 4 scope (invites, leads management) | Section 2 and the open decisions set the boundary; anything beyond it goes to `docs/questions.md` |
| Free hosting cold starts during a live demo | Decision 2; the presenter kit includes a warm-up step and a recorded fallback |
| Port 3000 is used by another local project | Use the `dev-alt-ports` launch config (3002/3003) |

## 10. Definition of done

- Step 3 gate fully met, with CI green.
- All 20 audit findings in §6 fixed, re-audit ≥ 8/10, and no hard-gate failures.
- No arch or curve shapes anywhere. D-UI-REDESIGN logged.
- Hosted link live, and all four flows verified on Android and iPhone.
