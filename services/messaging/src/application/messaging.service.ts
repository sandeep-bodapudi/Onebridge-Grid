import { BadRequestException, ConflictException, ForbiddenException, HttpException, NotFoundException } from '@nestjs/common';
import { ulid } from 'ulid';
import type { EventBus, KeyVaultProvider } from '@onebridge/shared';
import type { ActorSummary, ChatMessage, Conversation, ConversationPage, InternalNote, MessagePage } from '@onebridge/api-contracts';
import {
  ActorRef,
  actorKey,
  companyRequestsPerMonth,
  containsLink,
  dayStart,
  EDIT_WINDOW_MS,
  isInboxAdmin,
  MAX_TEXT,
  monthStart,
  needsRequest,
  sameActor,
} from '../domain/rules.js';
import { decryptText, encryptText } from '../domain/crypto.js';
import {
  CompanyRef,
  ConversationDoc,
  ConversationKind,
  MessageDoc,
  MongoCompanyRefRepository,
  MongoConversationRepository,
  MongoFollowRefRepository,
  MongoMessageRepository,
  MongoNoteRepository,
  MongoSeatRefRepository,
} from '../infrastructure/repositories.js';
import type { ProfilesClient } from '../infrastructure/profiles-client.js';
import { canSee, RealtimeHub, Scope, Socket } from './realtime-hub.js';

const CONVERSATION_PAGE = 30;
const MESSAGE_PAGE = 50;
const SEARCH_SCAN = 200;
const MAX_NOTE = 2000;

const problem = (status: number, title: string, detail: string, code?: string) => ({
  type: 'https://tools.ietf.org/html/rfc7807',
  title,
  status,
  detail,
  ...(code ? { code } : {}),
});

const notFound = () => new NotFoundException(problem(404, 'Not Found', 'No such conversation.'));

export interface MessagingLimits {
  memberRequestsPerMonth: number;
  dailyNewConversationCap: number;
}

export interface StartInput {
  to?: { type?: string; id?: string };
  viaCardSeatId?: string;
  context?: { kind?: string; id?: string };
  message?: SendInput;
}

export interface SendInput {
  clientMessageId?: string;
  text?: string;
  attachmentIds?: string[];
  replyToMessageId?: string;
}

interface DomainEvent {
  type: string;
  tenantId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

/**
 * N08: conversations, message requests and the company inbox. Message text
 * is encrypted at rest and never logged or put in events (IDs only).
 */
export class MessagingService {
  constructor(
    private readonly conversations: MongoConversationRepository,
    private readonly messages: MongoMessageRepository,
    private readonly notes: MongoNoteRepository,
    private readonly companies: MongoCompanyRefRepository,
    private readonly seats: MongoSeatRefRepository,
    private readonly followRefs: MongoFollowRefRepository,
    private readonly profiles: ProfilesClient,
    private readonly vault: KeyVaultProvider,
    private readonly eventBus: EventBus,
    readonly hub: RealtimeHub,
    private readonly limits: MessagingLimits,
    private readonly now: () => Date = () => new Date()
  ) {}

  // ------------------------------------------------------------------
  // Who is acting
  // ------------------------------------------------------------------

  /** The member, or the company named in X-Act-As-Company (any member of it; seats are limited by canSee). */
  async scopeFor(personId: string, company?: string, role?: string): Promise<Scope> {
    if (!company) return { personId, actor: { type: 'member', id: personId }, seatIds: [] };
    if (!role) throw new ForbiddenException(problem(403, 'Forbidden', 'You are not a member of this company.'));
    const seatIds = (await this.seats.heldBy(company, personId)).map((s) => s.seatId);
    return { personId, actor: { type: 'company', id: company }, role, seatIds };
  }

  private authorId(scope: Scope): string {
    return scope.seatIds[0] ?? scope.personId;
  }

  private async publishEvent(type: string, tenantId: string, payload: Record<string, unknown>): Promise<void> {
    await this.eventBus.publish({
      eventId: ulid(),
      type,
      version: '1.0.0',
      tenantId,
      occurredAt: this.now().toISOString(),
      correlationId: ulid(),
      aggregateVersion: 1,
      payload,
    });
  }

  private async visible(scope: Scope, id: string): Promise<ConversationDoc> {
    const conv = await this.conversations.get(id);
    // Not a participant looks the same as not found (no probing other inboxes).
    if (!conv || !canSee(scope, conv)) throw notFound();
    return conv;
  }

  private other(conv: ConversationDoc, actor: ActorRef) {
    return conv.participants.find((p) => !sameActor(p, actor))!;
  }

  private mine(conv: ConversationDoc, actor: ActorRef) {
    return conv.participants.find((p) => sameActor(p, actor))!;
  }

  // ------------------------------------------------------------------
  // Views
  // ------------------------------------------------------------------

  private async summaries(actors: ActorRef[]): Promise<Map<string, ActorSummary>> {
    const memberIds = actors.filter((a) => a.type === 'member').map((a) => a.id);
    const companyIds = actors.filter((a) => a.type === 'company').map((a) => a.id);
    const [members, companies] = await Promise.all([
      this.profiles.summaries(memberIds).catch(() => []),
      this.companies.getMany(Array.from(new Set(companyIds))),
    ]);
    const map = new Map<string, ActorSummary>();
    for (const m of members) map.set(`member:${m.personId}`, { type: 'member', id: m.personId, handle: m.handle, name: m.name, headline: m.headline, photoUrl: m.photoUrl, verified: false });
    for (const c of companies) map.set(`company:${c.tenantId}`, companySummary(c));
    for (const a of actors) {
      // Accounts without a public profile still show up, without details.
      if (!map.has(actorKey(a))) map.set(actorKey(a), { type: a.type, id: a.id, name: a.type === 'company' ? 'A company' : 'OneBridge member', verified: false });
    }
    return map;
  }

  private async textOf(conv: ConversationDoc, msg: MessageDoc): Promise<string | undefined> {
    if (msg.unsentAt || !msg.body) return undefined;
    return decryptText(this.vault, msg.body, `${conv.id}|${msg.id}`);
  }

  messageView(viewer: Scope, conv: ConversationDoc, msg: MessageDoc, text: string | undefined): ChatMessage {
    const fromViewer = sameActor(msg.sender, viewer.actor);
    let state: ChatMessage['state'];
    if (msg.unsentAt) state = 'unsent';
    else if (fromViewer) {
      const other = this.other(conv, viewer.actor);
      if (other.lastReadAt && other.lastReadAt >= msg.createdAt) state = 'read';
      else if (this.hub.isOnline(other) || (other.lastSeenAt && other.lastSeenAt >= msg.createdAt)) state = 'delivered';
      else state = 'sent';
    } else {
      const me = this.mine(conv, viewer.actor);
      state = me.lastReadAt && me.lastReadAt >= msg.createdAt ? 'read' : 'delivered';
    }
    return {
      id: msg.id,
      conversationId: msg.conversationId,
      ...(fromViewer ? { clientMessageId: msg.clientMessageId } : {}),
      sender: msg.sender,
      ...(fromViewer && msg.sentBySeatId ? { sentBySeatId: msg.sentBySeatId } : {}),
      ...(text !== undefined ? { text } : {}),
      ...(msg.replyToMessageId ? { replyToMessageId: msg.replyToMessageId } : {}),
      state,
      ...(msg.editedAt ? { editedAt: msg.editedAt } : {}),
      createdAt: msg.createdAt,
    };
  }

  private async conversationViews(scope: Scope, convs: ConversationDoc[]): Promise<Conversation[]> {
    const actors = convs.flatMap((c) => c.participants.map((p) => ({ type: p.type, id: p.id })));
    const [names, lastMessages, unread] = await Promise.all([
      this.summaries(actors),
      this.messages.getMany(convs.map((c) => c.lastMessageId).filter((id): id is string => Boolean(id))),
      Promise.all(convs.map((c) => this.messages.countUnread(c.id, scope.actor, this.mine(c, scope.actor)?.lastReadAt))),
    ]);
    const lastById = new Map(lastMessages.map((m) => [m.id, m]));
    return Promise.all(
      convs.map(async (conv, i) => {
        const last = conv.lastMessageId ? lastById.get(conv.lastMessageId) : undefined;
        return this.view(scope, conv, names, last ? this.messageView(scope, conv, last, await this.textOf(conv, last)) : undefined, unread[i]);
      })
    );
  }

  private async view(scope: Scope, conv: ConversationDoc, names: Map<string, ActorSummary>, lastMessage: ChatMessage | undefined, unreadCount: number): Promise<Conversation> {
    const pending = conv.requestState === 'pending' || conv.requestState === 'ignored';
    const isReceiver = Boolean(conv.requestReceiver && sameActor(conv.requestReceiver, scope.actor));
    const inboxSide = scope.actor.type === 'company' && conv.tenantId === scope.actor.id;
    let canSend = true;
    if (pending && !isReceiver) canSend = (await this.messages.countBy(conv.id, scope.actor)) === 0;
    const other = this.other(conv, scope.actor);
    return {
      id: conv.id,
      kind: conv.kind,
      participants: conv.participants.map((p) => names.get(actorKey(p))!),
      ownership: conv.ownership,
      // Ignoring is silent: the sender keeps seeing "pending".
      requestState: conv.requestState === 'ignored' && !isReceiver ? 'pending' : conv.requestState,
      ...(pending ? { requestDirection: isReceiver ? ('incoming' as const) : ('outgoing' as const) } : {}),
      // Status, assignment and the card seat are internal to the company inbox.
      ...(inboxSide ? { status: conv.status } : {}),
      ...(inboxSide && conv.assignedSeatId ? { assignedSeatId: conv.assignedSeatId } : {}),
      ...(conv.viaCardSeatId ? { viaCardSeatId: conv.viaCardSeatId } : {}),
      viewer: scope.actor,
      canSend,
      otherOnline: this.hub.isOnline(other),
      ...(lastMessage ? { lastMessage } : {}),
      unreadCount,
      updatedAt: conv.updatedAt,
    };
  }

  private async viewOne(scope: Scope, conv: ConversationDoc): Promise<Conversation> {
    return (await this.conversationViews(scope, [conv]))[0];
  }

  private pushConversationUpdate(conv: ConversationDoc, only?: ActorRef): void {
    this.hub.publish(conv, (viewer) => (only && !sameActor(viewer.actor, only) ? null : { type: 'conversation.updated', conversationId: conv.id }));
  }

  // ------------------------------------------------------------------
  // Conversations
  // ------------------------------------------------------------------

  async start(scope: Scope, input: StartInput): Promise<Conversation> {
    const to = input.to;
    if (!to || (to.type !== 'member' && to.type !== 'company') || !to.id) {
      throw new BadRequestException(problem(400, 'Bad Request', 'Choose a member or a company to message.'));
    }
    const receiver: ActorRef = { type: to.type, id: to.id };
    if (sameActor(receiver, scope.actor)) throw new BadRequestException(problem(400, 'Bad Request', 'You cannot message yourself.', 'self_message'));
    if (scope.actor.type === 'company' && !isInboxAdmin(scope.role)) {
      throw new ForbiddenException(problem(403, 'Forbidden', 'Only the company owner or an admin can start conversations for the company.'));
    }
    const viaCardSeatId = input.viaCardSeatId || undefined;
    if (viaCardSeatId && (receiver.type !== 'company' || scope.actor.type !== 'member')) {
      throw new BadRequestException(problem(400, 'Bad Request', 'A card conversation is from a member to the company on the card.'));
    }

    // The receiver must exist.
    if (receiver.type === 'company') {
      if (!(await this.companies.get(receiver.id))) throw new NotFoundException(problem(404, 'Not Found', 'No such company.'));
    } else if (!(await this.profiles.summaries([receiver.id])).some((m) => m.personId === receiver.id)) {
      throw new NotFoundException(problem(404, 'Not Found', 'No such member.'));
    }
    const cardSeat = viaCardSeatId ? await this.seats.get(receiver.id, viaCardSeatId) : null;
    if (viaCardSeatId && !cardSeat) throw new NotFoundException(problem(404, 'Not Found', 'No such card.'));

    const keys = [actorKey(scope.actor), actorKey(receiver)].sort();
    const pairKey = `${keys.join('|')}${viaCardSeatId ? `|card:${viaCardSeatId}` : ''}`;
    const existing = await this.conversations.byPair(pairKey);
    if (existing) {
      // One conversation per pair: a "new" message goes into it.
      await this.send(scope, existing.id, input.message ?? {});
      return this.viewOne(scope, (await this.conversations.get(existing.id))!);
    }

    const text = this.validText(input.message);
    const isRequest = needsRequest({
      receiver,
      receiverFollowsSender: await this.followRefs.follows(receiver, scope.actor),
      contextKind: input.context?.kind,
    });
    if (isRequest && containsLink(text)) {
      throw new BadRequestException(problem(400, 'Bad Request', 'Message requests cannot include links. Send them after your request is accepted.', 'request_restricted'));
    }
    await this.checkCaps(scope, isRequest);

    const kind: ConversationKind =
      scope.actor.type === 'member' && receiver.type === 'member'
        ? 'member_member'
        : scope.actor.type === 'company' && receiver.type === 'company'
          ? 'company_company'
          : viaCardSeatId
            ? 'member_card'
            : 'member_company';
    const company = scope.actor.type === 'company' ? scope.actor : receiver.type === 'company' ? receiver : undefined;
    // company_company: the receiving company's inbox handles it.
    const tenantId = kind === 'company_company' ? receiver.id : company?.id;
    const id = ulid();
    const nowIso = this.now().toISOString();
    const doc: ConversationDoc = {
      id,
      kind,
      pairKey,
      participants: [{ ...scope.actor }, { ...receiver }],
      ownership: company ? 'company' : 'members',
      ...(tenantId ? { tenantId } : {}),
      keyScope: kind === 'member_company' || kind === 'member_card' ? tenantId! : `conv:${id}`,
      startedBy: scope.actor,
      requestState: isRequest ? 'pending' : 'none',
      ...(isRequest ? { requestReceiver: receiver } : {}),
      status: 'open',
      // Card conversations go to the employee whose card it was (the company still owns them).
      ...(cardSeat && cardSeat.status === 'active' ? { assignedSeatId: cardSeat.seatId } : {}),
      ...(viaCardSeatId ? { viaCardSeatId } : {}),
      ...(input.context?.kind && input.context.id ? { context: { kind: input.context.kind, id: input.context.id } } : {}),
      lastMessageAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const { conversation, created } = await this.conversations.insertOrGet(doc);
    if (created) {
      await this.publishEvent('conversation.started', tenantId ?? 'global', {
        conversationId: id,
        kind,
        isRequest,
        ...(viaCardSeatId ? { viaCardSeatId } : {}),
      });
    }
    await this.send(scope, conversation.id, { ...input.message, text });
    return this.viewOne(scope, (await this.conversations.get(conversation.id))!);
  }

  private validText(input?: SendInput): string {
    if (input?.attachmentIds?.length) {
      throw new BadRequestException(problem(400, 'Bad Request', 'Attachments are not available yet. Send text for now.', 'attachments_unavailable'));
    }
    const text = (input?.text ?? '').trim();
    if (!text) throw new BadRequestException(problem(400, 'Bad Request', 'Write a message first.'));
    if (text.length > MAX_TEXT) throw new BadRequestException(problem(400, 'Bad Request', `Messages can be up to ${MAX_TEXT} characters.`, 'too_long'));
    return text;
  }

  private async checkCaps(scope: Scope, isRequest: boolean): Promise<void> {
    const now = this.now();
    if ((await this.conversations.countStartedSince(scope.actor, dayStart(now), false)) >= this.limits.dailyNewConversationCap) {
      throw new HttpException(
        { ...problem(429, 'Too Many Requests', 'You have started a lot of conversations today. Try again tomorrow.', 'rate_limited'), retryAfterSeconds: 3600 },
        429
      );
    }
    if (!isRequest) return;
    const cap =
      scope.actor.type === 'company' ? companyRequestsPerMonth((await this.companies.get(scope.actor.id))?.plan) : this.limits.memberRequestsPerMonth;
    if ((await this.conversations.countStartedSince(scope.actor, monthStart(now), true)) >= cap) {
      throw new HttpException(
        {
          ...problem(429, 'Too Many Requests', `You have used this month's ${cap} message requests to people who do not follow you. Ask them to follow you, or try next month.`, 'request_limit'),
          limit: cap,
        },
        429
      );
    }
  }

  async list(scope: Scope, query: { folder?: string; assigned?: string; q?: string; cursor?: string }): Promise<ConversationPage> {
    const a = scope.actor;
    const filter: Record<string, unknown> = { participants: { $elemMatch: { type: a.type, id: a.id } } };
    const receiverIsMe = { 'requestReceiver.type': a.type, 'requestReceiver.id': a.id };
    const folder = query.folder === 'requests' || query.folder === 'done' ? query.folder : 'inbox';
    if (folder === 'requests') Object.assign(filter, { requestState: 'pending', ...receiverIsMe });
    else if (folder === 'done') {
      if (a.type !== 'company') return { items: [] };
      Object.assign(filter, { tenantId: a.id, status: 'done' });
    } else {
      const nor: Record<string, unknown>[] = [{ requestState: { $in: ['pending', 'ignored'] }, ...receiverIsMe }];
      if (a.type === 'company') nor.push({ tenantId: a.id, status: 'done' });
      filter.$nor = nor;
    }
    if (a.type === 'company') {
      if (!isInboxAdmin(scope.role)) Object.assign(filter, { tenantId: a.id, assignedSeatId: { $in: scope.seatIds } });
      else if (query.assigned === 'me') Object.assign(filter, { tenantId: a.id, assignedSeatId: { $in: scope.seatIds } });
      else if (query.assigned === 'unassigned') Object.assign(filter, { tenantId: a.id, assignedSeatId: { $exists: false } });
    }

    const q = (query.q ?? '').trim().toLowerCase().slice(0, 100);
    if (q) {
      // Search by the other side's name (message text is encrypted, so it is not searchable server-side yet).
      const convs = await this.conversations.list(filter, SEARCH_SCAN);
      const names = await this.summaries(convs.map((c) => this.other(c, a)));
      const hits = convs.filter((c) => names.get(actorKey(this.other(c, a)))!.name.toLowerCase().includes(q)).slice(0, CONVERSATION_PAGE);
      return { items: await this.conversationViews(scope, hits) };
    }
    const convs = await this.conversations.list(filter, CONVERSATION_PAGE, query.cursor);
    const last = convs[convs.length - 1];
    return {
      items: await this.conversationViews(scope, convs),
      ...(convs.length === CONVERSATION_PAGE && last ? { nextCursor: `${last.lastMessageAt}|${last.id}` } : {}),
    };
  }

  async get(scope: Scope, id: string): Promise<Conversation> {
    return this.viewOne(scope, await this.visible(scope, id));
  }

  // ------------------------------------------------------------------
  // Messages
  // ------------------------------------------------------------------

  async messagesPage(scope: Scope, id: string, cursor?: string): Promise<MessagePage> {
    const conv = await this.visible(scope, id);
    const docs = await this.messages.page(conv.id, MESSAGE_PAGE, cursor);
    const items = await Promise.all(docs.map(async (m) => this.messageView(scope, conv, m, await this.textOf(conv, m))));
    const last = docs[docs.length - 1];
    return { items, ...(docs.length === MESSAGE_PAGE && last ? { nextCursor: `${last.createdAt}|${last.id}` } : {}) };
  }

  async send(scope: Scope, id: string, input: SendInput): Promise<ChatMessage> {
    let conv = await this.visible(scope, id);
    const clientMessageId = (input.clientMessageId ?? '').trim().slice(0, 100);
    if (!clientMessageId) throw new BadRequestException(problem(400, 'Bad Request', 'clientMessageId is required.'));
    const text = this.validText(input);

    if (conv.requestState === 'pending' || conv.requestState === 'ignored') {
      if (conv.requestReceiver && sameActor(conv.requestReceiver, scope.actor)) {
        // Replying to a request accepts it.
        conv = (await this.conversations.set(conv.id, { requestState: 'accepted' }))!;
      } else {
        const sentBefore = await this.messages.countBy(conv.id, scope.actor);
        if (sentBefore >= 1) {
          throw new BadRequestException(problem(400, 'Bad Request', 'You can send one message until they accept your request.', 'awaiting_acceptance'));
        }
        if (containsLink(text)) {
          throw new BadRequestException(problem(400, 'Bad Request', 'Message requests cannot include links. Send them after your request is accepted.', 'request_restricted'));
        }
      }
    }
    if (input.replyToMessageId) {
      const parent = await this.messages.get(input.replyToMessageId);
      if (!parent || parent.conversationId !== conv.id) throw new BadRequestException(problem(400, 'Bad Request', 'You can only reply to a message in this conversation.'));
    }

    const messageId = ulid();
    const nowIso = this.now().toISOString();
    const { message, created } = await this.messages.insertOrGet({
      id: messageId,
      conversationId: conv.id,
      clientMessageId,
      sender: scope.actor,
      ...(scope.actor.type === 'company' ? { sentBySeatId: this.authorId(scope) } : {}),
      body: await encryptText(this.vault, conv.keyScope, `${conv.id}|${messageId}`, text),
      ...(input.replyToMessageId ? { replyToMessageId: input.replyToMessageId } : {}),
      createdAt: nowIso,
    });
    if (!created) return this.messageView(scope, conv, message, await this.textOf(conv, message));

    const reopen = conv.status === 'done' && conv.tenantId && !(scope.actor.type === 'company' && scope.actor.id === conv.tenantId);
    conv = (await this.conversations.set(conv.id, { lastMessageId: message.id, lastMessageAt: nowIso, updatedAt: nowIso, ...(reopen ? { status: 'open' as const } : {}) }))!;
    await this.conversations.setParticipant(conv.id, scope.actor, { lastReadAt: nowIso, lastReadMessageId: message.id });
    conv = (await this.conversations.get(conv.id))!;

    await this.publishEvent('message.sent', conv.tenantId ?? 'global', {
      conversationId: conv.id,
      messageId: message.id,
      senderType: scope.actor.type,
      senderId: scope.actor.id,
    });
    const finalConv = conv;
    this.hub.publish(finalConv, (viewer) => ({ type: 'message.new', conversationId: finalConv.id, message: this.messageView(viewer, finalConv, message, text) }));
    return this.messageView(scope, conv, message, text);
  }

  private async ownMessage(scope: Scope, messageId: string): Promise<{ conv: ConversationDoc; msg: MessageDoc }> {
    const msg = await this.messages.get(messageId);
    if (!msg) throw new NotFoundException(problem(404, 'Not Found', 'No such message.'));
    const conv = await this.visible(scope, msg.conversationId);
    const author =
      sameActor(msg.sender, scope.actor) &&
      (scope.actor.type === 'member' || msg.sentBySeatId === scope.personId || (msg.sentBySeatId !== undefined && scope.seatIds.includes(msg.sentBySeatId)));
    if (!author) throw new ForbiddenException(problem(403, 'Forbidden', 'You can only change your own messages.'));
    if (msg.unsentAt) throw new ConflictException(problem(409, 'Conflict', 'This message was removed.', 'window_closed'));
    if (this.now().getTime() - new Date(msg.createdAt).getTime() > EDIT_WINDOW_MS) {
      throw new ConflictException(problem(409, 'Conflict', 'Messages can be changed for 15 minutes after sending.', 'window_closed'));
    }
    return { conv, msg };
  }

  private broadcastUpdate(conv: ConversationDoc, msg: MessageDoc, text: string | undefined): void {
    this.hub.publish(conv, (viewer) => ({ type: 'message.updated', conversationId: conv.id, message: this.messageView(viewer, conv, msg, text) }));
  }

  async edit(scope: Scope, messageId: string, rawText: string | undefined): Promise<ChatMessage> {
    const { conv, msg } = await this.ownMessage(scope, messageId);
    const text = this.validText({ text: rawText });
    const updated = (await this.messages.set(msg.id, {
      body: await encryptText(this.vault, conv.keyScope, `${conv.id}|${msg.id}`, text),
      editedAt: this.now().toISOString(),
    }))!;
    this.broadcastUpdate(conv, updated, text);
    return this.messageView(scope, conv, updated, text);
  }

  async unsend(scope: Scope, messageId: string): Promise<ChatMessage> {
    const { conv, msg } = await this.ownMessage(scope, messageId);
    // The text is deleted, not just hidden.
    const updated = (await this.messages.set(msg.id, { unsentAt: this.now().toISOString() }, ['body']))!;
    this.broadcastUpdate(conv, updated, undefined);
    return this.messageView(scope, conv, updated, undefined);
  }

  async read(scope: Scope, id: string, upToMessageId: string | undefined): Promise<void> {
    const conv = await this.visible(scope, id);
    const msg = upToMessageId ? await this.messages.get(upToMessageId) : null;
    if (!msg || msg.conversationId !== conv.id) throw new BadRequestException(problem(400, 'Bad Request', 'Unknown message.'));
    const mine = this.mine(conv, scope.actor);
    if (mine.lastReadAt && mine.lastReadAt >= msg.createdAt) return;
    await this.conversations.setParticipant(conv.id, scope.actor, { lastReadAt: msg.createdAt, lastReadMessageId: msg.id });
    // Read receipts (N10 will let members turn them off).
    this.hub.publish(conv, () => ({ type: 'read', conversationId: conv.id, actor: scope.actor, upToMessageId: msg.id }), scope.actor);
  }

  // ------------------------------------------------------------------
  // Requests
  // ------------------------------------------------------------------

  private async asReceiver(scope: Scope, id: string): Promise<ConversationDoc> {
    const conv = await this.visible(scope, id);
    if (!conv.requestReceiver || !sameActor(conv.requestReceiver, scope.actor) || conv.requestState === 'none' || conv.requestState === 'accepted') {
      throw new ConflictException(problem(409, 'Conflict', 'There is no request to answer.', 'not_a_request'));
    }
    return conv;
  }

  async accept(scope: Scope, id: string): Promise<Conversation> {
    const conv = (await this.conversations.set((await this.asReceiver(scope, id)).id, { requestState: 'accepted', updatedAt: this.now().toISOString() }))!;
    this.pushConversationUpdate(conv);
    return this.viewOne(scope, conv);
  }

  /** Silent: the sender is not told and keeps seeing a pending request. */
  async ignore(scope: Scope, id: string): Promise<Conversation> {
    const conv = (await this.conversations.set((await this.asReceiver(scope, id)).id, { requestState: 'ignored' }))!;
    this.pushConversationUpdate(conv, scope.actor);
    return this.viewOne(scope, conv);
  }

  // ------------------------------------------------------------------
  // Company inbox
  // ------------------------------------------------------------------

  private async inbox(scope: Scope, id: string): Promise<ConversationDoc> {
    const conv = await this.visible(scope, id);
    if (scope.actor.type !== 'company' || conv.tenantId !== scope.actor.id) {
      throw new ForbiddenException(problem(403, 'Forbidden', 'Only the company handling this conversation can do that.'));
    }
    return conv;
  }

  async setStatus(scope: Scope, id: string, status: string | undefined): Promise<Conversation> {
    if (status !== 'open' && status !== 'done') throw new BadRequestException(problem(400, 'Bad Request', 'Status is open or done.'));
    const conv = (await this.conversations.set((await this.inbox(scope, id)).id, { status }))!;
    this.pushConversationUpdate(conv, scope.actor);
    return this.viewOne(scope, conv);
  }

  async assign(scope: Scope, id: string, seatId: string | undefined): Promise<Conversation> {
    const conv = await this.inbox(scope, id);
    if (!isInboxAdmin(scope.role)) throw new ForbiddenException(problem(403, 'Forbidden', 'Only the company owner or an admin can assign conversations.'));
    const seat = seatId ? await this.seats.get(conv.tenantId!, seatId) : null;
    if (!seat || seat.status !== 'active' || !seat.personId) {
      throw new BadRequestException(problem(400, 'Bad Request', 'Choose an active seat in this company.', 'invalid_seat'));
    }
    const updated = (await this.conversations.set(conv.id, { assignedSeatId: seat.seatId }))!;
    await this.publishEvent('conversation.assigned', conv.tenantId!, { conversationId: conv.id, seatId: seat.seatId });
    this.pushConversationUpdate(updated, scope.actor);
    return this.viewOne(scope, updated);
  }

  async addNote(scope: Scope, id: string, rawText: string | undefined): Promise<InternalNote> {
    const conv = await this.inbox(scope, id);
    const text = (rawText ?? '').trim();
    if (!text) throw new BadRequestException(problem(400, 'Bad Request', 'Write a note first.'));
    if (text.length > MAX_NOTE) throw new BadRequestException(problem(400, 'Bad Request', `Notes can be up to ${MAX_NOTE} characters.`, 'too_long'));
    const noteId = ulid();
    const note = {
      id: noteId,
      tenantId: conv.tenantId!,
      conversationId: conv.id,
      authorSeatId: this.authorId(scope),
      body: await encryptText(this.vault, conv.tenantId!, `${conv.id}|note|${noteId}`, text),
      createdAt: this.now().toISOString(),
    };
    await this.notes.add(note);
    return { id: note.id, conversationId: conv.id, authorSeatId: note.authorSeatId, text, createdAt: note.createdAt };
  }

  async listNotes(scope: Scope, id: string): Promise<{ items: InternalNote[] }> {
    const conv = await this.inbox(scope, id);
    const docs = await this.notes.list(conv.tenantId!, conv.id);
    return {
      items: await Promise.all(
        docs.map(async (n) => ({
          id: n.id,
          conversationId: n.conversationId,
          authorSeatId: n.authorSeatId,
          text: await decryptText(this.vault, n.body, `${conv.id}|note|${n.id}`),
          createdAt: n.createdAt,
        }))
      ),
    };
  }

  // ------------------------------------------------------------------
  // Realtime
  // ------------------------------------------------------------------

  async typing(scope: Scope, conversationId: string): Promise<void> {
    const conv = await this.conversations.get(conversationId);
    if (!conv || !canSee(scope, conv)) return;
    this.hub.publish(conv, () => ({ type: 'typing', conversationId: conv.id, actor: scope.actor }), scope.actor);
  }

  private async broadcastPresence(actor: ActorRef, online: boolean): Promise<void> {
    const convs = await this.conversations.list({ participants: { $elemMatch: { type: actor.type, id: actor.id } } }, 100);
    for (const conv of convs) this.hub.publish(conv, () => ({ type: 'presence', conversationId: conv.id, actor, online }), actor);
  }

  async connected(socket: Socket): Promise<void> {
    if (!this.hub.add(socket)) return;
    await this.conversations.touchSeen(socket.scope.actor, this.now().toISOString());
    await this.broadcastPresence(socket.scope.actor, true);
  }

  async disconnected(socket: Socket): Promise<void> {
    if (!this.hub.remove(socket)) return;
    await this.conversations.touchSeen(socket.scope.actor, this.now().toISOString());
    await this.broadcastPresence(socket.scope.actor, false);
  }

  // ------------------------------------------------------------------
  // Read models from events (idempotent, at-least-once)
  // ------------------------------------------------------------------

  async onOrgEvent(event: DomainEvent): Promise<void> {
    const p = event.payload;
    const tenantId = (p.orgId as string) || event.tenantId;
    if (!tenantId || tenantId === 'global') return;
    const existing = await this.companies.get(tenantId);
    const updated = (p.updatedFields ?? {}) as Record<string, unknown>;
    const nested = (p.brandKit ?? {}) as Record<string, unknown>;
    const pick = (key: string) => (updated[key] as string | undefined) ?? (p[key] as string | undefined);
    const name = pick('name') ?? existing?.name;
    if (!name) return;
    await this.companies.upsert({
      tenantId,
      name,
      slug: pick('slug') ?? existing?.slug,
      industry: pick('industry') ?? existing?.industry,
      city: pick('city') ?? existing?.city,
      plan: pick('plan') ?? existing?.plan,
      logo: (p.logo as string | undefined) ?? (nested.logo as string | undefined) ?? existing?.logo,
      verified: event.type === 'kyb.status_changed' ? p.status === 'verified' : existing?.verified ?? false,
      updatedAt: event.occurredAt,
    });
  }

  async onSeatEvent(event: DomainEvent): Promise<void> {
    const p = event.payload;
    const tenantId = (p.orgId as string) || event.tenantId;
    const seatId = p.seatId as string | undefined;
    if (!tenantId || !seatId) return;
    const at = { updatedAt: event.occurredAt };
    switch (event.type) {
      case 'seat.created':
        await this.seats.patch(tenantId, seatId, { personId: p.personId as string | undefined, title: p.title as string | undefined, status: p.status as string | undefined, ...at });
        break;
      case 'seat.assigned':
        // The seat keeps its conversations; the new holder sees them (offboarding, F16).
        await this.seats.patch(tenantId, seatId, { personId: p.personId as string | undefined, ...at });
        break;
      case 'seat.updated': {
        const f = (p.updatedFields ?? {}) as Record<string, unknown>;
        await this.seats.patch(tenantId, seatId, {
          ...(typeof f.title === 'string' ? { title: f.title } : {}),
          ...(typeof f.status === 'string' ? { status: f.status } : {}),
          ...at,
        });
        break;
      }
      case 'seat.status_changed': {
        const status = p.newStatus as string | undefined;
        await this.seats.patch(tenantId, seatId, { status, ...at });
        // A seat that is no longer active hands its conversations back to the inbox for reassignment.
        if (status !== 'active') await this.conversations.unassignSeat(tenantId, seatId);
        break;
      }
    }
  }

  async onFollowEvent(event: DomainEvent): Promise<void> {
    const p = event.payload;
    const ref = {
      followerType: p.followerType as ActorRef['type'],
      followerId: p.followerId as string,
      targetType: p.targetType as ActorRef['type'],
      targetId: p.targetId as string,
    };
    if (!ref.followerId || !ref.targetId) return;
    if (event.type === 'follow.created') await this.followRefs.add(ref);
    else if (event.type === 'follow.removed') await this.followRefs.remove(ref);
  }
}

function companySummary(ref: CompanyRef): ActorSummary {
  return {
    type: 'company',
    id: ref.tenantId,
    handle: ref.slug,
    name: ref.name,
    headline: [ref.industry, ref.city].filter(Boolean).join(' · ') || undefined,
    photoUrl: ref.logo,
    verified: ref.verified,
  };
}
