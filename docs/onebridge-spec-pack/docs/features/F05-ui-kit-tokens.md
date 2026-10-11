# F05: Design tokens and ui-kit foundations
Priority: Must     Build step: 1     Depends on: none
Source: UI/UX Specification sections 1 to 3 and 8, PRD v1.1 section 8

## User story
As a developer, I use one set of tokens and components so every screen looks like OneBridge.

## Acceptance criteria
- Tokens exist as CSS variables and a Tailwind preset: Bridge Orange #F68713, Charcoal #393536, Charcoal Deep #1E1E1E, Warm Paper #FAF7F2, Sand #EFE8DC, Deep Orange #A04E08, Success #27704A, Warning #C99700, Error #C2362B, Info #3B6EA8, Sand border #E3D9C8.
- Radius 12 (inputs, chips), 16 (buttons, tiles), 22 (cards), full arch (hero). Spacing 4, 8, 12, 16, 20, 24, 32.
- Manrope self-hosted with Noto Sans Devanagari fallback. Weights: ExtraBold names and titles, Bold labels, Regular body.
- Dark mode tokens defined.
- Components with Storybook stories (light, dark, loading, empty, error): arch card, keystone badge, action button (primary, secondary, ghost), QR frame, status chip, stat tile, side drawer, toast, empty state, offline banner, update banner.
- Automated contrast test fails the build if any token pair used for text drops below 4.5:1.
- Primary orange button uses charcoal text. No component uses orange as text on a light background.

## States to design
Every component in loading, empty, error, disabled, focus.

## Tests required
Contrast test, visual snapshot tests, keyboard focus visible on every control, reduced-motion behaviour.

## Out of scope
Figma sync, custom template builder.
