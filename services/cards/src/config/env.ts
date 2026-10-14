import dotenv from 'dotenv';

dotenv.config();

export interface CardsEnvConfig {
  nodeEnv: string;
  port: number;
  appUrl: string;
  mongoUri: string;
  webPublicUrl: string;
  revalidationSigningSecret: string;
}

export function loadAndValidateEnv(): CardsEnvConfig {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.CARDS_PORT || '4003', 10),
    appUrl: process.env.APP_URL || 'http://localhost:3000',
    mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/onebridge_dev',
    webPublicUrl: process.env.WEB_PUBLIC_URL || 'http://localhost:3001',
    revalidationSigningSecret:
      process.env.REVALIDATION_SIGNING_SECRET || 'test-revalidation-signing-secret-at-least-32-chars',
  };
}
