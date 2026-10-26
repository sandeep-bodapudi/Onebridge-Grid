import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongo, MongoConnectionHandle, FakeEventBus, LocalKeyVaultProvider } from '@onebridge/shared';
import {
  InviteService,
  SeatsService,
  CounterService,
  MongoInviteRepository,
  MongoNoticeAcceptanceRepository,
  MongoSeatRepository,
  MongoOrganizationRepository,
  MongoAuditRepository,
  MongoCounterRepository,
  FakeInviteNotifier,
  SEAT_NOTICE,
  IdentityInternalClient,
} from '../src/index.js';

const TENANT = '01JACTENANTA00000000000000';
const OTHER = '01JACTENANTB00000000000000';
const SEAT = 'OB-7KQ2MX-E0002';
const NOW = new Date('2026-10-26T10:00:00.000Z');

describe('F14: invite and seat claim', () => {
  let mongod: MongoMemoryServer;
  let handle: MongoConnectionHandle;
  let service: InviteService;
  let notifier: FakeInviteNotifier;
  let bus: FakeEventBus;
  let clock: Date;
  let contacts: Record<string, { phone?: string; email?: string }>;
  let identity: IdentityInternalClient;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    handle = await connectMongo(mongod.getUri());
  }, 120000);

  afterAll(async () => {
    if (handle) await handle.close();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    const db = handle._getInternalDb();
    await Promise.all(
      ['organizations', 'seats', 'invites', 'notice_acceptances', 'audit_logs', 'counters'].map((c) => db.collection(c).deleteMany({}))
    );
    const now = NOW.toISOString();
    for (const [tenantId, businessId, name] of [
      [TENANT, 'OB-7KQ2MX', 'Acme Steels'],
      [OTHER, 'OB-AAAAAA', 'Other Co'],
    ]) {
      await db.collection('organizations').insertOne({
        id: tenantId, tenantId, businessId, name, slug: name.toLowerCase().replace(/\s+/g, '-'), previousSlugs: [], industry: 'Steel',
        size: '11-50', city: 'Pune', plan: 'business', verifiedBadge: false, onboardingStartedAt: now, aggregateVersion: 1, createdAt: now, updatedAt: now,
      });
    }
    await db.collection('seats').insertMany([
      { id: SEAT, tenantId: TENANT, title: 'Sales executive', status: 'vacant', isReadOnly: false, createdAt: now, updatedAt: now },
      { id: 'OB-7KQ2MX-E0009', tenantId: TENANT, title: 'Over limit', status: 'vacant', isReadOnly: true, createdAt: now, updatedAt: now },
    ]);

    clock = new Date(NOW);
    contacts = { person_meera: { phone: '+919890123456' }, person_other: { phone: '+919811111111' }, person_mail: { email: 'meera@example.com' } };
    identity = {
      createMembership: vi.fn().mockResolvedValue({ id: 'mem_1', role: 'employee' }),
      getPersonContacts: vi.fn(async (personId: string) => contacts[personId] ?? null),
    };
    bus = new FakeEventBus();
    notifier = new FakeInviteNotifier();
    const seatRepo = new MongoSeatRepository(handle);
    const orgRepo = new MongoOrganizationRepository(handle);
    const auditRepo = new MongoAuditRepository(handle);
    const seats = new SeatsService(seatRepo, orgRepo, new CounterService(new MongoCounterRepository(handle), orgRepo), auditRepo, bus);
    service = new InviteService(
      new MongoInviteRepository(handle),
      new MongoNoticeAcceptanceRepository(handle),
      seatRepo,
      seats,
      orgRepo,
      auditRepo,
      identity,
      new LocalKeyVaultProvider(),
      notifier,
      bus,
      'https://app.example.test',
      true,
      () => clock
    );
  });

  const tokenOf = (url?: string) => (url ?? '').split('/invite/')[1];
  const accept = { acceptNotice: true, noticeVersion: SEAT_NOTICE.version };

  it('sends an invite through the notifier, marks the seat invited and stores no plain contact or token', async () => {
    const sent = await service.invite(TENANT, SEAT, { channel: 'whatsapp', contact: '98901 23456' }, 'person_owner');
    expect(sent.status).toBe('pending');
    expect(sent.contactMasked).toBe('+91 •••••• 3456');
    expect(sent.expiresAt).toBe('2026-11-02T10:00:00.000Z'); // 7 days
    expect(notifier.sent[0]).toMatchObject({ channel: 'whatsapp', to: '+919890123456', companyName: 'Acme Steels', seatTitle: 'Sales executive' });

    const db = handle._getInternalDb();
    const stored = JSON.stringify(await db.collection('invites').findOne({}));
    expect(stored).not.toContain('9890123456');
    expect(stored).not.toContain(tokenOf(sent.inviteUrl));
    expect((await db.collection('seats').findOne({ id: SEAT }))?.status).toBe('invited');
    expect((await db.collection('audit_logs').find({ action: 'seat.invited' }).toArray()).length).toBe(1);
  });

  it('blocks invites to over-limit seats with an upgrade message', async () => {
    await expect(service.invite(TENANT, 'OB-7KQ2MX-E0009', { channel: 'sms', contact: '9890123456' }, 'person_owner')).rejects.toMatchObject({
      response: { code: 'over_limit', detail: expect.stringContaining('Upgrade') },
    });
  });

  it('rejects bad channels and contacts', async () => {
    await expect(service.invite(TENANT, SEAT, { channel: 'pigeon', contact: '9890123456' }, 'o')).rejects.toMatchObject({ status: 400 });
    await expect(service.invite(TENANT, SEAT, { channel: 'email', contact: 'not-an-email' }, 'o')).rejects.toMatchObject({ status: 400 });
  });

  it('shows minimal data for an open invite and nothing for unknown, revoked or claimed ones', async () => {
    const sent = await service.invite(TENANT, SEAT, { channel: 'sms', contact: '9890123456' }, 'o');
    const preview = await service.preview(tokenOf(sent.inviteUrl));
    expect(preview).toMatchObject({ status: 'pending', companyName: 'Acme Steels', seatTitle: 'Sales executive', contactMasked: '+91 •••••• 3456' });
    expect(preview.notice?.en.points[0]).toContain('Acme Steels');
    expect(JSON.stringify(preview)).not.toContain('9890123456');

    expect(await service.preview('x'.repeat(43))).toEqual({ status: 'invalid' });
    await service.revoke(TENANT, SEAT, 'o');
    expect(await service.preview(tokenOf(sent.inviteUrl))).toEqual({ status: 'revoked' });
  });

  it('lets the invited person claim once: notice recorded, membership added, seat assigned', async () => {
    const sent = await service.invite(TENANT, SEAT, { channel: 'sms', contact: '9890123456' }, 'o');
    const token = tokenOf(sent.inviteUrl);
    const result = await service.claim(token, 'person_meera', accept);
    expect(result).toEqual({ tenantId: TENANT, seatId: SEAT, cardId: SEAT, companyName: 'Acme Steels' });

    const db = handle._getInternalDb();
    const notice = await db.collection('notice_acceptances').findOne({ personId: 'person_meera' });
    expect(notice).toMatchObject({ tenantId: TENANT, seatId: SEAT, version: SEAT_NOTICE.version, acceptedAt: NOW.toISOString() });
    expect(identity.createMembership).toHaveBeenCalledWith(expect.objectContaining({ personId: 'person_meera', orgId: TENANT, role: 'employee', onlyIfAbsent: true }));
    const seat = await db.collection('seats').findOne({ id: SEAT });
    expect(seat).toMatchObject({ personId: 'person_meera', status: 'active' });
    expect(bus.calls.some((c) => (c.args as { event?: { type?: string } }).event?.type === 'seat.assigned')).toBe(true);

    // Single use: a second claim (even by the same person) fails and the link shows "claimed" only.
    await expect(service.claim(token, 'person_meera', accept)).rejects.toMatchObject({ status: 410 });
    expect(await service.preview(token)).toEqual({ status: 'claimed' });
  });

  it('refuses a claim by the wrong person', async () => {
    const sent = await service.invite(TENANT, SEAT, { channel: 'sms', contact: '9890123456' }, 'o');
    await expect(service.claim(tokenOf(sent.inviteUrl), 'person_other', accept)).rejects.toMatchObject({
      status: 403,
      response: { code: 'wrong_person', detail: expect.stringContaining('+91 •••••• 3456') },
    });
    expect(identity.createMembership).not.toHaveBeenCalled();
  });

  it('matches email invites on the verified email', async () => {
    const sent = await service.invite(TENANT, SEAT, { channel: 'email', contact: 'Meera@Example.com' }, 'o');
    await expect(service.claim(tokenOf(sent.inviteUrl), 'person_mail', accept)).resolves.toMatchObject({ seatId: SEAT });
  });

  it('requires the current notice to be accepted', async () => {
    const sent = await service.invite(TENANT, SEAT, { channel: 'sms', contact: '9890123456' }, 'o');
    const token = tokenOf(sent.inviteUrl);
    await expect(service.claim(token, 'person_meera', { acceptNotice: false, noticeVersion: SEAT_NOTICE.version })).rejects.toMatchObject({
      response: { code: 'notice_required' },
    });
    await expect(service.claim(token, 'person_meera', { acceptNotice: true, noticeVersion: 'old' })).rejects.toMatchObject({
      response: { code: 'notice_required' },
    });
    // Declining leaves the invite open.
    expect((await service.preview(token)).status).toBe('pending');
  });

  it('expires after 7 days, and a resend gives a fresh link to the same contact', async () => {
    const sent = await service.invite(TENANT, SEAT, { channel: 'sms', contact: '9890123456' }, 'o');
    const oldToken = tokenOf(sent.inviteUrl);
    clock = new Date(NOW.getTime() + 7 * 86_400_000 + 1000);
    expect(await service.preview(oldToken)).toEqual({ status: 'expired' });
    await expect(service.claim(oldToken, 'person_meera', accept)).rejects.toMatchObject({ status: 410, response: { code: 'expired' } });

    const resent = await service.resend(TENANT, SEAT, 'o');
    expect(resent.sentCount).toBe(2);
    expect(notifier.sent[1].to).toBe('+919890123456');
    expect(tokenOf(resent.inviteUrl)).not.toBe(oldToken);
    await expect(service.claim(tokenOf(resent.inviteUrl), 'person_meera', accept)).resolves.toMatchObject({ seatId: SEAT });
  });

  it('a new invite cancels the previous link', async () => {
    const first = await service.invite(TENANT, SEAT, { channel: 'sms', contact: '9890123456' }, 'o');
    await service.invite(TENANT, SEAT, { channel: 'email', contact: 'meera@example.com' }, 'o');
    expect(await service.preview(tokenOf(first.inviteUrl))).toEqual({ status: 'revoked' });
  });

  it('keeps invites inside the company', async () => {
    await service.invite(TENANT, SEAT, { channel: 'sms', contact: '9890123456' }, 'o');
    expect(await service.listPending(TENANT)).toHaveLength(1);
    expect(await service.listPending(OTHER)).toHaveLength(0);
    await expect(service.revoke(OTHER, SEAT, 'o')).rejects.toMatchObject({ status: 404 });
  });

  it('never returns the link once invites are delivered for real', async () => {
    Object.defineProperty(notifier, 'deliversForReal', { value: true });
    const sent = await service.invite(TENANT, SEAT, { channel: 'sms', contact: '9890123456' }, 'o');
    expect(sent.inviteUrl).toBeUndefined();
  });
});
