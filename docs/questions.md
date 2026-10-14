# Questions Log

## Q-11: Dark Mode Tokens for UI Kit (Class C)
**Feature:** F05 - UI Kit  
**Context:** AC-4 requires dark mode tokens to be defined. However, the specific hex codes for dark mode (e.g., Dark Charcoal, Dark Paper, Dark Sand) are not provided in `F05-ui-kit-tokens.md` or the PRD summary.  
**Question:** Do we have a specific dark mode palette defined by the design team, or should I generate a standard accessible dark palette (inverting light backgrounds to dark grays/blacks and adjusting text for contrast)?  
**Status:** **Open (Agent proposal pending approval)**  
**Later Features Affected:** F05 (finalizing CSS variables in ui-kit), F12 (visitor card themes), F24 (My Card PWA dark theme), F26 (public company profile).  

## Q-12: Visual Snapshot Testing Strategy (Class C)
**Feature:** F05 - UI Kit  
**Context:** The "Tests required" section lists "visual snapshot tests".  
**Question:** Should we integrate a SaaS visual regression tool (like Chromatic or Percy) into the CI pipeline, or is a local DOM/HTML snapshot testing strategy using Vitest/Storybook test runner sufficient for Phase 1?  
**Status:** **Open (Agent proposal pending approval)**  
**Later Features Affected:** F05 (Storybook visual regression workflow), CI gate automation, F12 & F24 visual budget testing.  

## Q-13: Self-Hosted Font Delivery Strategy (Class C)
**Feature:** F05 - UI Kit  
**Context:** AC-3 mandates "Manrope self-hosted with Noto Sans Devanagari fallback". While the `@font-face` CSS can be written, the actual `.woff2` files must be served.  
**Question:** Should the `.woff2` font files be bundled and published inside the `@onebridge/ui-kit` npm package itself, or should we assume consuming applications (`web-app`, `web-public`) will host these assets in their respective `public/fonts` directories?  
**Status:** **Open (Agent proposal pending approval)**  
**Later Features Affected:** F05 (ui-kit font asset publishing), F12 (web-public font hosting), F24 (web-app PWA font caching in Serwist service worker).  

## Q-14: Single Person Multiple Seats Policy (Class C)
**Feature:** F08 - Seats and people  
**Context:** AC-1 states "A person is assigned to a seat." Does OneBridge allow a single human (`Person`) to occupy multiple seats within the same company (e.g., dual roles such as Founder + Head of Product), or is a person strictly constrained to one seat per tenant?  
**Question:** Can a single person ID be assigned to more than one active seat simultaneously within the same organization?  
**Status:** **Open (Agent proposal pending approval)**  
**Later Features Affected:** F08 (seats), F14 (invite claim flow), F15 (CSV bulk import), F16 (offboarding).
  
