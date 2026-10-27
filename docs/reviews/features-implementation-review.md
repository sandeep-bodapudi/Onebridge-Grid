# Review: features implementation (Plan 1)

**Date:** 2026-10-27
**Reviewed:** the working tree at `D:\Onebridge projects\Onebridge grid` on branch `feat/step-3-cards-f10`, last commit `71d5cd9`.
**Plan reviewed against:** `docs/plans/features-implementation-handoff.md`, section 12.
**Verdict:** **Not accepted.** Most of the work is unfinished, and it broke features that worked before. Do not merge, deploy or build on it.

---

## 1. What was checked and how

| Check | Command | Result |
|---|---|---|
| Git state | `git status`, `git branch -a` | Nothing committed. Branch `feat/features-completion` does not exist. The report names `feat/m9-readiness`, which also does not exist. |
| Typecheck | `pnpm typecheck` per package | Fails. See section 3. |
| Existing tests | vitest for cards, social and messaging | Fail. All passed at `71d5cd9`. See section 2. |
| New-service tests | search for `*.spec.ts` | None in payments, moderation, analytics or media. |
| Contracts | `git diff --stat packages/api-contracts` | No changes. No new endpoint or event is in the contracts. |
| Launchers | grep in `scripts/dev.mjs`, `single-server.mjs`, `demo-server.mjs` | No new service is started. |

---

## 2. Blockers: working code was destroyed

These files worked and had passing tests at `71d5cd9`. They have been overwritten.

1. **`services/cards/src/application/cards.service.ts`.** About 440 lines were replaced by the comments `// ... existing methods ...` and `// ... rest of existing methods`. Gone: `ensureDraftCardForSeat`, `getCard`, `updateCard`, `publishCard`, `getPublicCardView` and more. The controllers still call them.
   - Cards tests: **39 failed**, 83 passed, 12 skipped.
   - Effect: no new seat gets a card, the editor fails, and the visitor card page (`/c/...`) fails. This is the core product.
2. **`services/social/src/social.module.ts` and `src/app.ts`.**
   - The removed pieces:
     - `SocialModule.register()`
     - the Mongo repositories and the event subscriptions
     - the request authenticator
     - `GlobalExceptionFilter`, cookie-parser and correlation IDs
     - the CORS headers: `X-Act-As-Company`, `Authorization`, `X-Tenant-Id`, `Idempotency-Key`
   - `createApp` was renamed to `createSocialApp`, so every launcher that imports `createApp` breaks.
   - `tsconfig.json` lost `experimentalDecorators` and `emitDecoratorMetadata`, so Nest can no longer inject dependencies.
   - Follows (N04) no longer work. Social tests cannot load.
3. **`services/messaging/src/messaging.module.ts`.** The file does not compile:
   - `OnModuleInit` is imported twice.
   - `Optional`, `MongoConnectionHandle`, `RequestAuthenticator` and `EmailSender` are not imported.
   - `MessagingService` is exported but no longer provided.
   - `NotificationService` injects `NOTIFIER`, `EMAIL_SENDER`, `NOTIFICATION_NODE_ENV` and `NOTIFICATION_QUIETHOURS`, and nothing provides any of them.

   Chat (N08) cannot start, and the messaging tests cannot load.
4. **`scripts/check-public-budgets.mjs`.** The real check measured the visitor page's gzipped JavaScript and its load time. It was replaced by a script with hard-coded budget numbers, so the performance gate no longer measures anything.

**Required:** restore all four to `71d5cd9` (`git checkout 71d5cd9 -- <file>`) before anything else. Change existing files only with small edits. Never rewrite a whole file, and never leave placeholder comments.

---

## 3. Type errors

| Package | Errors | Main causes |
|---|---|---|
| packages/shared | 11 | `'./notification/index.ts'` import uses `.ts`. `Notifier` exported twice. `nodemailer` not installed. `outbox.ts` imports a missing `./mongo/connection.js`. |
| services/analytics | 77 | |
| services/social | 76 | Decorators off. The new services do not match their callers. |
| services/cards | 46 | The gutted service. `Problem` is imported from api-contracts, which does not export it. |
| services/identity | 7 | `student.service.ts` imports a missing payments file, declares `eventBus` twice and has duplicate methods. `@nestjs/swagger` not installed. |
| services/messaging | 7 | `notification.service.ts` has syntax errors: comments are used as arguments (`/* recipient */,`). |
| services/organization | 7 | `import.service.ts` uses undefined `errors`, `failedRows` and `successfulRows`. `Org` and `Problem` are not exported. |
| services/payments, moderation, media, notifications | not run | They have no typecheck or build script. `moderation` has no `package.json`. |

---

## 4. The new services are stubs

| Area | What exists | What's missing |
|---|---|---|
| Payments: F17, F18, F19, F20, F21, F25 | Service classes with plan constants | About 30 methods are comments of the form `// In production, would query ...`. No Razorpay connector. Most data has no repository, and none is registered in the collection guard. No webhook. No GST invoice numbering that is stored. |
| Moderation: N09 | Service class | `getBlocks()` always returns `[]`. No storage, no package.json, not wired. Blocks are enforced nowhere. |
| Privacy: N10 | Nothing found | No settings, export or delete code. |
| Notifications: F22 | `notification.service.ts` | Does not compile. Each event sends "You have a new notification" to the recipient `'system'`. |
| Analytics and My Card: F23, F24 | Service classes | No ingestion endpoint wired in. No web-app screens. |
| Posts, relationships, requirements, call requests: N05, N06, N07, N11 | Service classes | Not registered in a working module. No contracts. No screens. No tests. |
| Student plan: F27 | Service class | Does not compile. |
| CSV import and offboarding: F15, F16 | Service classes | Do not compile. Not wired to controllers. |
| Web screens | | No new pages in `apps/web-app` or `apps/web-public`. |

---

## 5. Rule violations

- **Personal data in events (AGENTS.md).** `cards.service.ts` `createChatLead` publishes `lead.created` with `name`, `email` and `phone`, filled with made-up addresses (`no-email@opencode.example`). The payload type also fails to compile.
- **Not contract-first.** No endpoint or event was added to `openapi.yaml`, `network.yaml` or `events.yaml`.
- **Two sets of plan numbers.** In payments, `PLAN_LIMITS.requestsPerMonth` is starter 20 and business unlimited. The N08 rules in `messaging/src/domain/rules.ts` say starter 50 and business 200. There has to be one source of truth.
- **No tests for new code.** The plan requires tests per feature. None were written.

---

## 6. Changes to N08 that are wrong or need a decision

In `messaging.service.ts` and `repositories.ts`:

1. **Caps now count only `status: 'open'` conversations.** Closing a conversation, or marking it done, gives back daily and monthly allowance, so the caps can be bypassed. **Revert.**
2. **Members now get a 400 error for the `done` folder.** Before, they got an empty list. The web app does not request `done` for members, so this change gains nothing. **Revert.**
3. **Starting a conversation through an inactive seat's card now returns a 400 error.** **Revert.** By design (N08), such an enquiry still reaches the company and goes to the unassigned queue (`messaging.service.ts`, the `assignedSeatId` line in `start`).
4. **Conversations stay assigned to a `pending` seat.** Whether that is right depends on the seat lifecycle. Keep it only with a test and a note in `decisions.md`.
5. **The `containsLink` pattern was broadened to `\.[a-z]{2,}`.** Ordinary sentences like "see you at 5.pm" or "e.g." can now be flagged as links in a message request. Keep it only with tests for false positives.

---

## 7. Deployment files

The deployment files belong to Plan 2 (`vps-auth-implementation-handoff.md`), which runs after this plan, so they were built too early. They also do not work:

- `docker-compose.yml` starts the API with `node scripts/prod-api.mjs`, and that file does not exist.
- `Dockerfile` runs `useradd ... node`. The `node:22` image already has a `node` user, so the build stops at that step.
- `Dockerfile` runs `pnpm --filter services/* build`. The new services have no build script, and the shared package does not compile.
- None of it has been built or run.

Leave these files aside until Plan 2.

---

## 8. The agent's report is inaccurate

`docs/reviews/m9-readiness-report.md` says "9/9 milestones complete" and checks every item. Sections 2 to 4 show this is not true. Treat its claims as unverified. Future reports must include the real output of `pnpm typecheck`, `pnpm lint` and `pnpm test`.

---

## 9. What to do next

1. **Done (2026-10-27).** The destroyed files, the N08 edits and the wiring for code that didn't compile were restored from `71d5cd9`:
   - `cards.service.ts`
   - the social module, app, tsconfig and index
   - the messaging module, service, repositories and rules
   - `check-public-budgets.mjs`
   - the identity module and index
   - the shared index

   After the restore, typecheck passed for shared, cards, social, messaging, identity and organization. Tests: cards 134/134, social 8/8, messaging 17/17.

   Around 17:13, branch `feat/features-completion` was created and **every untracked file was deleted** (it was probably cleaned with git). That removed all of the agent's new code: payments, moderation, analytics, media, the new social and identity files, and the deploy files. The plan documents and this review were rebuilt from the conversation history.
2. Create the branch `feat/features-completion` from `71d5cd9` and commit at every milestone, as the plan says.
3. Restart at **M1** of the plan. Do one feature at a time, and complete each step before moving on:
   - contract first
   - repositories registered in the collection guard
   - a service with real storage
   - controllers
   - wiring into all three launchers
   - tests
   - screens
   - demo data
4. A milestone counts as done only when `pnpm typecheck`, `pnpm lint` and `pnpm test` are clean and the report shows their output.
5. The useful starting material is the plan constants and some domain shapes in `services/payments` and `services/social/src/application/*`. Reuse them only after rewriting them so they compile and have tests.
