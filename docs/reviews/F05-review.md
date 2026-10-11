# F05 Audit Review

## 1. Acceptance Criteria Check
- **AC-1** (Tokens exist as CSS variables and a Tailwind preset): **Verified**. `packages/ui-kit/src/styles/tokens.css` and `packages/ui-kit/tailwind.config.ts`.
- **AC-2** (Radius and spacing): **Verified**. `packages/ui-kit/tailwind.config.ts`.
- **AC-3** (Manrope self-hosted with fallback): **Verified**. Configured in `tailwind.config.ts`.
- **AC-4** (Dark mode tokens defined): **Verified**. Defined under `.dark` class in `tokens.css`.
- **AC-5** (Components with Storybook stories: arch card, keystone badge, action button, QR frame, status chip, stat tile, side drawer, toast, empty state, offline banner, update banner): **Not verified**. The components exist minimally in `src/components/index.tsx`, but no `.stories.tsx` files were created for them to cover light, dark, loading, empty, and error states.
- **AC-6** (Automated contrast test fails the build if < 4.5:1): **Verified**. Covered by `packages/ui-kit/tests/contrast.spec.ts`.
- **AC-7** (Primary orange button uses charcoal text; no orange text on light bg): **Verified**. Covered by styling and `contrast.spec.ts`.

## 2. Rule Violations
- **Strict TypeScript/Linting Rules**: **Fail**. `eslint .` fails due to the use of `// @ts-ignore` in `packages/ui-kit/tests/components.spec.tsx` (lines 16 and 22). `@typescript-eslint/ban-ts-comment` requires `@ts-expect-error` instead.
- **Tenant ID on every query**: **Pass** (N/A).
- **Server-side authorisation**: **Pass** (N/A).
- **No personal data in logs**: **Pass** (N/A).
- **Idempotency on writes**: **Pass** (N/A).
- **Problem+json errors**: **Pass** (N/A).
- **Design tokens only**: **Pass**. All colors use tailwind/CSS variables.
- **Orange never as text on light background**: **Pass**. Explicitly verified by tests.

## 3. Invented Behaviour
- **None**. The components provided match the AC specification without adding unrequested features.

## 4. Missing States or Tests
- **Visual snapshot tests missing:** The feature spec specifically requires "visual snapshot tests", but none were implemented.
- **Reduced-motion behaviour missing:** The CSS/Tailwind does not explicitly implement `motion-reduce` overrides or fade fallbacks for interactions.
- **Storybook Stories Missing:** All components lack `*.stories.tsx` coverage for all 5 required states (light, dark, loading, empty, error).
- **Loading State:** The loading state is missing for components other than `ActionButton`.

## 5. Report Accuracy
- **False Claim:** "basic snapshot/accessibility testing implemented." (There are no snapshot tests).
- **False Claim:** "All tests (pnpm test), typechecks (tsc), and lints pass. No warnings." (`eslint .` actually fails).

## 6. Verdict
**Verdict: Reject**

### Required Fixes:
1. Replace `// @ts-ignore` with `// @ts-expect-error` in `tests/components.spec.tsx` so the workspace lint passes.
2. Implement Storybook stories (`.stories.tsx`) for every component listed in AC-5 to demonstrate light, dark, loading, empty, and error states.
3. Implement Visual Snapshot testing (e.g. `expect(container).toMatchSnapshot()`) to satisfy the testing requirement.
4. Implement and test `reduced-motion` behaviour globally or at the component level to respect accessibility settings.
