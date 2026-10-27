import React, { useEffect, useState } from 'react';
import { AuthMethodsResponse, CodeSentResponse, SignInResponse, apiClient } from '../../api-client';
import { AuthShell } from './AuthShell';
import { CodeStep } from './CodeStep';
import { FormError } from './fields';
import { GoogleButton } from './GoogleButton';
import { SignupForm } from './SignupForm';
import { PRIVACY_VERSION, TERMS_VERSION, authErrorText } from './auth-errors';

export interface SignUpProps {
  onSignedIn: () => void;
  onMfa: (status: 'mfa_required' | 'mfa_setup_required', mfaTicket?: string) => void;
  termsHref: string;
  privacyHref: string;
  signInHref?: string;
  methods?: AuthMethodsResponse;
}

/** D-AUTH-EMAIL (VPS plan A8): create an account with Google, or with email, password and an emailed code. */
export const SignUp: React.FC<SignUpProps> = ({ onSignedIn, onMfa, termsHref, privacyHref, signInHref = '/login', methods: given }) => {
  const [methods, setMethods] = useState<AuthMethodsResponse | null>(given ?? null);
  const [sent, setSent] = useState<CodeSentResponse | null>(null);
  const [linkTicket, setLinkTicket] = useState<{ ticket: string; maskedEmail: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!given) void apiClient.getAuthMethods().then(setMethods);
  }, [given]);

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

  const handle = (res: SignInResponse) => {
    if (res.status === 'authenticated') return onSignedIn();
    if (res.status === 'mfa_required' || res.status === 'mfa_setup_required') return onMfa(res.status, res.mfaTicket);
    if (res.status === 'link_confirmation_required' && res.linkTicket) return setLinkTicket({ ticket: res.linkTicket, maskedEmail: res.maskedEmail ?? 'your email' });
    setError('Something went wrong. Try again.');
  };

  const google = methods?.methods.includes('google') && methods.googleClientId;
  const email = methods?.methods.includes('email');
  const code = linkTicket ?? (sent ? { ticket: sent.ticket, maskedEmail: sent.maskedEmail } : null);

  return (
    <AuthShell>
      {code ? (
        <CodeStep
          title={linkTicket ? 'Confirm it’s your account' : 'Check your email'}
          maskedEmail={code.maskedEmail}
          error={error}
          isLoading={busy}
          backLabel={linkTicket ? 'Back' : 'Use a different email'}
          onVerify={(c) => void run(async () => handle(linkTicket ? await apiClient.confirmGoogleLink(code.ticket, c) : await apiClient.verifySignup(code.ticket, c)))}
          onResend={() => void run(async () => void (await apiClient.resendCode(code.ticket)))}
          onBack={() => {
            setError(null);
            setSent(null);
            setLinkTicket(null);
          }}
        />
      ) : (
        <div className="flex flex-col gap-5" data-testid="sign-up">
          <div>
            <h1 className="font-body text-xl font-bold text-charcoal dark:text-warm-paper tracking-tight">Create your OneBridge account</h1>
            <p className="text-sm text-charcoal/80 dark:text-warm-paper/80 mt-1">
              Already have one?{' '}
              <a href={signInHref} className="font-semibold underline underline-offset-2">
                Sign in
              </a>
            </p>
          </div>
          <FormError message={error} />
          {google ? <GoogleButton clientId={methods!.googleClientId!} text="signup_with" disabled={busy} onCredential={(t) => void run(async () => handle(await apiClient.loginWithGoogle(t)))} /> : null}
          {google && email ? (
            <div className="flex items-center gap-3 text-xs text-charcoal/60 dark:text-warm-paper/60" aria-hidden="true">
              <span className="h-px flex-1 bg-sand-border dark:bg-sand-border/30" />
              or
              <span className="h-px flex-1 bg-sand-border dark:bg-sand-border/30" />
            </div>
          ) : null}
          {email ? (
            <SignupForm
              isLoading={busy}
              termsHref={termsHref}
              privacyHref={privacyHref}
              onSubmit={(v) =>
                void run(async () => setSent(await apiClient.signup({ ...v, acceptedTermsVersion: TERMS_VERSION, acceptedPrivacyVersion: PRIVACY_VERSION })))
              }
            />
          ) : null}
        </div>
      )}
    </AuthShell>
  );
};
