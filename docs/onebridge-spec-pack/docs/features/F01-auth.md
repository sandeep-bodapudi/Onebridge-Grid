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
