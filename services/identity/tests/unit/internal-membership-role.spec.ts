import { describe, it, expect, beforeEach } from 'vitest';
import { FakeEventBus } from '@onebridge/shared';
import { RbacService } from '../../src/application/rbac.service';
import { InMemoryMembershipRepository } from '../../src/infrastructure/repositories/in-memory-membership.repository';
import { InMemoryPersonRepository } from '../../src/infrastructure/repositories/in-memory-person.repository';
import { NestInternalController } from '../../src/presentation/nest-internal.controller';

describe('GET /internal/memberships/role (D-SERVICE-AUTH)', () => {
  let controller: NestInternalController;

  beforeEach(async () => {
    const membershipRepo = new InMemoryMembershipRepository();
    await membershipRepo.save({
      id: 'mem-1',
      personId: 'person-1',
      orgId: 'tenant-A',
      role: 'admin',
      scope: { branchId: 'B01' },
    });
    const rbacService = new RbacService(membershipRepo, new InMemoryPersonRepository(), new FakeEventBus());
    controller = new NestInternalController(rbacService);
  });

  it("returns the person's role and scope in the company", async () => {
    await expect(controller.getMembershipRole('person-1', 'tenant-A')).resolves.toEqual({
      role: 'admin',
      scope: { branchId: 'B01' },
    });
  });

  it('returns 404 when the person is not a member of that company', async () => {
    await expect(controller.getMembershipRole('person-1', 'tenant-B')).rejects.toMatchObject({ status: 404 });
    await expect(controller.getMembershipRole('stranger', 'tenant-A')).rejects.toMatchObject({ status: 404 });
  });

  it('returns 400 when personId or tenantId is missing', async () => {
    await expect(controller.getMembershipRole(undefined, 'tenant-A')).rejects.toMatchObject({ status: 400 });
    await expect(controller.getMembershipRole('person-1', undefined)).rejects.toMatchObject({ status: 400 });
  });
});
