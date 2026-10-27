// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { axe } from 'jest-axe';
import type { ChatMessage, Conversation } from '@onebridge/api-contracts';
import { MessagesApp } from './MessagesApp';
import { applyRead, mergeMessages, preview } from './chat-state';
import { apiClient } from '../../api-client';

const ME = { type: 'member' as const, id: 'p1' };
const now = new Date().toISOString();
const msg = (id: string, from: typeof ME, text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  conversationId: 'c1',
  sender: from,
  text,
  state: 'delivered',
  createdAt: new Date(Date.now() - (100 - Number(id.replace(/\D/g, '') || 0)) * 1000).toISOString(),
  ...extra,
});
const RAVI = { type: 'member' as const, id: 'p2' };
const conv = (extra: Partial<Conversation> = {}): Conversation => ({
  id: 'c1',
  kind: 'member_member',
  participants: [
    { type: 'member', id: 'p1', name: 'Meera Iyer', verified: false },
    { type: 'member', id: 'p2', name: 'Ravi Teja', handle: 'ravi-teja', verified: false },
  ],
  ownership: 'members',
  requestState: 'none',
  viewer: ME,
  canSend: true,
  otherOnline: false,
  unreadCount: 1,
  updatedAt: now,
  lastMessage: msg('m2', RAVI, 'Can you share the price list?'),
  ...extra,
});

/** Stand-in WebSocket: the test pushes frames through onmessage. */
function fakeSocket() {
  const ws = { readyState: 1, send: vi.fn(), close: vi.fn(), onopen: null as null | (() => void), onmessage: null as null | ((e: { data: string }) => void), onclose: null as null | (() => void) };
  return ws;
}

const session = { personId: 'p1', name: 'Meera Iyer', hasCompany: false };

describe('N08 chat state', () => {
  it('merges pages oldest first and applies read receipts to my messages', () => {
    const list = mergeMessages([msg('m3', ME, 'c')], [msg('m1', ME, 'a'), msg('m2', RAVI, 'b')]);
    expect(list.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
    const read = applyRead(list, ME, 'm2');
    expect(read.map((m) => m.state)).toEqual(['read', 'delivered', 'delivered']);
    expect(preview(conv({ lastMessage: msg('m9', ME, 'Hello') }))).toBe('You: Hello');
    expect(preview(conv({ lastMessage: msg('m9', ME, 'x', { state: 'unsent', text: undefined }) }))).toBe('Message removed');
  });
});

describe('N08 messages page', () => {
  let socket: ReturnType<typeof fakeSocket>;

  beforeEach(() => {
    vi.restoreAllMocks();
    socket = fakeSocket();
    vi.spyOn(apiClient, 'openRealtime').mockResolvedValue(socket as unknown as WebSocket);
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('lists conversations, opens one, marks it read and shows live messages', async () => {
    vi.spyOn(apiClient, 'listConversations').mockResolvedValue({ items: [conv()] });
    vi.spyOn(apiClient, 'getConversation').mockResolvedValue(conv());
    vi.spyOn(apiClient, 'listMessages').mockResolvedValue({ items: [msg('m2', RAVI, 'Can you share the price list?'), msg('m1', ME, 'Hello Ravi', { state: 'read' })] });
    const read = vi.spyOn(apiClient, 'markRead').mockResolvedValue(undefined);
    const { container } = render(<MessagesApp session={session} initialInbox="personal" />);

    fireEvent.click(await screen.findByRole('button', { name: /Ravi Teja/ }));
    expect(await screen.findByText('Hello Ravi')).toBeTruthy();
    await waitFor(() => expect(read).toHaveBeenCalledWith('c1', 'm2', undefined));
    expect((await axe(container)).violations).toEqual([]);

    await act(async () => {
      socket.onopen?.();
      socket.onmessage?.({ data: JSON.stringify({ type: 'typing', conversationId: 'c1', actor: RAVI }) });
    });
    expect(screen.getAllByText('Typing…').length).toBeGreaterThan(0);
    await act(async () => {
      socket.onmessage?.({ data: JSON.stringify({ type: 'message.new', conversationId: 'c1', message: msg('m5', RAVI, 'Sending it now') }) });
    });
    expect(screen.getAllByText('Sending it now').length).toBeGreaterThan(0);
  });

  it('answers an incoming message request', async () => {
    const pending = conv({ requestState: 'pending', requestDirection: 'incoming' });
    vi.spyOn(apiClient, 'listConversations').mockResolvedValue({ items: [pending] });
    vi.spyOn(apiClient, 'getConversation').mockResolvedValue(pending);
    vi.spyOn(apiClient, 'listMessages').mockResolvedValue({ items: [msg('m2', RAVI, 'Hello, can we talk?')] });
    vi.spyOn(apiClient, 'markRead').mockResolvedValue(undefined);
    const accept = vi.spyOn(apiClient, 'conversationAction').mockResolvedValue({ ...pending, requestState: 'accepted', requestDirection: undefined });
    render(<MessagesApp session={session} initialInbox="personal" initialConversationId="c1" />);

    expect(await screen.findByText(/wants to message you/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(accept).toHaveBeenCalledWith('c1', 'accept', undefined));
    await waitFor(() => expect(screen.queryByText(/wants to message you/)).toBeNull());
  });

  it('holds the composer while my request waits', async () => {
    const waiting = conv({ requestState: 'pending', requestDirection: 'outgoing', canSend: false, unreadCount: 0 });
    vi.spyOn(apiClient, 'listConversations').mockResolvedValue({ items: [waiting] });
    vi.spyOn(apiClient, 'getConversation').mockResolvedValue(waiting);
    vi.spyOn(apiClient, 'listMessages').mockResolvedValue({ items: [msg('m1', ME, 'Hi Ravi')] });
    render(<MessagesApp session={session} initialInbox="personal" initialConversationId="c1" />);
    expect(await screen.findByText('Request sent. You can send more messages after Ravi Teja accepts.')).toBeTruthy();
    expect(screen.queryByLabelText('Message Ravi Teja')).toBeNull();
  });

  it('keeps a message typed offline as "Not sent yet" and sends it on retry without duplicating', async () => {
    vi.spyOn(apiClient, 'listConversations').mockResolvedValue({ items: [conv({ unreadCount: 0 })] });
    vi.spyOn(apiClient, 'getConversation').mockResolvedValue(conv({ unreadCount: 0 }));
    vi.spyOn(apiClient, 'listMessages').mockResolvedValue({ items: [] });
    const send = vi
      .spyOn(apiClient, 'sendMessage')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockImplementation(async (_id, body) => msg('m7', ME, body.text, { clientMessageId: body.clientMessageId, state: 'sent', createdAt: new Date().toISOString() }));
    render(<MessagesApp session={session} initialInbox="personal" initialConversationId="c1" />);

    const box = await screen.findByLabelText('Message Ravi Teja');
    fireEvent.change(box, { target: { value: 'Price list attached soon' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText(/Not sent yet/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByText(/Not sent yet/)).toBeNull());
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][1].clientMessageId).toBe(send.mock.calls[1][1].clientMessageId);
    expect(screen.getAllByText('Price list attached soon')).toHaveLength(1);
  });

  it('starts a new conversation from a profile link', async () => {
    vi.spyOn(apiClient, 'listConversations').mockResolvedValue({ items: [] });
    const started = conv({ id: 'c9', unreadCount: 0 });
    const start = vi.spyOn(apiClient, 'startConversation').mockResolvedValue(started);
    vi.spyOn(apiClient, 'getConversation').mockResolvedValue(started);
    vi.spyOn(apiClient, 'listMessages').mockResolvedValue({ items: [msg('m1', ME, 'Hello from the expo')] });
    render(<MessagesApp session={session} initialInbox="personal" target={{ type: 'member', id: 'p2', name: 'Ravi Teja' }} />);

    expect(await screen.findByText(/your first message arrives as a request/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Message Ravi Teja'), { target: { value: 'Hello from the expo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(start).toHaveBeenCalledWith(expect.objectContaining({ to: { type: 'member', id: 'p2' } }), undefined));
    expect(await screen.findByText('Hello from the expo')).toBeTruthy();
  });

  it('shows the company inbox tools to an admin', async () => {
    const companyConv = conv({
      kind: 'member_company',
      ownership: 'company',
      viewer: { type: 'company', id: 'co1' },
      participants: [
        { type: 'member', id: 'p2', name: 'Ravi Teja', verified: false },
        { type: 'company', id: 'co1', name: 'Sahyadri Steel Works', verified: true },
      ],
      status: 'open',
      unreadCount: 0,
    });
    const list = vi.spyOn(apiClient, 'listConversations').mockResolvedValue({ items: [companyConv] });
    vi.spyOn(apiClient, 'getConversation').mockResolvedValue(companyConv);
    vi.spyOn(apiClient, 'listMessages').mockResolvedValue({ items: [] });
    vi.spyOn(apiClient, 'listSeats').mockResolvedValue({ items: [{ id: 'seat-1', title: 'Sales', personId: 'e1', status: 'active' }], total: 1, limit: 200, offset: 0 } as Awaited<ReturnType<typeof apiClient.listSeats>>);
    const done = vi.spyOn(apiClient, 'setConversationStatus').mockResolvedValue({ ...companyConv, status: 'done' });
    render(<MessagesApp session={{ ...session, hasCompany: true, companyId: 'co1', companyRole: 'owner' }} initialInbox="company" initialConversationId="c1" />);

    await waitFor(() => expect(list).toHaveBeenCalledWith(expect.objectContaining({ folder: 'inbox' }), 'co1'));
    expect(await screen.findByText('Not assigned')).toBeTruthy();
    expect(screen.getByLabelText('Assign to')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mark done' }));
    await waitFor(() => expect(done).toHaveBeenCalledWith('c1', 'done', 'co1'));
  });
});
