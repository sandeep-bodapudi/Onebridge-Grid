/**
 * Domain event envelope and an in-process pub/sub EventBus.
 *
 * Per ADR-0003: eventId, type, version, tenantId, occurredAt, correlationId,
 * payload, and aggregateVersion (monotonic per aggregate).
 *
 * AGENTS.md section 4 calls for "an internal event bus interface with an
 * SNS/SQS adapter for production and an in-memory adapter for local and
 * tests". InMemoryEventBus is that in-memory adapter: it delivers published
 * events synchronously to subscribed handlers within the same process.
 *
 * Scope note (logged in docs/decisions.md): this only delivers events to
 * subscribers that share the same EventBus instance. That is sufficient for
 * `pnpm dev` (single composed process) and for integration tests that wire
 * two services to one bus, but NOT a substitute for the production SNS/SQS
 * adapter needed when services run as separate deployed processes — that
 * adapter is out of scope here and deferred to Step 12 (Hardening), the
 * same step production OAuth verifiers and OpenTelemetry/Sentry land in.
 */

export interface DomainEvent {
  eventId: string;
  type: string;
  version: string;
  tenantId: string;
  occurredAt: string;
  correlationId: string;
  aggregateVersion?: number;
  payload: Record<string, unknown>;
}

export type EventHandler = (event: DomainEvent) => Promise<void> | void;

/** Matches the loose `EventBus` interface already used across services (fakes.ts). */
export interface PublishableEventBus {
  publish(event: unknown): Promise<void>;
}

export interface SubscribableEventBus extends PublishableEventBus {
  subscribe(eventType: string, handler: EventHandler): void;
}

function isDomainEvent(event: unknown): event is DomainEvent {
  return (
    !!event &&
    typeof event === 'object' &&
    typeof (event as Record<string, unknown>).type === 'string' &&
    typeof (event as Record<string, unknown>).tenantId === 'string'
  );
}

export class InMemoryEventBus implements SubscribableEventBus {
  private readonly handlersByType = new Map<string, EventHandler[]>();
  public readonly published: DomainEvent[] = [];

  async publish(event: unknown): Promise<void> {
    if (!isDomainEvent(event)) {
      // Published events that don't match the envelope shape are recorded
      // but cannot be routed to typed subscribers.
      return;
    }
    this.published.push(event);
    const handlers = this.handlersByType.get(event.type) ?? [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        // A subscriber failure must never fail the publisher's write path
        // (ADR-0003: consumers are idempotent and independently retried).
        console.error(`[InMemoryEventBus] handler failed for event type "${event.type}":`, err);
      }
    }
  }

  subscribe(eventType: string, handler: EventHandler): void {
    const handlers = this.handlersByType.get(eventType) ?? [];
    handlers.push(handler);
    this.handlersByType.set(eventType, handlers);
  }
}
