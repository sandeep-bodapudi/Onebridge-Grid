import crypto from 'node:crypto';

/**
 * F10 AC-6 / ADR-0003 point 5: "An outbox worker calls [web-public] over
 * HTTPS: signed requests (HMAC with timestamp, 5 minute tolerance),
 * retried with exponential backoff, idempotent by eventId." Target:
 * `POST /api/revalidate` on web-public.
 *
 * apps/web-public does not exist yet (it is scaffolded in F12). Until
 * then HttpRevalidationNotifier is unused in practice; FakeRevalidationNotifier
 * is the adapter used in dev and tests, per AGENTS.md section 4 ("external
 * providers sit behind interfaces with a fake adapter for local and tests").
 */
export interface RevalidationNotifier {
  revalidateCard(input: { cardId: string; slug: string; tenantId: string }): Promise<void>;
}

export class FakeRevalidationNotifier implements RevalidationNotifier {
  public calls: Array<{ cardId: string; slug: string; tenantId: string }> = [];
  public shouldFail = false;

  async revalidateCard(input: { cardId: string; slug: string; tenantId: string }): Promise<void> {
    if (this.shouldFail) throw new Error('Fake revalidation failure');
    this.calls.push(input);
  }
}

export class HttpRevalidationNotifier implements RevalidationNotifier {
  constructor(
    private readonly webPublicUrl: string,
    private readonly signingSecret: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async revalidateCard(input: { cardId: string; slug: string; tenantId: string }): Promise<void> {
    const timestamp = Date.now().toString();
    const body = JSON.stringify({ path: `/c/${input.slug}`, cardId: input.cardId, tenantId: input.tenantId });
    const signature = crypto
      .createHmac('sha256', this.signingSecret)
      .update(`${timestamp}.${body}`)
      .digest('hex');

    const maxAttempts = 3;
    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const res = await this.fetchImpl(`${this.webPublicUrl}/api/revalidate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Signature': signature,
            'X-Timestamp': timestamp,
          },
          body,
        });
        if (!res.ok) {
          throw new Error(`revalidate responded with status ${res.status}`);
        }
        return;
      } catch (err) {
        lastError = err;
        if (attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 200));
        }
      }
    }
    console.error('[HttpRevalidationNotifier] revalidate failed after retries:', lastError);
  }
}
