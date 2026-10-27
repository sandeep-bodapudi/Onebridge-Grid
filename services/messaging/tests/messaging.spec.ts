import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongo, MongoConnectionHandle, FakeEventBus, LocalKeyVaultProvider } from '@onebridge/shared';
import {
  MessagingService,
  RealtimeHub,
  MongoConversationRepository,
  MongoMessageRepository,
  MongoNoteRepository,
  MongoCompanyRefRepository,
  MongoSeatRefRepository,
  MongoFollowRefRepository,
  ProfilesClient,
  MemberSummary,
  Scope,
  containsLink,
  needsRequest,
} from '../src/index.js';

const ACME = '01JACTENANTA00000000000000';
const OTHER = '01JACTENANTB00000000000000';
const T0 = '2026-10-27T09:00:00.000Z';
const evt = (type: string, payload: Record<string, unknown>, tenantId = ACME) => ({ type, tenantId, occurredAt: T0, payload });

const members: MemberSummary[] = [
  { personId: 'p1', handle: 'meera-iyer', name: 'Meera Iyer', visibility: 'everyone' },
  { personId: 'p2', handle: 'ravi-teja', name: 'Ravi Teja', visibility: 'everyone' },
  { personId: 'p3', handle: 'fatima', name: 'Fatima Begum', visibility: 'members' },
];
const profiles: ProfilesClient = { summaries: async (ids) => members.filter((m) => ids.includes(m.personId)) };

const COLLECTIONS = ['conversations', 'messages', 'conversation_notes', 'messaging_company_refs', 'messaging_seat_refs', 'messaging_follow_refs'];

describe('N08 rules', () => {
  it('asks for a request only for strangers messaging a member', () => {
    expect(needsRequest({ receiver: { type: 'company', id: 'c' }, receiverFollowsSender: false })).toBe(false);
    expect(needsRequest({ receiver: { type: 'member', id: 'm' }, receiverFollowsSender: true })).toBe(false);
    expect(needsRequest({ receiver: { type: 'member', id: 'm' }, receiverFollowsSender: false, contextKind: 'call_request' })).toBe(false);
    expect(needsRequest({ receiver: { type: 'member', id: 'm' }, receiverFollowsSender: false, contextKind: 'product' })).toBe(true);
  });

  it('spots links', () => {
    expect(containsLink('see https://x.example/y')).toBe(true);
    expect(containsLink('visit www.acme.in')).toBe(true);
    expect(containsLink('mail me at acme.com')).toBe(true);
    expect(containsLink('We make 12.5 mm TMT bars. Price on request.')).toBe(false);
  });
});

describe('N08 MessagingService', () => {
  let mongod: MongoMemoryServer;
  let handle: MongoConnectionHandle;
  let service: MessagingService;
  let bus: FakeEventBus;
  let clock: Date;
  let n = 0;
  const events = () => bus.calls.map((c) => (c.args as { event: { type: string; tenantId: string; payload: Record<string, unknown> } }).event);
  const msg = (text: string) => ({ clientMessageId: `c${++n}`, text });

  const member = (id: string): Scope => ({ personId: id, actor: { type: 'member', id }, seatIds: [] });
  let owner: Scope;
  let employee: Scope;

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
    await Promise.all(COLLECTIONS.map((c) => db.collection(c).deleteMany({})));
    const conversations = new MongoConversationRepository(handle);
    const messages = new MongoMessageRepository(handle);
    const companies = new MongoCompanyRefRepository(handle);
    const seats = new MongoSeatRefRepository(handle);
    const follows = new MongoFollowRefRepository(handle);
    for (const r of [conversations, messages, companies, seats, follows]) await r.createIndexes();
    bus = new FakeEventBus();
    clock = new Date(T0);
    service = new MessagingService(
      conversations,
      messages,
      new MongoNoteRepository(handle),
      companies,
      seats,
      follows,
      profiles,
      new LocalKeyVaultProvider('test-master-secret-for-messaging-at-least-32'),
      bus,
      new RealtimeHub(() => clock),
      { memberRequestsPerMonth: 2, dailyNewConversationCap: 30 },
      () => clock
    );
    await service.onOrgEvent(evt('org.created', { orgId: ACME, name: 'Sahyadri Steel Works', slug: 'sahyadri-steel-works', plan: 'business' }));
    await service.onOrgEvent(evt('org.created', { orgId: OTHER, name: 'Charminar Fabricators', slug: 'charminar-fabricators', plan: 'free' }, OTHER));
    await service.onSeatEvent(evt('seat.created', { orgId: ACME, seatId: 'seat-sales', title: 'Sales', personId: 'e1', status: 'active' }));
    owner = await service.scopeFor('o1', ACME, 'owner');
    employee = await service.scopeFor('e1', ACME, 'employee');
  });

  it('sends an enquiry to the company inbox with no request step, IDs-only events and encrypted text', async () => {
    const conv = await service.start(member('p1'), { to: { type: 'company', id: ACME }, message: msg('Need 20 t of TMT bars') });
    expect(conv).toMatchObject({ kind: 'member_company', ownership: 'company', requestState: 'none', canSend: true });
    expect(conv.participants.map((p) => p.name)).toEqual(['Meera Iyer', 'Sahyadri Steel Works']);
    expect(conv.lastMessage?.text).toBe('Need 20 t of TMT bars');

    expect((await service.list(owner, {})).items.map((c) => c.id)).toEqual([conv.id]);
    // The employee has no conversation assigned yet.
    expect((await service.list(employee, {})).items).toHaveLength(0);
    await expect(service.get(employee, conv.id)).rejects.toMatchObject({ status: 404 });

    const types = events().map((e) => e.type);
    expect(types).toEqual(['conversation.started', 'message.sent']);
    expect(events()[1].tenantId).toBe(ACME);
    expect(Object.keys(events()[1].payload).sort()).toEqual(['conversationId', 'messageId', 'senderId', 'senderType']);
    expect(JSON.stringify(events())).not.toContain('TMT');

    const raw = await handle._getInternalDb().collection('messages').findOne({});
    expect(JSON.stringify(raw)).not.toContain('TMT');
    expect(raw?.body).toMatchObject({ kid: `dek-${ACME}-v1` });
  });

  it('turns a first message to a stranger into a request: one message, no links, silent ignore', async () => {
    await expect(service.start(member('p1'), { to: { type: 'member', id: 'p2' }, message: msg('see www.acme.in') })).rejects.toMatchObject({
      response: { code: 'request_restricted' },
    });
    const conv = await service.start(member('p1'), { to: { type: 'member', id: 'p2' }, message: msg('Hello Ravi, are you buying steel?') });
    expect(conv).toMatchObject({ requestState: 'pending', requestDirection: 'outgoing', canSend: false });
    expect((await handle._getInternalDb().collection('messages').findOne({}))?.body.kid).toBe(`dek-conv:${conv.id}-v1`);
    await expect(service.send(member('p1'), conv.id, msg('Hello again'))).rejects.toMatchObject({ response: { code: 'awaiting_acceptance' } });

    expect((await service.list(member('p2'), { folder: 'requests' })).items).toEqual([expect.objectContaining({ id: conv.id, requestDirection: 'incoming' })]);
    expect((await service.list(member('p2'), {})).items).toHaveLength(0);

    await service.ignore(member('p2'), conv.id);
    expect((await service.list(member('p2'), { folder: 'requests' })).items).toHaveLength(0);
    // The sender is not told.
    expect((await service.get(member('p1'), conv.id)).requestState).toBe('pending');

    // Starting again goes into the same conversation, still limited to one message.
    await expect(service.start(member('p1'), { to: { type: 'member', id: 'p2' }, message: msg('Ping') })).rejects.toMatchObject({
      response: { code: 'awaiting_acceptance' },
    });
  });

  it('lets the receiver accept, or accept by replying', async () => {
    const a = await service.start(member('p1'), { to: { type: 'member', id: 'p2' }, message: msg('Hi') });
    await service.accept(member('p2'), a.id);
    await expect(service.send(member('p1'), a.id, msg('Thanks for accepting'))).resolves.toMatchObject({ text: 'Thanks for accepting' });
    await expect(service.accept(member('p2'), a.id)).rejects.toMatchObject({ response: { code: 'not_a_request' } });

    const b = await service.start(member('p3'), { to: { type: 'member', id: 'p2' }, message: msg('Hello') });
    await service.send(member('p2'), b.id, msg('Hi Fatima'));
    expect((await service.get(member('p3'), b.id)).requestState).toBe('accepted');
  });

  it('skips the request when the receiver follows the sender or for a call request reply', async () => {
    await service.onFollowEvent(evt('follow.created', { followerType: 'member', followerId: 'p2', targetType: 'company', targetId: ACME }, 'global'));
    const fromCompany = await service.start(owner, { to: { type: 'member', id: 'p2' }, message: msg('Thanks for following us') });
    expect(fromCompany).toMatchObject({ kind: 'member_company', requestState: 'none' });
    const answer = await service.start(member('p1'), { to: { type: 'member', id: 'p3' }, context: { kind: 'call_request', id: 'cr1' }, message: msg('About your call') });
    expect(answer.requestState).toBe('none');
    await service.onFollowEvent(evt('follow.removed', { followerType: 'member', followerId: 'p2', targetType: 'company', targetId: ACME }, 'global'));
    // Only Owner and Admins start conversations for the company.
    await expect(service.start(employee, { to: { type: 'member', id: 'p3' }, message: msg('Hi') })).rejects.toMatchObject({ status: 403 });
  });

  it('caps new message requests per month', async () => {
    members.push({ personId: 'p4', handle: 'p4', name: 'Arjun Rao', visibility: 'everyone' });
    try {
      await service.start(member('p1'), { to: { type: 'member', id: 'p2' }, message: msg('Hi') });
      await service.start(member('p1'), { to: { type: 'member', id: 'p3' }, message: msg('Hi') });
      await expect(service.start(member('p1'), { to: { type: 'member', id: 'p4' }, message: msg('Hi') })).rejects.toMatchObject({
        status: 429,
        response: { code: 'request_limit', limit: 2 },
      });
      // Enquiries to companies are not requests.
      await expect(service.start(member('p1'), { to: { type: 'company', id: ACME }, message: msg('Hi') })).resolves.toBeTruthy();
      clock = new Date('2026-11-01T00:00:01.000Z');
      await expect(service.start(member('p1'), { to: { type: 'member', id: 'p4' }, message: msg('Hi') })).resolves.toBeTruthy();
    } finally {
      members.pop();
    }
  });

  it('never duplicates a retried message', async () => {
    const conv = await service.start(member('p1'), { to: { type: 'company', id: ACME }, message: msg('First') });
    const again = { clientMessageId: 'retry-1', text: 'Second' };
    const a = await service.send(member('p1'), conv.id, again);
    const b = await service.send(member('p1'), conv.id, again);
    expect(b.id).toBe(a.id);
    expect((await service.messagesPage(member('p1'), conv.id)).items).toHaveLength(2);
  });

  it('edits and unsends within 15 minutes only', async () => {
    const conv = await service.start(member('p1'), { to: { type: 'company', id: ACME }, message: msg('Price for 12 mm?') });
    const id = conv.lastMessage!.id;
    await expect(service.edit(owner, id, 'hijack')).rejects.toMatchObject({ status: 403 });
    const edited = await service.edit(member('p1'), id, 'Price for 16 mm?');
    expect(edited).toMatchObject({ text: 'Price for 16 mm?', editedAt: expect.any(String) });
    expect((await service.messagesPage(owner, conv.id)).items[0].text).toBe('Price for 16 mm?');
    const removed = await service.unsend(member('p1'), id);
    expect(removed.state).toBe('unsent');
    expect(removed.text).toBeUndefined();
    expect((await handle._getInternalDb().collection('messages').findOne({ id }))?.body).toBeUndefined();

    const late = await service.send(member('p1'), conv.id, msg('Another'));
    clock = new Date(clock.getTime() + 16 * 60 * 1000);
    await expect(service.edit(member('p1'), late.id, 'x')).rejects.toMatchObject({ status: 409, response: { code: 'window_closed' } });
    await expect(service.unsend(member('p1'), late.id)).rejects.toMatchObject({ response: { code: 'window_closed' } });
  });

  it('shows read receipts and unread counts', async () => {
    const conv = await service.start(member('p1'), { to: { type: 'member', id: 'p2' }, message: msg('Hi') });
    await service.accept(member('p2'), conv.id);
    expect((await service.list(member('p2'), {})).items[0].unreadCount).toBe(1);
    expect((await service.messagesPage(member('p1'), conv.id)).items[0].state).toBe('sent');
    await service.read(member('p2'), conv.id, conv.lastMessage!.id);
    expect((await service.list(member('p2'), {})).items[0].unreadCount).toBe(0);
    expect((await service.messagesPage(member('p1'), conv.id)).items[0].state).toBe('read');
  });

  it('runs the company inbox: assignment, seats, done, notes and card conversations', async () => {
    const conv = await service.start(member('p1'), { to: { type: 'company', id: ACME }, message: msg('Quote please') });
    await expect(service.assign(employee, conv.id, 'seat-sales')).rejects.toMatchObject({ status: 404 });
    await expect(service.assign(owner, conv.id, 'no-seat')).rejects.toMatchObject({ response: { code: 'invalid_seat' } });
    const assigned = await service.assign(owner, conv.id, 'seat-sales');
    expect(assigned.assignedSeatId).toBe('seat-sales');
    expect(events().some((e) => e.type === 'conversation.assigned')).toBe(true);
    // The member never sees internal fields.
    const memberView = await service.get(member('p1'), conv.id);
    expect(memberView.assignedSeatId).toBeUndefined();
    expect(memberView.status).toBeUndefined();

    expect((await service.list(employee, {})).items.map((c) => c.id)).toEqual([conv.id]);
    const reply = await service.send(employee, conv.id, msg('Sending a quote today'));
    expect(reply.sentBySeatId).toBe('seat-sales');
    expect((await service.messagesPage(member('p1'), conv.id)).items[0].sentBySeatId).toBeUndefined();

    const note = await service.addNote(employee, conv.id, 'Repeat buyer, give 2% off');
    expect((await service.listNotes(owner, conv.id)).items).toEqual([expect.objectContaining({ id: note.id, text: 'Repeat buyer, give 2% off' })]);
    await expect(service.listNotes(member('p1'), conv.id)).rejects.toMatchObject({ status: 403 });

    await service.setStatus(employee, conv.id, 'done');
    expect((await service.list(owner, {})).items).toHaveLength(0);
    expect((await service.list(owner, { folder: 'done' })).items).toHaveLength(1);
    // A new message from the buyer reopens it.
    await service.send(member('p1'), conv.id, msg('One more question'));
    expect((await service.list(owner, {})).items).toHaveLength(1);

    // Card conversation: assigned to the card's seat, owned by the company.
    const card = await service.start(member('p2'), { to: { type: 'company', id: ACME }, viaCardSeatId: 'seat-sales', message: msg('Met you at the expo') });
    expect(card).toMatchObject({ kind: 'member_card', ownership: 'company' });
    expect((await service.get(employee, card.id)).assignedSeatId).toBe('seat-sales');

    // Offboarding: the seat goes to a new person, who inherits the conversations.
    await service.onSeatEvent(evt('seat.assigned', { orgId: ACME, seatId: 'seat-sales', personId: 'e2', previousPersonId: 'e1', bindingsPreserved: true }));
    expect((await service.list(await service.scopeFor('e1', ACME, 'employee'), {})).items).toHaveLength(0);
    expect((await service.list(await service.scopeFor('e2', ACME, 'employee'), {})).items).toHaveLength(2);
    // A seat that stops being active hands its conversations back to the inbox.
    await service.onSeatEvent(evt('seat.status_changed', { orgId: ACME, seatId: 'seat-sales', previousStatus: 'active', newStatus: 'vacant' }));
    expect((await service.list(owner, { assigned: 'unassigned' })).items).toHaveLength(2);
  });

  it('keeps one company out of another company\'s inbox', async () => {
    const conv = await service.start(member('p1'), { to: { type: 'company', id: ACME }, message: msg('Hi') });
    const otherOwner = await service.scopeFor('o2', OTHER, 'owner');
    await expect(service.get(otherOwner, conv.id)).rejects.toMatchObject({ status: 404 });
    await expect(service.messagesPage(otherOwner, conv.id)).rejects.toMatchObject({ status: 404 });
    expect((await service.list(otherOwner, {})).items).toHaveLength(0);
    await expect(service.scopeFor('p9', ACME, undefined)).rejects.toMatchObject({ status: 403 });
  });

  it('lets companies message each other; the receiver\'s inbox handles it', async () => {
    const conv = await service.start(owner, { to: { type: 'company', id: OTHER }, message: msg('Can you fabricate 40 enclosures?') });
    expect(conv).toMatchObject({ kind: 'company_company', requestState: 'none' });
    const otherOwner = await service.scopeFor('o2', OTHER, 'owner');
    expect((await service.get(otherOwner, conv.id)).status).toBe('open');
    expect((await service.get(owner, conv.id)).status).toBeUndefined();
  });

  it('finds conversations by the other side\'s name', async () => {
    await service.start(member('p1'), { to: { type: 'company', id: ACME }, message: msg('Hi') });
    await service.start(member('p1'), { to: { type: 'company', id: OTHER }, message: msg('Hi') });
    expect((await service.list(member('p1'), { q: 'charminar' })).items.map((c) => c.participants[1].name)).toEqual(['Charminar Fabricators']);
  });
});
