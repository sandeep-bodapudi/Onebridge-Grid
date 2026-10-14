import { TenantScopedRepository, MongoConnectionHandle } from '@onebridge/shared';
import { TeamProps } from '../domain/team.js';

export class MongoTeamRepository extends TenantScopedRepository<TeamProps> {
  constructor(dbOrHandle: MongoConnectionHandle | unknown) {
    super(dbOrHandle as MongoConnectionHandle, 'teams');
  }

  async save(team: TeamProps): Promise<TeamProps> {
    const filter = { id: team.id } as Parameters<typeof this.replaceOne>[0];
    const existing = await this.findOne(filter);

    if (existing) {
      await this.replaceOne(filter, team);
    } else {
      await this.insertOne(team as Parameters<typeof this.insertOne>[0]);
    }
    return team;
  }

  async findById(id: string): Promise<TeamProps | null> {
    const filter = { id } as Parameters<typeof this.findOne>[0];
    return this.findOne(filter);
  }

  async listTeams(departmentId?: string, includeArchived = false): Promise<TeamProps[]> {
    const filter: Record<string, unknown> = {};
    if (!includeArchived) {
      filter.status = 'active';
    }
    if (departmentId) {
      filter.departmentId = departmentId;
    }
    return this.find(filter as Parameters<typeof this.find>[0]);
  }

  async archiveTeam(id: string): Promise<TeamProps | null> {
    const team = await this.findById(id);
    if (!team) return null;
    const updated: TeamProps = {
      ...team,
      status: 'archived',
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return this.save(updated);
  }

  async deleteTeam(id: string): Promise<boolean> {
    const archived = await this.archiveTeam(id);
    return archived !== null;
  }

  async createIndexes(): Promise<void> {
    await this.collection.createIndex({ tenantId: 1, id: 1 }, { unique: true });
    await this.collection.createIndex({ tenantId: 1, departmentId: 1 });
    await this.collection.createIndex({ tenantId: 1, status: 1 });
  }
}

