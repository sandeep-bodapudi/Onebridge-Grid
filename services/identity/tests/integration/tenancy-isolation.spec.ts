import { describe, it, expect, beforeEach } from 'vitest';
import { TokenService } from '../../src/application/token.service';
import { InMemorySessionRepository } from '../../src/infrastructure/repositories/in-memory-session.repository';
import { InMemoryPersonRepository } from '../../src/infrastructure/repositories/in-memory-person.repository';
import { InMemoryMembershipRepository } from '../../src/infrastructure/repositories/in-memory-membership.repository';
import { RbacService } from '../../src/application/rbac.service';
import { MeController } from '../../src/presentation/me.controller';
import { FakeEventBus, ProblemException, TenantScopedQuery } from '@onebridge/shared';

describe('Tenancy & Cross-Company Isolation (AC-1, AC-4, AC-6)', () => {
  let personRepo: InMemoryPersonRepository;
  let sessionRepo: InMemorySessionRepository;
  let membershipRepo: InMemoryMembershipRepository;
  let tokenService: TokenService;
  let rbacService: RbacService;
  let eventBus: FakeEventBus;
  let controller: MeController;

  const jwtSecret = 'test-jwt-secret-key-minimum-32-chars!!';
  const person = {
    id: 'person-iso-1',
    phone: '+919876543210',
    name: 'Sandeep Bodapudi',
    status: 'active' as const,
    createdAt: new Date().toISOString()
  };

  beforeEach(async () => {
    personRepo = new InMemoryPersonRepository();
    sessionRepo = new InMemorySessionRepository();
    membershipRepo = new InMemoryMembershipRepository();
    eventBus = new FakeEventBus();

    tokenService = new TokenService(sessionRepo, jwtSecret);
    rbacService = new RbacService(membershipRepo, personRepo, eventBus);
    controller = new MeController(rbacService, tokenService);

    await personRepo.save(person);

    await membershipRepo.save({
      id: 'mem-10',
      personId: person.id,
      orgId: 'tenant-authorized',
      role: 'admin',
      createdAt: new Date().toISOString()
    });
  });

  it('should reject cross-company access when user has no membership in requested tenant (AC-4, AC-6)', async () => {
    const { accessToken } = await tokenService.createSessionFamily(person.id, 'Chrome', '127.0.0.1');

    try {
      await controller.getMe(`Bearer ${accessToken}`, 'tenant-unauthorized', { correlationId: 'corr-cross-deny' });
      expect.fail('Should have thrown 403 ProblemException');
    } catch (err: unknown) {
      const problemErr = err as ProblemException;
      expect(problemErr.status).toBe(403);
      expect(problemErr.problem).toBeDefined();
      expect(problemErr.problem.status).toBe(403);
      expect(problemErr.problem.title).toBe('Forbidden');
      expect(problemErr.problem.correlationId).toBe('corr-cross-deny');
      expect(problemErr.problem.detail).toContain('No membership found for tenant: tenant-unauthorized');
    }
  });

  it('should log security authorization failure without personal data (AC-6)', async () => {
    const { accessToken } = await tokenService.createSessionFamily(person.id, 'Chrome', '127.0.0.1');

    try {
      await controller.getMe(`Bearer ${accessToken}`, 'tenant-unauthorized', { correlationId: 'corr-audit-check' });
    } catch {
      // Expected 403
    }

    const recordedEvents = eventBus.calls.filter(c => c.name === 'publish');
    expect(recordedEvents.length).toBeGreaterThanOrEqual(1);

    const auditEvent = recordedEvents[0].args.event;
    expect(auditEvent.type).toBe('audit.recorded');
    expect(auditEvent.payload.action).toBe('authorization.denied');
    expect(auditEvent.correlationId).toBe('corr-audit-check');

    // Asserts zero personal data in payload
    const serialized = JSON.stringify(auditEvent);
    expect(serialized).not.toContain('+919876543210');
    expect(serialized).not.toContain('Sandeep');
  });

  it('should enforce complete data isolation between tenants in all repository queries (Cross-Tenant Isolation & AC-1)', async () => {
    // Add membership for second person in different tenant
    await membershipRepo.save({
      id: 'mem-20',
      personId: 'person-iso-2',
      orgId: 'tenant-other',
      role: 'owner',
      createdAt: new Date().toISOString()
    });

    // Querying for tenant-authorized must NOT see tenant-other's records
    const authorizedMemberships = await membershipRepo.findMany({
      where: { tenantId: 'tenant-authorized' }
    });
    expect(authorizedMemberships).toHaveLength(1);
    expect(authorizedMemberships[0].orgId).toBe('tenant-authorized');

    // Querying without tenantId MUST throw TenantIsolationError
    await expect(membershipRepo.findMany({ where: {} } as TenantScopedQuery)).rejects.toThrow('TenantIsolationError: Missing tenantId in query');
  });
});
