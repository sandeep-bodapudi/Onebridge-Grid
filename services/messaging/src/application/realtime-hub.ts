import crypto from 'node:crypto';
import { ActorRef, actorKey, isInboxAdmin, sameActor } from '../domain/rules.js';
import type { ConversationDoc } from '../infrastructure/repositories.js';

/** Who a socket (or an API call) acts as. */
export interface Scope {
  personId: string;
  actor: ActorRef;
  /** Role in the company when actor is a company. */
  role?: string;
  /** Active seats the person holds in that company. */
  seatIds: string[];
}

export interface Socket {
  scope: Scope;
  send(frame: Record<string, unknown>): void;
}

const TICKET_TTL_MS = 60_000;

/**
 * Can this scope see the conversation? Members see their own; for a company,
 * Owner and Admins see all of its conversations and other seats see those
 * assigned to them (N08 company inbox).
 */
export function canSee(scope: Scope, conv: ConversationDoc): boolean {
  const side = conv.participants.find((p) => sameActor(p, scope.actor));
  if (!side) return false;
  if (scope.actor.type === 'member') return scope.actor.id === scope.personId;
  if (isInboxAdmin(scope.role)) return true;
  // Non-admin seats only see the inbox conversations assigned to their seat.
  return conv.tenantId === scope.actor.id && Boolean(conv.assignedSeatId && scope.seatIds.includes(conv.assignedSeatId));
}

/**
 * N08 fan-out on one node: WebSocket connections, single-use tickets and
 * presence. Redis pub/sub replaces the in-process loop when there is more
 * than one node (plan: messaging service).
 */
export class RealtimeHub {
  private readonly sockets = new Set<Socket>();
  private readonly tickets = new Map<string, { scope: Scope; expiresAt: number }>();
  private readonly online = new Map<string, number>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  issueTicket(scope: Scope): { ticket: string; expiresAt: string } {
    const nowMs = this.now().getTime();
    for (const [t, v] of this.tickets) if (v.expiresAt <= nowMs) this.tickets.delete(t);
    const ticket = crypto.randomBytes(24).toString('base64url');
    const expiresAt = nowMs + TICKET_TTL_MS;
    this.tickets.set(ticket, { scope, expiresAt });
    return { ticket, expiresAt: new Date(expiresAt).toISOString() };
  }

  /** Single use: a ticket opens one socket within 60 seconds. */
  redeem(ticket: string): Scope | null {
    const entry = this.tickets.get(ticket);
    this.tickets.delete(ticket);
    if (!entry || entry.expiresAt <= this.now().getTime()) return null;
    return entry.scope;
  }

  /** Returns true when this is the actor's first connection (they just came online). */
  add(socket: Socket): boolean {
    this.sockets.add(socket);
    const key = actorKey(socket.scope.actor);
    const count = (this.online.get(key) ?? 0) + 1;
    this.online.set(key, count);
    return count === 1;
  }

  /** Returns true when the actor's last connection closed (they went offline). */
  remove(socket: Socket): boolean {
    if (!this.sockets.delete(socket)) return false;
    const key = actorKey(socket.scope.actor);
    const count = (this.online.get(key) ?? 1) - 1;
    if (count <= 0) this.online.delete(key);
    else this.online.set(key, count);
    return count <= 0;
  }

  isOnline(actor: ActorRef): boolean {
    return (this.online.get(actorKey(actor)) ?? 0) > 0;
  }

  get size(): number {
    return this.sockets.size;
  }

  /**
   * Sends a frame to every socket that can see the conversation. `frameFor`
   * builds the frame per viewer (message state and company-only fields
   * differ by side). `exceptActor` skips the sender's own side for typing.
   */
  publish(conv: ConversationDoc, frameFor: (viewer: Scope) => Record<string, unknown> | null, exceptActor?: ActorRef): void {
    for (const socket of this.sockets) {
      if (exceptActor && sameActor(socket.scope.actor, exceptActor)) continue;
      if (!canSee(socket.scope, conv)) continue;
      const frame = frameFor(socket.scope);
      if (frame) {
        try {
          socket.send(frame);
        } catch {
          // A broken socket is cleaned up by its close handler.
        }
      }
    }
  }
}
