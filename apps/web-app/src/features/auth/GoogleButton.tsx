import React, { useEffect, useRef, useState } from 'react';

const GIS_SRC = 'https://accounts.google.com/gsi/client';

interface GoogleIdentity {
  accounts: {
    id: {
      initialize(options: { client_id: string; callback: (res: { credential?: string }) => void; ux_mode?: 'popup'; cancel_on_tap_outside?: boolean }): void;
      renderButton(el: HTMLElement, options: Record<string, unknown>): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

let gisLoad: Promise<void> | null = null;

/** Loads Google Identity Services once, and only on the sign-in pages that render this button. */
function loadGis(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.google?.accounts?.id) return Promise.resolve();
  gisLoad ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisLoad = null;
      reject(new Error('Google script failed to load'));
    };
    document.head.appendChild(script);
  });
  return gisLoad;
}

export interface GoogleButtonProps {
  clientId: string;
  /** Called with the Google ID token (credential). */
  onCredential: (idToken: string) => void;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
  disabled?: boolean;
}

/** D-AUTH-EMAIL: "Continue with Google" rendered by Google itself; the token goes to /auth/oauth/google. */
export const GoogleButton: React.FC<GoogleButtonProps> = ({ clientId, onCredential, text = 'continue_with', disabled }) => {
  const host = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  callback.current = onCredential;
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGis()
      .then(() => {
        if (cancelled || !host.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          ux_mode: 'popup',
          cancel_on_tap_outside: true,
          callback: (res) => {
            if (res.credential) callback.current(res.credential);
          },
        });
        const width = Math.min(400, Math.max(200, host.current.offsetWidth || 320));
        window.google.accounts.id.renderButton(host.current, { type: 'standard', theme: 'outline', size: 'large', text, shape: 'rectangular', width });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, text]);

  if (failed) {
    return (
      <p data-testid="google-unavailable" className="text-sm text-charcoal/70 dark:text-warm-paper/70">
        Google sign-in isn&apos;t available right now. Use your email and password below.
      </p>
    );
  }
  return (
    <div
      ref={host}
      data-testid="google-button"
      aria-busy={!ready}
      className={`min-h-[44px] w-full flex justify-center ${disabled ? 'pointer-events-none opacity-50' : ''}`}
    />
  );
};
