export interface TurnstileValidator {
  validateToken(token: string | undefined, clientIp: string): Promise<boolean>;
}

export class BypassTurnstileValidator implements TurnstileValidator {
  constructor(private readonly allowEmptyInNonProd = true) {}

  async validateToken(token: string | undefined, _clientIp: string): Promise<boolean> {
    if (token === 'turnstile-test-fail') {
      return false;
    }
    if (token === 'turnstile-test-pass') {
      return true;
    }
    if (!token && this.allowEmptyInNonProd) {
      return true;
    }
    // Any other token in test/dev
    return Boolean(token);
  }
}

export class CloudflareTurnstileValidator implements TurnstileValidator {
  constructor(private readonly secretKey: string) {}

  async validateToken(token: string | undefined, clientIp: string): Promise<boolean> {
    if (!token) {
      return false;
    }

    try {
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: this.secretKey,
          response: token,
          remoteip: clientIp,
        }),
      });

      if (!response.ok) {
        return false;
      }

      const outcome = (await response.json()) as { success: boolean };
      return outcome.success === true;
    } catch {
      return false;
    }
  }
}

/**
 * D-VPS-DEPLOY B1: production without TURNSTILE_SECRET. The card page has no Turnstile widget yet,
 * so share-backs rely on the per-network and per-card rate limits. The test tokens mean nothing here.
 */
export class RateLimitOnlyTurnstileValidator implements TurnstileValidator {
  private warned = false;

  async validateToken(_token: string | undefined, _clientIp: string): Promise<boolean> {
    if (!this.warned) {
      this.warned = true;
      console.warn(JSON.stringify({ level: 'warn', message: 'Turnstile is off (no TURNSTILE_SECRET): share-backs rely on rate limits only' }));
    }
    return true;
  }
}

/** Cloudflare when TURNSTILE_SECRET is set; rate limits only in production otherwise; the test bypass elsewhere. */
export function selectTurnstileValidator(nodeEnv: string, secret: string | undefined): TurnstileValidator {
  if (secret) return new CloudflareTurnstileValidator(secret);
  return nodeEnv === 'production' ? new RateLimitOnlyTurnstileValidator() : new BypassTurnstileValidator();
}
