'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SignUp } from '../../src/features/auth/SignUp';
import { apiClient } from '../../src/api-client';
import { nextFromLocation, safeNextPath, withNext } from '../../src/features/auth/next-path';

/** D-AUTH-EMAIL: create an account. MFA, when required, continues on the sign-in page. */
export default function SignupPage() {
  const router = useRouter();
  const [next, setNext] = useState<string | null>(null);
  useEffect(() => setNext(nextFromLocation()), []);
  return (
    <main className="min-h-screen flex items-center justify-center p-4 md:p-8 bg-sand/30 dark:bg-charcoal-deep text-charcoal dark:text-warm-paper">
      <div className="w-full max-w-4xl">
        <SignUp
          signInHref={withNext('/login', next)}
          onSignedIn={() => router.push(safeNextPath(next))}
          onMfa={() => router.push(withNext('/login', next))}
          termsHref={apiClient.publicPageUrl('/terms')}
          privacyHref={apiClient.publicPageUrl('/privacy')}
        />
      </div>
    </main>
  );
}
