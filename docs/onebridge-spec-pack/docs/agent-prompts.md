# Agent prompts

Copy these into Antigravity. Replace `{...}` placeholders. Use a fresh conversation for each prompt. Always use Planning mode.

---

## PROMPT 0: Orientation (once, no code)

```
You are the lead engineer for OneBridge Grid. This is a long project with strict rules. Your job in this session is to read and confirm, not to build.

READ, in this order, completely:
1. AGENTS.md
2. docs/decisions.md
3. docs/adr/ADR-0001, ADR-0002, ADR-0003
4. docs/PLAN.md
5. docs/features/README.md and every file in docs/features/
6. docs/spec/ (PRDs, UI/UX specification, printed card designs, reference images)

THEN produce one document, docs/orientation-report.md, with these sections:
A. Restatement: in 15 lines or fewer, what we are building and the 10 rules from AGENTS.md section 3 you consider most likely to be broken by accident.
B. Conflicts: every place where two files disagree, with file names and the exact lines. If none, write "None found".
C. Gaps: every place where a feature file is silent about something you would need to build it (a field, a state, a number, a message, a permission). One line each: feature id, what is missing.
D. Risky requirements: anything you think is wrong, unsafe or impossible, with a reason.
E. Questions: copy each gap and conflict that needs a human decision into docs/questions.md using the format in AGENTS.md section 11.

RULES FOR THIS SESSION
- Do not write or change any code, config or dependency.
- Do not edit any existing spec file. Only create docs/orientation-report.md and docs/questions.md.
- Do not answer your own questions. Do not assume.
- If something is unclear, it goes in section C or E. Silence is not permission.

When finished, stop and wait for my review.
```

---

## PROMPT 1: Build one feature (use per feature file)

```
TASK: Implement feature {FEATURE_ID} from docs/features/{FILE}.md.

STEP 0: LOAD CONTEXT
Read AGENTS.md, docs/decisions.md, the ADRs, docs/PLAN.md, the feature file, and the files for every feature it depends on (Depends on line). Read nothing else unless needed; if you need another file, say which and why.

STEP 1: PLAN (do not write code yet)
Output a plan with exactly these sections, then STOP and wait for my approval:
1. Scope: the acceptance criteria of this feature as a numbered list, copied word for word from the feature file. Number them AC-1, AC-2, ...
2. Out of scope: copy from the feature file. Add anything else you will deliberately not do.
3. Contract changes: every new or changed endpoint, request and response field, event, and data model field, written as OpenAPI or schema snippets. Mark each as "from feature file" or "PROPOSED by me". Proposed items need my approval.
4. Files: the files you will create or change, grouped by module.
5. Tests: for each AC, the test(s) you will write (name, level, what it asserts). Include failure and edge cases and the cross-tenant isolation test. No AC may be without a test.
6. States: every UI state you will build (loading, empty, error, offline, plus those listed in the feature file).
7. Dependencies on fakes: which fake adapters or stubs you will use.
8. Gaps and questions: everything the feature file does not specify that you need. Classify each A, B or C using AGENTS.md section 11. Class C items go into docs/questions.md. State clearly which parts are blocked by them.
9. Risks: anything that could break an existing feature or a rule in AGENTS.md section 3.

STEP 2: IMPLEMENT (only after I reply "approved")
Order of work:
a. Update the contract in packages/api-contracts and regenerate clients.
b. Write failing tests for every AC.
c. Implement until the tests pass.
d. Build every state in section 6 of your plan.
e. Add telemetry and audit events. Check that no personal data reaches logs, events or analytics names.
f. Run: pnpm lint, pnpm typecheck, pnpm test, and pnpm test:e2e where relevant. Fix failures. Do not disable, skip or weaken any test, rule or check.

STEP 3: COMPLETION REPORT
Output docs/reports/{FEATURE_ID}-report.md containing:
- Traceability table: AC number | status (Done / Partial / Not done) | test names | main files.
- Anything Partial or Not done, with the reason. Never mark an AC Done unless a passing test proves it.
- Commands run and their results (pass or fail).
- Decisions you made (Class B only) and any ASSUMPTIONS. Class C items must not appear here: they belong in docs/questions.md.
- Contract changes actually made.
- Known limitations and follow-ups.

HARD RULES
- Work only on {FEATURE_ID}. Do not change other features, except through their public API or to fix a contract you were told to change.
- Do not invent fields, endpoints, error codes, copy, limits, colours or behaviour. If it is not in the feature file, decisions.md or an ADR, it is a question (Class C), not a decision.
- Do not add dependencies without asking.
- Do not touch docs/spec/, AGENTS.md or docs/decisions.md except to append to the agent section of decisions.md.
- If you hit anything that forces a change to a rule or decision, stop and ask.
- Small commits using Conventional Commits, one per logical change.
```

---

## PROMPT 2: Independent review of a finished feature (fresh conversation)

```
TASK: Audit the implementation of {FEATURE_ID}. You did not write it. Assume it has defects and look for them.

READ: AGENTS.md, docs/decisions.md, the ADRs, docs/features/{FILE}.md, docs/reports/{FEATURE_ID}-report.md, and the code and tests it names.

DO NOT change any code. Produce docs/reviews/{FEATURE_ID}-review.md with:
1. Acceptance criteria check: for each AC, Verified / Not verified / Wrong, with the evidence (test name or file and line). A criterion counts as verified only if a test would fail when the behaviour breaks.
2. Rule violations: check every rule in AGENTS.md section 3, one line each (Pass or Fail with evidence). Especially: tenantId on every query, server-side authorisation, no personal data in logs or events, idempotency on writes, problem+json errors, design tokens only, orange never as text, no localStorage for tokens or leads.
3. Invented behaviour: anything the code does that no source file asks for (extra fields, endpoints, copy, limits, behaviour).
4. Missing states or tests.
5. Report accuracy: any claim in the completion report that the code does not support.
6. Verdict: Accept / Accept with fixes / Reject, and a numbered list of required fixes.

Run pnpm lint, typecheck, test yourself and include the results. Do not trust the report.
```

---

## PROMPT 3: Fix review findings

```
TASK: Fix the findings in docs/reviews/{FEATURE_ID}-review.md for {FEATURE_ID}.

First output a short plan listing each required fix and how you will verify it. Wait for my approval. Then fix only those items, add or strengthen tests for each, re-run lint, typecheck and tests, and update docs/reports/{FEATURE_ID}-report.md. Do not make any other change. If a fix needs a decision, put it in docs/questions.md and stop on that item.
```

---

## PROMPT 4: Step gate check (after the last feature of a step)

```
TASK: Check the exit gate for Step {N} in docs/PLAN.md.

For each condition in the gate, state Met / Not met with evidence (command output, test name, or file). Run the full pnpm lint, typecheck, test and test:e2e. List every item in docs/questions.md that is still open and which later feature it affects. Do not change code. Output docs/reviews/step-{N}-gate.md and stop.
```

---

## How to use these

1. Run PROMPT 0 once. Answer every question in docs/questions.md by editing docs/decisions.md or the feature file (not by chatting). Then re-run PROMPT 0 until sections B and C are empty or accepted.
2. For each feature in the order of docs/features/README.md: PROMPT 1, review the plan, reply "approved", then PROMPT 2 in a new conversation, then PROMPT 3 if needed.
3. After the last feature of a step: PROMPT 4. Start the next step only when the gate is met.
4. Commit after each accepted feature.
