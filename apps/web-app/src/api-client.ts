export interface AuthState {
  accessToken: string | null;
  user: Record<string, unknown> | null;
}

// In-memory token storage (Rule: NEVER put tokens or lead data in localStorage or sessionStorage)
let inMemoryAccessToken: string | null = null;
let inMemoryActiveTenantId: string | null = null;

const IDENTITY_API_URL = process.env.NEXT_PUBLIC_IDENTITY_API_URL || 'http://localhost:4001';

export const apiClient = {
  getAccessToken(): string | null {
    return inMemoryAccessToken;
  },

  setAccessToken(token: string | null): void {
    inMemoryAccessToken = token;
  },

  setActiveTenantId(tenantId: string | null): void {
    inMemoryActiveTenantId = tenantId;
  },

  clear(): void {
    inMemoryAccessToken = null;
    inMemoryActiveTenantId = null;
  },

  async silentRefresh(): Promise<string | null> {
    try {
      const res = await fetch(`${IDENTITY_API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'onebridge-csrf-token',
        },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.accessToken) {
          inMemoryAccessToken = data.accessToken;
          return data.accessToken;
        }
      }
    } catch {
      // Silent refresh failure is normal on first visit without cookie
    }
    return null;
  },

  async requestOtp(phone: string): Promise<{ message: string; cooldownSeconds?: number }> {
    const res = await fetch(`${IDENTITY_API_URL}/auth/otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'onebridge-csrf-token',
      },
      body: JSON.stringify({ phone }),
      credentials: 'include',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to request OTP');
    }
    return res.json();
  },

  async verifyOtp(
    phone: string,
    code: string,
    deviceLabel = 'Browser'
  ): Promise<{ status: string; accessToken?: string; mfaTicket?: string }> {
    const res = await fetch(`${IDENTITY_API_URL}/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'onebridge-csrf-token',
      },
      body: JSON.stringify({ phone, code, deviceLabel }),
      credentials: 'include',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Invalid OTP code');
    }

    const data = await res.json();
    if (data.accessToken) {
      inMemoryAccessToken = data.accessToken;
    }
    return data;
  },

  async verifyMfa(code: string, mfaTicket?: string): Promise<{ accessToken: string }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-CSRF-Token': 'onebridge-csrf-token',
    };
    if (inMemoryAccessToken) {
      headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
    }

    const res = await fetch(`${IDENTITY_API_URL}/auth/mfa/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code, mfaTicket }),
      credentials: 'include',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Invalid TOTP code');
    }

    const data = await res.json();
    if (data.accessToken) {
      inMemoryAccessToken = data.accessToken;
    }
    return data;
  },

  async getMe(): Promise<Record<string, unknown>> {
    if (!inMemoryAccessToken) {
      throw new Error('Not authenticated');
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${inMemoryAccessToken}`,
    };
    if (inMemoryActiveTenantId) {
      headers['X-Tenant-Id'] = inMemoryActiveTenantId;
    }

    const res = await fetch(`${IDENTITY_API_URL}/me`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to fetch identity profile');
    }

    return res.json();
  },

  async logout(): Promise<void> {
    try {
      await fetch(`${IDENTITY_API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'onebridge-csrf-token',
        },
        credentials: 'include',
      });
    } finally {
      this.clear();
    }
  },
};
