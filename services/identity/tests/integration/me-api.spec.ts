import { describe, it, expect, beforeEach } from 'vitest';
import { TokenService } from '../../src/application/token.service';
import { InMemorySessionRepository } from '../../src/infrastructure/repositories/in-memory-session.repository';
import { InMemoryPersonRepository } from '../../src/infrastructure/repositories/in-memory-person.repository';
import { InMemoryMembershipRepository } from '../../src/infrastructure/repositories/in-memory-membership.repository';
import { RbacService } from '../../src/application/rbac.service';
import { MeController } from '../../src/presentation/me.controller';
import { 
  FakeEventBus, 
  ProblemException, 
  TenantIsolationError, 
  RbacGuard, 
  RequirePermission, 
  RequireRole,
  MembershipLike
} from '@onebridge/shared';

describe('Me & RBAC API Integration (AC-4, AC-6)', () => {
  let personRepo: InMemoryPersonRepository;
  let sessionRepo: InMemorySessionRepository;
  let membershipRepo: InMemoryMembershipRepository;
  let tokenService: TokenService;
  let rbacService: RbacService;
  let eventBus: FakeEventBus;
  let controller: MeController;

  const jwtSecret = 'test-jwt-secret-key-minimum-32-chars!!';
  const person = {
    id: 'person-test-1',
    phone: '+919876543210',
    name: 'Sandeep Bodapudi',
    email: 'sandeep@onebridge.in',
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

    // Create memberships in 2 companies
    await membershipRepo.save({
      id: 'mem-1',
      personId: person.id,
      orgId: 'org-alpha',
      role: 'owner',
      createdAt: new Date().toISOString()
    });

    await membershipRepo.save({
      id: 'mem-2',
      personId: person.id,
      orgId: 'org-beta',
      role: 'branch_manager',
      scope: { branchId: 'branch-b1' },
      createdAt: new Date().toISOString()
    });
  });

  it('should reject unauthenticated requests to GET /me with 401', async () => {
    await expect(controller.getMe(undefined, undefined, { correlationId: 'c-1' }))
      .rejects.toThrow(ProblemException);
  });

  it('should return person and all company memberships on GET /me (AC-4)', async () => {
    const { accessToken } = await tokenService.createSessionFamily(person.id, 'MacBook Air', '127.0.0.1');

    const res = await controller.getMe(`Bearer ${accessToken}`, undefined, { correlationId: 'c-2' });

    expect(res.person.id).toBe(person.id);
    expect(res.person.name).toBe(person.name);
    expect(res.memberships).toHaveLength(2);
    expect(res.memberships.map(m => m.orgId)).toContain('org-alpha');
    expect(res.memberships.map(m => m.orgId)).toContain('org-beta');

    // Default active tenant should be first membership
    expect(res.activeTenant?.tenantId).toBe('org-alpha');
    expect(res.activeTenant?.role).toBe('owner');
    expect(res.activeTenant?.permissions).toContain('billing:manage');
  });

  it('should return memberships: [] and undefined activeTenant when person has 0 memberships (AC-4)', async () => {
    const freshPerson = {
      id: 'person-no-memberships',
      phone: '+919999999999',
      status: 'active' as const,
      createdAt: new Date().toISOString()
    };
    await personRepo.save(freshPerson);

    const { accessToken } = await tokenService.createSessionFamily(freshPerson.id, 'Browser', '127.0.0.1');
    const res = await controller.getMe(`Bearer ${accessToken}`, undefined, { correlationId: 'c-empty' });

    expect(res.person.id).toBe(freshPerson.id);
    expect(res.memberships).toEqual([]);
    expect(res.activeTenant).toBeUndefined();
  });

  it('should explicitly switch active tenant based on X-Tenant-Id header (AC-4)', async () => {
    const { accessToken } = await tokenService.createSessionFamily(person.id, 'MacBook Air', '127.0.0.1');

    const res = await controller.getMe(`Bearer ${accessToken}`, 'org-beta', { correlationId: 'c-3' });

    expect(res.activeTenant?.tenantId).toBe('org-beta');
    expect(res.activeTenant?.role).toBe('branch_manager');
    expect(res.activeTenant?.scope?.branchId).toBe('branch-b1');
    expect(res.activeTenant?.permissions).toContain('org:profile:read');
    expect(res.activeTenant?.permissions).not.toContain('billing:manage');
  });

  it('should support internal membership creation via POST /internal/memberships', async () => {
    const result = await controller.createInternalMembership({
      personId: person.id,
      orgId: 'org-gamma',
      role: 'admin'
    }, 'idem-key-1');

    expect(result.orgId).toBe('org-gamma');
    expect(result.role).toBe('admin');

    const all = await membershipRepo.findByPersonId(person.id);
    expect(all).toHaveLength(3);
  });

  it('should enforce idempotency on POST /internal/memberships (cached response on replay, 422 on payload mismatch)', async () => {
    const payloadA = {
      personId: person.id,
      orgId: 'org-delta',
      role: 'employee' as const
    };

    // First write with key
    const firstCall = await controller.createInternalMembership(payloadA, 'idem-unique-123');
    expect(firstCall.orgId).toBe('org-delta');

    // Replay write with same key and exact body -> returns cached
    const replayCall = await controller.createInternalMembership(payloadA, 'idem-unique-123');
    expect(replayCall.id).toBe(firstCall.id);

    // Call with same key but different body -> throws 422 ProblemException
    const payloadB = {
      personId: person.id,
      orgId: 'org-epsilon',
      role: 'admin' as const
    };
    await expect(
      controller.createInternalMembership(payloadB, 'idem-unique-123')
    ).rejects.toThrow(ProblemException);
  });

  it('should enforce tenant isolation in InMemoryMembershipRepository', async () => {
    // Missing orgId/tenantId on save throws TenantIsolationError
    await expect(
      membershipRepo.save({
        id: 'mem-invalid',
        personId: person.id,
        orgId: '',
        role: 'viewer',
        createdAt: new Date().toISOString()
      })
    ).rejects.toThrow(TenantIsolationError);

    // Missing orgId/tenantId on findByPersonAndOrg throws TenantIsolationError
    await expect(
      membershipRepo.findByPersonAndOrg(person.id, '')
    ).rejects.toThrow(TenantIsolationError);
  });

  describe('RbacGuard & Decorators', () => {
    const guard = new RbacGuard();

    class SampleEndpointClass {
      @RequireRole('owner', 'admin')
      adminOnlyMethod() {
        return 'admin-data';
      }

      @RequirePermission('cards:manage')
      cardsManageMethod() {
        return 'card-saved';
      }
    }

    const sample = new SampleEndpointClass();

    it('should allow request when role requirement is satisfied', () => {
      const mockContext = {
        getHandler: () => sample.adminOnlyMethod,
        getClass: () => SampleEndpointClass,
        switchToHttp: () => ({
          getRequest: () => ({
            activeMembership: {
              id: 'm-1',
              personId: 'p-1',
              orgId: 'org-1',
              role: 'owner',
              createdAt: new Date().toISOString()
            } as MembershipLike,
            headers: { 'x-correlation-id': 'cor-1' }
          })
        })
      };

      expect(guard.canActivate(mockContext)).toBe(true);
    });

    it('should throw 403 ProblemException when role does not match @RequireRole', () => {
      const mockContext = {
        getHandler: () => sample.adminOnlyMethod,
        getClass: () => SampleEndpointClass,
        switchToHttp: () => ({
          getRequest: () => ({
            activeMembership: {
              id: 'm-2',
              personId: 'p-2',
              orgId: 'org-1',
              role: 'branch_manager',
              createdAt: new Date().toISOString()
            } as MembershipLike,
            headers: { 'x-correlation-id': 'cor-2' }
          })
        })
      };

      expect(() => guard.canActivate(mockContext)).toThrow(ProblemException);
    });

    it('should validate scope and permission for @RequirePermission', () => {
      // Branch manager attempting cards:manage within own branch -> PASS
      const mockContextAllowed = {
        getHandler: () => sample.cardsManageMethod,
        getClass: () => SampleEndpointClass,
        switchToHttp: () => ({
          getRequest: () => ({
            activeMembership: {
              id: 'm-3',
              personId: 'p-3',
              orgId: 'org-1',
              role: 'branch_manager',
              scope: { branchId: 'branch-b1' },
              createdAt: new Date().toISOString()
            } as MembershipLike,
            params: { branchId: 'branch-b1' },
            headers: { 'x-correlation-id': 'cor-3' }
          })
        })
      };
      expect(guard.canActivate(mockContextAllowed)).toBe(true);

      // Branch manager attempting cards:manage for a different branch -> 403 ProblemException
      const mockContextDenied = {
        getHandler: () => sample.cardsManageMethod,
        getClass: () => SampleEndpointClass,
        switchToHttp: () => ({
          getRequest: () => ({
            activeMembership: {
              id: 'm-3',
              personId: 'p-3',
              orgId: 'org-1',
              role: 'branch_manager',
              scope: { branchId: 'branch-b1' },
              createdAt: new Date().toISOString()
            } as MembershipLike,
            params: { branchId: 'branch-north' },
            headers: { 'x-correlation-id': 'cor-4' }
          })
        })
      };
      expect(() => guard.canActivate(mockContextDenied)).toThrow(ProblemException);
    });

    it('should throw 403 ProblemException when membership is missing on guarded route', () => {
      const mockContextNoMembership = {
        getHandler: () => sample.cardsManageMethod,
        getClass: () => SampleEndpointClass,
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { 'x-correlation-id': 'cor-5' }
          })
        })
      };
      expect(() => guard.canActivate(mockContextNoMembership)).toThrow(ProblemException);
    });
  });
});
