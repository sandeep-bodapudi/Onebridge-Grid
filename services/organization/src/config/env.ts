import dotenv from 'dotenv';
import { resolveServiceJwtSecret } from '@onebridge/shared';

dotenv.config();

export interface OrganizationEnvConfig {
  nodeEnv: string;
  port: number;
  appUrl: string;
  mongoUri: string;
  identityApiUrl: string;
  internalServiceKey: string;
  /** Verifies identity access tokens (D-SERVICE-AUTH). Must equal identity's JWT_SECRET. */
  jwtSecret?: string;
  /** D-AUTH-EMAIL D11: phone sign-in is off (AUTH_METHODS without phone; production default), so invites go by email only. */
  emailOnlyInvites?: boolean;
  /** EMAIL_PROVIDER, SMTP_* and EMAIL_* settings for the invite emails. */
  emailEnv?: Record<string, string | undefined>;
}

const EMAIL_KEYS = ['EMAIL_PROVIDER', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_SECURE', 'EMAIL_FROM', 'EMAIL_REPLY_TO'];

export function loadAndValidateEnv(): OrganizationEnvConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  // Same rule as identity: AUTH_METHODS when set, otherwise phone is off only in production.
  const methods = process.env.AUTH_METHODS?.split(',').map((m) => m.trim().toLowerCase());
  const phoneSignIn = methods ? methods.includes('phone') : nodeEnv !== 'production';
  const emailEnv: Record<string, string | undefined> = {};
  for (const key of EMAIL_KEYS) emailEnv[key] = process.env[key];
  return {
    emailOnlyInvites: !phoneSignIn,
    emailEnv,
    nodeEnv,
    jwtSecret: resolveServiceJwtSecret(nodeEnv, process.env.JWT_SECRET),
    port: parseInt(process.env.ORGANIZATION_PORT || '4002', 10),
    appUrl: process.env.APP_URL || 'http://localhost:3000',
    mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/onebridge_dev',
    identityApiUrl: process.env.IDENTITY_API_URL || 'http://localhost:4001',
    internalServiceKey:
      process.env.INTERNAL_SERVICE_KEY || 'test-internal-service-key-at-least-32-chars-12345',
  };
}
