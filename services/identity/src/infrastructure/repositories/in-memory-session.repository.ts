import { Session, SessionFamily } from '../../domain/session.js';

export class InMemorySessionRepository {
  private families = new Map<string, SessionFamily>();
  private sessions = new Map<string, Session>();

  async saveFamily(family: SessionFamily): Promise<void> {
    this.families.set(family.familyId, family);
  }

  async findFamilyById(familyId: string): Promise<SessionFamily | undefined> {
    return this.families.get(familyId);
  }

  async saveSession(session: Session): Promise<void> {
    this.sessions.set(session.sessionId, session);
  }

  async findSessionById(sessionId: string): Promise<Session | undefined> {
    return this.sessions.get(sessionId);
  }

  async findSessionsByUserId(
    userId: string,
    limit = 20,
    offset = 0
  ): Promise<{ items: Session[]; total: number }> {
    const all = Array.from(this.sessions.values())
      .filter(s => s.userId === userId && !s.isRevoked)
      .sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());
    const total = all.length;
    const items = all.slice(offset, offset + limit);
    return { items, total };
  }

  async revokeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isRevoked = true;
      const family = this.families.get(session.familyId);
      if (family) {
        family.isRevoked = true;
        family.revokedAt = new Date().toISOString();
      }
    }
  }

  async revokeFamily(familyId: string): Promise<void> {
    const family = this.families.get(familyId);
    if (family) {
      family.isRevoked = true;
      family.revokedAt = new Date().toISOString();
      for (const session of this.sessions.values()) {
        if (session.familyId === familyId) {
          session.isRevoked = true;
        }
      }
    }
  }
}
