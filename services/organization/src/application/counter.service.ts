import { Injectable, NotFoundException } from '@nestjs/common';
import {
  TenantContext,
  formatBranchId,
  formatDepartmentId,
  formatSeatId,
} from '@onebridge/shared';
import { MongoCounterRepository } from '../infrastructure/mongo-counter.repository.js';
import { MongoOrganizationRepository } from '../infrastructure/mongo-organization.repository.js';
import { CounterType } from '../domain/counter.js';

@Injectable()
export class CounterService {
  constructor(
    private readonly counterRepo: MongoCounterRepository,
    private readonly orgRepo: MongoOrganizationRepository
  ) {}

  /**
   * Generates a permanent derived ID for branches, departments, or seats.
   * Format per F03 AC-4 & PRD Section 8.2: <BusinessID>-B<nn>, -D<nn>, -E<nnnn>.
   * Counters never reuse a number.
   */
  async generateDerivedId(tenantId: string, type: CounterType): Promise<string> {
    const org = await TenantContext.run(tenantId, () => this.orgRepo.findById(tenantId));
    if (!org) {
      throw new NotFoundException(`Organization with id "${tenantId}" not found`);
    }

    const businessId = org.businessId;
    const seq = await TenantContext.run(tenantId, () =>
      this.counterRepo.getNextSequence(tenantId, type)
    );

    if (type === 'branch') {
      return formatBranchId(businessId, seq);
    }
    if (type === 'department') {
      return formatDepartmentId(businessId, seq);
    }
    if (type === 'seat') {
      return formatSeatId(businessId, seq);
    }

    throw new Error(`Unsupported derived entity type: "${String(type)}"`);
  }

  async getNextSequence(tenantId: string, type: CounterType): Promise<number> {
    return TenantContext.run(tenantId, () =>
      this.counterRepo.getNextSequence(tenantId, type)
    );
  }

  async getCurrentSequence(tenantId: string, type: CounterType): Promise<number> {
    return TenantContext.run(tenantId, () =>
      this.counterRepo.getSequence(tenantId, type)
    );
  }
}
