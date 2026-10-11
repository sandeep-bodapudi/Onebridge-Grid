import dotenv from 'dotenv';
import { validateMongoUri } from '@onebridge/shared';

const KNOWN_DEV_KEYS = new Set([
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  'default-dev-encryption-key-onebridge-32-bytes!',
  'test-jwt-secret-key-at-least-32-chars-long-12345',
  'test-internal-service-key-at-least-32-chars-12345',
]);

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
  cookiePath: string;
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
  if (isProduction) {
    if (!jwtSecret || jwtSecret.length < 32) {
      throw new Error('JWT_SECRET is required and must be at least 32 characters in production');
    }
    if (KNOWN_DEV_KEYS.has(jwtSecret)) {
      throw new Error('JWT_SECRET cannot use known development or sample keys in production');
    }
  }

  // 3. Validate INTERNAL_SERVICE_KEY
  const internalServiceKey = (env.INTERNAL_SERVICE_KEY || '').trim();
  if (isProduction) {
    if (!internalServiceKey || internalServiceKey.length < 32) {
      throw new Error('INTERNAL_SERVICE_KEY is required and must be at least 32 characters in production');
    }
    if (KNOWN_DEV_KEYS.has(internalServiceKey)) {
      throw new Error('INTERNAL_SERVICE_KEY cannot use known development or sample keys in production');
    }
  }

  // 4. Validate ENCRYPTION_KEY (Single format: 64 hexadecimal characters representing a 256-bit AES key)
  const encryptionKey = (env.ENCRYPTION_KEY || '').trim();
  if (isProduction) {
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY is required in production');
    }
    if (KNOWN_DEV_KEYS.has(encryptionKey)) {
      throw new Error('ENCRYPTION_KEY cannot use known development or sample keys in production');
    }
    if (!/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
      throw new Error('ENCRYPTION_KEY must be exactly 64 hexadecimal characters (256-bit key) in production');
    }
  }

  // 5. Validate fake providers in production
  const enableFakeOtp = env.ENABLE_FAKE_OTP === 'true';
  if (isProduction && enableFakeOtp) {
    throw new Error('ENABLE_FAKE_OTP is strictly prohibited in production');
  }

  const enableFakeOauth = env.ENABLE_FAKE_OAUTH === 'true';
  if (isProduction && enableFakeOauth) {
    throw new Error('ENABLE_FAKE_OAUTH is strictly prohibited in production');
  }

  // 6. Port & URLs
  const port = parseInt(env.PORT || '4001', 10);
  const appUrl = (env.APP_URL || 'http://localhost:3000').trim();

  // 7. Cookie configuration
  const cookieSecure = isProduction ? true : env.COOKIE_SECURE === 'true';
  const cookieDomain = env.COOKIE_DOMAIN ? env.COOKIE_DOMAIN.trim() : undefined;
  const cookiePath = (env.COOKIE_PATH || '/auth').trim();

  return {
    nodeEnv,
    port,
    appUrl,
    mongoUri,
    allowRemoteSeed,
    jwtSecret: jwtSecret || 'test-jwt-secret-key-at-least-32-chars-long-12345',
    internalServiceKey: internalServiceKey || 'test-internal-service-key-at-least-32-chars-12345',
    encryptionKey: encryptionKey || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    cookieSecure,
    cookieDomain,
    cookiePath,
    enableFakeOtp,
    enableFakeOauth,
  };
}
