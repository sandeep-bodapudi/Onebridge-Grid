import React, { useEffect, useState } from 'react';
import { OfflineBanner } from '@onebridge/ui-kit';
import { AuthMethodsResponse, SignInResponse, apiClient } from '../../api-client';
import { AuthShell } from './AuthShell';
import { CodeStep } from './CodeStep';
import { EmailPasswordForm } from './EmailPasswordForm';
import { FormError } from './fields';
import { GoogleButton } from './GoogleButton';
import { authErrorText } from './auth-errors';

type Stage =
  | { kind: 'methods' }
  | { kind: 'code'; ticket: string; maskedEmail: string; link: boolean };

export interface SignInProps {
  /** After a session exists. */
  onSignedIn: () => void;
  /** Tokens that need TOTP (F01 AC-8) hand over to the existing MFA screens. */
  onMfa: (status: 'mfa_required' | 'mfa_setup_required', mfaTicket?: string) => void;
  /** Development only: the phone flow, shown when the server lists `phone`. */
  onUsePhone?: () => void;
  signupHref?: string;
  /** Tests pass the methods; otherwise they are fetched from identity. */
  methods?: AuthMethodsResponse;
}

/** D-AUTH-EMAIL (VPS plan A8): Continue with Google first, then email and password. */
export const SignIn: React.FC<SignInProps> = ({ onSignedIn, onMfa, onUsePhone, signupHref = '/signup', methods: given }) => {
  const [methods, setMethods] = useState<AuthMethodsResponse | null>(given ?? null);
  const [stage, setStage] = useState<Stage>({ kind: 'methods' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!given) void apiClient.getAuthMethods().then(setMethods);
  }, [given]);

  useEffect(() => {
    const update = () => setOffline(typeof navigator !== 'undefined' && navigator.onLine === false);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const handle = (res: SignInResponse) => {
    if (res.status === 'authenticated') return onSignedIn();
    if (res.status === 'mfa_required' || res.status === 'mfa_setup_required') return onMfa(res.status, res.mfaTicket);
    if (res.status === 'code_required' && res.ticket) return setStage({ kind: 'code', ticket: res.ticket, maskedEmail: res.maskedEmail ?? 'your email', link: false });
    if (res.status === 'link_confirmation_required' && res.linkTicket) {
      return setStage({ kind: 'code', ticket: res.linkTicket, maskedEmail: res.maskedEmail ?? 'your email', link: true });
    }
    setError('Something went wrong. Try again.');
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(authErrorText(err));
    } finally {
      setBusy(false);
    }
  };

  const google = methods?.methods.includes('google') && methods.googleClientId;
  const email = methods?.methods.includes('email');
  const phone = methods?.methods.includes('phone') && onUsePhone;

  return (
    <AuthShell>
      {offline ? (
        <div className="mb-4" data-testid="offline-banner">
          <OfflineBanner message="You're offline. Connect to the internet to sign in." />
        </div>
      ) : null}

      {stage.kind === 'code' ? (
        <CodeStep
          title={stage.link ? 'Confirm it’s your account' : 'Check your email'}
          maskedEmail={stage.maskedEmail}
          backLabel="Back to sign in"
          error={error}
          isLoading={busy}
          onVerify={(code) =>
            void run(async () => handle(stage.link ? await apiClient.confirmGoogleLink(stage.ticket, code) : await apiClient.verifyLoginCode(stage.ticket, code)))
          }
          onResend={() => void run(async () => void (await apiClient.resendCode(stage.ticket)))}
          onBack={() => {
            setError(null);
            setStage({ kind: 'methods' });
          }}
        />
      ) : (
        <div className="flex flex-col gap-5" data-testid="sign-in">
          <div>
            <h1 className="font-body text-xl font-bold text-charcoal dark:text-warm-paper tracking-tight">Sign in to OneBridge</h1>
            <p className="text-sm text-charcoal/80 dark:text-warm-paper/80 mt-1">
              New here?{' '}
              <a href={signupHref} className="font-semibold underline underline-offset-2">
                Create an account
              </a>
            </p>
          </div>

          <FormError message={error} />

          {methods === null ? (
            <p className="text-sm text-charcoal/70 dark:text-warm-paper/70" role="status">
              Loading sign-in options…
            </p>
          ) : null}

          {google ? <GoogleButton clientId={methods!.googleClientId!} disabled={busy} onCredential={(token) => void run(async () => handle(await apiClient.loginWithGoogle(token)))} /> : null}

          {google && email ? (
            <div className="flex items-center gap-3 text-xs text-charcoal/60 dark:text-warm-paper/60" aria-hidden="true">
              <span className="h-px flex-1 bg-sand-border dark:bg-sand-border/30" />
              or
              <span className="h-px flex-1 bg-sand-border dark:bg-sand-border/30" />
            </div>
          ) : null}

          {email ? <EmailPasswordForm isLoading={busy} onSubmit={(e, p) => void run(async () => handle(await apiClient.loginWithPassword(e, p)))} /> : null}

          {phone ? (
            <button type="button" onClick={onUsePhone} className="min-h-[44px] self-center text-sm font-semibold text-charcoal underline underline-offset-2 dark:text-warm-paper" data-testid="use-phone">
              Sign in with a phone code (development)
            </button>
          ) : null}
        </div>
      )}
    </AuthShell>
  );
};
