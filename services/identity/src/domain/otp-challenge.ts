export interface OtpChallenge {
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

export interface RateLimitEntry {
  requests: Date[];
  lockedUntil?: Date;
}
