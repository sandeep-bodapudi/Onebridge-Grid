export type ActorType = 'member' | 'company';

export interface ActorRef {
  type: ActorType;
  id: string;
}

export const sameActor = (a: ActorRef, b: ActorRef) => a.type === b.type && a.id === b.id;
export const actorKey = (a: ActorRef) => `${a.type}:${a.id}`;

export const MAX_TEXT = 4000;
export const EDIT_WINDOW_MS = 15 * 60 * 1000;

/** Context kinds that skip the request step: answering what the other side asked for (N07, N11). */
const ANSWER_CONTEXTS = ['requirement', 'call_request'];

/**
 * N08 message request rule for a NEW conversation. Messages to a company are
 * enquiries and go straight to its inbox. A member gets a request unless they
 * follow the sender, or the sender answers their requirement or call request.
 * (Confirmed business relationships, N06, will also skip it.)
 */
export function needsRequest(input: { receiver: ActorRef; receiverFollowsSender: boolean; contextKind?: string }): boolean {
  if (input.receiver.type === 'company') return false;
  if (input.receiverFollowsSender) return false;
  if (input.contextKind && ANSWER_CONTEXTS.includes(input.contextKind)) return false;
  return true;
}

/** Links are not allowed in a message request (spam control). */
const LINK = /(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|in|net|org|io|co|biz|info|xyz|me|app)(\/\S*)?\b/i;
export const containsLink = (text: string) => LINK.test(text);

/** New message requests per month for a company, by plan (sample numbers, plan section 5). */
export function companyRequestsPerMonth(plan: string | undefined): number {
  switch (plan) {
    case 'enterprise':
      return Number.POSITIVE_INFINITY;
    case 'business':
      return 200;
    case 'starter':
      return 50;
    default:
      return 5;
  }
}

export const monthStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
export const dayStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();

/** Owner and Admins see the whole company inbox; other seats see what is assigned to them. */
export const isInboxAdmin = (role: string | undefined) => role === 'owner' || role === 'admin';
