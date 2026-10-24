import { test, expect } from '@playwright/test';
import { generateTotp } from './totp-helper';

test.describe('E2E Login Flow - Seeded Owner with MFA (AC-8, AC-9)', () => {
  test('logs in seeded Owner with mandatory MFA using RFC 6238 TOTP helper', async ({
    page,
    context,
  }) => {
    // 1. Navigate to login page
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in to OneBridge' })).toBeVisible();

    // 2. Enter seeded Owner mobile number (+919876500001)
    const phoneInput = page.locator('#phone');
    await phoneInput.fill('+919876500001');

    const consentCheckbox = page.getByRole('checkbox');
    await consentCheckbox.check();

    // 3. Request OTP
    const sendOtpButton = page.getByRole('button', { name: 'Send Verification Code' });
    await sendOtpButton.click();

    // 4. Verify OTP step is presented
    await expect(page.getByRole('heading', { name: 'Enter 6-Digit Code' })).toBeVisible();

    // 5. Enter the dev fake OTP ('123456'). Filling the first box spreads the code across all six
    //    (the same path SMS autofill takes), and a complete code submits on its own.
    await page.getByLabel('Digit 1').fill('123456');

    // 6. Assert MFA Challenge step is rendered
    await expect(page.getByRole('heading', { name: 'Two-Factor Authentication' })).toBeVisible();

    // 7. Generate TOTP code from seeded secret (JBSWY3DPEHPK3PXP)
    const totpCode = generateTotp('JBSWY3DPEHPK3PXP');
    expect(totpCode).toHaveLength(6);

    // 8. Submit TOTP code
    const totpInput = page.locator('[data-testid="mfa-challenge-form"] input');
    await totpInput.fill(totpCode);

    const verifyMfaButton = page.locator('[data-testid="mfa-challenge-form"] button[type="submit"]');
    await verifyMfaButton.click();

    // 9. Assert dashboard transition
    await page.waitForURL('**/dashboard');
    await expect(page.getByTestId('dashboard-container')).toBeVisible();
    await expect(page.getByTestId('welcome-header')).toContainText('Aarav Patel');
    await expect(page.getByTestId('active-role')).toContainText('owner', { ignoreCase: true });

    // 10. Security Assertions:
    // a. Zero tokens in localStorage
    const localStorageData = await page.evaluate(() => {
      return {
        token: window.localStorage.getItem('token'),
        accessToken: window.localStorage.getItem('accessToken'),
        refreshToken: window.localStorage.getItem('refreshToken'),
      };
    });
    expect(localStorageData.token).toBeNull();
    expect(localStorageData.accessToken).toBeNull();
    expect(localStorageData.refreshToken).toBeNull();

    // b. Zero tokens in sessionStorage
    const sessionStorageData = await page.evaluate(() => {
      return {
        token: window.sessionStorage.getItem('token'),
        accessToken: window.sessionStorage.getItem('accessToken'),
        refreshToken: window.sessionStorage.getItem('refreshToken'),
      };
    });
    expect(sessionStorageData.token).toBeNull();
    expect(sessionStorageData.accessToken).toBeNull();
    expect(sessionStorageData.refreshToken).toBeNull();

    // c. HttpOnly SameSite=Lax refresh cookie
    const cookies = await context.cookies();
    const refreshCookie = cookies.find((c) => c.name === 'refreshToken');
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie?.httpOnly).toBe(true);
    expect(refreshCookie?.sameSite).toBe('Lax');
  });
});
