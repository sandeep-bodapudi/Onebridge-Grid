import dotenv from 'dotenv';
import { resolveServiceJwtSecret, resolveInternalServiceKey, resolveEncryptionKey } from '@onebridge/shared';

dotenv.config();

export interface MessagingEnvConfig {
  nodeEnv: string;
  port: number;
  appUrl: string;
  mongoUri: string;
  /** Verifies identity access tokens (D-SERVICE-AUTH). Must equal identity's JWT_SECRET. */
  jwtSecret: string;
  identityApiUrl: string;
  /** Profiles service, for member summaries (service key). */
  profilesApiUrl: string;
  internalServiceKey: string;
  /** Master secret for message encryption keys (ADR-0002 style). */
  encryptionKey?: string;
  /** N08: new message requests a member may send per month (plan section 5.2, free member). */
  memberRequestsPerMonth: number;
  /** N08: new conversations one account may start per day, requests or not (spam protection; N09 tunes it). */
  dailyNewConversationCap: number;
}

export function loadAndValidateEnv(): MessagingEnvConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  return {
    nodeEnv,
    port: parseInt(process.env.MESSAGING_PORT || '4007', 10),
    appUrl: process.env.APP_URL || 'http://localhost:3000',
    mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/onebridge_dev',
    jwtSecret: resolveServiceJwtSecret(nodeEnv, process.env.JWT_SECRET),
    identityApiUrl: process.env.IDENTITY_API_URL || 'http://localhost:4001',
    profilesApiUrl: process.env.PROFILES_API_URL || 'http://localhost:4004',
    internalServiceKey: resolveInternalServiceKey(process.env.INTERNAL_SERVICE_KEY, nodeEnv),
    // Messages are encrypted with keys derived from it; production refuses a missing or development key.
    encryptionKey: resolveEncryptionKey(process.env.ENCRYPTION_KEY, nodeEnv),
    memberRequestsPerMonth: parseInt(process.env.MEMBER_REQUESTS_PER_MONTH || '5', 10),
    dailyNewConversationCap: parseInt(process.env.DAILY_NEW_CONVERSATION_CAP || '30', 10),
  };
}
