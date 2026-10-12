import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NestAuthController } from '../../src/presentation/nest-auth.controller';
import { NestMeController } from '../../src/presentation/nest-me.controller';
import { NestInternalController } from '../../src/presentation/nest-internal.controller';

describe('OpenAPI Route Parity & Status Verification (Condition 10)', () => {
  const openApiPath = path.resolve(__dirname, '../../../../packages/api-contracts/openapi.yaml');
  const openApiContent = fs.readFileSync(openApiPath, 'utf-8');

  const identityEndpoints: Array<{ path: string; method: string; expectedStatuses: string[] }> = [
    { path: '/auth/otp:', method: 'post:', expectedStatuses: ["'200':", "'429':"] },
    { path: '/auth/verify:', method: 'post:', expectedStatuses: ["'200':", "'400':", "'423':"] },
    { path: '/auth/oauth/{provider}:', method: 'post:', expectedStatuses: ["'200':", "'400':"] },
    { path: '/auth/oauth/confirm-link:', method: 'post:', expectedStatuses: ["'200':", "'400':"] },
    { path: '/auth/refresh:', method: 'post:', expectedStatuses: ["'200':", "'401':"] },
    { path: '/auth/logout:', method: 'post:', expectedStatuses: ["'204':"] },
    { path: '/auth/sessions:', method: 'get:', expectedStatuses: ["'200':", "'401':"] },
    { path: '/auth/sessions/{id}:', method: 'delete:', expectedStatuses: ["'204':", "'401':", "'403':"] },
    { path: '/auth/mfa/setup:', method: 'post:', expectedStatuses: ["'200':"] },
    { path: '/auth/mfa/verify:', method: 'post:', expectedStatuses: ["'200':"] },
    { path: '/me:', method: 'get:', expectedStatuses: ["'200':", "'401':", "'403':"] },
    { path: '/internal/memberships:', method: 'post:', expectedStatuses: ["'201':", "'422':"] },
  ];

  it('should verify every identity route exists in openapi.yaml with matching methods and statuses', () => {
    for (const endpoint of identityEndpoints) {
      expect(
        openApiContent.includes(endpoint.path),
        `Expected OpenAPI path "${endpoint.path}" to be in openapi.yaml`
      ).toBe(true);

      const pathIdx = openApiContent.indexOf(endpoint.path);
      const nextPathIdx = openApiContent.indexOf('\n  /', pathIdx + endpoint.path.length);
      const section = openApiContent.substring(pathIdx, nextPathIdx !== -1 ? nextPathIdx : undefined);

      expect(
        section.includes(endpoint.method),
        `Expected method "${endpoint.method}" in section for ${endpoint.path}`
      ).toBe(true);

      for (const expectedStatus of endpoint.expectedStatuses) {
        expect(
          section.includes(expectedStatus),
          `Expected status "${expectedStatus}" in section for ${endpoint.path}`
        ).toBe(true);
      }
    }
  });

  it('should verify controllers define methods for all identity routes', () => {
    // Auth controller methods
    expect(typeof NestAuthController.prototype.requestOtp).toBe('function');
    expect(typeof NestAuthController.prototype.verifyOtp).toBe('function');
    expect(typeof NestAuthController.prototype.oauthLogin).toBe('function');
    expect(typeof NestAuthController.prototype.confirmOAuthLink).toBe('function');
    expect(typeof NestAuthController.prototype.refresh).toBe('function');
    expect(typeof NestAuthController.prototype.logout).toBe('function');
    expect(typeof NestAuthController.prototype.listSessions).toBe('function');
    expect(typeof NestAuthController.prototype.revokeSession).toBe('function');
    expect(typeof NestAuthController.prototype.setupMfa).toBe('function');
    expect(typeof NestAuthController.prototype.verifyMfa).toBe('function');

    // Me controller methods
    expect(typeof NestMeController.prototype.getMe).toBe('function');

    // Internal controller methods
    expect(typeof NestInternalController.prototype.createMembership).toBe('function');
  });
});
