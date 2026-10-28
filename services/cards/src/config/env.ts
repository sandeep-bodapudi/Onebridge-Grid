import dotenv from 'dotenv';
import { resolveEncryptionKey, resolveInternalServiceKey, resolveSecret, resolveServiceJwtSecret } from '@onebridge/shared';

const DEV_REVALIDATION_SECRET = 'test-revalidation-signing-secret-at-least-32-chars';
const EMAIL_KEYS = ['EMAIL_PROVIDER', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_SECURE', 'EMAIL_FROM', 'EMAIL_REPLY_TO'];

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
  /** Flag demo_leads_panel: exposes the read-only GET /leads list used by the hosted prototype. Off unless DEMO_LEADS_PANEL=true. */
  demoLeadsPanel?: boolean;
  /** Call web-public's signed /api/revalidate outside production too (hosted demo runs `next start`, so ISR caches pages). */
  revalidateWebPublic?: boolean;
  /** D-VPS-DEPLOY: web-public's address inside the Docker network, for revalidation calls. Defaults to webPublicUrl. */
  webPublicInternalUrl?: string;
  /** ENCRYPTION_KEY (64 hex): encrypts leads. Required in production. */
  encryptionKey?: string;
  /** Cloudflare Turnstile secret; without it production relies on rate limits. */
  turnstileSecret?: string;
  /** EMAIL_PROVIDER, SMTP_* and EMAIL_* settings for lead emails. */
  emailEnv?: Record<string, string | undefined>;
}

export function loadAndValidateEnv(): CardsEnvConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const webPublicUrl = process.env.WEB_PUBLIC_URL || 'http://localhost:3001';
  const emailEnv: Record<string, string | undefined> = {};
  for (const key of EMAIL_KEYS) emailEnv[key] = process.env[key];
  return {
    emailEnv,
    encryptionKey: resolveEncryptionKey(process.env.ENCRYPTION_KEY, nodeEnv),
    turnstileSecret: process.env.TURNSTILE_SECRET || undefined,
    webPublicInternalUrl: process.env.WEB_PUBLIC_INTERNAL_URL || undefined,
    nodeEnv,
    jwtSecret: resolveServiceJwtSecret(nodeEnv, process.env.JWT_SECRET),
    identityApiUrl: process.env.IDENTITY_API_URL || 'http://localhost:4001',
    internalServiceKey: resolveInternalServiceKey(process.env.INTERNAL_SERVICE_KEY, nodeEnv),
    port: parseInt(process.env.CARDS_PORT || '4003', 10),
    appUrl: process.env.APP_URL || 'http://localhost:3000',
    mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/onebridge_dev',
    webPublicUrl,
    // On the VPS short links are served by web-public at <site>/r/<code> (no obg.in edge worker).
    shortLinkBaseUrl: process.env.SHORT_LINK_BASE_URL || (nodeEnv === 'production' ? `${webPublicUrl.replace(/\/+$/, '')}/r` : 'https://obg.in'),
    demoLeadsPanel: process.env.DEMO_LEADS_PANEL === 'true',
    revalidateWebPublic: process.env.REVALIDATE_WEB_PUBLIC === 'true',
    revalidationSigningSecret: resolveSecret('REVALIDATION_SIGNING_SECRET', process.env.REVALIDATION_SIGNING_SECRET, DEV_REVALIDATION_SECRET, nodeEnv),
  };
}
