import { describe, it, expect, vi } from 'vitest';
import { InMemoryEventBus, DomainEvent } from '../src/event-bus.js';

function makeEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    eventId: 'evt_1',
    type: 'org.created',
    version: '1.0.0',
    tenantId: 'tenant_1',
    occurredAt: new Date().toISOString(),
    correlationId: 'corr_1',
    aggregateVersion: 1,
    payload: { orgId: 'tenant_1' },
    ...overrides,
  };
}

describe('InMemoryEventBus', () => {
  it('delivers a published event to subscribers of that event type', async () => {
    const bus = new InMemoryEventBus();
    const handler = vi.fn();
    bus.subscribe('org.created', handler);

    const event = makeEvent();
    await bus.publish(event);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('does not deliver an event to subscribers of a different type', async () => {
    const bus = new InMemoryEventBus();
    const handler = vi.fn();
    bus.subscribe('seat.created', handler);

    await bus.publish(makeEvent({ type: 'org.created' }));

    expect(handler).not.toHaveBeenCalled();
  });

  it('delivers one event to multiple subscribers of the same type', async () => {
    const bus = new InMemoryEventBus();
    const first = vi.fn();
    const second = vi.fn();
    bus.subscribe('org.updated', first);
    bus.subscribe('org.updated', second);

    await bus.publish(makeEvent({ type: 'org.updated' }));

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('records every published event regardless of whether it has subscribers', async () => {
    const bus = new InMemoryEventBus();
    const event = makeEvent({ type: 'branch.archived' });

    await bus.publish(event);

    expect(bus.published).toHaveLength(1);
    expect(bus.published[0]).toEqual(event);
  });

  it('does not let one subscriber throwing stop another subscriber of the same event', async () => {
    const bus = new InMemoryEventBus();
    const failing = vi.fn().mockRejectedValue(new Error('boom'));
    const succeeding = vi.fn();
    bus.subscribe('seat.assigned', failing);
    bus.subscribe('seat.assigned', succeeding);

    await expect(bus.publish(makeEvent({ type: 'seat.assigned' }))).resolves.toBeUndefined();

    expect(failing).toHaveBeenCalledTimes(1);
    expect(succeeding).toHaveBeenCalledTimes(1);
  });

  it('ignores a published value that is not a domain event envelope, without throwing', async () => {
    const bus = new InMemoryEventBus();
    await expect(bus.publish({ notAnEvent: true })).resolves.toBeUndefined();
    await expect(bus.publish(null)).resolves.toBeUndefined();
    await expect(bus.publish('a string')).resolves.toBeUndefined();
  });

  it('subscribing after publish does not retroactively receive earlier events', async () => {
    const bus = new InMemoryEventBus();
    await bus.publish(makeEvent({ type: 'org.created' }));

    const lateHandler = vi.fn();
    bus.subscribe('org.created', lateHandler);

    expect(lateHandler).not.toHaveBeenCalled();
  });
});

describe('InMemoryEventBus memory', () => {
  it('keeps only the most recent 1000 events', async () => {
    const bus = new InMemoryEventBus();
    for (let i = 0; i < 1500; i++) await bus.publish({ type: 'x.happened', tenantId: 't', eventId: String(i) });
    expect(bus.published).toHaveLength(1000);
    expect((bus.published[999] as unknown as { eventId: string }).eventId).toBe('1499');
  });
});
