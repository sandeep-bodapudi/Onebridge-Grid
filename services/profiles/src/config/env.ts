import dotenv from 'dotenv';
import { resolveServiceJwtSecret } from '@onebridge/shared';

dotenv.config();

export interface ProfilesEnvConfig {
  nodeEnv: string;
  port: number;
  appUrl: string;
  /** Public site origin (member profile pages live at <webPublicUrl>/in/<handle>). */
  webPublicUrl: string;
  mongoUri: string;
  /** Verifies identity access tokens (D-SERVICE-AUTH). Must equal identity's JWT_SECRET. */
  jwtSecret: string;
  identityApiUrl: string;
  internalServiceKey: string;
}

export function loadAndValidateEnv(): ProfilesEnvConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  return {
    nodeEnv,
    port: parseInt(process.env.PROFILES_PORT || '4004', 10),
    appUrl: process.env.APP_URL || 'http://localhost:3000',
    webPublicUrl: process.env.WEB_PUBLIC_URL || 'http://localhost:3001',
    mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/onebridge_dev',
    jwtSecret: resolveServiceJwtSecret(nodeEnv, process.env.JWT_SECRET),
    identityApiUrl: process.env.IDENTITY_API_URL || 'http://localhost:4001',
    internalServiceKey: process.env.INTERNAL_SERVICE_KEY || 'test-internal-service-key-at-least-32-chars-12345',
  };
}
