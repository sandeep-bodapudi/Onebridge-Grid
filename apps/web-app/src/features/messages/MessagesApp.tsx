'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActorRef, ChatMessage, Conversation } from '@onebridge/api-contracts';
import { apiClient } from '../../api-client';
import type { MemberSession } from '../../member-session';
import { ConversationList } from './ConversationList';
import { OutboxItem, SeatOption, Thread } from './Thread';
import { applyRead, isMine, mergeMessages, newClientId, otherSide } from './chat-state';
import { RealtimeFrame, useRealtime } from './useRealtime';

type Folder = 'inbox' | 'requests' | 'done';
type Assigned = '' | 'me' | 'unassigned';

export interface NewConversationTarget extends ActorRef {
  name: string;
  viaCardSeatId?: string;
}

const tab = (active: boolean) =>
  `min-h-[40px] px-3 rounded-[10px] text-sm font-bold ${active ? 'bg-charcoal text-warm-paper' : 'text-charcoal/75 hover:bg-warm-paper'}`;
const primary = 'min-h-[44px] px-5 rounded-[12px] bg-bridge-orange text-[#241A10] text-sm font-extrabold disabled:opacity-60';

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}

/** Network failures (no HTTP status) are queued and retried; refusals are shown. */
const isOffline = (err: unknown) => !(err as { status?: number })?.status;

/**
 * N08 messages: the member's own inbox, or (Owner, Admin and seats) the
 * company inbox. Live over WebSocket; sends over HTTP with a client ID so
 * retries never duplicate; messages typed offline wait in an outbox.
 */
export function MessagesApp({
  session,
  initialInbox,
  initialConversationId,
  target,
}: {
  session: MemberSession;
  initialInbox: 'personal' | 'company';
  initialConversationId?: string;
  target?: NewConversationTarget;
}) {
  const canUseCompany = Boolean(session.companyId);
  const [inbox, setInbox] = useState<'personal' | 'company'>(canUseCompany ? initialInbox : 'personal');
  const asCompany = inbox === 'company' ? session.companyId : undefined;
  const isAdmin = session.companyRole === 'owner' || session.companyRole === 'admin';

  const [folder, setFolder] = useState<Folder>('inbox');
  const [assigned, setAssigned] = useState<Assigned>('');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Conversation[]>([]);
  const [listState, setListState] = useState<{ loading: boolean; error?: string; nextCursor?: string }>({ loading: true });
  const [requestCount, setRequestCount] = useState(0);

  const [selectedId, setSelectedId] = useState<string | undefined>(initialConversationId);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [olderCursor, setOlderCursor] = useState<string | undefined>();
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [draftTarget, setDraftTarget] = useState<NewConversationTarget | undefined>(target);
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [typingUntil, setTypingUntil] = useState<Record<string, number>>({});
  const [seats, setSeats] = useState<SeatOption[]>([]);
  const [, setTick] = useState(0);

  const selectedRef = useRef<string | undefined>(selectedId);
  selectedRef.current = selectedId;
  const selectedConvRef = useRef<Conversation | null>(selected);
  selectedConvRef.current = selected;

  // ---------------------------------------------------------------- loading
  const loadList = useCallback(async () => {
    setListState((s) => ({ ...s, loading: true, error: undefined }));
    try {
      const page = await apiClient.listConversations({ folder, assigned: assigned || undefined, q: query || undefined }, asCompany);
      setItems(page.items);
      setListState({ loading: false, nextCursor: page.nextCursor });
      if (!asCompany) {
        apiClient
          .listConversations({ folder: 'requests' })
          .then((r) => setRequestCount(r.items.length))
          .catch(() => undefined);
      }
    } catch (err) {
      setListState({ loading: false, error: errorText(err) });
    }
  }, [folder, assigned, query, asCompany]);

  const loadMore = async () => {
    if (!listState.nextCursor) return;
    try {
      const page = await apiClient.listConversations({ folder, assigned: assigned || undefined, cursor: listState.nextCursor }, asCompany);
      setItems((prev) => [...prev, ...page.items.filter((c) => !prev.some((p) => p.id === c.id))]);
      setListState({ loading: false, nextCursor: page.nextCursor });
    } catch (err) {
      setListState((s) => ({ ...s, error: errorText(err) }));
    }
  };

  const markRead = useCallback(
    (conv: Conversation, list: ChatMessage[]) => {
      const last = [...list].reverse().find((m) => !isMine(m, conv.viewer) && m.state !== 'read');
      if (!last || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
      apiClient.markRead(conv.id, last.id, asCompany).catch(() => undefined);
      setItems((prev) => prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c)));
    },
    [asCompany]
  );

  const loadThread = useCallback(
    async (id: string) => {
      setThreadLoading(true);
      setThreadError(null);
      try {
        const [conv, page] = await Promise.all([apiClient.getConversation(id, asCompany), apiClient.listMessages(id, undefined, asCompany)]);
        if (selectedRef.current !== id) return;
        const list = mergeMessages([], page.items);
        setSelected(conv);
        setMessages(list);
        setOlderCursor(page.nextCursor);
        markRead(conv, list);
      } catch (err) {
        if (selectedRef.current === id) setThreadError(errorText(err));
      } finally {
        setThreadLoading(false);
      }
    },
    [asCompany, markRead]
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    setSelected(null);
    setMessages([]);
    if (selectedId) void loadThread(selectedId);
  }, [selectedId, loadThread]);

  // Opening /messages?to=… goes to the existing conversation with them, if there is one.
  useEffect(() => {
    if (!draftTarget || listState.loading) return;
    const existing = items.find((c) => {
      const o = otherSide(c);
      return o.type === draftTarget.type && o.id === draftTarget.id && !draftTarget.viaCardSeatId;
    });
    if (existing) {
      setDraftTarget(undefined);
      setSelectedId(existing.id);
    }
  }, [draftTarget, items, listState.loading]);

  useEffect(() => {
    if (inbox !== 'company' || !isAdmin || !session.companyId) return;
    apiClient
      .listSeats(session.companyId, { status: 'active', limit: 200 })
      .then((page) => setSeats(page.items.filter((s) => s.personId).map((s) => ({ id: s.id, title: s.title }))))
      .catch(() => setSeats([]));
  }, [inbox, isAdmin, session.companyId]);

  // Typing indicators fade after 4 seconds.
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const typingIds = Object.entries(typingUntil)
    .filter(([, until]) => until > Date.now())
    .map(([id]) => id);

  // ---------------------------------------------------------------- realtime
  const onFrame = useCallback(
    (frame: RealtimeFrame) => {
      const id = frame.conversationId;
      switch (frame.type) {
        case 'connected':
          void loadList();
          if (selectedRef.current) void loadThread(selectedRef.current);
          return;
        case 'message.new': {
          const message = frame.message as ChatMessage;
          setTypingUntil((t) => ({ ...t, [message.conversationId]: 0 }));
          if (id === selectedRef.current) {
            setMessages((prev) => mergeMessages(prev, [message]));
            const conv = selectedConvRef.current;
            if (conv && conv.id === id && !isMine(message, conv.viewer)) markRead(conv, [message]);
            if (message.clientMessageId) setOutbox((o) => o.filter((x) => x.clientMessageId !== message.clientMessageId));
          }
          setItems((prev) => {
            const found = prev.find((c) => c.id === id);
            if (!found) {
              void loadList();
              return prev;
            }
            const mine = isMine(message, found.viewer);
            const updated = { ...found, lastMessage: message, updatedAt: message.createdAt, unreadCount: !mine && id !== selectedRef.current ? found.unreadCount + 1 : found.unreadCount };
            return [updated, ...prev.filter((c) => c.id !== id)];
          });
          return;
        }
        case 'message.updated': {
          const message = frame.message as ChatMessage;
          if (id === selectedRef.current) setMessages((prev) => mergeMessages(prev, [message]));
          setItems((prev) => prev.map((c) => (c.id === id && c.lastMessage?.id === message.id ? { ...c, lastMessage: message } : c)));
          return;
        }
        case 'typing':
          if (id) setTypingUntil((t) => ({ ...t, [id]: Date.now() + 4000 }));
          return;
        case 'read':
          if (id === selectedRef.current) setMessages((prev) => applyRead(prev, selectedConvRef.current?.viewer, String(frame.upToMessageId)));
          return;
        case 'presence':
          setItems((prev) => prev.map((c) => (c.id === id ? { ...c, otherOnline: Boolean(frame.online) } : c)));
          if (id === selectedRef.current) setSelected((conv) => (conv ? { ...conv, otherOnline: Boolean(frame.online) } : conv));
          return;
        case 'conversation.updated':
          void loadList();
          if (id && id === selectedRef.current) void apiClient.getConversation(id, asCompany).then(setSelected).catch(() => undefined);
          return;
      }
    },
    [loadList, loadThread, markRead, asCompany]
  );
  const { status, sendTyping } = useRealtime(asCompany, onFrame);

  // ---------------------------------------------------------------- sending
  const deliver = useCallback(
    async (item: OutboxItem) => {
      setOutbox((o) => o.map((x) => (x.clientMessageId === item.clientMessageId ? { ...x, status: 'sending', error: undefined } : x)));
      try {
        const message = await apiClient.sendMessage(item.conversationId, { clientMessageId: item.clientMessageId, text: item.text, replyToMessageId: item.replyToMessageId }, asCompany);
        setOutbox((o) => o.filter((x) => x.clientMessageId !== item.clientMessageId));
        if (item.conversationId === selectedRef.current) setMessages((prev) => mergeMessages(prev, [message]));
        setItems((prev) => {
          const found = prev.find((c) => c.id === item.conversationId);
          return found ? [{ ...found, lastMessage: message, updatedAt: message.createdAt }, ...prev.filter((c) => c.id !== found.id)] : prev;
        });
      } catch (err) {
        setOutbox((o) =>
          o.map((x) => (x.clientMessageId === item.clientMessageId ? { ...x, status: 'failed', offline: isOffline(err), error: isOffline(err) ? undefined : errorText(err) } : x))
        );
      }
    },
    [asCompany]
  );

  // Messages typed while offline go out when the connection is back.
  useEffect(() => {
    const flush = () => outbox.filter((x) => x.status === 'failed' && x.offline).forEach((x) => void deliver(x));
    window.addEventListener('online', flush);
    if (status === 'online') flush();
    return () => window.removeEventListener('online', flush);
  }, [status, deliver]);

  const send = (text: string, replyToMessageId?: string) => {
    if (!selectedId) return;
    const item: OutboxItem = { clientMessageId: newClientId(), conversationId: selectedId, text, replyToMessageId, status: 'sending' };
    setOutbox((o) => [...o, item]);
    void deliver(item);
  };

  const startNew = async (text: string) => {
    if (!draftTarget) return;
    setStarting(true);
    setStartError(null);
    try {
      const conv = await apiClient.startConversation(
        {
          to: { type: draftTarget.type, id: draftTarget.id },
          ...(draftTarget.viaCardSeatId ? { viaCardSeatId: draftTarget.viaCardSeatId } : {}),
          message: { clientMessageId: newClientId(), text },
        },
        asCompany
      );
      setDraftTarget(undefined);
      setFolder('inbox');
      setSelectedId(conv.id);
      void loadList();
    } catch (err) {
      setStartError(errorText(err));
    } finally {
      setStarting(false);
    }
  };

  const replaceSelected = (conv: Conversation) => {
    setSelected(conv);
    void loadList();
  };

  const switchInbox = (next: 'personal' | 'company') => {
    setInbox(next);
    setFolder('inbox');
    setAssigned('');
    setSelectedId(undefined);
    setDraftTarget(undefined);
  };

  const folders: Array<{ id: Folder; label: string }> = useMemo(
    () => (inbox === 'company' ? [{ id: 'inbox', label: 'Open' }, { id: 'done', label: 'Done' }] : [{ id: 'inbox', label: 'Inbox' }, { id: 'requests', label: requestCount ? `Requests (${requestCount})` : 'Requests' }]),
    [inbox, requestCount]
  );

  const showThread = Boolean(selectedId || draftTarget);
  const selectedOutbox = outbox.filter((x) => x.conversationId === selectedId);

  return (
    <main className="max-w-6xl mx-auto md:px-6 md:py-6 text-charcoal">
      <div className="bg-white md:rounded-[18px] md:border border-sand-border overflow-hidden grid md:grid-cols-[340px_1fr] h-[calc(100dvh-64px)] md:h-[calc(100dvh-112px)]">
        {/* Conversation list */}
        <aside className={`flex flex-col min-h-0 border-r border-sand-border ${showThread ? 'hidden md:flex' : 'flex'}`} aria-label="Inbox">
          <div className="px-4 pt-4 pb-3 border-b border-sand-border space-y-3">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">Messages</h1>
              <span className="ml-auto text-xs text-charcoal/60" role="status">
                {status === 'online' ? 'Live' : status === 'connecting' ? 'Connecting…' : 'Offline. Reconnecting…'}
              </span>
            </div>
            {canUseCompany ? (
              <div className="flex gap-1" role="tablist" aria-label="Which inbox">
                <button type="button" role="tab" aria-selected={inbox === 'personal'} className={tab(inbox === 'personal')} onClick={() => switchInbox('personal')}>
                  Personal
                </button>
                <button type="button" role="tab" aria-selected={inbox === 'company'} className={tab(inbox === 'company')} onClick={() => switchInbox('company')}>
                  Company inbox
                </button>
              </div>
            ) : null}
            <div className="flex gap-1 flex-wrap" role="tablist" aria-label="Folders">
              {folders.map((f) => (
                <button key={f.id} type="button" role="tab" aria-selected={folder === f.id} className={tab(folder === f.id)} onClick={() => setFolder(f.id)}>
                  {f.label}
                </button>
              ))}
              {inbox === 'company' && isAdmin ? (
                <>
                  <label htmlFor="assigned-filter" className="sr-only">
                    Assigned
                  </label>
                  <select
                    id="assigned-filter"
                    value={assigned}
                    onChange={(e) => setAssigned(e.target.value as Assigned)}
                    className="ml-auto min-h-[40px] rounded-[10px] border border-sand-border bg-white px-2 text-sm"
                  >
                    <option value="">Everyone</option>
                    <option value="me">Assigned to me</option>
                    <option value="unassigned">Unassigned</option>
                  </select>
                </>
              ) : null}
            </div>
            <form
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                void loadList();
              }}
            >
              <label htmlFor="conv-search" className="sr-only">
                Search conversations by name
              </label>
              <input
                id="conv-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name"
                className="w-full min-h-[44px] px-3 rounded-[12px] border border-sand-border bg-white text-base focus:outline-none focus:border-bridge-orange focus:ring-1 focus:ring-bridge-orange"
              />
            </form>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {listState.error ? (
              <div className="p-4 text-sm" role="alert">
                <p>{listState.error}</p>
                <button type="button" className="mt-2 underline font-bold min-h-[40px]" onClick={() => void loadList()}>
                  Try again
                </button>
              </div>
            ) : listState.loading && !items.length ? (
              <div className="p-4 space-y-3" aria-busy="true">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 rounded-[12px] bg-warm-paper animate-pulse motion-reduce:animate-none" />
                ))}
              </div>
            ) : items.length ? (
              <>
                <ConversationList items={items} selectedId={selectedId} typingIds={typingIds} onSelect={(id) => {
                  setDraftTarget(undefined);
                  setSelectedId(id);
                }} />
                {listState.nextCursor ? (
                  <div className="p-3 text-center">
                    <button type="button" className="underline font-bold min-h-[40px] text-sm" onClick={() => void loadMore()}>
                      Show more conversations
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="p-6 text-sm text-charcoal/75">
                {query ? (
                  <p>No conversations with “{query}”.</p>
                ) : folder === 'requests' ? (
                  <p>No message requests. People who do not follow you appear here first.</p>
                ) : folder === 'done' ? (
                  <p>Nothing marked done yet.</p>
                ) : inbox === 'company' ? (
                  <p>{isAdmin ? 'No conversations yet. Messages to your company arrive here.' : 'No conversations assigned to you yet.'}</p>
                ) : (
                  <>
                    <p className="font-semibold text-charcoal">No messages yet.</p>
                    <p className="mt-1">Find companies and people, then tap Message on their page.</p>
                    <a href="/network/search" className="mt-3 inline-flex min-h-[44px] items-center px-4 rounded-[12px] bg-charcoal text-warm-paper font-bold">
                      Find companies and people
                    </a>
                  </>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Thread */}
        <div className={`min-h-0 ${showThread ? 'flex flex-col' : 'hidden md:flex md:flex-col'}`}>
          {draftTarget && !selectedId ? (
            <NewConversation
              target={draftTarget}
              busy={starting}
              error={startError}
              onSend={(text) => void startNew(text)}
              onBack={() => setDraftTarget(undefined)}
            />
          ) : selected && selected.id === selectedId ? (
            <Thread
              conv={selected}
              messages={messages}
              hasOlder={Boolean(olderCursor)}
              loading={threadLoading}
              outbox={selectedOutbox}
              typing={typingIds.includes(selected.id)}
              companyInbox={inbox === 'company'}
              isAdmin={isAdmin}
              seats={seats}
              onBack={() => setSelectedId(undefined)}
              onLoadOlder={async () => {
                if (!olderCursor) return;
                const page = await apiClient.listMessages(selected.id, olderCursor, asCompany).catch(() => null);
                if (page) {
                  setMessages((prev) => mergeMessages(prev, page.items));
                  setOlderCursor(page.nextCursor);
                }
              }}
              onSend={send}
              onRetry={(item) => void deliver(item)}
              onDiscard={(item) => setOutbox((o) => o.filter((x) => x.clientMessageId !== item.clientMessageId))}
              onTyping={() => sendTyping(selected.id)}
              onEdit={async (messageId, text) => {
                const m = await apiClient.editMessage(messageId, text, asCompany);
                setMessages((prev) => mergeMessages(prev, [m]));
              }}
              onUnsend={async (messageId) => {
                const m = await apiClient.unsendMessage(messageId, asCompany);
                setMessages((prev) => mergeMessages(prev, [m]));
              }}
              onAccept={async () => replaceSelected(await apiClient.conversationAction(selected.id, 'accept', asCompany))}
              onIgnore={async () => {
                await apiClient.conversationAction(selected.id, 'ignore', asCompany);
                setSelectedId(undefined);
                void loadList();
              }}
              onStatus={async (next) => replaceSelected(await apiClient.setConversationStatus(selected.id, next, session.companyId!))}
              onAssign={async (seatId) => replaceSelected(await apiClient.assignConversation(selected.id, seatId, session.companyId!))}
              loadNotes={async () => (await apiClient.listNotes(selected.id, session.companyId!)).items}
              addNote={async (text) => {
                await apiClient.addNote(selected.id, text, session.companyId!);
              }}
            />
          ) : selectedId ? (
            <div className="p-6 text-sm" aria-busy={threadLoading}>
              {threadError ? (
                <div role="alert">
                  <p>{threadError}</p>
                  <button type="button" className="mt-2 underline font-bold min-h-[40px]" onClick={() => setSelectedId(undefined)}>
                    Back to conversations
                  </button>
                </div>
              ) : (
                <p className="text-charcoal/65">Loading conversation…</p>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-sm text-charcoal/65 bg-warm-paper">
              <p>Choose a conversation to read it here.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function NewConversation({ target, busy, error, onSend, onBack }: { target: NewConversationTarget; busy: boolean; error: string | null; onSend: (text: string) => void; onBack: () => void }) {
  const [text, setText] = useState('');
  return (
    <section className="flex flex-col h-full min-h-0" aria-label={`New message to ${target.name}`}>
      <header className="flex items-center gap-3 px-4 h-16 border-b border-sand-border bg-white shrink-0">
        <button type="button" onClick={onBack} className="md:hidden min-h-[44px] px-2 -ml-2 font-bold text-sm" aria-label="Back to conversations">
          ←
        </button>
        <h2 className="font-bold truncate">New message to {target.name}</h2>
      </header>
      <div className="flex-1 bg-warm-paper p-6 text-sm text-charcoal/75">
        {target.type === 'member' ? (
          <p>If {target.name} does not follow you, your first message arrives as a request. You can send one message, without links, until they accept.</p>
        ) : (
          <p>Your message goes to {target.name}&rsquo;s team inbox. Your phone number is not shared.</p>
        )}
      </div>
      <form
        className="border-t border-sand-border bg-white px-4 py-3 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onSend(text.trim());
        }}
      >
        {error ? (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        ) : null}
        <div className="flex gap-2 items-end">
          <label htmlFor="new-message" className="sr-only">
            Message {target.name}
          </label>
          <textarea
            id="new-message"
            value={text}
            rows={2}
            maxLength={4000}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Message ${target.name}`}
            className="w-full rounded-[12px] border border-sand-border bg-white text-charcoal text-base px-3 py-2.5 resize-none focus:outline-none focus:border-bridge-orange focus:ring-1 focus:ring-bridge-orange"
          />
          <button type="submit" className={primary} disabled={busy || !text.trim()}>
            Send
          </button>
        </div>
      </form>
    </section>
  );
}
