// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { axe } from 'jest-axe';
import { apiClient, AuthApiError } from '../../api-client';
import { SignIn } from './SignIn';
import { SignUp } from './SignUp';
import { ResetPasswordForm } from './ResetPasswordForm';
import { authErrorText } from './auth-errors';

const EMAIL_ONLY = { methods: ['email' as const] };
const DEV = { methods: ['google' as const, 'email' as const, 'phone' as const], googleClientId: 'client-123' };

afterEach(() => vi.restoreAllMocks());

function typeInto(label: RegExp | string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function enterCode(code: string) {
  code.split('').forEach((d, i) => fireEvent.change(screen.getByLabelText(`Digit ${i + 1}`), { target: { value: d } }));
}

describe('D-AUTH-EMAIL sign-in screen (A8)', () => {
  it('signs in with email and password', async () => {
    const login = vi.spyOn(apiClient, 'loginWithPassword').mockResolvedValue({ status: 'authenticated', accessToken: 't' });
    const onSignedIn = vi.fn();
    render(<SignIn methods={EMAIL_ONLY} onSignedIn={onSignedIn} onMfa={vi.fn()} />);
    typeInto('Email', 'meera@example.com');
    typeInto('Password', 'a long enough passphrase');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    expect(login).toHaveBeenCalledWith('meera@example.com', 'a long enough passphrase');
  });

  it('checks fields before sending and moves focus to the first problem', () => {
    const login = vi.spyOn(apiClient, 'loginWithPassword');
    render(<SignIn methods={EMAIL_ONLY} onSignedIn={vi.fn()} onMfa={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(login).not.toHaveBeenCalled();
    expect(screen.getByText('Enter your email.')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText('Email'));
    expect(screen.getByLabelText('Email').getAttribute('aria-describedby')).toContain('error');
    typeInto('Email', 'meera@');
    expect(screen.queryByText('Enter your email.')).toBeNull();
  });

  it('shows a blame-free message for wrong credentials and the wait time when limited', async () => {
    vi.spyOn(apiClient, 'loginWithPassword')
      .mockRejectedValueOnce(new AuthApiError('x', 401, 'invalid_credentials'))
      .mockRejectedValueOnce(new AuthApiError('x', 429, 'rate_limited', 600));
    render(<SignIn methods={EMAIL_ONLY} onSignedIn={vi.fn()} onMfa={vi.fn()} />);
    typeInto('Email', 'meera@example.com');
    typeInto('Password', 'wrong passphrase');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText("That email and password don't match. Try again, or reset your password.")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Too many tries. Wait 10 minutes, then try again.')).toBeTruthy();
  });

  it('asks a new device for the emailed code, then signs in', async () => {
    vi.spyOn(apiClient, 'loginWithPassword').mockResolvedValue({ status: 'code_required', ticket: 'tk', maskedEmail: 'm•••@example.com' });
    const verify = vi.spyOn(apiClient, 'verifyLoginCode').mockResolvedValue({ status: 'authenticated', accessToken: 't' });
    const onSignedIn = vi.fn();
    render(<SignIn methods={EMAIL_ONLY} onSignedIn={onSignedIn} onMfa={vi.fn()} />);
    typeInto('Email', 'meera@example.com');
    typeInto('Password', 'a long enough passphrase');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('m•••@example.com')).toBeTruthy();
    enterCode('482913');
    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    expect(verify).toHaveBeenCalledWith('tk', '482913');
  });

  it('hands MFA to the caller', async () => {
    vi.spyOn(apiClient, 'loginWithPassword').mockResolvedValue({ status: 'mfa_required', mfaTicket: 'mfa-1' });
    const onMfa = vi.fn();
    render(<SignIn methods={EMAIL_ONLY} onSignedIn={vi.fn()} onMfa={onMfa} />);
    typeInto('Email', 'owner@example.com');
    typeInto('Password', 'a long enough passphrase');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(onMfa).toHaveBeenCalledWith('mfa_required', 'mfa-1'));
  });

  it('shows phone sign-in only when the server lists phone', () => {
    const { unmount } = render(<SignIn methods={EMAIL_ONLY} onSignedIn={vi.fn()} onMfa={vi.fn()} onUsePhone={vi.fn()} />);
    expect(screen.queryByTestId('use-phone')).toBeNull();
    expect(screen.queryByTestId('google-button')).toBeNull();
    unmount();
    render(<SignIn methods={DEV} onSignedIn={vi.fn()} onMfa={vi.fn()} onUsePhone={vi.fn()} />);
    expect(screen.getByTestId('use-phone')).toBeTruthy();
    expect(screen.getByTestId('google-button')).toBeTruthy();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<SignIn methods={EMAIL_ONLY} onSignedIn={vi.fn()} onMfa={vi.fn()} />);
    expect((await axe(container)).violations).toEqual([]);
  });
});

describe('D-AUTH-EMAIL sign-up screen (A8)', () => {
  it('creates the account, then verifies the emailed code', async () => {
    const signup = vi.spyOn(apiClient, 'signup').mockResolvedValue({ status: 'code_sent', ticket: 'tk', maskedEmail: 'r•••@example.com' });
    vi.spyOn(apiClient, 'verifySignup').mockResolvedValue({ status: 'authenticated', accessToken: 't' });
    const onSignedIn = vi.fn();
    render(<SignUp methods={EMAIL_ONLY} onSignedIn={onSignedIn} onMfa={vi.fn()} termsHref="/terms" privacyHref="/privacy" />);
    typeInto('Your name', 'Ravi Kumar');
    typeInto('Email', 'ravi@example.com');
    typeInto('Password', 'a long enough passphrase');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('r•••@example.com')).toBeTruthy();
    expect(signup.mock.calls[0][0]).toMatchObject({ name: 'Ravi Kumar', email: 'ravi@example.com', acceptedTermsVersion: expect.any(String), acceptedPrivacyVersion: expect.any(String) });
    enterCode('111222');
    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
  });

  it('needs consent and a 10-character password', () => {
    const signup = vi.spyOn(apiClient, 'signup');
    render(<SignUp methods={EMAIL_ONLY} onSignedIn={vi.fn()} onMfa={vi.fn()} termsHref="/terms" privacyHref="/privacy" />);
    typeInto('Your name', 'Ravi');
    typeInto('Email', 'ravi@example.com');
    typeInto('Password', 'short');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(signup).not.toHaveBeenCalled();
    expect(screen.getByText('Use at least 10 characters.')).toBeTruthy();
    expect(screen.getByText('Accept the terms and the privacy policy to continue.')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText('Password'));
  });

  it('links the terms and the privacy policy, and has no accessibility violations', async () => {
    const { container } = render(<SignUp methods={EMAIL_ONLY} onSignedIn={vi.fn()} onMfa={vi.fn()} termsHref="https://onebridgecard.com/terms" privacyHref="https://onebridgecard.com/privacy" />);
    expect(screen.getByRole('link', { name: 'Terms of Service' }).getAttribute('href')).toBe('https://onebridgecard.com/terms');
    expect(screen.getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')).toBe('https://onebridgecard.com/privacy');
    expect((await axe(container)).violations).toEqual([]);
  });
});

describe('D-AUTH-EMAIL code step and reset (A8)', () => {
  it('counts down 60 seconds before offering a new code', async () => {
    vi.useFakeTimers();
    try {
      const resend = vi.fn().mockResolvedValue({});
      render(<ResetPasswordForm requestCode={vi.fn().mockResolvedValue({ status: 'code_sent', ticket: 'tk', maskedEmail: 'm•••@example.com' })} resendCode={resend} resetPassword={vi.fn()} />);
      typeInto('Email', 'meera@example.com');
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
      });
      expect(screen.getByText('Resend code in 60s')).toBeTruthy();
      for (let i = 0; i < 60; i++) await act(async () => void vi.advanceTimersByTime(1000));
      fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));
      expect(resend).toHaveBeenCalledWith('tk');
    } finally {
      vi.useRealTimers();
    }
  });

  it('resets the password and says every device was signed out', async () => {
    const reset = vi.fn().mockResolvedValue(undefined);
    render(<ResetPasswordForm requestCode={vi.fn().mockResolvedValue({ status: 'code_sent', ticket: 'tk', maskedEmail: 'm•••@example.com' })} resendCode={vi.fn()} resetPassword={reset} />);
    typeInto('Email', 'meera@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await screen.findByText('m•••@example.com');
    enterCode('123456');
    typeInto('New password', 'a brand new passphrase');
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(await screen.findByText(/every device that was signed in has been signed out/)).toBeTruthy();
    expect(reset).toHaveBeenCalledWith('tk', '123456', 'a brand new passphrase');
  });

  it('goes back to the code when the code was wrong', async () => {
    const reset = vi.fn().mockRejectedValue(new AuthApiError('x', 400, 'code_invalid'));
    render(<ResetPasswordForm requestCode={vi.fn().mockResolvedValue({ status: 'code_sent', ticket: 'tk', maskedEmail: 'm•••@example.com' })} resendCode={vi.fn()} resetPassword={reset} />);
    typeInto('Email', 'meera@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await screen.findByText('m•••@example.com');
    enterCode('000000');
    typeInto('New password', 'a brand new passphrase');
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(await screen.findByText("That code isn't right. Check the email and try again.")).toBeTruthy();
    expect(screen.getByTestId('code-step')).toBeTruthy();
  });

  it('turns each problem code into plain text', () => {
    expect(authErrorText(new AuthApiError('x', 400, 'code_expired'))).toBe('This code has expired. Ask for a new one.');
    expect(authErrorText(new AuthApiError('x', 400, 'too_many_attempts'))).toBe('Too many wrong codes. Ask for a new one.');
    expect(authErrorText(new AuthApiError('x', 429, 'rate_limited', 30))).toBe('Wait 30 seconds, then try again.');
    expect(authErrorText(new AuthApiError('Use at least 10 characters.', 400, 'weak_password'))).toBe('Use at least 10 characters.');
  });
});
