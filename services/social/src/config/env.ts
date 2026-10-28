import dotenv from 'dotenv';
import { resolveServiceJwtSecret, resolveInternalServiceKey } from '@onebridge/shared';

dotenv.config();

export interface SocialEnvConfig {
  nodeEnv: string;
  port: number;
  appUrl: string;
  mongoUri: string;
  /** Verifies identity access tokens (D-SERVICE-AUTH). Must equal identity's JWT_SECRET. */
  jwtSecret: string;
  identityApiUrl: string;
  /** Profiles service, for member summaries in lists (service key). */
  profilesApiUrl: string;
  internalServiceKey: string;
  /** N04: follows one account can make per day (spam protection; N09 lowers it for new accounts). */
  dailyFollowCap: number;
}

export function loadAndValidateEnv(): SocialEnvConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  return {
    nodeEnv,
    port: parseInt(process.env.SOCIAL_PORT || '4005', 10),
    appUrl: process.env.APP_URL || 'http://localhost:3000',
    mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/onebridge_dev',
    jwtSecret: resolveServiceJwtSecret(nodeEnv, process.env.JWT_SECRET),
    identityApiUrl: process.env.IDENTITY_API_URL || 'http://localhost:4001',
    profilesApiUrl: process.env.PROFILES_API_URL || 'http://localhost:4004',
    internalServiceKey: resolveInternalServiceKey(process.env.INTERNAL_SERVICE_KEY, nodeEnv),
    dailyFollowCap: parseInt(process.env.DAILY_FOLLOW_CAP || '200', 10),
  };
}
