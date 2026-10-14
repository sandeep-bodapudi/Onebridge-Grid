import { Role } from '@onebridge/shared';

export interface CreateMembershipInternalRequest {
  personId: string;
  orgId: string;
  role: Role;
  idempotencyKey?: string;
  correlationId?: string;
}

export interface IdentityInternalClient {
  createMembership(req: CreateMembershipInternalRequest): Promise<{ id: string; role: Role }>;
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
}
