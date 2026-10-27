'use client';

import React from 'react';
import { AuthShell } from '../../src/features/auth/AuthShell';
import { ResetPasswordForm } from '../../src/features/auth/ResetPasswordForm';
import { apiClient } from '../../src/api-client';

/** D-AUTH-EMAIL: forgot password: email, code, new password; every device is then signed out. */
export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 md:p-8 bg-sand/30 dark:bg-charcoal-deep text-charcoal dark:text-warm-paper">
      <div className="w-full max-w-4xl">
        <AuthShell>
          <ResetPasswordForm
            requestCode={(email) => apiClient.forgotPassword(email)}
            resendCode={(ticket) => apiClient.resendCode(ticket)}
            resetPassword={(ticket, code, password) => apiClient.resetPassword(ticket, code, password)}
          />
        </AuthShell>
      </div>
    </main>
  );
}
