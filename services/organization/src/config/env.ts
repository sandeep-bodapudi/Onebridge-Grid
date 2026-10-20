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
}

export function loadAndValidateEnv(): OrganizationEnvConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  return {
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
