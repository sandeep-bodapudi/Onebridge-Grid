# ADR-0002: Lead encryption and blind index
Date: 2026-10-09   Status: Accepted

## Context
Share-back and enquiry leads hold visitor personal data. PRD requires encryption at rest. We also need duplicate detection (same phone, same card, 24 hours) which cannot query ciphertext.

## Decision
1. **Encrypt one payload per lead.** The fields `name`, `phone`, `email`, `company`, `note` are serialised to JSON and encrypted with AES-256-GCM. Random 96-bit IV per record. Additional authenticated data (AAD) = `tenantId|leadId`, so ciphertext cannot be moved to another record or tenant.
2. **Keys:** per-tenant data key (DEK), wrapped by a master key in a managed KMS or vault. The lead stores `kid` (key ID), `iv`, `authTag`, `ciphertext`. Rotation is lazy: new writes use the newest key, a background job re-encrypts old records.
3. **Blind index** for duplicate detection: `HMAC-SHA256(indexKey, tenantId + "|" + E.164 phone)`, stored with `indexVersion`. `indexKey` is a separate key in KMS/vault, never stored in the database or in the same secret as the encryption key. The index is per tenant, so the same number in two companies gives different values.
4. Phone numbers are normalised to E.164 before hashing (default country code +91).
5. **Lookup index:** `(tenantId, cardId, phoneBlindIndex, createdAt)`. Duplicate rule: same index on the same card within 24 hours returns the original confirmation without creating a second lead (and does not notify twice).
6. **Who can decrypt:** only the Cards service, only in request handlers that serve an authorised role (owner of the seat, managers in scope, admins). Decrypted values are never logged. Lead reads are audited with `lead.viewed` (counts, not content).
7. **Erasure (DPDP):** deleting a lead deletes the record. Destroying a tenant's DEK renders all its leads unreadable (crypto-shredding), available as a last-step option.
8. The PWA's offline copy uses WebCrypto with a non-extractable key (see F24). It is a separate mechanism.
9. Not encrypted: `leadId`, `tenantId`, `cardId`, `ownerSeatId`, `source`, `createdAt`, consent record (timestamp, notice version).

## Consequences
- Exact-match lookups only (no partial search on phone or email).
- If `indexKey` leaks, an attacker with the database can test guesses for phone numbers (small keyspace). Hence the key is held separately in KMS and access is audited.
- Key rotation for the index requires recomputing indexes (use `indexVersion`).
