import { OtpChallenge, RateLimitEntry } from '../../domain/otp-challenge.js';

export class InMemoryOtpRepository {
  private challenges: OtpChallenge[] = [];
  private phoneRateLimits = new Map<string, RateLimitEntry>();
  private ipRateLimits = new Map<string, RateLimitEntry>();

  async save(challenge: OtpChallenge): Promise<void> {
    const idx = this.challenges.findIndex(c => c.id === challenge.id);
    if (idx >= 0) {
      this.challenges[idx] = challenge;
    } else {
      this.challenges.push(challenge);
    }
  }

  async findLatestByPhone(phone: string): Promise<OtpChallenge | undefined> {
    const matching = this.challenges
      .filter(c => c.phone === phone)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return matching[0];
  }

  async getPhoneRateLimit(phone: string): Promise<RateLimitEntry> {
    let entry = this.phoneRateLimits.get(phone);
    if (!entry) {
      entry = { requests: [] };
      this.phoneRateLimits.set(phone, entry);
    }
    return entry;
  }

  async getIpRateLimit(ip: string): Promise<RateLimitEntry> {
    let entry = this.ipRateLimits.get(ip);
    if (!entry) {
      entry = { requests: [] };
      this.ipRateLimits.set(ip, entry);
    }
    return entry;
  }
}
