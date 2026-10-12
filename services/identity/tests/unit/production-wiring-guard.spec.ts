import { describe, it, expect } from 'vitest';
import { IdentityModule } from '../../src/identity.module';
import { IdentityEnvConfig } from '../../src/config/env';

describe('Production Wiring Guard (Fix 1: AC-A9)', () => {
  const prodConfig: IdentityEnvConfig = {
    nodeEnv: 'production',
    port: 4001,
    appUrl: 'https://app.onebridge.in',
    mongoUri: 'mongodb+srv://user:pass@cluster.mongodb.net/prod',
    allowRemoteSeed: false,
    jwtSecret: 'a'.repeat(32),
    internalServiceKey: 'b'.repeat(32),
    encryptionKey: 'c'.repeat(64),
    cookieSecure: true,
    cookiePath: '/auth',
    enableFakeOtp: false,
    enableFakeOauth: false,
  };

  const devConfig: IdentityEnvConfig = {
    ...prodConfig,
    nodeEnv: 'development',
    mongoUri: 'mongodb://localhost:27017/dev',
    cookieSecure: false,
  };

  it('strictly throws if in-memory repositories are wired under NODE_ENV=production', () => {
    expect(() =>
      IdentityModule.register({
        envConfig: prodConfig,
        useInMemoryRepositories: true,
      })
    ).toThrowError(/In-memory repositories are strictly prohibited in production/);
  });

  it('permits in-memory repositories in non-production environments', () => {
    expect(() =>
      IdentityModule.register({
        envConfig: devConfig,
        useInMemoryRepositories: true,
      })
    ).not.toThrowError(/In-memory repositories are strictly prohibited in production/);
  });
});
