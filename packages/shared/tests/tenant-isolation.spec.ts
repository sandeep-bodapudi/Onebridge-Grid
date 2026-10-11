import { describe, it, expect } from 'vitest';
import { Repository } from '../src/tenant';

describe('AC-4: Tenant Isolation (Mock DB)', () => {
  const dbData = [
    { id: '1', tenantId: 'tenant-a', name: 'Item A' },
    { id: '2', tenantId: 'tenant-b', name: 'Item B' }
  ];
  const repo = new Repository(dbData);

  it('should throw TenantIsolationError if a repository query lacks a tenantId', async () => {
    await expect(repo.findMany({ where: { name: 'Item A' } })).rejects.toThrow('TenantIsolationError: Missing tenantId in query');
    await expect(repo.findMany({})).rejects.toThrow('TenantIsolationError: Missing tenantId in query');
  });
  
  it('should succeed and isolate data if tenantId is provided', async () => {
    const results = await repo.findMany({ where: { tenantId: 'tenant-a' } });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('1');
  });
});
