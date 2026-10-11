import { loadAndValidateEnv } from '../config/env.js';
import { SEED_DATA } from './seed.data.js';
import { KeyService } from '../application/key.service.js';
import { MongoClient, Db, redactMongoUri, isLocalMongoUri } from '@onebridge/shared';

export async function seedDevDatabase(customDb?: Db): Promise<{ seeded: boolean; message: string }> {
  const env = loadAndValidateEnv();

  // Refuse to run in production
  if (env.nodeEnv === 'production') {
    throw new Error('Database seeding is strictly forbidden in production!');
  }

  // Refuse non-local MONGODB_URI unless ALLOW_REMOTE_SEED=true
  if (!isLocalMongoUri(env.mongoUri) && !env.allowRemoteSeed) {
    throw new Error(
      `Refusing to seed non-local database "${redactMongoUri(env.mongoUri)}" without ALLOW_REMOTE_SEED=true`
    );
  }

  let client: MongoClient | null = null;
  let db: Db;

  if (customDb) {
    db = customDb;
  } else {
    client = new MongoClient(env.mongoUri);
    await client.connect();
    db = client.db();
  }

  try {
    const keyService = new KeyService(env.encryptionKey);

    // 1. Idempotency Check: check if already seeded
    const orgCount = await db.collection('organizations').countDocuments({
      id: SEED_DATA.tenants.acme.id,
    });
    if (orgCount > 0) {
      return {
        seeded: false,
        message: 'Dev database already seeded. Skipping seed execution.',
      };
    }

    console.log('[OneBridge Seed] Seeding fresh dev database with fixed ULID entities...');

    // 2. Seed Tenants (Organizations)
    const orgs = Object.values(SEED_DATA.tenants).map((t) => ({
      ...t,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    await db.collection('organizations').insertMany(orgs);

    // 3. Seed Persons (with encrypted TOTP secrets for Owner & Admin)
    const personDocs = Object.values(SEED_DATA.persons).map((p) => {
      const now = new Date().toISOString();
      return {
        userId: p.id,
        phone: p.phone,
        email: p.email,
        name: p.name,
        authProviders: ['phone'],
        mfa: {
          enabled: p.mfaEnrolled,
          secret: p.totpSecret ? keyService.encrypt(p.totpSecret) : undefined,
        },
        roles: [],
        createdAt: now,
        updatedAt: now,
      };
    });
    await db.collection('persons').insertMany(personDocs);

    // 4. Seed Memberships
    const membershipDocs = Object.values(SEED_DATA.memberships).map((m) => ({
      id: m.id,
      personId: m.personId,
      orgId: m.tenantId,
      tenantId: m.tenantId,
      role: m.role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    await db.collection('memberships').insertMany(membershipDocs);

    console.log(
      `[OneBridge Seed] Successfully seeded ${orgs.length} tenants, ${personDocs.length} persons, and ${membershipDocs.length} memberships.`
    );

    return {
      seeded: true,
      message: `Successfully seeded ${orgs.length} tenants, ${personDocs.length} persons, ${membershipDocs.length} memberships`,
    };
  } finally {
    if (client) {
      await client.close();
    }
  }
}

if (process.argv[1]?.includes('seed.ts') || process.argv[1]?.includes('seed.js')) {
  seedDevDatabase()
    .then((res) => {
      console.log(res.message);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[OneBridge Seed] Seed failure:', err.message);
      process.exit(1);
    });
}
