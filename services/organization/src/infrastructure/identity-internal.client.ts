import { Role } from '@onebridge/shared';

export interface CreateMembershipInternalRequest {
  personId: string;
  orgId: string;
  role: Role;
  /** F14 seat claim: keep an existing membership instead of changing its role. */
  onlyIfAbsent?: boolean;
  idempotencyKey?: string;
  correlationId?: string;
}

export interface IdentityInternalClient {
  createMembership(req: CreateMembershipInternalRequest): Promise<{ id: string; role: Role }>;
  /** F14: verified phone (E.164) and email of a person. Null when the person does not exist. */
  getPersonContacts(personId: string): Promise<{ phone?: string; email?: string } | null>;
}

export class HttpIdentityInternalClient implements IdentityInternalClient {
  constructor(
    private readonly identityBaseUrl: string,
    private readonly serviceKey: string
  ) {}

  async createMembership(req: CreateMembershipInternalRequest): Promise<{ id: string; role: Role }> {
    const url = `${this.identityBaseUrl.replace(/\/$/, '')}/internal/memberships`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-service-key': this.serviceKey,
    };
    if (req.idempotencyKey) {
      headers['idempotency-key'] = req.idempotencyKey;
    }
    if (req.correlationId) {
      headers['x-correlation-id'] = req.correlationId;
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          personId: req.personId,
          orgId: req.orgId,
          role: req.role,
          onlyIfAbsent: req.onlyIfAbsent === true || undefined,
        }),
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => '');
        throw new Error(`Identity service returned HTTP ${res.status}: ${errorBody}`);
      }

      return (await res.json()) as { id: string; role: Role };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to call Identity internal API: ${msg}`, { cause: err });
    }
  }

  async getPersonContacts(personId: string): Promise<{ phone?: string; email?: string } | null> {
    const url = `${this.identityBaseUrl.replace(/\/$/, '')}/internal/persons/${encodeURIComponent(personId)}/contacts`;
    const res = await fetch(url, { headers: { 'x-service-key': this.serviceKey } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Identity service returned HTTP ${res.status} for person contacts`);
    return (await res.json()) as { phone?: string; email?: string };
  }
}
