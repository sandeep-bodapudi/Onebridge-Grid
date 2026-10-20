import crypto from 'node:crypto';

export interface KeyVaultProvider {
  /**
   * Retrieves the active DEK for a tenant.
   */
  getTenantKey(tenantId: string): Promise<{ kid: string; key: Buffer }>;

  /**
   * Retrieves a key by its unique key ID (used for decrypting historical records).
   */
  getKeyByKid(kid: string): Promise<Buffer>;

  /**
   * Retrieves the HMAC blind index secret key (held separately from DEKs per ADR-0002 Point 3).
   */
  getIndexKey(): Promise<Buffer | string>;
}

export class LocalKeyVaultProvider implements KeyVaultProvider {
  private masterSecret: Buffer;
  private keyCache = new Map<string, { kid: string; key: Buffer }>();
  private kidIndex = new Map<string, Buffer>();
  private indexSecret: Buffer;

  constructor(masterSecret = 'local-dev-master-key-vault-secret-at-least-32-chars!') {
    this.masterSecret = crypto.createHash('sha256').update(masterSecret, 'utf8').digest();
    // Dedicated index secret separate from masterSecret per ADR-0002 point 3
    this.indexSecret = crypto
      .createHmac('sha256', this.masterSecret)
      .update('onebridge-blind-index-salt-v1', 'utf8')
      .digest();
  }

  async getTenantKey(tenantId: string): Promise<{ kid: string; key: Buffer }> {
    const cached = this.keyCache.get(tenantId);
    if (cached) {
      return cached;
    }

    const kid = `dek-${tenantId}-v1`;
    // Deterministic per-tenant key derived using HKDF or HMAC-SHA256 from masterSecret
    const key = crypto
      .createHmac('sha256', this.masterSecret)
      .update(`tenant:${tenantId}`, 'utf8')
      .digest();

    const record = { kid, key };
    this.keyCache.set(tenantId, record);
    this.kidIndex.set(kid, key);
    return record;
  }

  async getKeyByKid(kid: string): Promise<Buffer> {
    const key = this.kidIndex.get(kid);
    if (key) {
      return key;
    }
    // Parse kid format dek-{tenantId}-v{version}
    const match = kid.match(/^dek-(.+)-v\d+$/);
    if (match) {
      const tenantId = match[1];
      const record = await this.getTenantKey(tenantId);
      return record.key;
    }
    throw new Error(`Unknown key identifier (kid): ${kid}`);
  }

  async getIndexKey(): Promise<Buffer> {
    return this.indexSecret;
  }
}
