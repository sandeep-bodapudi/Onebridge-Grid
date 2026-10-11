import { Db, GlobalRepository } from '@onebridge/shared';
import { Session, SessionFamily } from '../../domain/session.js';

interface MongoSessionDoc extends Session {
  id: string;
}

interface MongoSessionFamilyDoc extends SessionFamily {
  id: string;
}

export class MongoSessionRepository {
  private sessionsRepo: GlobalRepository<MongoSessionDoc>;
  private familiesRepo: GlobalRepository<MongoSessionFamilyDoc>;

  constructor(db: Db) {
    this.sessionsRepo = new GlobalRepository<MongoSessionDoc>(db, 'sessions');
    // Session families stored within the global sessions collection or separate index
    this.familiesRepo = new GlobalRepository<MongoSessionFamilyDoc>(db, 'sessions');
  }

  async saveFamily(family: SessionFamily): Promise<void> {
    await this.familiesRepo.replaceOne(
      { familyId: family.familyId, type: 'family' } as any,
      { ...family, id: `family-${family.familyId}`, type: 'family' } as any,
      { upsert: true }
    );
  }

  async findFamilyById(familyId: string): Promise<SessionFamily | undefined> {
    const doc = await this.familiesRepo.findOne({ familyId, type: 'family' } as any);
    return doc ? (doc as unknown as SessionFamily) : undefined;
  }

  async saveSession(session: Session): Promise<void> {
    await this.sessionsRepo.replaceOne(
      { sessionId: session.sessionId, type: 'session' } as any,
      { ...session, id: session.sessionId, type: 'session' } as any,
      { upsert: true }
    );
  }

  async findSessionById(sessionId: string): Promise<Session | undefined> {
    const doc = await this.sessionsRepo.findOne({ sessionId, type: 'session' } as any);
    return doc ? (doc as unknown as Session) : undefined;
  }

  async findSessionsByUserId(
    userId: string,
    limit = 20,
    offset = 0
  ): Promise<{ items: Session[]; total: number }> {
    const filter = { userId, type: 'session', isRevoked: false } as any;
    const total = await this.sessionsRepo.countDocuments(filter);
    const docs = await this.sessionsRepo.find(filter, {
      sort: { lastActiveAt: -1 },
      skip: offset,
      limit,
    });
    return {
      items: docs as unknown as Session[],
      total,
    };
  }

  async revokeSession(sessionId: string): Promise<void> {
    const session = await this.findSessionById(sessionId);
    if (session) {
      await this.sessionsRepo.updateOne(
        { sessionId, type: 'session' } as any,
        { $set: { isRevoked: true } as any }
      );
      if (session.familyId) {
        await this.revokeFamily(session.familyId);
      }
    }
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.familiesRepo.updateOne(
      { familyId, type: 'family' } as any,
      { $set: { isRevoked: true, revokedAt: new Date().toISOString() } as any }
    );
    await this.sessionsRepo.updateMany(
      { familyId, type: 'session' } as any,
      { $set: { isRevoked: true } as any }
    );
  }
}
