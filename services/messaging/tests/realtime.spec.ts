import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'node:net';
import { MongoMemoryServer } from 'mongodb-memory-server';
import WebSocket from 'ws';
import request from 'supertest';
import { connectMongo, MongoConnectionHandle, FakeEventBus, RequestAuthenticator } from '@onebridge/shared';
import { MessagingService, ProfilesClient, createApp, loadAndValidateEnv } from '../src/index.js';

const ACME = '01JACTENANTA00000000000000';
const evt = (type: string, payload: Record<string, unknown>, tenantId = ACME) => ({ type, tenantId, occurredAt: '2026-10-27T09:00:00.000Z', payload });
const profiles: ProfilesClient = { summaries: async (ids) => [{ personId: 'p1', handle: 'meera-iyer', name: 'Meera Iyer', visibility: 'everyone' as const }].filter((m) => ids.includes(m.personId)) };

describe('N08 realtime', () => {
  let mongod: MongoMemoryServer;
  let handle: MongoConnectionHandle;
  let app: Awaited<ReturnType<typeof createApp>>;
  let base: string;

  // Test double: the caller is whoever x-user-id says; the role comes from x-user-role.
  const authenticator = {
    authenticate: async (headers: Record<string, string | string[] | undefined>) => ({
      personId: String(headers['x-user-id'] ?? ''),
      tenantId: headers['x-tenant-id'] as string | undefined,
      role: headers['x-tenant-id'] ? (headers['x-user-role'] as string | undefined) : undefined,
      via: 'token',
    }),
  } as unknown as RequestAuthenticator;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    handle = await connectMongo(mongod.getUri());
    const bus = new FakeEventBus();
    app = await createApp({
      envConfig: { ...loadAndValidateEnv(), appUrl: 'http://localhost:3000' },
      connectionHandle: handle,
      eventBus: bus,
      requestAuthenticator: authenticator,
      profilesClient: profiles,
    });
    await app.listen(0, '127.0.0.1');
    base = `127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    const service = app.get(MessagingService);
    await service.onOrgEvent(evt('org.created', { orgId: ACME, name: 'Sahyadri Steel Works', slug: 'sahyadri-steel-works' }));
  }, 120000);

  afterAll(async () => {
    if (app) await app.close();
    if (handle) await handle.close();
    if (mongod) await mongod.stop();
  });

  const http = () => request(`http://${base}`);

  async function connect(personId: string, company?: string): Promise<{ ws: WebSocket; frames: Array<Record<string, unknown>> }> {
    let req = http().post('/realtime/ticket').set('x-user-id', personId);
    if (company) req = req.set('x-act-as-company', company).set('x-user-role', 'owner');
    const { body } = await req.expect(200);
    const ws = new WebSocket(`ws://${base}/realtime?ticket=${body.ticket}`, { origin: 'http://localhost:3000' });
    const frames: Array<Record<string, unknown>> = [];
    ws.on('message', (d) => frames.push(JSON.parse(String(d))));
    await new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    });
    return { ws, frames };
  }

  const waitFor = async (check: () => boolean, ms = 1000) => {
    const end = Date.now() + ms;
    while (!check()) {
      if (Date.now() > end) throw new Error('timed out');
      await new Promise((r) => setTimeout(r, 5));
    }
  };

  it('delivers a message to the company inbox socket within a second, with typing and presence', async () => {
    const inbox = await connect('o1', ACME);
    const buyer = await connect('p1');
    const start = await http()
      .post('/conversations')
      .set('x-user-id', 'p1')
      .send({ to: { type: 'company', id: ACME }, message: { clientMessageId: 'w1', text: 'Live hello' } })
      .expect(201);
    expect(start.body.otherOnline).toBe(true);

    const sentAt = Date.now();
    await http().post(`/conversations/${start.body.id}/messages`).set('x-user-id', 'p1').send({ clientMessageId: 'w2', text: 'Are you there?' }).expect(201);
    await waitFor(() => inbox.frames.some((f) => f.type === 'message.new' && (f.message as { text?: string }).text === 'Are you there?'));
    expect(Date.now() - sentAt).toBeLessThan(1000);

    inbox.ws.send(JSON.stringify({ type: 'typing', conversationId: start.body.id }));
    await waitFor(() => buyer.frames.some((f) => f.type === 'typing'));

    inbox.ws.close();
    await waitFor(() => buyer.frames.some((f) => f.type === 'presence' && f.online === false));
    buyer.ws.close();
  });

  it('refuses sockets without a valid single-use ticket or from another site', async () => {
    const { body } = await http().post('/realtime/ticket').set('x-user-id', 'p1').expect(200);
    const bad = new WebSocket(`ws://${base}/realtime?ticket=${body.ticket}`, { origin: 'https://evil.example' });
    await expect(new Promise((_, reject) => bad.once('error', reject))).rejects.toThrow(/403/);
    const ok = new WebSocket(`ws://${base}/realtime?ticket=${body.ticket}`, { origin: 'http://localhost:3000' });
    // The origin check runs before the ticket is redeemed, so the ticket still works once.
    await new Promise((resolve, reject) => {
      ok.once('open', resolve);
      ok.once('error', reject);
    });
    ok.close();
    const reused = new WebSocket(`ws://${base}/realtime?ticket=${body.ticket}`, { origin: 'http://localhost:3000' });
    await expect(new Promise((_, reject) => reused.once('error', reject))).rejects.toThrow(/401/);
  });

  it('holds 1,000 concurrent sockets on one node and still delivers within a second', async () => {
    const service = app.get(MessagingService);
    const sockets: WebSocket[] = [];
    try {
      for (let batch = 0; batch < 10; batch++) {
        const opened = await Promise.all(
          Array.from({ length: 100 }, async (_, i) => {
            const { ws } = await connect(`load-${batch}-${i}`);
            return ws;
          })
        );
        sockets.push(...opened);
      }
      expect(service.hub.size).toBeGreaterThanOrEqual(1000);
      const inbox = await connect('o1', ACME);
      const conv = await http()
        .post('/conversations')
        .set('x-user-id', 'load-0-0')
        .send({ to: { type: 'company', id: ACME }, message: { clientMessageId: 'load-1', text: 'Under load' } })
        .expect(201);
      const sentAt = Date.now();
      await http().post(`/conversations/${conv.body.id}/messages`).set('x-user-id', 'load-0-0').send({ clientMessageId: 'load-2', text: 'Still fast?' }).expect(201);
      await waitFor(() => inbox.frames.some((f) => f.type === 'message.new' && (f.message as { text?: string }).text === 'Still fast?'));
      expect(Date.now() - sentAt).toBeLessThan(1000);
      inbox.ws.close();
    } finally {
      for (const ws of sockets) ws.terminate();
    }
  }, 120000);
});
