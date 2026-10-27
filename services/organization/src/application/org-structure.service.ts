import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ulid } from 'ulid';
import { EventBus, TenantContext } from '@onebridge/shared';
import {
  CreateBranchRequest,
  UpdateBranchRequest,
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
  CreateTeamRequest,
  UpdateTeamRequest,
  MovePersonRequest,
} from '@onebridge/api-contracts';

import { BranchProps } from '../domain/branch.js';
import { DepartmentProps, DEFAULT_DEPARTMENT_NAMES } from '../domain/department.js';
import { TeamProps, OrgChartNodeProps } from '../domain/team.js';
import { AuditLogProps } from '../domain/audit-log.js';

import { MongoBranchRepository } from '../infrastructure/mongo-branch.repository.js';
import { MongoDepartmentRepository } from '../infrastructure/mongo-department.repository.js';
import { MongoTeamRepository } from '../infrastructure/mongo-team.repository.js';
import { MongoAuditRepository } from '../infrastructure/mongo-audit.repository.js';
import { MongoOrganizationRepository } from '../infrastructure/mongo-organization.repository.js';
import { CounterService } from './counter.service.js';

/** One-line postal address for read models and card Directions links. */
export function formatAddress(address: BranchProps['address'] | undefined): string | undefined {
  if (!address) return undefined;
  const a = address as unknown as Record<string, unknown>;
  const parts = [a.line1, a.line2, a.city, a.state, a.pincode].filter((p) => typeof p === 'string' && p.trim());
  return parts.length ? parts.join(', ') : undefined;
}

@Injectable()
export class OrgStructureService {
  constructor(
    private readonly branchRepo: MongoBranchRepository,
    private readonly deptRepo: MongoDepartmentRepository,
    private readonly teamRepo: MongoTeamRepository,
    private readonly auditRepo: MongoAuditRepository,
    private readonly orgRepo: MongoOrganizationRepository,
    private readonly counterService: CounterService,
    private readonly eventBus: EventBus
  ) {}

  // ---------------------------------------------------------------------------
  // BRANCHES (AC-1, AC-4, AC-5)
  // ---------------------------------------------------------------------------

  async createBranch(
    tenantId: string,
    dto: CreateBranchRequest,
    actorPersonId = 'system',
    correlationId = 'unknown'
  ): Promise<BranchProps> {
    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException('Branch name is required');
    }
    if (!dto.address || !dto.address.line1 || !dto.address.city || !dto.address.state || !dto.address.pincode) {
      throw new BadRequestException('Complete branch address (line1, city, state, pincode) is required');
    }

    // AC-5: Starter allows 1 branch. Business and above allow unlimited. Enforced server-side.
    const org = await TenantContext.run(tenantId, () => this.orgRepo.findById(tenantId));
    if (!org) {
      throw new NotFoundException(`Organization "${tenantId}" not found`);
    }

    // N02: free profiles have the same single branch as Starter.
    if (org.plan === 'starter' || org.plan === 'free') {
      const activeCount = await TenantContext.run(tenantId, () => this.branchRepo.countActiveBranches());
      if (activeCount >= 1) {
        throw new ForbiddenException(
          `${org.plan === 'free' ? 'The free plan' : 'Starter plan'} allows a maximum of 1 branch. Please upgrade to Business for unlimited branches.`
        );
      }
    }

    // Generate derived Branch ID: OB-XXXXXX-B01
    const branchId = await this.counterService.generateDerivedId(tenantId, 'branch');
    const now = new Date().toISOString();

    const branch: BranchProps = {
      id: branchId,
      tenantId,
      name: dto.name.trim(),
      address: dto.address,
      mapPin: dto.mapPin,
      contact: dto.contact,
      managerPersonId: dto.managerPersonId,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await TenantContext.run(tenantId, () => this.branchRepo.save(branch));

    // Audit Log & Event
    await this.recordAudit(tenantId, {
      action: 'branch.created',
      entityType: 'branch',
      entityId: branchId,
      actorPersonId,
      after: branch,
    });

    await this.eventBus.publish({
      eventId: ulid(),
      type: 'branch.created',
      version: '1.0.0',
      tenantId,
      occurredAt: now,
      correlationId,
      aggregateVersion: 1,
      payload: {
        orgId: tenantId,
        branchId,
        name: branch.name,
        managerPersonId: branch.managerPersonId,
        address: formatAddress(branch.address),
        mapPin: branch.mapPin,
      },
    });

    return branch;
  }

  async updateBranch(
    tenantId: string,
    branchId: string,
    dto: UpdateBranchRequest,
    actorPersonId = 'system',
    correlationId = 'unknown'
  ): Promise<BranchProps> {
    const existing = await TenantContext.run(tenantId, () => this.branchRepo.findById(branchId));
    if (!existing) {
      throw new NotFoundException(`Branch "${branchId}" not found`);
    }

    const now = new Date().toISOString();
    const updated: BranchProps = {
      ...existing,
      name: dto.name?.trim() ?? existing.name,
      address: dto.address ?? existing.address,
      mapPin: dto.mapPin ?? existing.mapPin,
      contact: dto.contact ?? existing.contact,
      managerPersonId: dto.managerPersonId ?? existing.managerPersonId,
      updatedAt: now,
    };

    await TenantContext.run(tenantId, () => this.branchRepo.save(updated));

    await this.recordAudit(tenantId, {
      action: 'branch.updated',
      entityType: 'branch',
      entityId: branchId,
      actorPersonId,
      before: existing,
      after: updated,
    });

    await this.eventBus.publish({
      eventId: ulid(),
      type: 'branch.updated',
      version: '1.0.0',
      tenantId,
      occurredAt: now,
      correlationId,
      aggregateVersion: 1,
      payload: {
        orgId: tenantId,
        branchId,
        updatedFields: dto,
        name: updated.name,
        address: formatAddress(updated.address),
        mapPin: updated.mapPin,
      },
    });

    return updated;
  }

  async archiveBranch(
    tenantId: string,
    branchId: string,
    actorPersonId = 'system',
    correlationId = 'unknown'
  ): Promise<BranchProps> {
    const existing = await TenantContext.run(tenantId, () => this.branchRepo.findById(branchId));
    if (!existing) {
      throw new NotFoundException(`Branch "${branchId}" not found`);
    }

    if (existing.status === 'archived') {
      return existing;
    }

    const now = new Date().toISOString();
    const updated: BranchProps = {
      ...existing,
      status: 'archived',
      archivedAt: now,
      updatedAt: now,
    };

    await TenantContext.run(tenantId, () => this.branchRepo.save(updated));

    await this.recordAudit(tenantId, {
      action: 'branch.archived',
      entityType: 'branch',
      entityId: branchId,
      actorPersonId,
      before: existing,
      after: updated,
    });

    await this.eventBus.publish({
      eventId: ulid(),
      type: 'branch.archived',
      version: '1.0.0',
      tenantId,
      occurredAt: now,
      correlationId,
      aggregateVersion: 1,
      payload: {
        orgId: tenantId,
        branchId,
      },
    });

    return updated;
  }

  async getBranch(tenantId: string, branchId: string): Promise<BranchProps> {
    const branch = await TenantContext.run(tenantId, () => this.branchRepo.findById(branchId));
    if (!branch) {
      throw new NotFoundException(`Branch "${branchId}" not found`);
    }
    return branch;
  }

  async listBranches(
    tenantId: string,
    includeArchived = false,
    limit = 50,
    offset = 0
  ): Promise<{ items: BranchProps[]; total: number; limit: number; offset: number }> {
    const all = await TenantContext.run(tenantId, () => this.branchRepo.listBranches(includeArchived));
    const items = all.slice(offset, offset + limit);
    return { items, total: all.length, limit, offset };
  }


  // ---------------------------------------------------------------------------
  // DEPARTMENTS (AC-2)
  // ---------------------------------------------------------------------------

  async createDepartment(
    tenantId: string,
    dto: CreateDepartmentRequest,
    actorPersonId = 'system',
    correlationId = 'unknown'
  ): Promise<DepartmentProps> {
    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException('Department name is required');
    }

    if (dto.branchId) {
      const branch = await TenantContext.run(tenantId, () => this.branchRepo.findById(dto.branchId!));
      if (!branch) {
        throw new NotFoundException(`Branch "${dto.branchId}" not found`);
      }
    }

    // Generate derived Department ID: OB-XXXXXX-D01
    const deptId = await this.counterService.generateDerivedId(tenantId, 'department');
    const now = new Date().toISOString();

    const dept: DepartmentProps = {
      id: deptId,
      tenantId,
      name: dto.name.trim(),
      branchId: dto.branchId,
      managerPersonId: dto.managerPersonId,
      isDefault: false,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await TenantContext.run(tenantId, () => this.deptRepo.save(dept));

    await this.recordAudit(tenantId, {
      action: 'department.created',
      entityType: 'department',
      entityId: deptId,
      actorPersonId,
      after: dept,
    });

    await this.eventBus.publish({
      eventId: ulid(),
      type: 'department.created',
      version: '1.0.0',
      tenantId,
      occurredAt: now,
      correlationId,
      aggregateVersion: 1,
      payload: {
        orgId: tenantId,
        departmentId: deptId,
        name: dept.name,
        branchId: dept.branchId,
      },
    });

    return dept;
  }

  async seedDefaultDepartments(
    tenantId: string,
    actorPersonId = 'system',
    correlationId = 'unknown'
  ): Promise<{ items: DepartmentProps[]; total: number; limit: number; offset: number }> {
    const existingDepts = await TenantContext.run(tenantId, () => this.deptRepo.listDepartments(undefined, true));
    const existingNames = new Set(existingDepts.map((d) => d.name.toLowerCase()));

    const seeded: DepartmentProps[] = [];

    for (const name of DEFAULT_DEPARTMENT_NAMES) {
      if (!existingNames.has(name.toLowerCase())) {
        const deptId = await this.counterService.generateDerivedId(tenantId, 'department');
        const now = new Date().toISOString();

        const dept: DepartmentProps = {
          id: deptId,
          tenantId,
          name,
          isDefault: true,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        };

        await TenantContext.run(tenantId, () => this.deptRepo.save(dept));
        seeded.push(dept);
      }
    }

    if (seeded.length > 0) {
      await this.recordAudit(tenantId, {
        action: 'department.defaults_seeded',
        entityType: 'department',
        entityId: 'multiple',
        actorPersonId,
        after: { count: seeded.length, names: seeded.map((s) => s.name) },
      });

      for (const dept of seeded) {
        await this.eventBus.publish({
          eventId: ulid(),
          type: 'department.created',
          version: '1.0.0',
          tenantId,
          occurredAt: dept.createdAt,
          correlationId,
          aggregateVersion: 1,
          payload: {
            orgId: tenantId,
            departmentId: dept.id,
            name: dept.name,
          },
        });
      }
    }

    return this.listDepartments(tenantId, undefined, false);
  }

  async updateDepartment(
    tenantId: string,
    departmentId: string,
    dto: UpdateDepartmentRequest,
    actorPersonId = 'system',
    correlationId = 'unknown'
  ): Promise<DepartmentProps> {
    const existing = await TenantContext.run(tenantId, () => this.deptRepo.findById(departmentId));
    if (!existing) {
      throw new NotFoundException(`Department "${departmentId}" not found`);
    }

    if (dto.branchId) {
      const branch = await TenantContext.run(tenantId, () => this.branchRepo.findById(dto.branchId!));
      if (!branch) {
        throw new NotFoundException(`Branch "${dto.branchId}" not found`);
      }
    }

    const now = new Date().toISOString();
    const updated: DepartmentProps = {
      ...existing,
      name: dto.name?.trim() ?? existing.name,
      branchId: dto.branchId !== undefined ? (dto.branchId || undefined) : existing.branchId,
      managerPersonId: dto.managerPersonId ?? existing.managerPersonId,
      updatedAt: now,
    };

    await TenantContext.run(tenantId, () => this.deptRepo.save(updated));

    await this.recordAudit(tenantId, {
      action: 'department.updated',
      entityType: 'department',
      entityId: departmentId,
      actorPersonId,
      before: existing,
      after: updated,
    });

    await this.eventBus.publish({
      eventId: ulid(),
      type: 'department.updated',
      version: '1.0.0',
      tenantId,
      occurredAt: now,
      correlationId,
      aggregateVersion: 1,
      payload: {
        orgId: tenantId,
        departmentId,
        updatedFields: dto,
      },
    });

    return updated;
  }

  async archiveDepartment(
    tenantId: string,
    departmentId: string,
    actorPersonId = 'system',
    correlationId = 'unknown'
  ): Promise<DepartmentProps> {
    const existing = await TenantContext.run(tenantId, () => this.deptRepo.findById(departmentId));
    if (!existing) {
      throw new NotFoundException(`Department "${departmentId}" not found`);
    }

    const now = new Date().toISOString();
    const updated: DepartmentProps = {
      ...existing,
      status: 'archived',
      archivedAt: now,
      updatedAt: now,
    };

    await TenantContext.run(tenantId, () => this.deptRepo.save(updated));

    await this.recordAudit(tenantId, {
      action: 'department.archived',
      entityType: 'department',
      entityId: departmentId,
      actorPersonId,
      before: existing,
      after: updated,
    });

    await this.eventBus.publish({
      eventId: ulid(),
      type: 'department.archived',
      version: '1.0.0',
      tenantId,
      occurredAt: now,
      correlationId,
      aggregateVersion: 1,
      payload: {
        orgId: tenantId,
        departmentId,
      },
    });

    return updated;
  }

  async getDepartment(tenantId: string, departmentId: string): Promise<DepartmentProps> {
    const dept = await TenantContext.run(tenantId, () => this.deptRepo.findById(departmentId));
    if (!dept) {
      throw new NotFoundException(`Department "${departmentId}" not found`);
    }
    return dept;
  }

  async listDepartments(
    tenantId: string,
    branchId?: string,
    includeArchived = false,
    limit = 50,
    offset = 0
  ): Promise<{ items: DepartmentProps[]; total: number; limit: number; offset: number }> {
    const all = await TenantContext.run(tenantId, () => this.deptRepo.listDepartments(branchId, includeArchived));
    const items = all.slice(offset, offset + limit);
    return { items, total: all.length, limit, offset };
  }


  // ---------------------------------------------------------------------------
  // TEAMS & HIERARCHY (AC-3, AC-6)
  // ---------------------------------------------------------------------------

  async createTeam(
    tenantId: string,
    dto: CreateTeamRequest,
    actorPersonId = 'system',
    correlationId = 'unknown'
  ): Promise<TeamProps> {
    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException('Team name is required');
    }
    if (!dto.departmentId) {
      throw new BadRequestException('Department ID is required');
    }

    const dept = await TenantContext.run(tenantId, () => this.deptRepo.findById(dto.departmentId));
    if (!dept) {
      throw new NotFoundException(`Department "${dto.departmentId}" not found`);
    }

    if (dto.parentTeamId) {
      const parent = await TenantContext.run(tenantId, () => this.teamRepo.findById(dto.parentTeamId!));
      if (!parent) {
        throw new NotFoundException(`Parent team "${dto.parentTeamId}" not found`);
      }
    }

    const teamId = ulid();
    const now = new Date().toISOString();

    const team: TeamProps = {
      id: teamId,
      tenantId,
      name: dto.name.trim(),
      departmentId: dto.departmentId,
      leadPersonId: dto.leadPersonId,
      parentTeamId: dto.parentTeamId,
      status: 'active',
      memberPersonIds: [],
      createdAt: now,
      updatedAt: now,
    };


    await TenantContext.run(tenantId, () => this.teamRepo.save(team));

    await this.recordAudit(tenantId, {
      action: 'team.created',
      entityType: 'team',
      entityId: teamId,
      actorPersonId,
      after: team,
    });

    await this.eventBus.publish({
      eventId: ulid(),
      type: 'team.created',
      version: '1.0.0',
      tenantId,
      occurredAt: now,
      correlationId,
      aggregateVersion: 1,
      payload: {
        orgId: tenantId,
        teamId,
        name: team.name,
        departmentId: team.departmentId,
        leadPersonId: team.leadPersonId,
      },
    });

    return team;
  }

  async updateTeam(
    tenantId: string,
    teamId: string,
    dto: UpdateTeamRequest,
    actorPersonId = 'system',
    correlationId = 'unknown'
  ): Promise<TeamProps> {
    const existing = await TenantContext.run(tenantId, () => this.teamRepo.findById(teamId));
    if (!existing) {
      throw new NotFoundException(`Team "${teamId}" not found`);
    }

    if (dto.parentTeamId) {
      if (dto.parentTeamId === teamId) {
        throw new BadRequestException('Cycle detected: a team cannot be its own parent');
      }
      await this.validateNoCycle(tenantId, teamId, dto.parentTeamId);
    }

    const now = new Date().toISOString();
    const updated: TeamProps = {
      ...existing,
      name: dto.name?.trim() ?? existing.name,
      departmentId: dto.departmentId ?? existing.departmentId,
      leadPersonId: dto.leadPersonId ?? existing.leadPersonId,
      parentTeamId: dto.parentTeamId !== undefined ? (dto.parentTeamId || undefined) : existing.parentTeamId,
      updatedAt: now,
    };

    await TenantContext.run(tenantId, () => this.teamRepo.save(updated));

    await this.recordAudit(tenantId, {
      action: 'team.updated',
      entityType: 'team',
      entityId: teamId,
      actorPersonId,
      before: existing,
      after: updated,
    });

    await this.eventBus.publish({
      eventId: ulid(),
      type: 'team.updated',
      version: '1.0.0',
      tenantId,
      occurredAt: now,
      correlationId,
      aggregateVersion: 1,
      payload: {
        orgId: tenantId,
        teamId,
        updatedFields: dto,
      },
    });

    return updated;
  }

  async archiveTeam(
    tenantId: string,
    teamId: string,
    actorPersonId = 'system',
    correlationId = 'unknown'
  ): Promise<TeamProps> {
    const existing = await TenantContext.run(tenantId, () => this.teamRepo.findById(teamId));
    if (!existing) {
      throw new NotFoundException(`Team "${teamId}" not found`);
    }

    if (existing.status === 'archived') {
      return existing;
    }

    const now = new Date().toISOString();
    const updated: TeamProps = {
      ...existing,
      status: 'archived',
      archivedAt: now,
      updatedAt: now,
    };

    await TenantContext.run(tenantId, () => this.teamRepo.save(updated));

    await this.recordAudit(tenantId, {
      action: 'team.archived',
      entityType: 'team',
      entityId: teamId,
      actorPersonId,
      before: existing,
      after: updated,
    });

    await this.eventBus.publish({
      eventId: ulid(),
      type: 'team.archived',
      version: '1.0.0',
      tenantId,
      occurredAt: now,
      correlationId,
      aggregateVersion: 1,
      payload: {
        orgId: tenantId,
        teamId,
      },
    });

    return updated;
  }

  async deleteTeam(
    tenantId: string,
    teamId: string,
    actorPersonId = 'system',
    correlationId = 'unknown'
  ): Promise<void> {
    await this.archiveTeam(tenantId, teamId, actorPersonId, correlationId);
  }

  async listTeams(
    tenantId: string,
    departmentId?: string,
    includeArchived = false,
    limit = 50,
    offset = 0
  ): Promise<{ items: TeamProps[]; total: number; limit: number; offset: number }> {
    const all = await TenantContext.run(tenantId, () => this.teamRepo.listTeams(departmentId, includeArchived));
    const items = all.slice(offset, offset + limit);
    return { items, total: all.length, limit, offset };
  }

  async assignPersonToPrimaryTeam(
    tenantId: string,
    teamId: string,
    personId: string
  ): Promise<TeamProps> {
    // Ensure person has only ONE primary team across the tenant (AC-3)
    const allTeams = await TenantContext.run(tenantId, () => this.teamRepo.listTeams(undefined, true));
    for (const t of allTeams) {
      if (t.id !== teamId && t.memberPersonIds?.includes(personId)) {
        const cleanedMembers = (t.memberPersonIds || []).filter((id) => id !== personId);
        await TenantContext.run(tenantId, () =>
          this.teamRepo.save({
            ...t,
            memberPersonIds: cleanedMembers,
            updatedAt: new Date().toISOString(),
          })
        );
      }
    }

    const targetTeam = await TenantContext.run(tenantId, () => this.teamRepo.findById(teamId));
    if (!targetTeam) {
      throw new NotFoundException(`Team "${teamId}" not found`);
    }

    const currentMembers = targetTeam.memberPersonIds || [];
    if (!currentMembers.includes(personId)) {
      targetTeam.memberPersonIds = [...currentMembers, personId];
      targetTeam.updatedAt = new Date().toISOString();
      await TenantContext.run(tenantId, () => this.teamRepo.save(targetTeam));
    }
    return targetTeam;
  }


  // Cycle prevention: walks parent chain to ensure candidateParent is not a descendant of currentTeam
  private async validateNoCycle(
    tenantId: string,
    currentTeamId: string,
    candidateParentId: string
  ): Promise<void> {
    let checkId: string | undefined = candidateParentId;
    const visited = new Set<string>();

    while (checkId) {
      if (checkId === currentTeamId) {
        throw new BadRequestException('Cycle detected: moving team creates an ancestor circular dependency');
      }
      if (visited.has(checkId)) {
        throw new BadRequestException('Cycle detected in existing parent structure');
      }
      visited.add(checkId);

      const parentTeam = await TenantContext.run(tenantId, () => this.teamRepo.findById(checkId!));
      checkId = parentTeam?.parentTeamId;
    }
  }

  // ---------------------------------------------------------------------------
  // ORG CHART TREE & MOVE PERSON (AC-6)
  // ---------------------------------------------------------------------------

  async getTree(tenantId: string): Promise<OrgChartNodeProps> {
    const org = await TenantContext.run(tenantId, () => this.orgRepo.findById(tenantId));
    if (!org) {
      throw new NotFoundException(`Organization "${tenantId}" not found`);
    }

    const branches = await TenantContext.run(tenantId, () => this.branchRepo.listBranches(false));
    const departments = await TenantContext.run(tenantId, () => this.deptRepo.listDepartments(undefined, false));
    const teams = await TenantContext.run(tenantId, () => this.teamRepo.listTeams());

    // Build hierarchical tree
    const rootNode: OrgChartNodeProps = {
      id: org.id,
      name: org.name,
      type: 'company',
      managerChain: [],
      children: [],
    };

    // Index departments by branch (undefined = global)
    const deptsByBranch = new Map<string, DepartmentProps[]>();
    const globalDepts: DepartmentProps[] = [];

    for (const d of departments) {
      if (d.branchId) {
        const list = deptsByBranch.get(d.branchId) || [];
        list.push(d);
        deptsByBranch.set(d.branchId, list);
      } else {
        globalDepts.push(d);
      }
    }

    // Index teams by department
    const teamsByDept = new Map<string, TeamProps[]>();
    for (const t of teams) {
      const list = teamsByDept.get(t.departmentId) || [];
      list.push(t);
      teamsByDept.set(t.departmentId, list);
    }

    // Helper to build team nodes recursively
    const buildTeamNodes = (deptTeams: TeamProps[], parentId?: string, parentChain: string[] = []): OrgChartNodeProps[] => {
      const filtered = deptTeams.filter((t) => t.parentTeamId === parentId || (!parentId && !t.parentTeamId));
      return filtered.map((t) => {
        const chain = t.leadPersonId ? [...parentChain, t.leadPersonId] : parentChain;
        return {
          id: t.id,
          name: t.name,
          type: 'team',
          managerPersonId: t.leadPersonId,
          managerChain: parentChain,
          children: buildTeamNodes(deptTeams, t.id, chain),
        };
      });
    };

    // Helper to build department node
    const buildDeptNode = (dept: DepartmentProps, branchManagerId?: string): OrgChartNodeProps => {
      const chain = branchManagerId ? [branchManagerId] : [];
      if (dept.managerPersonId) chain.push(dept.managerPersonId);

      const deptTeams = teamsByDept.get(dept.id) || [];
      return {
        id: dept.id,
        name: dept.name,
        type: 'department',
        managerPersonId: dept.managerPersonId,
        managerChain: branchManagerId ? [branchManagerId] : [],
        children: buildTeamNodes(deptTeams, undefined, chain),
      };
    };

    // Branch nodes
    for (const b of branches) {
      const branchDepts = deptsByBranch.get(b.id) || [];
      const branchChildren: OrgChartNodeProps[] = branchDepts.map((d) => buildDeptNode(d, b.managerPersonId));

      rootNode.children?.push({
        id: b.id,
        name: b.name,
        type: 'branch',
        managerPersonId: b.managerPersonId,
        managerChain: [],
        children: branchChildren,
      });
    }

    // Global departments directly under company
    for (const gd of globalDepts) {
      rootNode.children?.push(buildDeptNode(gd));
    }

    return rootNode;
  }

  async movePersonInTree(
    tenantId: string,
    dto: MovePersonRequest,
    actorPersonId = 'system',
    correlationId = 'unknown'
  ): Promise<OrgChartNodeProps> {
    if (!dto.personId) {
      throw new BadRequestException('personId is required');
    }

    if (dto.targetBranchId) {
      const branch = await TenantContext.run(tenantId, () => this.branchRepo.findById(dto.targetBranchId!));
      if (!branch) {
        throw new NotFoundException(`Target branch "${dto.targetBranchId}" not found`);
      }
    }

    if (dto.targetDepartmentId) {
      const dept = await TenantContext.run(tenantId, () => this.deptRepo.findById(dto.targetDepartmentId!));
      if (!dept) {
        throw new NotFoundException(`Target department "${dto.targetDepartmentId}" not found`);
      }
    }

    if (dto.targetTeamId) {
      const team = await TenantContext.run(tenantId, () => this.teamRepo.findById(dto.targetTeamId!));
      if (!team) {
        throw new NotFoundException(`Target team "${dto.targetTeamId}" not found`);
      }
    }

    if (dto.targetTeamId) {
      await this.assignPersonToPrimaryTeam(tenantId, dto.targetTeamId, dto.personId);
    }

    // Record audit of drag-and-drop move
    await this.recordAudit(tenantId, {
      action: 'tree.person_moved',
      entityType: 'person',
      entityId: dto.personId,
      actorPersonId,
      after: {
        targetBranchId: dto.targetBranchId,
        targetDepartmentId: dto.targetDepartmentId,
        targetTeamId: dto.targetTeamId,
      },
    });

    await this.eventBus.publish({
      eventId: ulid(),
      type: 'org.person_moved',
      version: '1.0.0',
      tenantId,
      occurredAt: new Date().toISOString(),
      correlationId,
      aggregateVersion: 1,
      payload: {
        orgId: tenantId,
        personId: dto.personId,
        targetBranchId: dto.targetBranchId,
        targetDepartmentId: dto.targetDepartmentId,
        targetTeamId: dto.targetTeamId,
      },
    });

    await this.eventBus.publish({
      eventId: ulid(),
      type: 'audit.recorded',
      version: '1.0.0',
      tenantId,
      occurredAt: new Date().toISOString(),
      correlationId,
      aggregateVersion: 1,
      payload: {
        action: 'tree.person_moved',
        entityType: 'person',
        entityId: dto.personId,
        actorPersonId,
      },
    });

    return this.getTree(tenantId);
  }


  // ---------------------------------------------------------------------------
  // AUDIT LOG (AC-7)
  // ---------------------------------------------------------------------------

  async listAuditLogs(tenantId: string, entityType?: string, limit = 50): Promise<AuditLogProps[]> {
    return TenantContext.run(tenantId, () => this.auditRepo.listLogs(entityType, limit));
  }

  private async recordAudit(
    tenantId: string,
    entry: {
      action: string;
      entityType: string;
      entityId: string;
      actorPersonId: string;
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
    }
  ): Promise<void> {
    const auditRecord: AuditLogProps = {
      id: ulid(),
      tenantId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      actorPersonId: entry.actorPersonId,
      before: entry.before,
      after: entry.after,
      occurredAt: new Date().toISOString(),
    };

    await TenantContext.run(tenantId, () => this.auditRepo.record(auditRecord));
  }
}
