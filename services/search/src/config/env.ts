import dotenv from 'dotenv';
import { resolveServiceJwtSecret } from '@onebridge/shared';

dotenv.config();

export interface SearchEnvConfig {
  nodeEnv: string;
  port: number;
  appUrl: string;
  mongoUri: string;
  jwtSecret: string;
  identityApiUrl: string;
  internalServiceKey: string;
  /** Cards service (public company pages, for catalogue keywords). */
  cardsApiUrl: string;
  /** Profiles service (member summaries, service key). */
  profilesApiUrl: string;
  /** N03: anonymous searches per IP per minute. */
  anonSearchPerMinute: number;
}

export function loadAndValidateEnv(): SearchEnvConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  return {
    nodeEnv,
    port: parseInt(process.env.SEARCH_PORT || '4006', 10),
    appUrl: process.env.APP_URL || 'http://localhost:3000',
    mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/onebridge_dev',
    jwtSecret: resolveServiceJwtSecret(nodeEnv, process.env.JWT_SECRET),
    identityApiUrl: process.env.IDENTITY_API_URL || 'http://localhost:4001',
    internalServiceKey: process.env.INTERNAL_SERVICE_KEY || 'test-internal-service-key-at-least-32-chars-12345',
    cardsApiUrl: process.env.CARDS_API_URL || 'http://localhost:4003',
    profilesApiUrl: process.env.PROFILES_API_URL || 'http://localhost:4004',
    anonSearchPerMinute: parseInt(process.env.ANON_SEARCH_PER_MINUTE || '60', 10),
  };
}
