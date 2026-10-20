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
