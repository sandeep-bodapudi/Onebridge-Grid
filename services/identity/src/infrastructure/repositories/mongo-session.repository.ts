import { GlobalRepository, MongoConnectionHandle } from '@onebridge/shared';
import { Session, SessionFamily } from '../../domain/session.js';
import { ISessionRepository } from '../../application/auth.service.js';

interface MongoSessionBaseDoc {
  type: 'session' | 'family';
  sessionId?: string;
  familyId: string;
  userId?: string;
  deviceLabel?: string;
  currentRefreshTokenHash?: string;
  refreshTokenHash?: string;
  usedRefreshTokenHashes?: string[];
  expiresAt?: Date | string;
  createdAt?: string;
  updatedAt?: string;
  lastActiveAt?: string;
  isRevoked?: boolean;
  revokedAt?: string;
  userAgent?: string;
  ipAddress?: string;
}

export class MongoSessionRepository implements ISessionRepository {
  private repo: GlobalRepository<MongoSessionBaseDoc>;

  constructor(dbOrHandle: MongoConnectionHandle | unknown) {
    this.repo = new GlobalRepository<MongoSessionBaseDoc>(dbOrHandle as MongoConnectionHandle, 'sessions');
  }

  async ensureIndexes(): Promise<void> {
    await this.repo.createIndex({ userId: 1 });
    await this.repo.createIndex({ familyId: 1 });
    await this.repo.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  }

  async saveFamily(family: SessionFamily): Promise<void> {
    await this.repo.replaceOne(
      { familyId: family.familyId, type: 'family' },
      {
        type: 'family',
        familyId: family.familyId,
        userId: family.userId,
        currentRefreshTokenHash: family.currentRefreshTokenHash,
        usedRefreshTokenHashes: Array.from(family.usedRefreshTokenHashes),
        isRevoked: family.isRevoked,
        revokedAt: family.revokedAt,
        createdAt: family.createdAt,
        updatedAt: family.updatedAt,
      },
      { upsert: true }
    );
  }

  async findFamilyById(familyId: string): Promise<SessionFamily | undefined> {
    const doc = await this.repo.findOne({ familyId, type: 'family' });
    if (!doc) return undefined;
    return {
      familyId: doc.familyId,
      userId: doc.userId || '',
      currentRefreshTokenHash: doc.currentRefreshTokenHash || '',
      usedRefreshTokenHashes: new Set<string>(doc.usedRefreshTokenHashes || []),
      isRevoked: doc.isRevoked || false,
      revokedAt: doc.revokedAt,
      createdAt: doc.createdAt || new Date().toISOString(),
      updatedAt: doc.updatedAt || new Date().toISOString(),
    };
  }

  async saveSession(session: Session): Promise<void> {
    await this.repo.replaceOne(
      { sessionId: session.sessionId, type: 'session' },
      {
        type: 'session',
        sessionId: session.sessionId,
        familyId: session.familyId,
        userId: session.userId,
        deviceLabel: session.deviceLabel,
        createdAt: session.createdAt,
        lastActiveAt: session.lastActiveAt,
        isRevoked: session.isRevoked,
        ipAddress: session.ipAddress,
      },
      { upsert: true }
    );
  }

  async findSessionById(sessionId: string): Promise<Session | undefined> {
    const doc = await this.repo.findOne({ sessionId, type: 'session' });
    if (!doc || !doc.sessionId) return undefined;
    return {
      sessionId: doc.sessionId,
      familyId: doc.familyId,
      userId: doc.userId || '',
      deviceLabel: doc.deviceLabel || doc.userAgent || 'Default Device',
      createdAt: doc.createdAt || '',
      lastActiveAt: doc.lastActiveAt || '',
      isRevoked: doc.isRevoked || false,
      ipAddress: doc.ipAddress || '127.0.0.1',
    };
  }

  async findSessionsByUserId(
    userId: string,
    limit = 20,
    offset = 0
  ): Promise<{ items: Session[]; total: number }> {
    const filter = { userId, type: 'session' as const, isRevoked: false };
    const total = await this.repo.countDocuments(filter);
    const docs = await this.repo.find(filter, {
      sort: { lastActiveAt: -1 },
      skip: offset,
      limit,
    });
    return {
      items: docs.filter(d => Boolean(d.sessionId)).map(d => ({
        sessionId: d.sessionId!,
        familyId: d.familyId,
        userId: d.userId || '',
        deviceLabel: d.deviceLabel || d.userAgent || 'Default Device',
        createdAt: d.createdAt || '',
        lastActiveAt: d.lastActiveAt || '',
        isRevoked: d.isRevoked || false,
        ipAddress: d.ipAddress || '127.0.0.1',
      })),
      total,
    };
  }

  async revokeSession(sessionId: string): Promise<void> {
    const session = await this.findSessionById(sessionId);
    if (session) {
      await this.repo.updateOne(
        { sessionId, type: 'session' },
        { $set: { isRevoked: true } }
      );
      if (session.familyId) {
        await this.revokeFamily(session.familyId);
      }
    }
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.repo.updateOne(
      { familyId, type: 'family' },
      { $set: { isRevoked: true, revokedAt: new Date().toISOString() } }
    );
    await this.repo.updateMany(
      { familyId, type: 'session' },
      { $set: { isRevoked: true } }
    );
  }
}
