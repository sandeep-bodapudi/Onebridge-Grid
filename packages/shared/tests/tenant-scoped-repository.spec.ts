import '../../../tests/setup-mongo.ts';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db } from 'mongodb';
import {
  TenantScopedRepository,
  TenantContext,
  TenantIsolationError,
} from '../src';

interface CardDocument {
  id: string;
  tenantId?: string;
  title: string;
  category?: string;
  views?: number;
}

interface LeadDocument {
  id: string;
  tenantId?: string;
  cardId: string;
  name: string;
}

describe('TenantScopedRepository MongoDB Isolation Tests (Condition 8)', () => {
  let mongod: MongoMemoryServer;
  let client: MongoClient;
  let db: Db;
  let cardsRepo: TenantScopedRepository<CardDocument>;

  const TENANT_A = '01JACTENANTA00000000000000';
  const TENANT_B = '01JACTENANTB00000000000000';

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    client = new MongoClient(uri);
    await client.connect();
    db = client.db('test_isolation');
  }, 300000);

  afterAll(async () => {
    if (client) {
      await client.close();
    }
    if (mongod) {
      await mongod.stop();
    }
  });

  beforeEach(async () => {
    await db.collection('cards').deleteMany({});
    await db.collection('leads').deleteMany({});
    cardsRepo = new TenantScopedRepository<CardDocument>(db, 'cards');
  });

  it('should throw TenantIsolationError if executed outside TenantContext', async () => {
    await expect(cardsRepo.find()).rejects.toThrow(TenantIsolationError);
    await expect(cardsRepo.countDocuments()).rejects.toThrow(TenantIsolationError);
  });

  it('should throw TenantIsolationError if filter overrides tenantId', async () => {
    await TenantContext.run(TENANT_A, async () => {
      await expect(
        cardsRepo.find({ tenantId: TENANT_B } as unknown as Filter<CardDocument>)
      ).rejects.toThrow(TenantIsolationError);

      await expect(
        cardsRepo.countDocuments({ tenantId: TENANT_B } as unknown as Filter<CardDocument>)
      ).rejects.toThrow(TenantIsolationError);

      await expect(
        cardsRepo.distinct('title', { tenantId: TENANT_B } as unknown as Filter<CardDocument>)
      ).rejects.toThrow(TenantIsolationError);
    });
  });

  it('should reject insertMany with mixed tenants', async () => {
    await TenantContext.run(TENANT_A, async () => {
      const mixedDocs: CardDocument[] = [
        { id: 'c1', title: 'Card 1', tenantId: TENANT_A },
        { id: 'c2', title: 'Card 2', tenantId: TENANT_B }, // Mismatched tenant
      ];

      await expect(cardsRepo.insertMany(mixedDocs)).rejects.toThrow(
        TenantIsolationError
      );
    });
  });

  it('should correctly countDocuments isolated per tenant', async () => {
    await TenantContext.run(TENANT_A, async () => {
      await cardsRepo.insertOne({ id: 'c1', title: 'Card 1' });
      await cardsRepo.insertOne({ id: 'c2', title: 'Card 2' });
    });

    await TenantContext.run(TENANT_B, async () => {
      await cardsRepo.insertOne({ id: 'c3', title: 'Card 3' });
    });

    await TenantContext.run(TENANT_A, async () => {
      const countA = await cardsRepo.countDocuments();
      expect(countA).toBe(2);
    });

    await TenantContext.run(TENANT_B, async () => {
      const countB = await cardsRepo.countDocuments();
      expect(countB).toBe(1);
    });
  });

  it('should correctly execute distinct isolated per tenant', async () => {
    await TenantContext.run(TENANT_A, async () => {
      await cardsRepo.insertOne({ id: 'c1', title: 'Card A', category: 'Tech' });
      await cardsRepo.insertOne({ id: 'c2', title: 'Card B', category: 'Finance' });
    });

    await TenantContext.run(TENANT_B, async () => {
      await cardsRepo.insertOne({ id: 'c3', title: 'Card C', category: 'Retail' });
    });

    await TenantContext.run(TENANT_A, async () => {
      const categories = await cardsRepo.distinct('category');
      expect(categories.sort()).toEqual(['Finance', 'Tech']);
    });

    await TenantContext.run(TENANT_B, async () => {
      const categories = await cardsRepo.distinct('category');
      expect(categories).toEqual(['Retail']);
    });
  });

  it('should reject updates that set or unset tenantId in updateOne, updateMany and findOneAndUpdate', async () => {
    await TenantContext.run(TENANT_A, async () => {
      await cardsRepo.insertOne({ id: 'c1', title: 'Card 1' });

      // $set tenantId
      await expect(
        cardsRepo.updateOne({ id: 'c1' }, { $set: { tenantId: TENANT_B } } as unknown as UpdateFilter<CardDocument>)
      ).rejects.toThrow(TenantIsolationError);

      await expect(
        cardsRepo.updateMany({ id: 'c1' }, { $set: { tenantId: TENANT_B } } as unknown as UpdateFilter<CardDocument>)
      ).rejects.toThrow(TenantIsolationError);

      await expect(
        cardsRepo.findOneAndUpdate({ id: 'c1' }, { $set: { tenantId: TENANT_B } } as unknown as UpdateFilter<CardDocument>)
      ).rejects.toThrow(TenantIsolationError);

      // $unset tenantId
      await expect(
        cardsRepo.updateOne({ id: 'c1' }, { $unset: { tenantId: '' } } as unknown as UpdateFilter<CardDocument>)
      ).rejects.toThrow(TenantIsolationError);

      await expect(
        cardsRepo.findOneAndUpdate({ id: 'c1' }, { $unset: { tenantId: '' } } as unknown as UpdateFilter<CardDocument>)
      ).rejects.toThrow(TenantIsolationError);
    });
  });

  it('should reject replaceOne with a mismatched tenantId and succeed with a valid replace', async () => {
    await TenantContext.run(TENANT_A, async () => {
      await cardsRepo.insertOne({ id: 'c1', title: 'Card 1' });

      // Mismatched replacement tenantId
      await expect(
        cardsRepo.replaceOne({ id: 'c1' }, { id: 'c1', title: 'Hacked', tenantId: TENANT_B })
      ).rejects.toThrow(TenantIsolationError);

      // Valid replacement
      const res = await cardsRepo.replaceOne({ id: 'c1' }, { id: 'c1', title: 'Updated Title' });
      expect(res.modifiedCount).toBe(1);

      const updated = await cardsRepo.findOne({ id: 'c1' });
      expect(updated?.title).toBe('Updated Title');
      expect(updated?.tenantId).toBe(TENANT_A);
    });
  });

  it('should isolate aggregate and enforce tenantId in leading stage', async () => {
    await TenantContext.run(TENANT_A, async () => {
      await cardsRepo.insertOne({ id: 'c1', title: 'Card 1', views: 10 });
      await cardsRepo.insertOne({ id: 'c2', title: 'Card 2', views: 20 });
    });

    await TenantContext.run(TENANT_B, async () => {
      await cardsRepo.insertOne({ id: 'c3', title: 'Card 3', views: 50 });
    });

    await TenantContext.run(TENANT_A, async () => {
      const agg = await cardsRepo.aggregate([
        { $group: { _id: null, totalViews: { $sum: '$views' } } },
      ]);
      expect(agg.length).toBe(1);
      expect(agg[0].totalViews).toBe(30);
    });

    // Conflicting $match in pipeline throws
    await TenantContext.run(TENANT_A, async () => {
      await expect(
        cardsRepo.aggregate([
          { $match: { tenantId: TENANT_B } },
        ])
      ).rejects.toThrow(TenantIsolationError);
    });
  });

  it('should enforce tenant isolation in aggregate $lookup across tenant-scoped collections', async () => {
    const leadsRepo = new TenantScopedRepository<LeadDocument>(db, 'leads');

    await TenantContext.run(TENANT_A, async () => {
      await cardsRepo.insertOne({ id: 'card-a', title: 'Acme Card' });
      await leadsRepo.insertOne({ id: 'lead-a', cardId: 'card-a', name: 'Lead for Acme' });
    });

    await TenantContext.run(TENANT_B, async () => {
      await cardsRepo.insertOne({ id: 'card-b', title: 'Beta Card' });
      await leadsRepo.insertOne({ id: 'lead-b', cardId: 'card-b', name: 'Lead for Beta' });
    });

    // Unscoped direct $lookup without pipeline throws
    await TenantContext.run(TENANT_A, async () => {
      await expect(
        cardsRepo.aggregate([
          {
            $lookup: {
              from: 'leads',
              localField: 'id',
              foreignField: 'cardId',
              as: 'leads',
            },
          },
        ])
      ).rejects.toThrow(TenantIsolationError);
    });

    // Scoped pipeline $lookup succeeds and only joins Tenant A leads
    await TenantContext.run(TENANT_A, async () => {
      const results = await cardsRepo.aggregate([
        {
          $lookup: {
            from: 'leads',
            let: { cardId: '$id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$cardId', '$$cardId'] },
                },
              },
            ],
            as: 'leads',
          },
        },
      ]);

      expect(results.length).toBe(1);
      expect(results[0].id).toBe('card-a');
      expect(results[0].leads.length).toBe(1);
      expect(results[0].leads[0].name).toBe('Lead for Acme');
    });
  });
});
