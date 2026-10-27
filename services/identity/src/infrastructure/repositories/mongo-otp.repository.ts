import { GlobalRepository, MongoConnectionHandle } from '@onebridge/shared';
import { OtpChallenge, RateLimitEntry } from '../../domain/otp-challenge.js';
import { IOtpRepository } from '../../application/auth.service.js';

interface MongoOtpDocument {
  id: string;
  phone: string;
  hashedCode: string;
  channel: 'sms' | 'whatsapp' | 'email';
  expiresAt: Date;
  used: boolean;
  failedAttempts: number;
  ipAddress: string;
  createdAt: Date;
}

interface MongoRateLimitDocument {
  key: string;
  requests: Date[];
  lockedUntil?: Date;
  resetAt: Date;
}

export class MongoOtpRepository implements IOtpRepository {
  private challengesRepo: GlobalRepository<MongoOtpDocument>;
  private rateLimitsRepo: GlobalRepository<MongoRateLimitDocument>;

  constructor(dbOrHandle: MongoConnectionHandle | unknown) {
    this.challengesRepo = new GlobalRepository<MongoOtpDocument>(dbOrHandle as MongoConnectionHandle, 'otp_challenges');
    this.rateLimitsRepo = new GlobalRepository<MongoRateLimitDocument>(dbOrHandle as MongoConnectionHandle, 'rate_limits');
  }

  async createIndexes(): Promise<void> {
    await this.ensureIndexes();
  }

  async ensureIndexes(): Promise<void> {
    await this.challengesRepo.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await this.challengesRepo.createIndex({ phone: 1 });
    await this.rateLimitsRepo.createIndex({ resetAt: 1 }, { expireAfterSeconds: 0 });
  }

  async save(challenge: OtpChallenge): Promise<void> {
    await this.challengesRepo.replaceOne(
      { id: challenge.id },
      { ...challenge },
      { upsert: true }
    );
  }

  async findLatestByPhone(phone: string): Promise<OtpChallenge | undefined> {
    const results = await this.challengesRepo.find(
      { phone },
      { sort: { createdAt: -1, _id: -1 }, limit: 1 }
    );
    if (!results || results.length === 0) return undefined;
    return results[0] as OtpChallenge;
  }

  async getPhoneRateLimit(phone: string): Promise<RateLimitEntry> {
    const key = `phone:${phone}`;
    const doc = await this.rateLimitsRepo.findOne({ key });
    if (!doc) {
      return { requests: [] };
    }
    return {
      requests: doc.requests || [],
      lockedUntil: doc.lockedUntil,
    };
  }

  async savePhoneRateLimit(phone: string, entry: RateLimitEntry): Promise<void> {
    const key = `phone:${phone}`;
    const resetAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    await this.rateLimitsRepo.replaceOne(
      { key },
      { key, requests: entry.requests, lockedUntil: entry.lockedUntil, resetAt },
      { upsert: true }
    );
  }

  async getIpRateLimit(ip: string): Promise<RateLimitEntry> {
    const key = `ip:${ip}`;
    const doc = await this.rateLimitsRepo.findOne({ key });
    if (!doc) {
      return { requests: [] };
    }
    return {
      requests: doc.requests || [],
      lockedUntil: doc.lockedUntil,
    };
  }

  async saveIpRateLimit(ip: string, entry: RateLimitEntry): Promise<void> {
    const key = `ip:${ip}`;
    const resetAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    await this.rateLimitsRepo.replaceOne(
      { key },
      { key, requests: entry.requests, lockedUntil: entry.lockedUntil, resetAt },
      { upsert: true }
    );
  }
}
