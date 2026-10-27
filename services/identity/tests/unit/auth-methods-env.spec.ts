import { describe, it, expect } from 'vitest';
import { loadAndValidateEnv } from '../../src/config/env';

const PROD = {
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb://mongo:27017/onebridge?replicaSet=rs0',
  JWT_SECRET: 'j'.repeat(32),
  INTERNAL_SERVICE_KEY: 'k'.repeat(32),
  ENCRYPTION_KEY: 'e'.repeat(64),
  GOOGLE_CLIENT_ID: 'client-123.apps.googleusercontent.com',
};

const DEV = { NODE_ENV: 'development', MONGODB_URI: 'mongodb://127.0.0.1:27017/onebridge' };

describe('D-AUTH-EMAIL sign-in methods (AUTH_METHODS)', () => {
  it('defaults to Google and email in production, and adds phone in development', () => {
    expect(loadAndValidateEnv(PROD).authMethods).toEqual(['google', 'email']);
    expect(loadAndValidateEnv(DEV).authMethods).toEqual(['google', 'email', 'phone']);
  });

  it('refuses phone sign-in in production', () => {
    expect(() => loadAndValidateEnv({ ...PROD, AUTH_METHODS: 'google,email,phone' })).toThrow(/may not include phone in production/);
  });

  it('refuses Google in production without a client ID, and allows email-only without one', () => {
    expect(() => loadAndValidateEnv({ ...PROD, GOOGLE_CLIENT_ID: '' })).toThrow(/GOOGLE_CLIENT_ID is required/);
    expect(loadAndValidateEnv({ ...PROD, GOOGLE_CLIENT_ID: '', AUTH_METHODS: 'email' }).authMethods).toEqual(['email']);
  });

  it('rejects unknown or empty method lists', () => {
    expect(() => loadAndValidateEnv({ ...DEV, AUTH_METHODS: 'google,pigeon' })).toThrow(/unknown method "pigeon"/);
    expect(() => loadAndValidateEnv({ ...DEV, AUTH_METHODS: ' , ' })).toThrow(/at least one method/);
  });

  it('passes the email settings through for the email sender', () => {
    const env = loadAndValidateEnv({ ...PROD, EMAIL_PROVIDER: 'smtp', SMTP_HOST: 'smtp.example.com', EMAIL_FROM: 'no-reply@example.com' });
    expect(env.emailEnv).toMatchObject({ EMAIL_PROVIDER: 'smtp', SMTP_HOST: 'smtp.example.com', EMAIL_FROM: 'no-reply@example.com' });
  });
});
