'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Link2Off, ShieldCheck } from 'lucide-react';
import { Button, Input, SpanMark } from '@onebridge/ui-kit';
import type { InvitePreview } from '@onebridge/api-contracts';
import { apiClient } from '../../../src/api-client';

type Step = 'loading' | 'closed' | 'welcome' | 'verify' | 'notice' | 'declined' | 'done';

const CLOSED_COPY: Record<string, { icon: React.ReactNode; title: string; body: string }> = {
  invalid: { icon: <Link2Off className="w-6 h-6" aria-hidden="true" />, title: 'This link does not work', body: 'Check that you opened the whole link, or ask your admin to send the invite again.' },
  claimed: { icon: <CheckCircle2 className="w-6 h-6" aria-hidden="true" />, title: 'This invite has been used', body: 'The card is already claimed. If it is yours, sign in to open it.' },
  revoked: { icon: <Link2Off className="w-6 h-6" aria-hidden="true" />, title: 'This invite was cancelled', body: 'Ask your admin for a new invite.' },
  expired: { icon: <Clock className="w-6 h-6" aria-hidden="true" />, title: 'This invite has expired', body: 'Invites work for 7 days. Ask your admin to send it again.' },
};

const panel = 'rounded-[18px] bg-charcoal border border-white/[0.08] p-6 sm:p-7';

/** F14: the invitee confirms their number or email, accepts the privacy notice and claims the seat. */
export default function InvitePage({ params }: { params: { token: string } }) {
  const { token } = params;
  const [step, setStep] = useState<Step>('loading');
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [closedStatus, setClosedStatus] = useState('invalid');
  const [contact, setContact] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<'en' | 'hi'>('en');
  const [result, setResult] = useState<{ companyName: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getInvite(token)
      .then((preview) => {
        if (cancelled) return;
        setInvite(preview);
        if (preview.status !== 'pending') {
          setClosedStatus(preview.status);
          setStep('closed');
        } else {
          setStep('welcome');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setClosedStatus('invalid');
          setStep('closed');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const isEmail = invite?.channel === 'email';

  const startVerify = async () => {
    setError(null);
    // Already signed in on this device: go straight to the notice; the server checks it is the right person.
    if (apiClient.getAccessToken() || (await apiClient.silentRefresh().catch(() => null))) {
      setStep('notice');
      return;
    }
    setStep('verify');
  };

  const sendCode = async () => {
    setError(null);
    if (!contact.trim()) {
      setError(isEmail ? 'Enter your email address.' : 'Enter your mobile number.');
      return;
    }
    setBusy(true);
    try {
      if (isEmail) await apiClient.requestEmailOtp(contact.trim());
      else await apiClient.requestOtp(contact.trim());
      setCodeSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the code. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code.');
      return;
    }
    setBusy(true);
    try {
      const res = isEmail ? await apiClient.verifyEmailOtp(contact.trim(), code.trim()) : await apiClient.verifyOtp(contact.trim(), code.trim());
      if (res.status !== 'authenticated') {
        setError('Your account needs two-step verification. Sign in on the sign-in page first, then open this link again.');
        return;
      }
      setStep('notice');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code is not right. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const accept = async () => {
    if (!invite?.notice) return;
    setError(null);
    setBusy(true);
    try {
      const claimed = await apiClient.claimInvite(token, { acceptNotice: true, noticeVersion: invite.notice.version });
      setResult({ companyName: claimed.companyName });
      setStep('done');
    } catch (err) {
      const e = err as Error & { code?: string };
      if (e.code === 'wrong_person') {
        // Signed in as someone else: sign out and let them confirm the invited contact.
        await apiClient.logout().catch(() => undefined);
        setCodeSent(false);
        setCode('');
        setContact('');
        setStep('verify');
        setError(e.message);
      } else if (e.code === 'claimed' || e.code === 'revoked' || e.code === 'expired' || e.code === 'invalid') {
        setClosedStatus(e.code);
        setStep('closed');
      } else {
        setError(e.message || 'Could not claim the card. Try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const errorBox = error ? (
    <p role="alert" className="flex items-start gap-2 text-sm px-3 py-3 rounded-[10px] bg-error/15 border border-error/40">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
      {error}
    </p>
  ) : null;

  const notice = invite?.notice?.[lang];

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-charcoal-deep text-warm-paper">
      <div className="w-full max-w-md space-y-5">
        <div className="flex items-center gap-2.5 font-bold">
          <SpanMark />
          OneBridge Grid
        </div>

        {step === 'loading' ? (
          <div className={`${panel} space-y-3`} aria-busy="true">
            <div className="h-6 w-2/3 rounded bg-white/10 animate-pulse motion-reduce:animate-none" />
            <div className="h-4 w-full rounded bg-white/10 animate-pulse motion-reduce:animate-none" />
          </div>
        ) : null}

        {step === 'closed' ? (
          <div className={`${panel} space-y-3`} data-testid={`invite-${closedStatus}`}>
            <span className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">{CLOSED_COPY[closedStatus]?.icon}</span>
            <h1 className="text-xl font-bold">{CLOSED_COPY[closedStatus]?.title}</h1>
            <p className="text-sm text-warm-paper/70">{CLOSED_COPY[closedStatus]?.body}</p>
            {closedStatus === 'claimed' ? (
              <a href="/login" className="inline-flex min-h-[44px] items-center font-bold underline underline-offset-4">
                Sign in
              </a>
            ) : null}
          </div>
        ) : null}

        {step === 'welcome' && invite ? (
          <div className={`${panel} space-y-5`}>
            <div>
              <p className="text-sm text-warm-paper/60">You are invited to</p>
              <h1 className="text-2xl font-bold tracking-tight mt-1">{invite.companyName}</h1>
              <p className="text-warm-paper/80 mt-1">{invite.seatTitle}</p>
            </div>
            <p className="text-sm text-warm-paper/70">
              Your digital business card is waiting. Confirm it is you with the {isEmail ? 'email' : 'mobile number'} this invite was sent to:{' '}
              <span className="font-semibold text-warm-paper">{invite.contactMasked}</span>.
            </p>
            <Button variant="primary" isFullWidth onClick={startVerify}>
              Continue
            </Button>
          </div>
        ) : null}

        {step === 'verify' && invite ? (
          <form
            className={`${panel} space-y-4`}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void (codeSent ? verifyCode() : sendCode());
            }}
          >
            <h1 className="text-xl font-bold">Confirm it is you</h1>
            <p className="text-sm text-warm-paper/70">
              Use the {isEmail ? 'email' : 'number'} the invite was sent to ({invite.contactMasked}).
            </p>
            <div>
              <label htmlFor="invite-contact" className="block text-[13px] font-semibold text-warm-paper/80 mb-1">
                {isEmail ? 'Email address' : 'Mobile number'}
              </label>
              <Input
                id="invite-contact"
                type={isEmail ? 'email' : 'tel'}
                inputMode={isEmail ? 'email' : 'tel'}
                autoComplete={isEmail ? 'email' : 'tel'}
                placeholder={isEmail ? 'name@company.com' : '98765 43210'}
                value={contact}
                disabled={codeSent}
                onChange={(e) => setContact(e.target.value)}
              />
            </div>
            {codeSent ? (
              <div>
                <label htmlFor="invite-code" className="block text-[13px] font-semibold text-warm-paper/80 mb-1">
                  6-digit code
                </label>
                <Input
                  id="invite-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
                <p className="text-xs text-warm-paper/55 mt-1">In this demo the code is 123456.</p>
              </div>
            ) : null}
            {errorBox}
            <Button type="submit" variant="primary" isFullWidth isLoading={busy}>
              {codeSent ? 'Verify' : 'Send code'}
            </Button>
            {codeSent ? (
              <button
                type="button"
                className="w-full min-h-[44px] text-sm font-semibold underline underline-offset-4"
                onClick={() => {
                  setCodeSent(false);
                  setCode('');
                  setError(null);
                }}
              >
                Use a different {isEmail ? 'email' : 'number'}
              </button>
            ) : null}
          </form>
        ) : null}

        {step === 'notice' && notice ? (
          <div className={`${panel} space-y-5`} lang={lang}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-11 h-11 rounded-xl bg-bridge-orange flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-[#241A10]" aria-hidden="true" />
                </span>
                <h1 className="text-xl font-bold">{notice.title}</h1>
              </div>
              <button
                type="button"
                onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
                className="min-h-[44px] min-w-[44px] px-3 rounded-lg bg-white/10 text-xs font-bold hover:bg-white/15 shrink-0"
                aria-label={lang === 'en' ? 'Read in Hindi' : 'Read in English'}
              >
                {lang === 'en' ? 'हिन्दी' : 'EN'}
              </button>
            </div>
            <ul className="space-y-3 text-sm leading-relaxed text-warm-paper/85">
              {notice.points.map((point) => (
                <li key={point} className="flex gap-3">
                  <span aria-hidden="true" className="mt-2 w-1.5 h-1.5 rounded-full bg-bridge-orange shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
            {errorBox}
            <div className="space-y-2">
              <Button variant="primary" isFullWidth isLoading={busy} onClick={accept} data-testid="accept-notice">
                {notice.accept}
              </Button>
              <Button variant="ghost" isFullWidth onClick={() => setStep('declined')} className="border border-white/15">
                {notice.decline}
              </Button>
            </div>
          </div>
        ) : null}

        {step === 'declined' ? (
          <div className={`${panel} space-y-3`}>
            <h1 className="text-xl font-bold">You did not claim the card</h1>
            <p className="text-sm text-warm-paper/70">
              Nothing has changed. You can open this link again until{' '}
              {invite?.expiresAt ? new Date(invite.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' }) : 'it expires'} if you change your mind.
            </p>
            <Button variant="secondary" isFullWidth onClick={() => setStep('notice')}>
              Read the notice again
            </Button>
          </div>
        ) : null}

        {step === 'done' ? (
          <div className={`${panel} space-y-4`} data-testid="invite-done">
            <span className="w-12 h-12 rounded-xl bg-bridge-orange flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-[#241A10]" aria-hidden="true" />
            </span>
            <h1 className="text-xl font-bold">The card is yours</h1>
            <p className="text-sm text-warm-paper/70">
              Add your photo and details, check the preview and publish. {result?.companyName ? `${result.companyName} may need to approve it before it goes live.` : ''}
            </p>
            <Button variant="primary" isFullWidth onClick={() => window.location.assign('/dashboard#cards')}>
              Set up my card
            </Button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
