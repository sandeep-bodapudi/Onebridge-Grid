import crypto from 'node:crypto';
import { FakeOtpSender } from '@onebridge/shared';
import { OtpChallenge } from '../domain/otp-challenge.js';
import type { IOtpRepository } from './auth.service.js';

export interface OtpRequestResult {
  message: string;
  channel: 'sms' | 'whatsapp' | 'email';
  cooldownSeconds: number;
}

export class OtpService {
  constructor(
    private otpRepo: IOtpRepository,
    private otpSender: FakeOtpSender,
    /** Demo and test builds only (ENABLE_FAKE_OTP, refused in production): every code is this value. */
    private fixedCode?: string
  ) {}

  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  private checkRateLimits(requests: Date[], limit = 5, windowMs = 60 * 60 * 1000, errorMsg: string) {
    const now = Date.now();
    const recent = requests.filter(d => now - d.getTime() < windowMs);
    if (recent.length >= limit) {
      throw new Error(errorMsg);
    }
  }

  async requestOtp(phone: string, ipAddress: string, email?: string): Promise<OtpRequestResult> {
    const now = new Date();

    // 1. Rate limits check
    const phoneLimit = await this.otpRepo.getPhoneRateLimit(phone);
    if (phoneLimit.lockedUntil && phoneLimit.lockedUntil.getTime() > now.getTime()) {
      throw new Error('Account is currently locked');
    }
    this.checkRateLimits(phoneLimit.requests, 5, 3600000, 'Rate limit exceeded: maximum 5 requests per hour');

    const ipLimit = await this.otpRepo.getIpRateLimit(ipAddress);
    if (ipLimit.lockedUntil && ipLimit.lockedUntil.getTime() > now.getTime()) {
      throw new Error('IP is currently locked');
    }
    this.checkRateLimits(ipLimit.requests, 5, 3600000, 'Rate limit exceeded: IP rate limit');

    // 2. Generate a cryptographically random 6-digit OTP
    const code = this.fixedCode ?? crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    const hashedCode = this.hashCode(code);

    // 3. Channel dispatch with fallback (SMS -> WhatsApp -> Email)
    const sendResult = await this.otpSender.sendOtp(phone, email, code);

    // 4. Record rate limit
    phoneLimit.requests.push(now);
    ipLimit.requests.push(now);

    // 5. Store challenge (expires in 5 minutes, single-use)
    const challenge: OtpChallenge = {
      id: crypto.randomUUID(),
      phone,
      hashedCode,
      channel: sendResult.channel as 'sms' | 'whatsapp' | 'email',
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000), // 5 minutes
      used: false,
      failedAttempts: 0,
      ipAddress,
      createdAt: now,
    };
    await this.otpRepo.save(challenge);

    return {
      message: 'If registered, an OTP has been sent.',
      channel: challenge.channel,
      cooldownSeconds: 30,
    };
  }

  async verifyOtp(phone: string, code: string, ipAddress: string): Promise<{ success: boolean; challenge: OtpChallenge }> {
    const now = new Date();

    // Check lock status
    const phoneLimit = await this.otpRepo.getPhoneRateLimit(phone);
    if (phoneLimit.lockedUntil && phoneLimit.lockedUntil.getTime() > now.getTime()) {
      throw new Error('Account is currently locked');
    }
    const ipLimit = await this.otpRepo.getIpRateLimit(ipAddress);
    if (ipLimit.lockedUntil && ipLimit.lockedUntil.getTime() > now.getTime()) {
      throw new Error('IP is currently locked');
    }

    const challenge = await this.otpRepo.findLatestByPhone(phone);
    if (!challenge) {
      throw new Error('Invalid OTP code');
    }

    if (challenge.used) {
      throw new Error('OTP has already been used');
    }

    if (challenge.expiresAt.getTime() < now.getTime()) {
      throw new Error('OTP has expired');
    }

    const inputHash = this.hashCode(code);
    if (challenge.hashedCode !== inputHash) {
      challenge.failedAttempts += 1;
      await this.otpRepo.save(challenge);

      if (challenge.failedAttempts >= 5) {
        const lockUntil = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes lockout
        phoneLimit.lockedUntil = lockUntil;
        ipLimit.lockedUntil = lockUntil;
        throw new Error('Account locked for 15 minutes due to too many failed attempts');
      }

      throw new Error('Invalid OTP code');
    }

    // Mark as used
    challenge.used = true;
    await this.otpRepo.save(challenge);

    return { success: true, challenge };
  }
}
