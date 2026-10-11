# F01: Authentication — Audit & Review

**Date:** 2026-10-11  
**Auditor:** Independent Code Agent  
**Target:** Feature F01 (Identity & Authentication)  
**Status:** Audit Complete  

---

## 1. Acceptance Criteria Check

| AC | Requirement | Status | Evidence & Defects |
|---|---|:---:|---|
| **AC-1** | Mobile OTP primary login under 30s; SMS fallback to WhatsApp, then email | **Verified** | `otp.spec.ts` tests fallback sequence (`should fallback to WhatsApp when SMS fails`, `should fallback to email when both SMS and WhatsApp fail`). Immediate execution on fake adapters. |
| **AC-2** | OTP expires in 5 min, single-use, stored hashed | **Verified** | `otp.spec.ts` (`should store OTP hashed and not in plaintext`, `should reject already used OTP (single-use)`, `should reject expired OTP (5 minutes window)`). Verified with SHA-256 in `otp.service.ts:20-22, 105-111`. |
| **AC-3** | Rate limits: 5 req/phone/hr, 5 wrong attempts then 15-min lock, per IP | **Verified** | `otp.spec.ts` (`should block 6th request within an hour per phone`, `should block 6th request within an hour per IP`, `should lock for 15 minutes after 5 wrong attempts`). Enforced in `otp.service.ts:39-50, 114-124`. |
| **AC-4** | Google and Microsoft sign-in link to existing person by verified email or phone only | **Wrong** | `oauth.spec.ts` tests email linking, but `auth.service.ts:108` only checks `this.personRepo.findByEmail`. Linking by verified phone is neither implemented nor tested. |
| **AC-5** | Refresh cookie uses `SameSite=Lax` | **Verified** | `tokens.spec.ts` & `auth-api.spec.ts` verify cookie headers in `token.service.ts:107` and `auth.controller.ts:64`. |
| **AC-6** | 15-min access token in memory, rotating refresh token, family revocation upon reuse | **Verified** | `tokens.spec.ts` (`should issue access token with 15 minutes expiry`, `should rotate refresh token upon each refresh call`, `should revoke entire session family if an already-used refresh token is reused`). Verified in `token.service.ts:157-164`. |
| **AC-7** | Users can list and revoke their own sessions and devices | **Wrong** | `auth-api.spec.ts` calls controller directly passing `userId` as an argument. However, `auth.controller.ts:143` does not extract the caller from the Bearer token / auth context; any caller can pass an arbitrary `userId`. In addition, `listSessions` is unpaginated (violating AGENTS.md section 3). |
| **AC-8** | TOTP MFA: optional for users, mandatory for Owner and Admin on Business plan | **Verified** | `mfa.spec.ts` tests RFC 6238 TOTP algorithms and policy matrices (`isMfaMandatory`). Logic in `auth.service.ts:81-89`. (Note: missing integration test through controller). |
| **AC-9** | Error messages never reveal whether a phone number is registered | **Verified** | `otp.spec.ts` verifies identical response message (`message: 'If registered, an OTP has been sent.'`) regardless of phone presence in database. |

---

## 2. Rule Violations (AGENTS.md Section 3)

| Rule | Status | Evidence |
|---|:---:|---|
| **tenantId on every query** | **Fail** | In-memory repositories in `services/identity/src/infrastructure/repositories/*` do not enforce `tenantId` and do not extend `packages/shared/src/tenant.ts` `Repository<T>`. Sessions and OTPs are queried without tenant context. |
| **Server-side authorisation** | **Fail** | `AuthController.listSessions(userId)` and `revokeSession(userId, sessionId)` take `userId` as an unverified function parameter rather than validating and decoding the incoming Bearer access token. |
| **Seats belong to company** | **Pass** | N/A to F01 authentication. |
| **No personal data in logs/events** | **Pass** | `Logger.log` uses scrubbed messages; `correlationId` only logged in `auth.service.ts:62`. |
| **Phone/email of visitors encrypted** | **Pass** | N/A to F01 (visitor leads are in F13). |
| **Token in memory only / Cookie security** | **Pass** | Refresh token is strictly set in `HttpOnly; Secure; SameSite=Lax` cookie. No localStorage usage. |
| **Student ID images in encrypted bucket** | **Pass** | N/A to F01 (handled in F27). |
| **Record consent with timestamp** | **Pass** | Consent checkbox implemented in `AuthFlow.tsx`. |
| **Short links immutable** | **Pass** | N/A to F01. |
| **Disabled chips resolve to neutral page** | **Pass** | N/A to F01. |
| **Contract first** | **Pass** | `openapi.yaml` and `events.yaml` updated and client types generated before code. |
| **Idempotency on write endpoints** | **Fail** | `POST /auth/otp`, `POST /auth/verify`, `POST /auth/refresh` do not process or validate `Idempotency-Key` headers via `IdempotencyInterceptor`. |
| **Modules never read each other's DB** | **Pass** | `services/identity` only accesses its own repositories. |
| **application/problem+json errors** | **Pass** | Controller throws `ProblemException` mapped to RFC 7807 structure. |
| **Lists are paginated** | **Fail** | `GET /auth/sessions` in `auth.controller.ts:143` returns all records without pagination parameters (`limit`, `offset`/`cursor`). |
| **Correlation ID on every request** | **Fail** | `auth.controller.ts:162` hardcodes `correlationId: 'corr-session'` in `revokeSession` instead of using the request context. |
| **Additive changes only** | **Pass** | No breaking schema modifications made. |
| **Feature flag for unfinished features** | **Pass** | N/A to F01 core auth. |
| **Tokens only / No hard-coded colours/radii** | **Pass** | `AuthFlow.tsx` strictly uses `@onebridge/ui-kit` tokens (`rounded-12`, `bg-warm-paper`, `text-charcoal`). |
| **Orange never as text on light background** | **Pass** | `AuthFlow.tsx` uses `text-deep-orange` for text links. |
| **Brand kit contrast check** | **Pass** | Handled in ui-kit and F09. |
| **Touch targets 44px or more** | **Fail** | Resend OTP button (`AuthFlow.tsx:145`) lacks a 44px minimum touch target height. |
| **Respect prefers-reduced-motion** | **Pass** | Enforced at tokens layer (`tokens.css`). |
| **No hard-coded strings (i18n)** | **Fail** | `AuthFlow.tsx:175` contains a hardcoded English string: `"Please wait 15 minutes before attempting again."`. |

---

## 3. Invented Behaviour

1. **`mockProfile` on `handleOAuth`**: `auth.controller.ts:89` accepts a `mockProfile` parameter in the request body for testing shortcut, exposing a non-standard field on the public API interface.
2. **Hardcoded Secret Key in UI Mockup**: `AuthFlow.tsx:195` contains a hardcoded static string `"JBSWY3DPEHPK3PXP"` for MFA setup instead of binding dynamically to the props.
3. **Hardcoded Correlation ID**: `auth.controller.ts:162` uses literal `'corr-session'`.

---

## 4. Missing States or Tests

1. **Missing Controller Integration Tests**:
   - `tests/integration/auth-api.spec.ts` lacks tests for `POST /auth/refresh` (cookie rotation).
   - Lacks tests for `POST /auth/logout` (cookie clearing).
   - Lacks tests for `POST /auth/mfa/setup` and `POST /auth/mfa/verify`.
   - Lacks tests for `POST /auth/oauth/{provider}`.
   - Lacks tests for `verifyOtp` returning `status: 'mfa_required'` or `'mfa_setup_required'`.
2. **Missing Phone-based Account Linking Test**:
   - AC-4 requires linking by verified email *or* phone. No test exists for linking by phone.

---

## 5. Report Accuracy

- **Claim on AC-4**: Report states AC-4 is "Done". In fact, OAuth linking only checks email; phone linking is unhandled.
- **Claim on AC-7**: Report states AC-7 is "Done". In fact, session management has no server-side bearer authorization and lacks list pagination.
- **Claim on Idempotency**: Report omitted the check on AGENTS.md rule 12 (write endpoints accepting idempotency keys).

---

## 6. Verification Commands & Results

| Command | Exit Code | Result |
|---|:---:|---|
| `pnpm lint` | 0 | **Pass** (0 lint errors) |
| `pnpm typecheck` | 0 | **Pass** (0 type errors across 14 workspace projects) |
| `pnpm test` | 0 | **Pass** (47 passed: 31 identity, 9 web-app, 7 ui-kit) |

---

## 7. Verdict & Required Fixes

**Verdict:** **Accept with fixes**

### Required Fixes:
1. **Implement Phone-based OAuth Linking (AC-4):** Check verified phone in `auth.service.ts` when linking OAuth profiles and add automated tests.
2. **Server-Side Authentication on Session Endpoints (Rule 2, AC-7):** Extract and verify the caller's identity from the `Authorization: Bearer <token>` header rather than accepting unauthenticated `userId` parameters.
3. **Paginate `GET /auth/sessions` (Rule 14):** Add `limit` and `cursor`/`offset` parameters to the session listing endpoint and repository.
4. **Enforce `Idempotency-Key` on Write Endpoints (Rule 12):** Wire `IdempotencyInterceptor` into `POST /auth/otp`, `POST /auth/verify`, and `POST /auth/refresh`.
5. **Add Missing HTTP Integration Tests (auth-api.spec.ts):** Cover `refresh`, `logout`, `mfa/setup`, `mfa/verify`, and `oauth` endpoints through `AuthController`.
6. **Eliminate Hardcoded Copy in `AuthFlow.tsx` (i18n Rule):** Replace `"Please wait 15 minutes before attempting again."` with a prop label (`labels.lockedDescription`).
7. **Fix Resend Button Touch Target (Design Rule):** Ensure minimum 44px touch target on the resend button in `AuthFlow.tsx`.
8. **Fix Correlation ID in `revokeSession`:** Pass context correlation ID instead of hardcoded `'corr-session'`.
