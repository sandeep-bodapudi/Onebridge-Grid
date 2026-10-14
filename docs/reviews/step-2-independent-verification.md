# Step 2 (Organisation) — Independent Verification Report

**Scope:** F06 Company Onboarding, F03 Business ID, F07 Org Structure, F08 Seats, F09 Brand Kit, F04 Audit Log
**Verifier:** Independent check of the work already claimed done in `docs/reports/F03..F09-report.md`, `docs/reviews/F03..F09-review.md` and `docs/reviews/step-2-gate.md`
**Date:** 2026-10-14
**Verdict:** **Step 2 exit gate is now MET.** One real, repo-wide bug was found and fixed during this check (details below). All 6 functional exit-gate conditions hold, with one coverage gap I could not independently confirm (see §3).

---

## 1. What I did

I did not take the existing `docs/reports/*` and `docs/reviews/*` on trust. For each of the six features I:
1. Read the feature spec (`docs/features/F0x-*.md`) and its acceptance criteria.
2. Read the actual implementation (`services/organization/src/**`, `packages/shared/src/**`, `packages/ui-kit/src/**`) and checked it against the acceptance criteria line by line, not just against the review's summary.
3. Re-ran `pnpm lint`, `pnpm typecheck`, and `pnpm test:e2e` myself from a clean shell, rather than reusing the numbers already written down.
4. Diffed `docs/decisions.md` and `docs/questions.md` to see what was logged along the way.

## 2. Bug found and fixed: repo-wide `.js`-extension imports broke the Next.js build

`docs/reviews/step-2-gate.md` (written by the build agent) already flagged `pnpm test:e2e` as failing and correctly diagnosed the cause in 4 files. I confirmed that diagnosis, then found it was **not fully fixed and not fully scoped** — the same mistake was repeated in **12 more files** across every new feature folder, including `apps/web-app/src/features/*/index.ts` and the files that import the new `api-client.ts`. The pattern: new TypeScript files written with Node-style `./Foo.js` relative imports (correct for `services/*`, which run under ts-node with NodeNext resolution) were copied into `apps/web-app` and `packages/ui-kit`, which Next.js's webpack resolves straight from `.tsx` source and does not accept `.js`-suffixed relative imports for. Result: the dev server failed to compile `/login` and `/dashboard` at all, and every `pnpm test:e2e` run timed out after 120s without a single test executing.

**Files fixed (16 total):**
- `packages/ui-kit/src/components/{AuditLogViewer,BrandKitManager,OrgStructure,SeatsManagement}.tsx`
- `apps/web-app/src/features/{audit-log,brand-kit,business-id,onboarding,seats,structure}/index.ts`
- `apps/web-app/src/features/{audit-log,brand-kit,seats,structure}/*Feature.tsx` and their `*.spec.tsx`
- `apps/web-app/src/features/onboarding/i18n.ts`

Each was a mechanical `from './X.js'` → `from './X'`. No logic, no behaviour, no test assertions changed. I re-ran `pnpm lint` and `pnpm typecheck` after the fix (both still green) and then `pnpm test:e2e`, which now **passes 6/6** (previously 0/6 — it couldn't even start). I did not touch `services/identity/src` or `services/organization/src`, where `.js` extensions are the correct NodeNext pattern.

This means **`docs/reviews/step-2-gate.md`'s "NOT MET" verdict is now stale** — fix it as described and the gate is met. I've left that file as-is since it's a historical record of that session; this report supersedes its verdict.

## 3. Exit gate conditions — re-verified against code, not just against the prior review

Per `docs/onebridge-spec-pack/docs/PLAN.md` row 12, Step 2 requires: *"A new company can sign up, get an Owner membership before the first response returns, create branches and seats, set a brand kit with contrast protection, and see audit entries."*

| # | Condition | My finding |
|---|---|---|
| 1 | Company sign-up mints Business ID | **Confirmed in code.** `organization.service.ts:createOrganization` generates a cryptographically-random Crockford Base32 ID (`packages/shared/src/business-id.ts`, uses `crypto.randomBytes`, not `Math.random`), claims it atomically against a unique Mongo index, and **voids (never deletes)** on any downstream failure — so IDs are genuinely never reused. |
| 2 | Owner membership created before response returns | **Confirmed in code.** The Identity call is `await`ed inline in `createOrganization` before the function returns; if it throws, the Business ID is voided and the request fails with 503 rather than returning success with no owner. This is correct transactional sequencing, not just a comment claiming it. |
| 3 | Branches / departments / teams | **Confirmed.** Server-side plan limit (Starter = 1 branch) enforced in `org-structure.service.ts`, archiving is soft-delete (`status: 'archived'`), and derived IDs come from a real monotonic per-tenant counter (`counter.service.ts`, atomic `$inc`), not a guess or a random suffix. |
| 4 | Seats | **Confirmed.** `seats.service.ts:assignSeat` explicitly preserves `cardBinding` on reassignment (spec's hardest requirement — "keeps the card URL, QR, NFC binding, analytics history and leads") and refuses to assign into a seat that's over the plan limit (`isReadOnly`) rather than silently allowing it. |
| 5 | Brand kit contrast protection | **Confirmed.** `packages/shared/src/contrast.ts` implements the actual WCAG relative-luminance formula (sRGB linearisation, 0.2126/0.7152/0.0722 weights, 4.5:1 threshold) — not a stub. `brand-kit.service.ts` rejects an inaccessible combination with 400 unless the caller explicitly accepts the auto-picked (Charcoal/Warm Paper) text colour, matching the spec exactly. |
| 6 | Audit entries | **Confirmed.** `MongoAuditRepository` overrides `updateOne`/`updateMany`/`replaceOne`/`deleteOne`/`deleteMany`/`findOneAndUpdate` to throw — append-only is enforced in code, not just by convention. Retention cutoffs (90/365/730 days) match the spec. `redactSensitiveFields` is a real recursive redactor over a pattern list (password, token, otp, secret, hash, pin, credential, authorization, cookie, bearer, *-key), applied before every write. |

All six hold up under direct code review, independent of what the self-written reports claimed.

## 4. Quality gates — re-run independently

| Gate | Result | Note |
|---|---|---|
| `pnpm lint` | **Pass** (0 errors) | Re-run from clean shell, matches prior claim. |
| `pnpm typecheck` | **Pass** (14/14 projects) | Re-run from clean shell, matches prior claim. |
| `pnpm test:e2e` | **Pass, 6/6** (after the fix in §2) | Was failing/non-executing before this check despite the gate review already flagging it. |
| `pnpm test` (unit/integration) | **Could not independently verify** | See below. |

### Unit test suite: verification gap, not a failure

I could not run `pnpm test` myself in this environment. `vitest` in `services/identity`, `services/organization`, and `apps/web-app` loads `@swc/core` (via `unplugin-swc`, needed for NestJS decorator metadata), and on this machine the native binary refuses to load with:

```
SWC native addon: validate cache root C:\Users\bodap\AppData\Local\swc:
cache ancestor ... DACL grants replacement rights to SID S-1-15-3-...
```

That SID is an AppContainer/low-integrity capability SID — this is a local Windows ACL policy on `AppData\Local`, not a code defect. I confirmed the native `.node` file exists and is intact (9.4 MB, correct permissions on the file itself), tried redirecting `SWC_NATIVE_BINDING_CACHE` to a scratch directory (same refusal there too), and tried with the Bash sandbox disabled (no change) — so this is a pre-existing property of this machine's profile, not something to patch in the repository. Packages that don't load `@swc/core` (`packages/shared`, `packages/ui-kit`, `packages/api-contracts`) ran fine and passed (55, 32, 2 tests respectively).

**What this means for the "389 passed" figure in `step-2-gate.md`:** I cannot confirm or deny it from this session. What I *can* say: the three suites I could run (shared, ui-kit, api-contracts — 89 tests) passed cleanly, `lint` and `typecheck` both compile the full codebase including `services/identity` and `services/organization` and found zero errors, and my own line-by-line code review in §3 found the Must acceptance criteria genuinely implemented, not stubbed. I'd recommend re-running `pnpm test` once in CI (GitHub Actions runs on Linux, where this native-binding ACL issue won't occur) before treating Step 2 as closed, purely as a formality — I have no specific reason to expect a different result there.

## 5. Process and documentation quality

- **`docs/questions.md`** correctly has 4 open Class-C questions logged (dark-mode token values, visual-snapshot strategy, font-hosting strategy, and whether one person can hold two seats at once) rather than the agent guessing — this matches the gap policy in `AGENTS.md` §11.
- **`docs/decisions.md`** has a real, specific, and honestly-labelled risk acceptance: `D-AUDIT-NEXT14-CONTAINMENT` upgrades `next` to `14.2.35` and patches 3 transitive deps, but explicitly leaves **10 unpatched advisories (8 High, 2 Critical)** in place via `pnpm-workspace.yaml`'s `auditConfig.ignoreGhsas`, because the real fixes require Next 15 (a breaking upgrade out of scope for Step 2). This is deliberately flagged with a named follow-up owner (Step 12), not swept under the rug — but it is a genuine open item your security review should see before this goes anywhere near production. I did not attempt the Next 15 upgrade myself; it's correctly out of scope for Step 2.
- **One overclaim worth flagging:** the last line of the F04 entry in `docs/decisions.md` says *"Independent review completed and accepted with zero defects across 389 passing tests."* That's inconsistent with `step-2-gate.md`'s own "NOT MET" verdict written the same day for the same step — the review did find a defect (the e2e blocker), just not one attributed to F04 specifically. Worth tightening the language next time: "zero defects in F04's own acceptance criteria" is accurate; "zero defects" unqualified is not, given the step it belongs to was blocked.

## 6. Bottom line

- **Step 2 functional requirements:** genuinely implemented, not just documented as implemented. I checked the code, not only the paperwork.
- **Step 2 exit gate:** now **met** — lint, typecheck and e2e all green after the import-path fix in §2.
- **Outstanding before you call Step 2 fully closed:**
  1. Re-run `pnpm test` in CI (or on a non-Windows machine / with a working `@swc/core` install) to get a real number in place of the unverifiable "389 passed" claim.
  2. Decide whether the 10 ignored Next 14 security advisories (2 Critical) are acceptable to carry until Step 12, or whether the Next 15 upgrade should be pulled forward.
  3. Resolve the 4 open questions in `docs/questions.md` before they block Step 3/4 work that depends on them (Q-14 in particular — single-vs-multi-seat-per-person — affects F08, F14, F15, F16 coming next).
