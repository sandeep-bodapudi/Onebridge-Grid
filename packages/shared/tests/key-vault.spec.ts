import { describe, it, expect } from 'vitest';
import { LocalKeyVaultProvider } from '../src/key-vault.js';

describe('ADR-0002: KeyVaultProvider', () => {
  it('provides a 256-bit key for a tenant with consistent kid', async () => {
    const vault = new LocalKeyVaultProvider('master-secret-for-tests-only-32b');
    const { kid, key } = await vault.getTenantKey('tenant-1');

    expect(kid).toContain('tenant-1');
    expect(key.length).toBe(32); // 256 bits

    // Fetching again returns same key and kid
    const same = await vault.getTenantKey('tenant-1');
    expect(same.kid).toBe(kid);
    expect(same.key.equals(key)).toBe(true);

    // Resolving by kid returns the same key
    const byKid = await vault.getKeyByKid(kid);
    expect(byKid.equals(key)).toBe(true);
  });

  it('produces distinct keys for distinct tenants', async () => {
    const vault = new LocalKeyVaultProvider('master-secret-for-tests-only-32b');
    const t1 = await vault.getTenantKey('tenant-1');
    const t2 = await vault.getTenantKey('tenant-2');

    expect(t1.key.equals(t2.key)).toBe(false);
  });

  it('provides a dedicated indexKey separate from tenant DEKs', async () => {
    const vault = new LocalKeyVaultProvider('master-secret-for-tests-only-32b');
    const indexKey = await vault.getIndexKey();

    expect(indexKey).toBeDefined();
    const t1 = await vault.getTenantKey('tenant-1');
    expect(Buffer.isBuffer(indexKey) ? indexKey.equals(t1.key) : false).toBe(false);
  });
});
