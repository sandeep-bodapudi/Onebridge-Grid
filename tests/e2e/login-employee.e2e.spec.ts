import { test, expect } from '@playwright/test';

test.describe('E2E Login Flow - Seeded Employee', () => {
  test('logs in seeded employee, enforces HttpOnly SameSite=Lax cookie, zero tokens in storage, and accesses dashboard', async ({
    page,
    context,
  }) => {
    // 1. Navigate to login page
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in to OneBridge' })).toBeVisible();

    // 2. Enter seeded employee mobile number and consent
    const phoneInput = page.locator('#phone');
    await phoneInput.fill('+919876500003');

    const consentCheckbox = page.getByRole('checkbox');
    await consentCheckbox.check();

    // 3. Request OTP
    const sendOtpButton = page.getByRole('button', { name: 'Send Verification Code' });
    await sendOtpButton.click();

    // 4. Verify OTP step is presented
    await expect(page.getByRole('heading', { name: 'Enter 6-Digit Code' })).toBeVisible();

    // 5. Submit dev fake OTP ('123456')
    const codeInput = page.getByPlaceholder('123456');
    await codeInput.fill('123456');

    const verifyButton = page.getByRole('button', { name: 'Verify & Continue' });
    await verifyButton.click();

    // 6. Assert dashboard transition
    await page.waitForURL('**/dashboard');
    await expect(page.getByTestId('dashboard-container')).toBeVisible();
    await expect(page.getByTestId('welcome-header')).toContainText('Rohan Verma');
    await expect(page.getByTestId('active-role')).toContainText('employee', { ignoreCase: true });

    // 7. Security Assertions:
    // a. No tokens in localStorage
    const localStorageData = await page.evaluate(() => {
      return {
        token: window.localStorage.getItem('token'),
        accessToken: window.localStorage.getItem('accessToken'),
        refreshToken: window.localStorage.getItem('refreshToken'),
        length: window.localStorage.length,
      };
    });
    expect(localStorageData.token).toBeNull();
    expect(localStorageData.accessToken).toBeNull();
    expect(localStorageData.refreshToken).toBeNull();

    // b. No tokens in sessionStorage
    const sessionStorageData = await page.evaluate(() => {
      return {
        token: window.sessionStorage.getItem('token'),
        accessToken: window.sessionStorage.getItem('accessToken'),
        refreshToken: window.sessionStorage.getItem('refreshToken'),
        length: window.sessionStorage.length,
      };
    });
    expect(sessionStorageData.token).toBeNull();
    expect(sessionStorageData.accessToken).toBeNull();
    expect(sessionStorageData.refreshToken).toBeNull();

    // c. Refresh token exists in HttpOnly, SameSite=Lax cookie
    const cookies = await context.cookies();
    const refreshCookie = cookies.find((c) => c.name === 'refreshToken');
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie?.httpOnly).toBe(true);
    expect(refreshCookie?.sameSite).toBe('Lax');

    // 8. Test sign out
    const signOutButton = page.getByTestId('logout-button');
    await signOutButton.click();
    await page.waitForURL('**/login');
  });
});
