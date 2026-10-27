# F01: Authentication
Priority: Must     Build step: 1     Depends on: none
Source: P1-ID-02

## User story
As a user, I sign in with my mobile number (OTP), Google or Microsoft so I can reach my company workspace.

## Acceptance criteria
- Mobile OTP is the primary login. OTP arrives in under 30 s. If SMS fails, fall back to WhatsApp, then email.
- OTP expires in 5 minutes, is single-use, and is stored hashed.
- Rate limits: 5 OTP requests per phone per hour, 5 wrong attempts then a 15-minute lock. Limits also apply per IP.
- Google and Microsoft sign-in (personal sign-in via OpenID Connect; not enterprise SSO) link to an existing person by verified email or phone only.
- Refresh cookie uses `SameSite=Lax`, because Strict breaks the return from Google and Microsoft.
- Access token is short-lived (15 min), kept in memory only. Refresh token rotates on every use and sits in an httpOnly, Secure, SameSite cookie. Reusing an old refresh token revokes the whole session family.
- Users can list and revoke their own sessions and devices.
- TOTP MFA: optional for users, mandatory for Owner and Admin on Business plan and above. Mandatory means login is blocked until set up.
- Error messages never reveal whether a phone number is registered.

## States to design
OTP entry, resend countdown, wrong code, locked, expired code, MFA setup, MFA challenge, session expired.

## API and events
`POST /auth/otp`, `POST /auth/verify`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/sessions`, `DELETE /auth/sessions/{id}`, `POST /auth/mfa/setup`, `POST /auth/mfa/verify`.
Event: `user.registered`.

## Data
`Person` (userId, phone, email, name, authProviders, mfa), `Session` (family id, device label, revokedAt), `OtpChallenge` (hashed code, expiry, attempts).

## Tests required
Rate limit and lockout, refresh rotation and reuse detection, MFA enforcement by role and plan, fallback channel order (with fake providers), no account enumeration.

## Out of scope
SAML/OIDC SSO, SCIM, email and password (decide later if wanted).

## Change (2026-10-27, founder): Google and email + password

Sign-in moves to **Continue with Google** and **email + password with 6-digit email codes**, for the VPS launch on onebridgecard.com. This replaces the "email and password" line under Out of scope.

- Phone sign-in stays in the code but is **off in production** (`AUTH_METHODS`); it remains on in development and tests. Phone stays a profile and card field.
- Sign-up: name, email, password, terms and privacy consent; the account is created only after the emailed code is entered. A sign-up with an email that already has an account gets the same answer, and the owner gets a notice instead of a code (no enumeration).
- Passwords: 10 to 128 characters, not the email (or its name part) and not the name; stored with scrypt. No common-password list (founder, 2026-10-27).
- Codes: random 6 digits, 10 minutes, 5 wrong tries end the code, resend after 60 seconds, at most 5 sends per email and 20 per network per hour.
- Sign-in: generic "email and password don't match"; 5 failures per account and 30 per network in 15 minutes, then a wait. A new device, or 30 days since the last code on that device, needs an emailed code. MFA (F01 AC-8) still applies after password and code.
- Forgot password always answers the same; reset and change sign the person out of every other session and send a "password changed" email.
- Google: real ID-token verification against Google's keys; an existing account with the same **verified** email is linked automatically, an unverified one needs the emailed code first.
- API: see `packages/api-contracts/openapi.yaml` (`/auth/methods`, `/auth/signup`, `/auth/signup/verify`, `/auth/login`, `/auth/login/verify`, `/auth/password/*`, `/auth/code/resend`). Decision: D-AUTH-EMAIL.
