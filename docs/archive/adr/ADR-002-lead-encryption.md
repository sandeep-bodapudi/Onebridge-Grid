# ADR 002: Lead Encryption and Blind Indexing

**Date:** 2026-10-09  
**Status:** Accepted  
**Context:**  
Phase 1 share-back leads capture PII (phone, email, name, company, note). Security rules mandate that visitor PII is encrypted at rest. The system also requires duplicate detection (preventing the same phone number from submitting multiple leads to the same card within 24 hours) and rate limiting. Database queries cannot be performed directly on non-deterministic ciphertext.

**Decision:**
1. **Encryption at rest:** The `Cards` service will encrypt the `name`, `phone`, `email`, `company`, and `note` fields using AES-GCM (authenticated encryption). We justify encrypting all fields because they are captured together and constitute a single identifiable PII record.
2. **Key ID & Authenticated Data (AAD):** Each encrypted payload will store a `keyId` to support future key rotation. The AES-GCM Additional Authenticated Data (AAD) will include the `tenantId` (or `cardId`) to cryptographically bind the ciphertext to its owner and prevent ciphertext swapping attacks.
3. **Per-Tenant Blind Index:** For duplicate detection, we will compute a deterministic HMAC-SHA256 hash (the "blind index") of the normalized phone number, using a **per-tenant** static pepper key. 
4. **Storage:** The `Lead` document will store the `ciphertext`, `iv`, `authTag`, `keyId`, and the `phoneBlindIndex`.

**Rationale:**
- AES-GCM guarantees both confidentiality and integrity of the PII.
- Encrypting the entire payload prevents partial leakage of visitor data.
- The per-tenant HMAC blind index allows us to query MongoDB for duplicates (`db.leads.findOne({ cardId: X, phoneBlindIndex: Y })`) without decrypting data. Scoping the pepper per-tenant prevents cross-tenant rainbow table attacks on the hashes.
- Binding the `tenantId` via AAD ensures that an attacker cannot swap a valid ciphertext from one tenant's lead into another tenant's record.
