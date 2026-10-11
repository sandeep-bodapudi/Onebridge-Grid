import dotenv from 'dotenv';
import { validateMongoUri, redactMongoUri } from '@onebridge/shared';

export interface IdentityEnvConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  appUrl: string;
  mongoUri: string;
  allowRemoteSeed: boolean;
  jwtSecret: string;
  internalServiceKey: string;
  encryptionKey: string;
  cookieSecure: boolean;
  cookieDomain?: string;
  enableFakeOtp: boolean;
  enableFakeOauth: boolean;
}

export function loadAndValidateEnv(explicitEnv?: Record<string, string | undefined>): IdentityEnvConfig {
  // Named loader: dotenv
  if (!explicitEnv && process.env.NODE_ENV !== 'test') {
    dotenv.config();
  }

  const env = explicitEnv || process.env;

  // Unset NODE_ENV strictly counts as production
  const rawNodeEnv = (env.NODE_ENV || '').trim().toLowerCase();
  const nodeEnv: 'development' | 'production' | 'test' =
    rawNodeEnv === 'development'
      ? 'development'
      : rawNodeEnv === 'test'
        ? 'test'
        : 'production';

  const isProduction = nodeEnv === 'production';
  const allowRemoteSeed = env.ALLOW_REMOTE_SEED === 'true';

  // 1. Validate MONGODB_URI
  const rawMongoUri = env.MONGODB_URI;
  const mongoUri = validateMongoUri(rawMongoUri, isProduction, allowRemoteSeed);

  // 2. Validate JWT_SECRET
  const jwtSecret = (env.JWT_SECRET || '').trim();
  if (isProduction && (!jwtSecret || jwtSecret.length < 32)) {
    throw new Error('JWT_SECRET is required and must be at least 32 characters in production');
  }

  // 3. Validate INTERNAL_SERVICE_KEY
  const internalServiceKey = (env.INTERNAL_SERVICE_KEY || '').trim();
  if (isProduction && (!internalServiceKey || internalServiceKey.length < 32)) {
    throw new Error('INTERNAL_SERVICE_KEY is required and must be at least 32 characters in production');
  }

  // 4. Validate fake providers in production
  const enableFakeOtp = env.ENABLE_FAKE_OTP === 'true';
  if (isProduction && enableFakeOtp) {
    throw new Error('ENABLE_FAKE_OTP is strictly prohibited in production');
  }

  const enableFakeOauth = env.ENABLE_FAKE_OAUTH === 'true';
  if (isProduction && enableFakeOauth) {
    throw new Error('ENABLE_FAKE_OAUTH is strictly prohibited in production');
  }

  // 5. Port & URLs
  const port = parseInt(env.PORT || '4001', 10);
  const appUrl = (env.APP_URL || 'http://localhost:3000').trim();

  // 6. Cookie configuration
  // Secure flag: true in production or if explicitly set to true. Allowed false in local dev/test HTTP.
  const cookieSecure = isProduction ? true : env.COOKIE_SECURE === 'true';
  const cookieDomain = env.COOKIE_DOMAIN ? env.COOKIE_DOMAIN.trim() : undefined;

  // 7. Encryption key for sensitive data at rest
  const encryptionKey = env.ENCRYPTION_KEY || 'default-dev-encryption-key-onebridge-32-bytes!';

  return {
    nodeEnv,
    port,
    appUrl,
    mongoUri,
    allowRemoteSeed,
    jwtSecret: jwtSecret || 'test-jwt-secret-key-at-least-32-chars-long-12345',
    internalServiceKey: internalServiceKey || 'test-internal-service-key-at-least-32-chars-12345',
    encryptionKey,
    cookieSecure,
    cookieDomain,
    enableFakeOtp,
    enableFakeOauth,
  };
}
