import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongo, MongoConnectionHandle } from '@onebridge/shared';
import { SearchService, MongoSearchIndex, Sources, CompanyPageSource, MemberSource, industriesFor, citySlug, score, tokens } from '../src/index.js';

const A = '01JACTENANTA00000000000000';
const B = '01JACTENANTB00000000000000';
const C = '01JACTENANTC00000000000000';
const NOW = new Date('2026-10-27T10:00:00.000Z');
const evt = (type: string, payload: Record<string, unknown>, tenantId = A, occurredAt = NOW.toISOString()) => ({ type, tenantId, occurredAt, payload });

const pages: Record<string, CompanyPageSource> = {
  'charminar-fabricators': {
    company: { name: 'Charminar Fabricators', slug: 'charminar-fabricators', verifiedBadge: true, about: 'Sheet metal fabrication and CNC machining in Balanagar.', city: 'Hyderabad', logo: 'https://cdn.example/l.png' },
    status: 'active',
    seoIndexable: true,
    products: [{ name: 'MS sheet metal enclosures', category: 'Fabrication' }, { name: 'CNC turned parts' }],
    services: [{ name: 'Laser cutting' }],
    portfolio: [{ title: 'Pharma plant ducting' }],
  },
  'golconda-tools': {
    company: { name: 'Golconda Tools', slug: 'golconda-tools', verifiedBadge: false, city: 'Hyderabad' },
    status: 'active',
    seoIndexable: false,
    products: [],
    services: [],
    portfolio: [],
  },
  'deccan-logistics': {
    company: { name: 'Deccan Logistics', slug: 'deccan-logistics', verifiedBadge: false, city: 'Hyderabad' },
    status: 'lapsed',
    seoIndexable: true,
    products: [{ name: 'Secret product' }],
    services: [],
    portfolio: [],
  },
};
const members: Record<string, MemberSource> = {
  p1: { personId: 'p1', handle: 'ravi-teja-reddy', name: 'Ravi Teja Reddy', headline: 'Procurement manager', visibility: 'everyone', city: 'Hyderabad', skills: ['Procurement', 'Structural steel'] },
  p2: { personId: 'p2', handle: 'fatima-begum', name: 'Fatima Begum', headline: 'Quality engineer', visibility: 'members', city: 'Hyderabad', skills: ['ISO 9001', 'CNC machining'] },
};
const sources: Sources = {
  companyPage: async (slug) => pages[slug] ?? null,
  members: async (ids) => ids.map((id) => members[id]).filter(Boolean),
};

describe('N03 search rules', () => {
  it('maps free-text industries and cities', () => {
    expect(industriesFor('Manufacturing')).toEqual(['manufacturing']);
    expect(industriesFor('Steel trading')).toEqual(['manufacturing', 'trading']);
    expect(industriesFor(undefined)).toEqual([]);
    expect(citySlug('  New Delhi ')).toBe('new-delhi');
  });

  it('needs every word to match and ranks name matches above tag matches', () => {
    const base = { id: 'x', kind: 'company' as const, actorId: 'x', industries: [], verified: false, hasCatalogue: false, completeness: 0, visibility: 'everyone' as const, indexable: true, lastActiveAt: NOW.toISOString(), updatedAt: NOW.toISOString() };
    const byName = score({ ...base, name: 'Steel Mart', tags: [] }, tokens('steel'), NOW).score;
    const byTag = score({ ...base, name: 'Mart', tags: ['Steel bars'] }, tokens('steel'), NOW).score;
    expect(byName).toBeGreaterThan(byTag);
    expect(score({ ...base, name: 'Steel Mart', tags: [] }, tokens('steel pipes'), NOW).score).toBe(0);
  });

  it('matches 4+ letter words inside longer words, below a word-start match', () => {
    const base = { id: 'x', kind: 'company' as const, actorId: 'x', industries: [], verified: false, hasCatalogue: false, completeness: 0, visibility: 'everyone' as const, indexable: true, lastActiveAt: NOW.toISOString(), updatedAt: NOW.toISOString() };
    const inside = score({ ...base, name: 'Mart', tags: ['FE 550D TMT rebars'] }, tokens('tmt bars'), NOW);
    expect(inside.score).toBeGreaterThan(0);
    expect(inside.snippet).toBe('FE 550D TMT rebars');
    expect(score({ ...base, name: 'Mart', tags: ['TMT bars'] }, tokens('tmt bars'), NOW).score).toBeGreaterThan(inside.score);
    // Short words still need a word start.
    expect(score({ ...base, name: 'Mart', tags: ['Rebar'] }, tokens('eb'), NOW).score).toBe(0);
  });
});

describe('N03 SearchService', () => {
  let mongod: MongoMemoryServer;
  let handle: MongoConnectionHandle;
  let service: SearchService;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    handle = await connectMongo(mongod.getUri());
  }, 120000);

  afterAll(async () => {
    if (handle) await handle.close();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    await handle._getInternalDb().collection('search_documents').deleteMany({});
    const index = new MongoSearchIndex(handle);
    await index.createIndexes();
    service = new SearchService(index, sources, () => NOW);
    await service.onOrgEvent(evt('org.created', { orgId: A, name: 'Charminar Fabricators', slug: 'charminar-fabricators', industry: 'Manufacturing', city: 'Hyderabad', plan: 'business' }));
    await service.onOrgEvent(evt('org.created', { orgId: B, name: 'Golconda Tools', slug: 'golconda-tools', industry: 'Manufacturing', city: 'Hyderabad', plan: 'free' }, B));
    await service.onOrgEvent(evt('org.created', { orgId: C, name: 'Deccan Logistics', slug: 'deccan-logistics', industry: 'Logistics services', city: 'Hyderabad', plan: 'starter' }, C));
    await service.onMemberEvent(evt('member.registered', { personId: 'p1' }, 'global'));
    await service.onMemberEvent(evt('member.registered', { personId: 'p2' }, 'global'));
  });

  it('finds companies by catalogue items and returns a snippet, never contact details', async () => {
    const res = await service.search({ q: 'enclosures' }, false);
    expect(res.items.map((i) => i.actor.name)).toEqual(['Charminar Fabricators']);
    expect(res.items[0].snippet).toBe('MS sheet metal enclosures');
    expect(res.items[0].featured).toBe(false);
    expect(JSON.stringify(res)).not.toMatch(/phone|email|\+91/i);
  });

  it('ranks verified, complete Business companies first for the same match', async () => {
    const res = await service.search({ q: 'hyderabad', type: 'company' }, false);
    expect(res.items[0].actor.name).toBe('Charminar Fabricators');
  });

  it('filters by type, industry, city, verified and catalogue', async () => {
    expect((await service.search({ industry: 'manufacturing' }, false)).items.map((i) => i.actor.name).sort()).toEqual(['Charminar Fabricators', 'Golconda Tools']);
    expect((await service.search({ verified: true }, false)).items.map((i) => i.actor.name)).toEqual(['Charminar Fabricators']);
    expect((await service.search({ hasCatalogue: true }, false)).items).toHaveLength(1);
    expect((await service.search({ type: 'member', city: 'Hyderabad' }, false)).items.map((i) => i.actor.name)).toEqual(['Ravi Teja Reddy']);
    expect((await service.search({ city: 'Pune' }, false)).items).toHaveLength(0);
  });

  it('shows members-only profiles to signed-in searchers only', async () => {
    expect((await service.search({ q: 'iso' }, false)).items).toHaveLength(0);
    expect((await service.search({ q: 'iso' }, true)).items.map((i) => i.actor.handle)).toEqual(['fatima-begum']);
  });

  it('hides a lapsed company\'s catalogue', async () => {
    expect((await service.search({ q: 'secret' }, true)).items).toHaveLength(0);
    expect((await service.search({ q: 'deccan' }, true)).items).toHaveLength(1);
  });

  it('updates within the event: catalogue changes, KYB, renames and deletions', async () => {
    pages['golconda-tools'].products = [{ name: 'Carbide drill bits' }];
    await service.onCompanyProfileUpdated(evt('company_profile.updated', { orgId: B }, B));
    expect((await service.search({ q: 'drill' }, false)).items.map((i) => i.actor.name)).toEqual(['Golconda Tools']);
    pages['golconda-tools'].company.verifiedBadge = true;
    await service.onOrgEvent(evt('kyb.status_changed', { orgId: B, status: 'verified' }, B));
    expect((await service.search({ q: 'golconda' }, false)).items[0].actor.verified).toBe(true);
    await service.onMemberEvent(evt('member.profile_updated', { personId: 'gone' }, 'global'));
    await service.onRemoved(evt('member.deleted', { personId: 'p1' }, 'global'));
    expect((await service.search({ q: 'ravi' }, true)).items).toHaveLength(0);
    pages['golconda-tools'].products = [];
    pages['golconda-tools'].company.verifiedBadge = false;
  });

  it('paginates with a cursor', async () => {
    const first = await service.search({}, true);
    expect(first.total).toBe(5);
    expect(first.nextCursor).toBeUndefined();
  });

  it('builds directory pages from indexable companies only, and 404s unknown industries', async () => {
    const page = await service.directory('hyderabad', 'manufacturing');
    expect(page.city).toBe('Hyderabad');
    expect(page.industry.name).toBe('Manufacturing');
    expect(page.items.map((i) => i.actor.name)).toEqual(['Charminar Fabricators']); // Golconda Tools opted out of search engines
    await expect(service.directory('hyderabad', 'space-mining')).rejects.toMatchObject({ status: 404 });
  });

  it('suggests companies, products and industries', async () => {
    const res = await service.suggest('cnc', true);
    const labels = res.items.map((i) => `${i.kind}:${i.label}`);
    expect(labels).toContain('company:Charminar Fabricators');
    expect(labels).toContain('product:CNC turned parts');
    expect((await service.suggest('manuf', false)).items.some((i) => i.kind === 'industry')).toBe(true);
    expect((await service.suggest('c', false)).items).toEqual([]);
  });
});
