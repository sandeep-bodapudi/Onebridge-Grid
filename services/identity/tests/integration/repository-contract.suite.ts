import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongo, MongoConnectionHandle, TenantIsolationError } from '@onebridge/shared';
import { KeyService } from '../../src/application/key.service';
import { InMemoryPersonRepository } from '../../src/infrastructure/repositories/in-memory-person.repository';
import { MongoPersonRepository } from '../../src/infrastructure/repositories/mongo-person.repository';
import { InMemorySessionRepository } from '../../src/infrastructure/repositories/in-memory-session.repository';
import { MongoSessionRepository } from '../../src/infrastructure/repositories/mongo-session.repository';
import { InMemoryOtpRepository } from '../../src/infrastructure/repositories/in-memory-otp.repository';
import { MongoOtpRepository } from '../../src/infrastructure/repositories/mongo-otp.repository';
import { InMemoryMembershipRepository } from '../../src/infrastructure/repositories/in-memory-membership.repository';
import { MongoMembershipRepository } from '../../src/infrastructure/repositories/mongo-membership.repository';
import { Person } from '../../src/domain/person';
import { Session, SessionFamily } from '../../src/domain/session';
import { OtpChallenge } from '../../src/domain/otp-challenge';
import { MembershipProps } from '../../src/domain/membership';

const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Repository Contract Suite (Fix 1: Real Mongo & In-Memory Parity)', () => {
  let mongod: MongoMemoryServer;
  let connectionHandle: MongoConnectionHandle;
  const keyService = new KeyService(TEST_KEY);

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    connectionHandle = await connectMongo(mongod.getUri());
  }, 120000);

  afterAll(async () => {
    if (connectionHandle) {
      await connectionHandle.close();
    }
    if (mongod) {
      await mongod.stop();
    }
  });

  const implementations = [
    {
      name: 'In-Memory',
      setup: async () => {
        return {
          personRepo: new InMemoryPersonRepository(),
          sessionRepo: new InMemorySessionRepository(),
          otpRepo: new InMemoryOtpRepository(),
          membershipRepo: new InMemoryMembershipRepository(),
        };
      },
    },
    {
      name: 'MongoDB',
      setup: async () => {
        const db = connectionHandle._getInternalDb();
        await db.collection('persons').deleteMany({});
        await db.collection('sessions').deleteMany({});
        await db.collection('session_families').deleteMany({});
        await db.collection('otps').deleteMany({});
        await db.collection('rate_limits').deleteMany({});
        await db.collection('memberships').deleteMany({});

        const personRepo = new MongoPersonRepository(connectionHandle, keyService);
        const sessionRepo = new MongoSessionRepository(connectionHandle);
        const otpRepo = new MongoOtpRepository(connectionHandle);
        const membershipRepo = new MongoMembershipRepository(connectionHandle);

        await personRepo.ensureIndexes();
        await sessionRepo.ensureIndexes();
        await otpRepo.ensureIndexes();
        await membershipRepo.ensureIndexes();

        return { personRepo, sessionRepo, otpRepo, membershipRepo };
      },
    },
  ];

  for (const impl of implementations) {
    describe(`${impl.name} Repositories Contract`, () => {
      let repos: Awaited<ReturnType<typeof impl.setup>>;

      beforeEach(async () => {
        repos = await impl.setup();
      });

      describe('Person Repository Contract', () => {
        it('creates, retrieves, updates, and queries persons by email and phone', async () => {
          const person: Person = {
            userId: '01JACTESTPERSON0000000000001',
            phone: '+919876543210',
            email: 'user@example.com',
            name: 'Test Person',
            authProviders: ['otp'],
            mfa: { enabled: false },
            roles: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await repos.personRepo.create(person);

          // Find by ID
          const byId = await repos.personRepo.findById(person.userId);
          expect(byId).toBeDefined();
          expect(byId?.userId).toBe(person.userId);
          expect(byId?.name).toBe('Test Person');

          // Find by phone
          const byPhone = await repos.personRepo.findByPhone('+919876543210');
          expect(byPhone).toBeDefined();
          expect(byPhone?.userId).toBe(person.userId);

          // Find by email (case-insensitive)
          const byEmail = await repos.personRepo.findByEmail('USER@EXAMPLE.COM');
          expect(byEmail).toBeDefined();
          expect(byEmail?.userId).toBe(person.userId);

          // Update person
          if (byId) {
            byId.name = 'Updated Person Name';
            byId.mfa = { enabled: true, secret: 'JBSWY3DPEHPK3PXP' };
            await repos.personRepo.update(byId);

            const updated = await repos.personRepo.findById(person.userId);
            expect(updated?.name).toBe('Updated Person Name');
            expect(updated?.mfa.enabled).toBe(true);
            expect(updated?.mfa.secret).toBe('JBSWY3DPEHPK3PXP');
          }
        });

        it('safely finds by email with normal address, case-insensitively, and escapes regex special characters', async () => {
          const personWithPlus: Person = {
            userId: 'usr_plus_safe',
            phone: '+919876543299',
            email: 'user+tag@example.com',
            name: 'Plus User',
            authProviders: ['otp'],
            mfa: { enabled: false },
            roles: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const personWithDot: Person = {
            userId: 'usr_dot_safe',
            phone: '+919876543298',
            email: 'user.name@example.com',
            name: 'Dot User',
            authProviders: ['otp'],
            mfa: { enabled: false },
            roles: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await repos.personRepo.create(personWithPlus);
          await repos.personRepo.create(personWithDot);

          // 1. Normal address
          const normal = await repos.personRepo.findByEmail('user+tag@example.com');
          expect(normal).toBeDefined();
          expect(normal?.userId).toBe(personWithPlus.userId);

          // 2. Case-insensitively
          const caseInsensitive = await repos.personRepo.findByEmail('USER+TAG@EXAMPLE.COM');
          expect(caseInsensitive).toBeDefined();
          expect(caseInsensitive?.userId).toBe(personWithPlus.userId);

          // 3. Special characters are not treated as RegExp syntax:
          // '.' in email is literal: 'user_name@example.com' should NOT match 'user.name@example.com'
          const wildDot = await repos.personRepo.findByEmail('user_name@example.com');
          expect(wildDot).toBeUndefined();

          // '.*' is literal and should not match 'user.name@example.com'
          const starQuery = await repos.personRepo.findByEmail('user.*@example.com');
          expect(starQuery).toBeUndefined();

          // Unbalanced brackets or regex quantifiers do not cause regex errors or misinterpretations
          const invalidRegex = await repos.personRepo.findByEmail('user(tag@example.com');
          expect(invalidRegex).toBeUndefined();
        });
      });

      describe('Session Repository Contract', () => {
        it('saves and finds families and sessions, lists by user, and revokes', async () => {
          const now = new Date().toISOString();
          const family: SessionFamily = {
            familyId: 'fam_01',
            userId: 'usr_01',
            createdAt: now,
            isRevoked: false,
          };
          await repos.sessionRepo.saveFamily(family);
          const retrievedFamily = await repos.sessionRepo.findFamilyById('fam_01');
          expect(retrievedFamily).toBeDefined();
          expect(retrievedFamily?.userId).toBe('usr_01');

          const session1: Session = {
            sessionId: 'sess_01',
            familyId: 'fam_01',
            userId: 'usr_01',
            refreshTokenHash: 'hash_01',
            userAgent: 'Chrome',
            ipAddress: '127.0.0.1',
            createdAt: now,
            lastActiveAt: now,
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            isRevoked: false,
          };
          const session2: Session = {
            sessionId: 'sess_02',
            familyId: 'fam_01',
            userId: 'usr_01',
            refreshTokenHash: 'hash_02',
            userAgent: 'Safari',
            ipAddress: '127.0.0.1',
            createdAt: now,
            lastActiveAt: new Date(Date.now() + 1000).toISOString(),
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            isRevoked: false,
          };

          await repos.sessionRepo.saveSession(session1);
          await repos.sessionRepo.saveSession(session2);

          const foundSess = await repos.sessionRepo.findSessionById('sess_01');
          expect(foundSess?.sessionId).toBe('sess_01');

          // List sessions for user
          const list = await repos.sessionRepo.findSessionsByUserId('usr_01', 10, 0);
          expect(list.total).toBe(2);
          expect(list.items.length).toBe(2);

          // Revoke session
          await repos.sessionRepo.revokeSession('sess_01');
          const afterRevoke = await repos.sessionRepo.findSessionsByUserId('usr_01', 10, 0);
          expect(afterRevoke.items.some((s: Session) => s.sessionId === 'sess_01')).toBe(false);
        });
      });

      describe('OTP Repository Contract', () => {
        it('saves challenge, finds latest, and tracks rate limits', async () => {
          const challenge1: OtpChallenge = {
            id: 'otp_01',
            phone: '+919999900001',
            codeHash: 'hash1',
            salt: 'salt1',
            attempts: 0,
            maxAttempts: 3,
            createdAt: new Date(Date.now() - 10000),
            expiresAt: new Date(Date.now() + 60000),
            verified: false,
          };
          const challenge2: OtpChallenge = {
            id: 'otp_02',
            phone: '+919999900001',
            codeHash: 'hash2',
            salt: 'salt2',
            attempts: 1,
            maxAttempts: 3,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 60000),
            verified: false,
          };

          await repos.otpRepo.save(challenge1);
          await repos.otpRepo.save(challenge2);

          const latest = await repos.otpRepo.findLatestByPhone('+919999900001');
          expect(latest).toBeDefined();
          expect(latest?.id).toBe('otp_02');
          expect(latest?.attempts).toBe(1);

          // Rate limit tracking
          const phoneLimit = await repos.otpRepo.getPhoneRateLimit('+919999900001');
          expect(phoneLimit).toBeDefined();
          expect(Array.isArray(phoneLimit.requests)).toBe(true);

          const ipLimit = await repos.otpRepo.getIpRateLimit('127.0.0.1');
          expect(ipLimit).toBeDefined();
          expect(Array.isArray(ipLimit.requests)).toBe(true);
        });
      });

      describe('Membership Repository Contract', () => {
        it('saves membership, queries by person and organization, enforces tenant isolation', async () => {
          const membership: MembershipProps = {
            id: 'mem_01',
            personId: 'person_01',
            orgId: 'org_alpha',
            role: 'Admin',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await repos.membershipRepo.save(membership);

          const byPerson = await repos.membershipRepo.findByPersonId('person_01');
          expect(byPerson.length).toBe(1);
          expect(byPerson[0].role).toBe('Admin');

          const byPersonAndOrg = await repos.membershipRepo.findByPersonAndOrg('person_01', 'org_alpha');
          expect(byPersonAndOrg).toBeDefined();
          expect(byPersonAndOrg?.role).toBe('Admin');

          // Missing tenantId / orgId in save throws TenantIsolationError
          const badMembership: MembershipProps = {
            id: 'mem_bad',
            personId: 'person_01',
            orgId: '',
            role: 'Member',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await expect(repos.membershipRepo.save(badMembership)).rejects.toThrow(TenantIsolationError);
        });
      });
    });
  }
});
