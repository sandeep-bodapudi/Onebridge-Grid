import { describe, it, expect, beforeEach } from 'vitest';
import { OtpService } from '../../src/application/otp.service';
import { FakeOtpSender } from '@onebridge/shared';
import { InMemoryOtpRepository } from '../../src/infrastructure/repositories/in-memory-otp.repository';

describe('OTP Service (AC-1, AC-2, AC-3, AC-9)', () => {
  let otpSender: FakeOtpSender;
  let otpRepo: InMemoryOtpRepository;
  let otpService: OtpService;

  beforeEach(() => {
    otpSender = new FakeOtpSender();
    otpRepo = new InMemoryOtpRepository();
    otpService = new OtpService(otpRepo, otpSender);
  });

  describe('AC-1: Fallback channel order', () => {
    it('should use SMS primarily when delivery succeeds', async () => {
      const result = await otpService.requestOtp('+919876543210', '127.0.0.1', 'user@example.com');
      expect(result.channel).toBe('sms');
      expect(otpSender.sentChannels).toHaveLength(1);
      expect(otpSender.sentChannels[0].channel).toBe('sms');
    });

    it('should fallback to WhatsApp when SMS fails', async () => {
      otpSender.failSms = true;
      const result = await otpService.requestOtp('+919876543210', '127.0.0.1', 'user@example.com');
      expect(result.channel).toBe('whatsapp');
      expect(otpSender.sentChannels).toHaveLength(1);
      expect(otpSender.sentChannels[0].channel).toBe('whatsapp');
    });

    it('should fallback to email when both SMS and WhatsApp fail', async () => {
      otpSender.failSms = true;
      otpSender.failWhatsapp = true;
      const result = await otpService.requestOtp('+919876543210', '127.0.0.1', 'user@example.com');
      expect(result.channel).toBe('email');
      expect(otpSender.sentChannels).toHaveLength(1);
      expect(otpSender.sentChannels[0].channel).toBe('email');
    });

    it('should fail if all channels fail or email is not available', async () => {
      otpSender.failSms = true;
      otpSender.failWhatsapp = true;
      otpSender.failEmail = true;
      await expect(otpService.requestOtp('+919876543210', '127.0.0.1', 'user@example.com'))
        .rejects.toThrow('All OTP delivery channels failed');
    });
  });

  describe('AC-2: Expiry, single-use, hashed storage', () => {
    it('should store OTP hashed and not in plaintext', async () => {
      await otpService.requestOtp('+919876543210', '127.0.0.1');
      const challenge = await otpRepo.findLatestByPhone('+919876543210');
      expect(challenge).toBeDefined();
      expect(challenge?.hashedCode).toBeDefined();
      expect(challenge?.hashedCode).not.toBe('123456');
      expect(challenge?.hashedCode.length).toBe(64); // SHA-256 hex
    });

    it('should verify valid OTP successfully', async () => {
      await otpService.requestOtp('+919876543210', '127.0.0.1');
      const verified = await otpService.verifyOtp('+919876543210', '123456', '127.0.0.1');
      expect(verified.success).toBe(true);
    });

    it('should reject already used OTP (single-use)', async () => {
      await otpService.requestOtp('+919876543210', '127.0.0.1');
      const firstAttempt = await otpService.verifyOtp('+919876543210', '123456', '127.0.0.1');
      expect(firstAttempt.success).toBe(true);

      await expect(otpService.verifyOtp('+919876543210', '123456', '127.0.0.1'))
        .rejects.toThrow('OTP has already been used');
    });

    it('should reject expired OTP (5 minutes window)', async () => {
      await otpService.requestOtp('+919876543210', '127.0.0.1');
      const challenge = await otpRepo.findLatestByPhone('+919876543210');
      // Artificially expire the challenge (6 minutes ago)
      if (challenge) {
        challenge.expiresAt = new Date(Date.now() - 6 * 60 * 1000);
        await otpRepo.save(challenge);
      }

      await expect(otpService.verifyOtp('+919876543210', '123456', '127.0.0.1'))
        .rejects.toThrow('OTP has expired');
    });
  });

  describe('AC-3: Rate limits and lockout', () => {
    it('should block 6th request within an hour per phone', async () => {
      for (let i = 0; i < 5; i++) {
        await otpService.requestOtp('+919876543210', '127.0.0.1');
      }
      await expect(otpService.requestOtp('+919876543210', '127.0.0.1'))
        .rejects.toThrow('Rate limit exceeded: maximum 5 requests per hour');
    });

    it('should block 6th request within an hour per IP', async () => {
      for (let i = 0; i < 5; i++) {
        await otpService.requestOtp(`+91987654321${i}`, '192.168.1.100');
      }
      await expect(otpService.requestOtp('+919876543299', '192.168.1.100'))
        .rejects.toThrow('Rate limit exceeded: IP rate limit');
    });

    it('should lock for 15 minutes after 5 wrong attempts', async () => {
      await otpService.requestOtp('+919876543210', '127.0.0.1');
      for (let i = 0; i < 4; i++) {
        await expect(otpService.verifyOtp('+919876543210', '000000', '127.0.0.1'))
          .rejects.toThrow('Invalid OTP code');
      }
      // 5th failed attempt triggers lock
      await expect(otpService.verifyOtp('+919876543210', '000000', '127.0.0.1'))
        .rejects.toThrow('Account locked for 15 minutes due to too many failed attempts');

      // Subsequent attempt (even with correct code) should remain locked
      await expect(otpService.verifyOtp('+919876543210', '123456', '127.0.0.1'))
        .rejects.toThrow('Account is currently locked');
    });
  });

  describe('AC-9: No account enumeration', () => {
    it('should provide identical response message regardless of whether phone exists in database', async () => {
      const resp1 = await otpService.requestOtp('+919876543210', '127.0.0.1');
      const resp2 = await otpService.requestOtp('+911111111111', '127.0.0.1');
      expect(resp1.message).toBe('If registered, an OTP has been sent.');
      expect(resp2.message).toBe('If registered, an OTP has been sent.');
    });
  });
});
