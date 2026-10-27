import { AuthApiError } from '../../api-client';

/** D-AUTH-EMAIL: the consent versions a sign-up records. Bump when the documents change. */
export const TERMS_VERSION = '2026-10-27';
export const PRIVACY_VERSION = '2026-10-27';

/** Plain, blame-free text for each identity problem code. */
export function authErrorText(err: unknown): string {
  if (!(err instanceof AuthApiError)) return err instanceof Error ? err.message : 'Something went wrong. Try again.';
  switch (err.code) {
    case 'invalid_credentials':
      return "That email and password don't match. Try again, or reset your password.";
    case 'rate_limited': {
      const minutes = Math.max(1, Math.ceil((err.retryAfterSeconds ?? 60) / 60));
      return err.retryAfterSeconds && err.retryAfterSeconds < 60
        ? `Wait ${err.retryAfterSeconds} seconds, then try again.`
        : `Too many tries. Wait ${minutes} minute${minutes === 1 ? '' : 's'}, then try again.`;
    }
    case 'code_invalid':
      return "That code isn't right. Check the email and try again.";
    case 'code_expired':
      return 'This code has expired. Ask for a new one.';
    case 'too_many_attempts':
      return 'Too many wrong codes. Ask for a new one.';
    case 'method_disabled':
      return 'This way of signing in is turned off. Use another one.';
    case 'email_failed':
      return "We couldn't send the email just now. Try again in a minute.";
    case 'offline':
      return "Can't reach OneBridge. Check your connection and try again.";
    default:
      return err.message;
  }
}

export function isCodeProblem(err: unknown): boolean {
  return err instanceof AuthApiError && ['code_invalid', 'code_expired', 'too_many_attempts'].includes(err.code ?? '');
}
