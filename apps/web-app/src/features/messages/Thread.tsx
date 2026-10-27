'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { ChatMessage, Conversation, InternalNote } from '@onebridge/api-contracts';
import { Avatar } from './ConversationList';
import { canChange, isMine, otherSide, shortTime } from './chat-state';

export interface OutboxItem {
  clientMessageId: string;
  conversationId: string;
  text: string;
  replyToMessageId?: string;
  status: 'sending' | 'failed';
  /** Network failures retry by themselves when the connection is back. */
  offline?: boolean;
  error?: string;
}

export interface SeatOption {
  id: string;
  title: string;
}

const field =
  'w-full rounded-[12px] border border-sand-border bg-white text-charcoal text-base px-3 py-2.5 focus:outline-none focus:border-bridge-orange focus:ring-1 focus:ring-bridge-orange';
const quiet = 'min-h-[44px] px-4 rounded-[12px] border border-sand-border bg-white text-sm font-bold disabled:opacity-60';
const primary = 'min-h-[44px] px-5 rounded-[12px] bg-bridge-orange text-[#241A10] text-sm font-extrabold disabled:opacity-60';

function StateLabel({ state }: { state: ChatMessage['state'] }) {
  const text = state === 'read' ? 'Read' : state === 'delivered' ? 'Delivered' : state === 'sent' ? 'Sent' : '';
  return text ? <span className="text-xs text-charcoal/60">{text}</span> : null;
}

function Bubble({
  message,
  mine,
  quoted,
  showState,
  onReply,
  onEdit,
  onUnsend,
  changeable,
}: {
  message: ChatMessage;
  mine: boolean;
  quoted?: ChatMessage;
  showState: boolean;
  onReply: () => void;
  onEdit: (text: string) => Promise<void>;
  onUnsend: () => Promise<void>;
  changeable: boolean;
}) {
  const [mode, setMode] = useState<'view' | 'menu' | 'edit' | 'confirm'>('view');
  const [text, setText] = useState(message.text ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const removed = message.state === 'unsent';

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setMode('view');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      <div className={`group flex items-center gap-1 max-w-[85%] sm:max-w-[70%] ${mine ? 'flex-row-reverse' : ''}`}>
        <div
          className={`rounded-[16px] px-3.5 py-2.5 text-[15px] leading-relaxed break-words whitespace-pre-wrap ${
            removed ? 'bg-transparent border border-dashed border-sand-border text-charcoal/60 italic' : mine ? 'bg-charcoal text-warm-paper' : 'bg-white border border-sand-border text-charcoal'
          }`}
        >
          {quoted && !removed ? (
            <span className={`block mb-1.5 pl-2 border-l-2 text-sm ${mine ? 'border-warm-paper/40 text-warm-paper/75' : 'border-sand-border text-charcoal/65'}`}>
              {quoted.state === 'unsent' ? 'Message removed' : (quoted.text ?? '').slice(0, 120)}
            </span>
          ) : null}
          {mode === 'edit' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(() => onEdit(text));
              }}
              className="flex flex-col gap-2 min-w-[220px]"
            >
              <label className="sr-only" htmlFor={`edit-${message.id}`}>
                Edit message
              </label>
              <textarea id={`edit-${message.id}`} value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={4000} className={`${field} text-charcoal`} autoFocus />
              <span className="flex gap-2 justify-end">
                <button type="button" className={quiet} onClick={() => setMode('view')}>
                  Cancel
                </button>
                <button type="submit" className={primary} disabled={busy || !text.trim()}>
                  Save
                </button>
              </span>
            </form>
          ) : removed ? (
            'Message removed'
          ) : (
            message.text
          )}
        </div>
        {!removed && mode !== 'edit' ? (
          <button
            type="button"
            aria-label="Message options"
            aria-expanded={mode === 'menu'}
            onClick={() => setMode(mode === 'menu' ? 'view' : 'menu')}
            className="w-9 h-9 rounded-full inline-flex items-center justify-center text-charcoal/60 hover:bg-white focus-visible:ring-2 focus-visible:ring-bridge-orange sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
          >
            <span aria-hidden="true">⋯</span>
          </button>
        ) : null}
      </div>
      {mode === 'menu' ? (
        <div className="mt-1 flex gap-1" role="group" aria-label="Message actions">
          <button
            type="button"
            className={quiet}
            onClick={() => {
              setMode('view');
              onReply();
            }}
          >
            Reply
          </button>
          {changeable ? (
            <>
              <button type="button" className={quiet} onClick={() => setMode('edit')}>
                Edit
              </button>
              <button type="button" className={quiet} onClick={() => setMode('confirm')}>
                Unsend
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      {mode === 'confirm' ? (
        <div className="mt-1 rounded-[12px] border border-sand-border bg-white p-3 text-sm max-w-[320px]" role="alertdialog" aria-label="Unsend message">
          <p>Unsend this message? It is removed for both of you.</p>
          <span className="mt-2 flex gap-2 justify-end">
            <button type="button" className={quiet} onClick={() => setMode('view')}>
              Keep it
            </button>
            <button type="button" className={primary} disabled={busy} onClick={() => void run(onUnsend)}>
              Unsend message
            </button>
          </span>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1 text-sm text-error">
          {error}
        </p>
      ) : null}
      <span className="mt-0.5 flex gap-2 items-center text-xs text-charcoal/60">
        {shortTime(message.createdAt)}
        {message.editedAt && !removed ? <span>Edited</span> : null}
        {mine && showState ? <StateLabel state={message.state} /> : null}
      </span>
    </li>
  );
}

function CompanyTools({
  conv,
  isAdmin,
  seats,
  onStatus,
  onAssign,
  loadNotes,
  addNote,
}: {
  conv: Conversation;
  isAdmin: boolean;
  seats: SeatOption[];
  onStatus: (status: 'open' | 'done') => Promise<void>;
  onAssign: (seatId: string) => Promise<void>;
  loadNotes: () => Promise<InternalNote[]>;
  addNote: (text: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<InternalNote[] | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setNotes(null);
    setOpen(false);
  }, [conv.id]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const assignedTitle = seats.find((s) => s.id === conv.assignedSeatId)?.title;

  return (
    <div className="border-b border-sand-border bg-white px-4 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-charcoal/70">{conv.assignedSeatId ? `Assigned to ${assignedTitle ?? 'a seat'}` : 'Not assigned'}</span>
        {isAdmin && seats.length ? (
          <>
            <label htmlFor="assign-seat" className="sr-only">
              Assign to
            </label>
            <select
              id="assign-seat"
              value={conv.assignedSeatId ?? ''}
              disabled={busy}
              onChange={(e) => e.target.value && void run(() => onAssign(e.target.value))}
              className="min-h-[40px] rounded-[10px] border border-sand-border bg-white px-2 text-sm"
            >
              <option value="">Assign to…</option>
              {seats.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </>
        ) : null}
        <span className="ml-auto flex gap-2">
          <button type="button" className={quiet} aria-expanded={open} onClick={() => {
            setOpen(!open);
            if (!notes) void run(async () => setNotes(await loadNotes()));
          }}>
            Notes{notes?.length ? ` (${notes.length})` : ''}
          </button>
          <button type="button" className={quiet} disabled={busy} onClick={() => void run(() => onStatus(conv.status === 'done' ? 'open' : 'done'))}>
            {conv.status === 'done' ? 'Reopen' : 'Mark done'}
          </button>
        </span>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-error">
          {error}
        </p>
      ) : null}
      {open ? (
        <div className="mt-3 rounded-[12px] bg-warm-paper p-3">
          <p className="text-xs font-semibold text-charcoal/70">Internal notes. Only your team sees these.</p>
          <ul className="mt-2 space-y-2">
            {(notes ?? []).map((n) => (
              <li key={n.id} className="rounded-[10px] bg-white border border-sand-border px-3 py-2">
                <span className="whitespace-pre-wrap">{n.text}</span>
                <span className="block text-xs text-charcoal/60 mt-1">{shortTime(n.createdAt)}</span>
              </li>
            ))}
            {notes && !notes.length ? <li className="text-charcoal/65">No notes yet.</li> : null}
          </ul>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const text = note.trim();
              if (!text) return;
              void run(async () => {
                await addNote(text);
                setNote('');
                setNotes(await loadNotes());
              });
            }}
          >
            <label htmlFor="note-text" className="sr-only">
              Add a note
            </label>
            <input id="note-text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="Add a note for your team" className={field} />
            <button type="submit" className={primary} disabled={busy || !note.trim()}>
              Add note
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export interface ThreadProps {
  conv: Conversation;
  messages: ChatMessage[];
  hasOlder: boolean;
  loading: boolean;
  outbox: OutboxItem[];
  typing: boolean;
  companyInbox: boolean;
  isAdmin: boolean;
  seats: SeatOption[];
  onBack: () => void;
  onLoadOlder: () => void;
  onSend: (text: string, replyToMessageId?: string) => void;
  onRetry: (item: OutboxItem) => void;
  onDiscard: (item: OutboxItem) => void;
  onTyping: () => void;
  onEdit: (messageId: string, text: string) => Promise<void>;
  onUnsend: (messageId: string) => Promise<void>;
  onAccept: () => Promise<void>;
  onIgnore: () => Promise<void>;
  onStatus: (status: 'open' | 'done') => Promise<void>;
  onAssign: (seatId: string) => Promise<void>;
  loadNotes: () => Promise<InternalNote[]>;
  addNote: (text: string) => Promise<void>;
}

export function Thread(props: ThreadProps) {
  const { conv, messages, outbox } = props;
  const other = otherSide(conv);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [answering, setAnswering] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft('');
    setReplyTo(null);
    setAnswerError(null);
  }, [conv.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length, outbox.length, conv.id]);

  const byId = new Map(messages.map((m) => [m.id, m]));
  const lastMine = [...messages].reverse().find((m) => isMine(m, conv.viewer) && m.state !== 'unsent');
  const incoming = conv.requestDirection === 'incoming' && conv.requestState === 'pending';
  const waiting = conv.requestDirection === 'outgoing' && !conv.canSend;

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    props.onSend(text, replyTo?.id);
    setDraft('');
    setReplyTo(null);
  };

  const answer = async (fn: () => Promise<void>) => {
    setAnswering(true);
    setAnswerError(null);
    try {
      await fn();
    } catch (err) {
      setAnswerError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setAnswering(false);
    }
  };

  return (
    <section className="flex flex-col h-full min-h-0" aria-label={`Conversation with ${other.name}`}>
      <header className="flex items-center gap-3 px-4 h-16 border-b border-sand-border bg-white shrink-0">
        <button type="button" onClick={props.onBack} className="md:hidden min-h-[44px] px-2 -ml-2 font-bold text-sm" aria-label="Back to conversations">
          ←
        </button>
        <Avatar name={other.name} photoUrl={other.photoUrl} size={40} online={conv.otherOnline} />
        <div className="min-w-0">
          <h2 className="font-bold truncate">
            {other.handle ? (
              <a href={other.type === 'company' ? `/network/company/${other.handle}` : `/network/in/${other.handle}`} className="hover:underline underline-offset-2">
                {other.name}
              </a>
            ) : (
              other.name
            )}
          </h2>
          <p className="text-xs text-charcoal/65 truncate">
            {props.typing ? 'Typing…' : conv.otherOnline ? 'Online' : other.headline ?? (other.type === 'company' ? 'Company' : 'Member')}
          </p>
        </div>
      </header>

      {props.companyInbox && conv.status ? (
        <CompanyTools conv={conv} isAdmin={props.isAdmin} seats={props.seats} onStatus={props.onStatus} onAssign={props.onAssign} loadNotes={props.loadNotes} addNote={props.addNote} />
      ) : null}

      {incoming ? (
        <div className="border-b border-sand-border bg-white px-4 py-3 text-sm" role="region" aria-label="Message request">
          <p>
            <strong>{other.name}</strong> wants to message you. They cannot send more until you accept. They are not told if you ignore it.
          </p>
          {answerError ? (
            <p role="alert" className="mt-1 text-error">
              {answerError}
            </p>
          ) : null}
          <span className="mt-2 flex gap-2">
            <button type="button" className={primary} disabled={answering} onClick={() => void answer(props.onAccept)}>
              Accept
            </button>
            <button type="button" className={quiet} disabled={answering} onClick={() => void answer(props.onIgnore)}>
              Ignore
            </button>
          </span>
        </div>
      ) : null}

      <div className="flex-1 min-h-0 overflow-y-auto bg-warm-paper px-4 py-4">
        {props.hasOlder ? (
          <div className="text-center mb-3">
            <button type="button" className={quiet} onClick={props.onLoadOlder} disabled={props.loading}>
              Show earlier messages
            </button>
          </div>
        ) : null}
        {props.loading && !messages.length ? <p className="text-sm text-charcoal/65" aria-busy="true">Loading messages…</p> : null}
        <ul className="space-y-3">
          {messages.map((m) => (
            <Bubble
              key={m.id}
              message={m}
              mine={isMine(m, conv.viewer)}
              quoted={m.replyToMessageId ? byId.get(m.replyToMessageId) : undefined}
              showState={m.id === lastMine?.id}
              changeable={canChange(m, conv.viewer)}
              onReply={() => {
                setReplyTo(m);
                composerRef.current?.focus();
              }}
              onEdit={(text) => props.onEdit(m.id, text)}
              onUnsend={() => props.onUnsend(m.id)}
            />
          ))}
          {outbox.map((item) => (
            <li key={item.clientMessageId} className="flex flex-col items-end">
              <div className="max-w-[85%] sm:max-w-[70%] rounded-[16px] px-3.5 py-2.5 text-[15px] whitespace-pre-wrap break-words bg-charcoal/80 text-warm-paper">{item.text}</div>
              {item.status === 'sending' ? (
                <span className="mt-0.5 text-xs text-charcoal/60">Sending…</span>
              ) : (
                <span className="mt-0.5 flex flex-wrap gap-2 items-center justify-end text-xs" role="status">
                  <span className="text-error font-semibold">{item.offline ? 'Not sent yet. It will send when you are back online.' : item.error ?? 'Not sent.'}</span>
                  <button type="button" className="underline font-bold min-h-[32px]" onClick={() => props.onRetry(item)}>
                    Retry
                  </button>
                  <button type="button" className="underline min-h-[32px]" onClick={() => props.onDiscard(item)}>
                    Discard
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
        <div ref={endRef} />
      </div>

      <footer className="border-t border-sand-border bg-white px-4 py-3 shrink-0">
        {waiting ? (
          <p className="text-sm text-charcoal/75" role="status">
            Request sent. You can send more messages after {other.name} accepts.
          </p>
        ) : incoming ? (
          <p className="text-sm text-charcoal/75">Accept the request to reply, or reply below to accept it.</p>
        ) : null}
        {!waiting ? (
          <form
            className="mt-1 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            {replyTo ? (
              <div className="flex items-center gap-2 rounded-[10px] bg-warm-paper px-3 py-2 text-sm">
                <span className="truncate">
                  Replying to: <span className="text-charcoal/70">{(replyTo.text ?? '').slice(0, 80)}</span>
                </span>
                <button type="button" className="ml-auto underline min-h-[32px]" onClick={() => setReplyTo(null)}>
                  Cancel reply
                </button>
              </div>
            ) : null}
            <div className="flex gap-2 items-end">
              <label htmlFor="composer" className="sr-only">
                Message {other.name}
              </label>
              <textarea
                id="composer"
                ref={composerRef}
                value={draft}
                rows={1}
                maxLength={4000}
                placeholder={`Message ${other.name}`}
                onChange={(e) => {
                  setDraft(e.target.value);
                  props.onTyping();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                className={`${field} resize-none max-h-40`}
              />
              <button type="submit" className={primary} disabled={!draft.trim()}>
                Send
              </button>
            </div>
            {draft.length > 3800 ? <p className="text-xs text-charcoal/65">{4000 - draft.length} characters left</p> : null}
          </form>
        ) : null}
      </footer>
    </section>
  );
}
