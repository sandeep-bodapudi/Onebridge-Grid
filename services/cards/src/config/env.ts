import dotenv from 'dotenv';
import { resolveServiceJwtSecret } from '@onebridge/shared';

dotenv.config();

export interface CardsEnvConfig {
  nodeEnv: string;
  port: number;
  appUrl: string;
  mongoUri: string;
  webPublicUrl: string;
  /** Base of short links encoded in QR codes and NFC chips. Production: https://obg.in (edge worker). A demo or staging host can use <WEB_PUBLIC_URL>/r. */
  shortLinkBaseUrl?: string;
  revalidationSigningSecret: string;
  /** Verifies identity access tokens (D-SERVICE-AUTH). Must equal identity's JWT_SECRET. */
  jwtSecret?: string;
  /** Identity service base URL, for membership role lookups. */
  identityApiUrl?: string;
  /** Service key for identity's /internal endpoints. Must equal identity's INTERNAL_SERVICE_KEY. */
  internalServiceKey?: string;
}

export function loadAndValidateEnv(): CardsEnvConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  return {
    nodeEnv,
    jwtSecret: resolveServiceJwtSecret(nodeEnv, process.env.JWT_SECRET),
    identityApiUrl: process.env.IDENTITY_API_URL || 'http://localhost:4001',
    internalServiceKey:
      process.env.INTERNAL_SERVICE_KEY || 'test-internal-service-key-at-least-32-chars-12345',
    port: parseInt(process.env.CARDS_PORT || '4003', 10),
    appUrl: process.env.APP_URL || 'http://localhost:3000',
    mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/onebridge_dev',
    webPublicUrl: process.env.WEB_PUBLIC_URL || 'http://localhost:3001',
    shortLinkBaseUrl: process.env.SHORT_LINK_BASE_URL || 'https://obg.in',
    revalidationSigningSecret:
      process.env.REVALIDATION_SIGNING_SECRET || 'test-revalidation-signing-secret-at-least-32-chars',
  };
}
