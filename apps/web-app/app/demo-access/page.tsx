'use client';

import React, { useState } from 'react';
import { Button, Input, SpanLine, SpanMark } from '@onebridge/ui-kit';

/** Passcode screen for the hosted prototype dashboard (D-DEMO-HOSTING). */
export default function DemoAccessPage() {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setError('Enter the passcode from your invite.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/demo-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; detail?: string };
      if (!res.ok || !data.ok) {
        setError(data.detail || 'That passcode is not right. Check the invite and try again.');
        return;
      }
      // Full page load: the client router cached /login as a redirect to this page
      // (from before the cookie existed), so router.push would bounce straight back here.
      window.location.assign('/login');
    } catch {
      setError('Could not reach the demo. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-warm-paper dark:bg-charcoal-deep">
      <form onSubmit={submit} noValidate className="w-full max-w-sm space-y-5">
        <div className="flex items-center gap-3">
          <SpanMark />
          <span className="font-bold text-sm">OneBridge Grid</span>
        </div>
        <div>
          <h1 className="text-xl font-bold">Prototype preview</h1>
          <p className="text-sm text-charcoal/70 dark:text-warm-paper/70 mt-1">
            Enter the passcode from your invite to open the demo dashboard. All companies and people in it are fictional.
          </p>
        </div>
        <SpanLine className="my-0" />
        <div className="space-y-1">
          <label htmlFor="demo-passcode" className="block text-sm font-semibold">
            Passcode
          </label>
          <Input
            id="demo-passcode"
            type="password"
            autoComplete="off"
            autoFocus
            value={passcode}
            hasError={Boolean(error)}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? 'demo-passcode-error' : undefined}
            onChange={(e) => {
              setPasscode(e.target.value);
              if (error) setError(null);
            }}
          />
          {error ? (
            <p id="demo-passcode-error" className="text-sm text-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <Button type="submit" variant="primary" isFullWidth isLoading={busy}>
          Open the demo
        </Button>
      </form>
    </main>
  );
}
