import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ulid } from 'ulid';
import { EventBus, TenantContext, TenantScopedRepository, MongoConnectionHandle } from '@onebridge/shared';
import { validateGstin } from '../domain/gstin-validator.js';
import { limitFor } from '../domain/plan-limits.js';
import { MongoOrganizationRepository } from '../infrastructure/mongo-organization.repository.js';
import { MongoAuditRepository } from '../infrastructure/mongo-audit.repository.js';
import { MongoSeatRepository } from '../infrastructure/mongo-seat.repository.js';
import { MongoBranchRepository } from '../infrastructure/mongo-branch.repository.js';
import { IdentityInternalClient } from '../infrastructure/identity-internal.client.js';

/** N02: someone asks the owner of an existing company (found by GSTIN) for access. */
export interface AccessRequestProps {
  id: string;
  tenantId: string;
  requesterPersonId: string;
  /** The name the requester chose to show the owner (their phone or email is never shared). */
  requesterName: string;
  message?: string;
  status: 'pending' | 'approved' | 'declined';
  role?: 'admin' | 'employee';
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

type Doc = AccessRequestProps & Record<string, unknown>;
type Base = TenantScopedRepository<Doc>;

export class MongoAccessRequestRepository extends TenantScopedRepository<Doc> {
  constructor(handle: MongoConnectionHandle | unknown) {
    super(handle as MongoConnectionHandle, 'access_requests');
  }

  private strip(d: (Doc & { _id?: unknown }) | null): AccessRequestProps | null {
    if (!d) return null;
    const { _id: _i, ...rest } = d;
    return rest as AccessRequestProps;
  }

  async findPendingFor(requesterPersonId: string): Promise<AccessRequestProps | null> {
    return this.strip(await this.findOne({ requesterPersonId, status: 'pending' } as unknown as Parameters<Base['findOne']>[0]));
  }

  async findById(id: string): Promise<AccessRequestProps | null> {
    return this.strip(await this.findOne({ id } as unknown as Parameters<Base['findOne']>[0]));
  }

  async listPending(): Promise<AccessRequestProps[]> {
    const docs = await this.find({ status: 'pending' } as unknown as Parameters<Base['find']>[0]);
    return docs.map((d) => this.strip(d)!).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async save(r: AccessRequestProps): Promise<void> {
    const filter = { id: r.id } as unknown as Parameters<Base['findOne']>[0];
    if (await this.findOne(filter)) await this.replaceOne(filter as unknown as Parameters<Base['replaceOne']>[0], r as Doc);
    else await this.insertOne(r as unknown as Parameters<Base['insertOne']>[0]);
  }
}

const problem = (status: number, title: string, detail: string, code?: string) => ({
  type: 'https://tools.ietf.org/html/rfc7807',
  title,
  status,
  detail,
  ...(code ? { code } : {}),
});

export interface PlanUsageItem {
  key: 'seats' | 'branches';
  used: number;
  limit?: number;
}

export class AccessRequestService {
  constructor(
    private readonly requests: MongoAccessRequestRepository,
    private readonly orgRepo: MongoOrganizationRepository,
    private readonly seatRepo: MongoSeatRepository,
    private readonly branchRepo: MongoBranchRepository,
    private readonly auditRepo: MongoAuditRepository,
    private readonly identityClient: IdentityInternalClient,
    private readonly eventBus: EventBus,
    private readonly now: () => Date = () => new Date()
  ) {}

  private async audit(tenantId: string, action: string, entityId: string, actorPersonId: string, after?: Record<string, unknown>) {
    const occurredAt = this.now().toISOString();
    await TenantContext.run(tenantId, () =>
      this.auditRepo.record({ id: ulid(), tenantId, action, entityType: 'access_request', entityId, actorPersonId, after, occurredAt })
    );
    await this.eventBus.publish({
      eventId: ulid(),
      type: 'audit.recorded',
      version: '1.0.0',
      tenantId,
      occurredAt,
      correlationId: ulid(),
      aggregateVersion: 1,
      payload: { action, entityType: 'access_request', entityId, actorPersonId, after },
    });
  }

  /**
   * POST /orgs/access-requests. The answer is the same whether or not the
   * GSTIN belongs to a company, so the endpoint cannot be used to probe.
   */
  async request(personId: string, input: { gstin?: unknown; name?: unknown; message?: unknown }): Promise<void> {
    const gstin = typeof input.gstin === 'string' ? input.gstin.trim().toUpperCase() : '';
    const check = validateGstin(gstin);
    if (!check.isValid) throw new BadRequestException(problem(400, 'Bad Request', check.reason || 'Enter a valid GSTIN.'));
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name || name.length > 80) throw new BadRequestException(problem(400, 'Bad Request', 'Enter the name the owner should see (up to 80 characters).'));
    const message = typeof input.message === 'string' ? input.message.trim().slice(0, 500) : undefined;

    const org = await this.orgRepo.findByGstinGlobal(gstin);
    if (!org) return;
    const tenantId = org.tenantId || org.id;
    await TenantContext.run(tenantId, async () => {
      if (await this.requests.findPendingFor(personId)) return; // one open request per person and company
      const request: AccessRequestProps = {
        id: ulid(),
        tenantId,
        requesterPersonId: personId,
        requesterName: name,
        message: message || undefined,
        status: 'pending',
        createdAt: this.now().toISOString(),
      };
      await this.requests.save(request);
      await this.audit(tenantId, 'org.access_requested', request.id, personId);
      await this.eventBus.publish({
        eventId: ulid(),
        type: 'org.access_requested',
        version: '1.0.0',
        tenantId,
        occurredAt: request.createdAt,
        correlationId: ulid(),
        aggregateVersion: 1,
        payload: { orgId: tenantId, requestId: request.id },
      });
    });
  }

  private ownerOnly(role: string | undefined) {
    if (role !== 'owner') {
      throw new ForbiddenException(problem(403, 'Forbidden', 'Only the company owner can review access requests.'));
    }
  }

  /** GET /orgs/{id}/access-requests (Owner only). */
  async listPending(tenantId: string, role: string | undefined) {
    this.ownerOnly(role);
    const items = await TenantContext.run(tenantId, () => this.requests.listPending());
    return items.map((r) => this.view(r));
  }

  private view(r: AccessRequestProps) {
    return {
      id: r.id,
      status: r.status,
      requester: { type: 'member' as const, id: r.requesterPersonId, name: r.requesterName, verified: false },
      message: r.message,
      createdAt: r.createdAt,
      decidedAt: r.decidedAt,
    };
  }

  /** POST /orgs/{id}/access-requests/{requestId}/decide (Owner only). Approval never lowers an existing role. */
  async decide(
    tenantId: string,
    requestId: string,
    input: { decision?: unknown; role?: unknown },
    role: string | undefined,
    actorPersonId: string
  ) {
    this.ownerOnly(role);
    if (input.decision !== 'approve' && input.decision !== 'decline') {
      throw new BadRequestException(problem(400, 'Bad Request', 'Choose approve or decline.'));
    }
    const grant = input.role === 'admin' ? 'admin' : 'employee';
    return TenantContext.run(tenantId, async () => {
      const request = await this.requests.findById(requestId);
      if (!request) throw new NotFoundException(problem(404, 'Not Found', 'No such access request.'));
      if (request.status !== 'pending') throw new ConflictException(problem(409, 'Conflict', 'This request has already been decided.', 'already_decided'));
      const decided: AccessRequestProps = {
        ...request,
        status: input.decision === 'approve' ? 'approved' : 'declined',
        role: input.decision === 'approve' ? grant : undefined,
        decidedAt: this.now().toISOString(),
        decidedBy: actorPersonId,
      };
      if (decided.status === 'approved') {
        await this.identityClient.createMembership({
          personId: request.requesterPersonId,
          orgId: tenantId,
          role: grant,
          onlyIfAbsent: true,
          idempotencyKey: `access-${request.id}`,
        });
      }
      await this.requests.save(decided);
      await this.audit(tenantId, `org.access_${decided.status}`, request.id, actorPersonId, { role: decided.role });
      return this.view(decided);
    });
  }

  /** GET /orgs/{id}/limits: usage of the limits the organization service measures. */
  async limits(tenantId: string) {
    return TenantContext.run(tenantId, async () => {
      const org = await this.orgRepo.findById(tenantId);
      if (!org) throw new NotFoundException(problem(404, 'Not Found', 'No such company.'));
      const [seats, branches] = await Promise.all([this.seatRepo.countSeats(), this.branchRepo.countActiveBranches()]);
      const item = (key: 'seats' | 'branches', used: number): PlanUsageItem => {
        const limit = limitFor(org.plan, key);
        return limit === null ? { key, used } : { key, used, limit };
      };
      return { plan: org.plan, items: [item('seats', seats), item('branches', branches)] };
    });
  }
}
