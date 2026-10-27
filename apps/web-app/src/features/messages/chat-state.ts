import type { ActorRef, ChatMessage, Conversation } from '@onebridge/api-contracts';

/** Messages are shown oldest first; pages arrive newest first. */
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return Array.from(byId.values()).sort((a, b) => (a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt)));
}

/** A read receipt from the other side marks my messages up to that one as read. */
export function applyRead(messages: ChatMessage[], viewer: ActorRef | undefined, upToMessageId: string): ChatMessage[] {
  const upTo = messages.find((m) => m.id === upToMessageId);
  if (!upTo || !viewer) return messages;
  return messages.map((m) =>
    m.sender.type === viewer.type && m.sender.id === viewer.id && m.state !== 'unsent' && m.createdAt <= upTo.createdAt ? { ...m, state: 'read' } : m
  );
}

export const isMine = (m: ChatMessage, viewer: ActorRef | undefined) => Boolean(viewer && m.sender.type === viewer.type && m.sender.id === viewer.id);

export const EDIT_WINDOW_MS = 15 * 60 * 1000;
export const canChange = (m: ChatMessage, viewer: ActorRef | undefined, now = Date.now()) =>
  isMine(m, viewer) && m.state !== 'unsent' && now - new Date(m.createdAt).getTime() <= EDIT_WINDOW_MS;

/** The participant who is not me. */
export function otherSide(conv: Conversation) {
  const v = conv.viewer;
  return conv.participants.find((p) => !(v && p.type === v.type && p.id === v.id)) ?? conv.participants[0];
}

/** One line for the conversation list. */
export function preview(conv: Conversation): string {
  const m = conv.lastMessage;
  if (!m) return 'No messages yet';
  if (m.state === 'unsent') return 'Message removed';
  return `${isMine(m, conv.viewer) ? 'You: ' : ''}${m.text ?? ''}`;
}

export function shortTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

export function newClientId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  return c?.randomUUID ? c.randomUUID() : `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
