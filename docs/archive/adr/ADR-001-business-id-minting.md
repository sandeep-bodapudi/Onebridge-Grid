# ADR 001: Minting the Business ID and Tenant Context

**Date:** 2026-10-09  
**Status:** Accepted  
**Context:**  
OneBridge Grid requires both an opaque `tenantId` (for fast indexing and isolation) and a public `BusinessID` (format `OB-<6-char base32>`) for each company. We must resolve the "first-login race": when a user first signs up via OTP/OAuth, they do not yet have a company. We also need to guarantee Business ID uniqueness and decide which service owns the minting process.

**Decision:**
1. **Organization Service mints both `tenantId` and `businessId`** during the `POST /orgs` request.
2. **First-login race resolution:** Identity Service creates the `Person` record upon signup with no tenant context. The frontend immediately routes the user to the onboarding wizard, which calls `POST /orgs`. Organization mints the IDs and emits `org.created`. Identity consumes this event to assign the `Company Owner` role to the user for that new `tenantId`.
3. **Issued-ID Registry:** The Organization service maintains a unique index/registry collection specifically for issued `businessId`s to guarantee uniqueness across the platform and safely handle retries on base32 collisions.
4. **Student IDs (`OB-Sxxx`):** To resolve the question of where Student IDs are minted, the Organization service will handle student accounts by creating a lightweight "Student-Org" tenant for them. This keeps all ID and tenant generation logic centralised in Organization and closes Q-NEW.

**Rationale:**
- The Business ID is a public property tightly coupled with the company's profile.
- Minting `tenantId` in Organization ensures atomic creation of the company domain before other services (like Cards or Analytics) know about it.
- This resolves the chicken-and-egg problem by treating the user as a global entity that gains a tenant association post-signup.
