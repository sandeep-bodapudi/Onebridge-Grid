import { describe, it, expect } from 'vitest';
import { loadAndValidateEnv } from '../../src/config/env';

describe('Environment Validation & Production Guards (Condition 2 & 6)', () => {
  it('should fail fast if ENABLE_FAKE_OTP is set under NODE_ENV=production', () => {
    expect(() =>
      loadAndValidateEnv({
        NODE_ENV: 'production',
        MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/prod',
        JWT_SECRET: 'a'.repeat(32),
        INTERNAL_SERVICE_KEY: 'b'.repeat(32),
        ENABLE_FAKE_OTP: 'true',
      })
    ).toThrowError(/ENABLE_FAKE_OTP is strictly prohibited in production/);
  });

  it('should fail fast if ENABLE_FAKE_OAUTH is set under NODE_ENV=production', () => {
    expect(() =>
      loadAndValidateEnv({
        NODE_ENV: 'production',
        MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/prod',
        JWT_SECRET: 'a'.repeat(32),
        INTERNAL_SERVICE_KEY: 'b'.repeat(32),
        ENABLE_FAKE_OAUTH: 'true',
      })
    ).toThrowError(/ENABLE_FAKE_OAUTH is strictly prohibited in production/);
  });

  it('should treat unset NODE_ENV strictly as production and reject fake providers', () => {
    expect(() =>
      loadAndValidateEnv({
        NODE_ENV: undefined,
        MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/prod',
        JWT_SECRET: 'a'.repeat(32),
        INTERNAL_SERVICE_KEY: 'b'.repeat(32),
        ENABLE_FAKE_OTP: 'true',
      })
    ).toThrowError(/ENABLE_FAKE_OTP is strictly prohibited in production/);
  });

  it('should refuse non-local MONGODB_URI in non-production without ALLOW_REMOTE_SEED=true', () => {
    expect(() =>
      loadAndValidateEnv({
        NODE_ENV: 'development',
        MONGODB_URI: 'mongodb+srv://user:pass@remote-cluster.mongodb.net/dev',
        ALLOW_REMOTE_SEED: 'false',
      })
    ).toThrowError(/Refusing non-local MONGODB_URI/);
  });

  it('should permit non-local MONGODB_URI in non-production when ALLOW_REMOTE_SEED=true', () => {
    const config = loadAndValidateEnv({
      NODE_ENV: 'development',
      MONGODB_URI: 'mongodb+srv://user:pass@remote-cluster.mongodb.net/dev',
      ALLOW_REMOTE_SEED: 'true',
      JWT_SECRET: 'a'.repeat(32),
      INTERNAL_SERVICE_KEY: 'b'.repeat(32),
    });
    expect(config.allowRemoteSeed).toBe(true);
  });

  it('should fail fast in production if MONGODB_URI is missing or invalid', () => {
    expect(() =>
      loadAndValidateEnv({
        NODE_ENV: 'production',
        MONGODB_URI: undefined,
      })
    ).toThrowError(/MONGODB_URI is required/);

    expect(() =>
      loadAndValidateEnv({
        NODE_ENV: 'production',
        MONGODB_URI: 'http://localhost:27017',
      })
    ).toThrowError(/Invalid MONGODB_URI scheme/);
  });
});
