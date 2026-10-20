import type {
  Organization,
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
  Branch,
  CreateBranchRequest,
  Department,
  CreateDepartmentRequest,
  Team,
  CreateTeamRequest,
  OrgChartNode,
  MovePersonRequest,
  Seat,
  PaginatedSeats,
  CreateSeatRequest,
  UpdateSeatRequest,
  AssignSeatRequest,
  BrandKit,
  UpdateBrandKitRequest,
  FieldLocks,
  UpdateFieldLocksRequest,
  UploadLogoRequest,
  UploadLogoResponse,
  PaginatedAuditLogs,
  ShortLink,
  CreateCardQrRequest,
  UpdateShortLinkRequest,
  Card,
  CardTemplate,
  UpdateCardRequest,
} from '@onebridge/api-contracts';

export interface AuthState {
  accessToken: string | null;
  user: Record<string, unknown> | null;
}

// In-memory token storage (Rule: NEVER put tokens or lead data in localStorage or sessionStorage)
let inMemoryAccessToken: string | null = null;
let inMemoryActiveTenantId: string | null = null;
let inFlightRefresh: Promise<string | null> | null = null;

const IDENTITY_API_URL = process.env.NEXT_PUBLIC_IDENTITY_API_URL || 'http://localhost:4001';
const ORGANIZATION_API_URL = process.env.NEXT_PUBLIC_ORGANIZATION_API_URL || 'http://localhost:4002';
const CARDS_API_URL = process.env.NEXT_PUBLIC_CARDS_API_URL || 'http://localhost:4003';
const WEB_PUBLIC_URL = process.env.NEXT_PUBLIC_WEB_PUBLIC_URL || 'http://localhost:3001';

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

  /**
   * Refresh tokens rotate and reuse revokes the whole session (identity
   * TokenService), so concurrent refreshes (React StrictMode double effects,
   * several components at once) must share one request.
   */
  silentRefresh(): Promise<string | null> {
    if (!inFlightRefresh) {
      inFlightRefresh = this.doSilentRefresh().finally(() => {
        inFlightRefresh = null;
      });
    }
    return inFlightRefresh;
  },

  async doSilentRefresh(): Promise<string | null> {
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

  async createOrganization(req: CreateOrganizationRequest): Promise<Organization> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (inMemoryAccessToken) {
      headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
    }

    const res = await fetch(`${ORGANIZATION_API_URL}/orgs`, {
      method: 'POST',
      headers,
      body: JSON.stringify(req),
      credentials: 'include',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to create organization');
    }

    return res.json();
  },

  async getOrganization(id: string): Promise<Organization> {
    const headers: Record<string, string> = {};
    if (inMemoryAccessToken) {
      headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
    }
    if (inMemoryActiveTenantId) {
      headers['X-Tenant-Id'] = inMemoryActiveTenantId;
    }

    const res = await fetch(`${ORGANIZATION_API_URL}/orgs/${id}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to fetch organization');
    }

    return res.json();
  },

  async updateOrganization(id: string, req: UpdateOrganizationRequest): Promise<Organization> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (inMemoryAccessToken) {
      headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
    }
    if (inMemoryActiveTenantId) {
      headers['X-Tenant-Id'] = inMemoryActiveTenantId;
    }

    const res = await fetch(`${ORGANIZATION_API_URL}/orgs/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(req),
      credentials: 'include',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to update organization');
    }

    return res.json();
  },

  async resolveSlug(slug: string): Promise<{ organization?: Organization; redirectUrl?: string }> {
    const res = await fetch(`${ORGANIZATION_API_URL}/orgs/by-slug/${slug}`, {
      method: 'GET',
      redirect: 'manual',
    });

    if (res.status === 301) {
      const location = res.headers.get('Location') || undefined;
      return { redirectUrl: location };
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to resolve organization slug');
    }

    const org = await res.json();
    return { organization: org };
  },

  async recordFirstCardPublished(orgId: string): Promise<Organization> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (inMemoryAccessToken) {
      headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
    }
    if (inMemoryActiveTenantId) {
      headers['X-Tenant-Id'] = inMemoryActiveTenantId;
    } else {
      headers['X-Tenant-Id'] = orgId;
    }

    const res = await fetch(`${ORGANIZATION_API_URL}/orgs/${orgId}/first-card`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to record first card published');
    }

    return res.json();
  },

  // ---------------------------------------------------------------------------
  // F07: STRUCTURE API (Branches, Departments, Teams, Tree)
  // ---------------------------------------------------------------------------

  async listBranches(tenantId: string, includeArchived = false): Promise<Branch[]> {
    const headers: Record<string, string> = { 'X-Tenant-Id': tenantId };
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;

    const res = await fetch(`${ORGANIZATION_API_URL}/orgs/${tenantId}/branches?includeArchived=${includeArchived}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to list branches');
    }
    const data = await res.json();
    return Array.isArray(data) ? data : data.items || [];
  },

  async createBranch(tenantId: string, req: CreateBranchRequest): Promise<Branch> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    };
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;

    const res = await fetch(`${ORGANIZATION_API_URL}/orgs/${tenantId}/branches`, {
      method: 'POST',
      headers,
      body: JSON.stringify(req),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to create branch');
    }
    return res.json();
  },

  async archiveBranch(tenantId: string, branchId: string): Promise<Branch> {
    const headers: Record<string, string> = { 'X-Tenant-Id': tenantId };
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;

    const res = await fetch(`${ORGANIZATION_API_URL}/orgs/${tenantId}/branches/${branchId}/archive`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to archive branch');
    }
    return res.json();
  },

  async listDepartments(tenantId: string, branchId?: string, includeArchived = false): Promise<Department[]> {
    const headers: Record<string, string> = { 'X-Tenant-Id': tenantId };
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;

    let url = `${ORGANIZATION_API_URL}/orgs/${tenantId}/departments?includeArchived=${includeArchived}`;
    if (branchId) url += `&branchId=${branchId}`;

    const res = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to list departments');
    }
    const data = await res.json();
    return Array.isArray(data) ? data : data.items || [];
  },

  async createDepartment(tenantId: string, req: CreateDepartmentRequest): Promise<Department> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    };
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;

    const res = await fetch(`${ORGANIZATION_API_URL}/orgs/${tenantId}/departments`, {
      method: 'POST',
      headers,
      body: JSON.stringify(req),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to create department');
    }
    return res.json();
  },

  async seedDefaultDepartments(tenantId: string): Promise<Department[]> {
    const headers: Record<string, string> = { 'X-Tenant-Id': tenantId };
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;

    const res = await fetch(`${ORGANIZATION_API_URL}/orgs/${tenantId}/departments/defaults`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to seed default departments');
    }
    const data = await res.json();
    return Array.isArray(data) ? data : data.items || [];
  },

  async archiveDepartment(tenantId: string, departmentId: string): Promise<Department> {
    const headers: Record<string, string> = { 'X-Tenant-Id': tenantId };
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;

    const res = await fetch(`${ORGANIZATION_API_URL}/orgs/${tenantId}/departments/${departmentId}/archive`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to archive department');
    }
    return res.json();
  },

  async listTeams(tenantId: string, departmentId?: string, includeArchived = false): Promise<Team[]> {
    const headers: Record<string, string> = { 'X-Tenant-Id': tenantId };
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;

    let url = `${ORGANIZATION_API_URL}/orgs/${tenantId}/teams?includeArchived=${includeArchived}`;
    if (departmentId) url += `&departmentId=${departmentId}`;

    const res = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to list teams');
    }
    const data = await res.json();
    return Array.isArray(data) ? data : data.items || [];
  },

  async archiveTeam(tenantId: string, teamId: string): Promise<Team> {
    const headers: Record<string, string> = { 'X-Tenant-Id': tenantId };
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;

    const res = await fetch(`${ORGANIZATION_API_URL}/orgs/${tenantId}/teams/${teamId}/archive`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to archive team');
    }
    return res.json();
  },


  async createTeam(tenantId: string, req: CreateTeamRequest): Promise<Team> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    };
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;

    const res = await fetch(`${ORGANIZATION_API_URL}/orgs/${tenantId}/teams`, {
      method: 'POST',
      headers,
      body: JSON.stringify(req),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to create team');
    }
    return res.json();
  },

  async getTree(tenantId: string): Promise<OrgChartNode> {
    const headers: Record<string, string> = { 'X-Tenant-Id': tenantId };
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;

    const res = await fetch(`${ORGANIZATION_API_URL}/orgs/${tenantId}/tree`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to fetch organization tree');
    }
    return res.json();
  },

  async movePersonInTree(tenantId: string, req: MovePersonRequest): Promise<OrgChartNode> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    };
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;

    const res = await fetch(`${ORGANIZATION_API_URL}/orgs/${tenantId}/tree/move-person`, {
      method: 'POST',
      headers,
      body: JSON.stringify(req),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to move person in tree');
    }
    return res.json();
  },

  async listSeats(
    tenantId: string,
    options?: {
      status?: string;
      branchId?: string;
      departmentId?: string;
      teamId?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<PaginatedSeats> {
    const headers: Record<string, string> = { 'X-Tenant-Id': tenantId };
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;

    const params = new URLSearchParams();
    if (options?.status) params.set('status', options.status);
    if (options?.branchId) params.set('branchId', options.branchId);
    if (options?.departmentId) params.set('departmentId', options.departmentId);
    if (options?.teamId) params.set('teamId', options.teamId);
    if (options?.limit !== undefined) params.set('limit', String(options.limit));
    if (options?.offset !== undefined) params.set('offset', String(options.offset));

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${ORGANIZATION_API_URL}/orgs/${tenantId}/seats${queryString}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to list seats');
    }
    return res.json();
  },

  async getSeat(tenantId: string, seatId: string): Promise<Seat> {
    const headers: Record<string, string> = { 'X-Tenant-Id': tenantId };
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;

    const res = await fetch(`${ORGANIZATION_API_URL}/orgs/${tenantId}/seats/${seatId}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to get seat');
    }
    return res.json();
  },

  async createSeat(
    tenantId: string,
    req: CreateSeatRequest,
    idempotencyKey?: string
  ): Promise<Seat> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    };
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

    const res = await fetch(`${ORGANIZATION_API_URL}/orgs/${tenantId}/seats`, {
      method: 'POST',
      headers,
      body: JSON.stringify(req),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to create seat');
    }
    return res.json();
  },

  async updateSeat(tenantId: string, seatId: string, req: UpdateSeatRequest): Promise<Seat> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    };
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;

    const res = await fetch(`${ORGANIZATION_API_URL}/orgs/${tenantId}/seats/${seatId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(req),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to update seat');
    }
    return res.json();
  },

  async assignSeat(tenantId: string, seatId: string, req: AssignSeatRequest): Promise<Seat> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    };
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;

    const res = await fetch(`${ORGANIZATION_API_URL}/orgs/${tenantId}/seats/${seatId}/assign`, {
      method: 'POST',
      headers,
      body: JSON.stringify(req),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to assign seat');
    }
    return res.json();
  },

  async archiveSeat(tenantId: string, seatId: string): Promise<Seat> {
    const headers: Record<string, string> = { 'X-Tenant-Id': tenantId };
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;

    const res = await fetch(`${ORGANIZATION_API_URL}/orgs/${tenantId}/seats/${seatId}/archive`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to archive seat');
    }
    return res.json();
  },

  async getBrandKit(tenantId: string): Promise<BrandKit> {
    const headers: Record<string, string> = { 'X-Tenant-Id': tenantId };
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;

    const res = await fetch(`${ORGANIZATION_API_URL}/orgs/${tenantId}/brand`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to fetch brand kit');
    }
    return res.json();
  },

  async updateBrandKit(
    tenantId: string,
    req: UpdateBrandKitRequest,
    acceptAutoPick = false,
    idempotencyKey?: string
  ): Promise<BrandKit> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    };
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

    const res = await fetch(
      `${ORGANIZATION_API_URL}/orgs/${tenantId}/brand${acceptAutoPick ? '?acceptAutoPick=true' : ''}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ ...req, acceptAutoPick }),
        credentials: 'include',
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to update brand kit');
    }
    return res.json();
  },

  async getFieldLocks(tenantId: string): Promise<FieldLocks> {
    const headers: Record<string, string> = { 'X-Tenant-Id': tenantId };
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;

    const res = await fetch(`${ORGANIZATION_API_URL}/orgs/${tenantId}/locks`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to fetch field locks');
    }
    return res.json();
  },

  async updateFieldLocks(tenantId: string, req: UpdateFieldLocksRequest): Promise<FieldLocks> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    };
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;

    const res = await fetch(`${ORGANIZATION_API_URL}/orgs/${tenantId}/locks`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(req),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to update field locks');
    }
    return res.json();
  },

  async uploadLogo(tenantId: string, file: File): Promise<UploadLogoResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    };
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;

    // Convert file to base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data:image/...;base64, prefix
        const base64Data = result.split(',')[1] || result;
        resolve(base64Data);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

    const payload: UploadLogoRequest = {
      filename: file.name,
      contentType: file.type as 'image/png' | 'image/svg+xml' | 'image/webp',
      size: file.size,
      contentBase64: base64,
    };

    const res = await fetch(`${ORGANIZATION_API_URL}/orgs/${tenantId}/brand/logo`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to upload logo');
    }
    return res.json();
  },

  async getAuditLogs(
    tenantId: string,
    params: {
      actor?: string;
      action?: string;
      entity?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<PaginatedAuditLogs> {
    const headers: Record<string, string> = {
      'X-Tenant-Id': tenantId,
    };
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;

    const query = new URLSearchParams();
    if (params.actor) query.append('actor', params.actor);
    if (params.action) query.append('action', params.action);
    if (params.entity) query.append('entity', params.entity);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.limit !== undefined) query.append('limit', String(params.limit));
    if (params.offset !== undefined) query.append('offset', String(params.offset));

    const qs = query.toString();
    const url = `${ORGANIZATION_API_URL}/orgs/${tenantId}/audit${qs ? `?${qs}` : ''}`;

    const res = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to fetch audit logs');
    }
    return res.json();
  },

  async exportAuditLogsCsv(
    tenantId: string,
    params: {
      actor?: string;
      action?: string;
      entity?: string;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<string> {
    const headers: Record<string, string> = {
      'X-Tenant-Id': tenantId,
    };
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;

    const query = new URLSearchParams();
    if (params.actor) query.append('actor', params.actor);
    if (params.action) query.append('action', params.action);
    if (params.entity) query.append('entity', params.entity);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);

    const qs = query.toString();
    const url = `${ORGANIZATION_API_URL}/orgs/${tenantId}/audit/export${qs ? `?${qs}` : ''}`;

    const res = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to export audit logs');
    }
    return res.text();
  },

  async listCardQrs(tenantId: string, cardId: string): Promise<ShortLink[]> {
    const headers: Record<string, string> = {
      'X-Tenant-Id': tenantId,
    };
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;

    const res = await fetch(`${CARDS_API_URL}/cards/${cardId}/qr`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to fetch card QR codes');
    }
    return res.json();
  },

  async createCardQr(
    tenantId: string,
    cardId: string,
    data: CreateCardQrRequest,
    idempotencyKey?: string
  ): Promise<ShortLink> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    };
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

    const res = await fetch(`${CARDS_API_URL}/cards/${cardId}/qr`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to create QR code');
    }
    return res.json();
  },

  async updateShortLink(
    tenantId: string,
    cardId: string,
    qrId: string,
    data: UpdateShortLinkRequest
  ): Promise<ShortLink> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    };
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;

    const res = await fetch(`${CARDS_API_URL}/cards/${cardId}/qr/${qrId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Failed to update short link');
    }
    return res.json();
  },

  getQrAssetUrl(
    cardId: string,
    qrId: string,
    format: 'png' | 'svg' | 'pdf',
    size?: number,
    template?: 'a4' | 'a5',
    tenantId?: string
  ): string {
    const params = new URLSearchParams();
    if (size) params.set('size', String(size));
    if (template) params.set('template', template);
    const activeTenant = tenantId || inMemoryActiveTenantId;
    if (activeTenant) params.set('tenantId', activeTenant);
    const qs = params.toString();
    return `${CARDS_API_URL}/cards/${cardId}/qr/${qrId}.${format}${qs ? `?${qs}` : ''}`;
  },

  /** Shared headers for cards-service calls (token + active company). */
  cardsHeaders(tenantId?: string, json = false): Record<string, string> {
    const headers: Record<string, string> = {};
    if (json) headers['Content-Type'] = 'application/json';
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
    const activeTenant = tenantId || inMemoryActiveTenantId;
    if (activeTenant) headers['X-Tenant-Id'] = activeTenant;
    return headers;
  },

  async cardsRequest<T>(path: string, init: RequestInit, tenantId?: string, fallbackError = 'Request failed'): Promise<T> {
    const res = await fetch(`${CARDS_API_URL}${path}`, {
      ...init,
      headers: { ...this.cardsHeaders(tenantId, Boolean(init.body)), ...(init.headers as Record<string, string> | undefined) },
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || fallbackError);
    }
    return res.json() as Promise<T>;
  },

  async listCardTemplates(tenantId?: string): Promise<CardTemplate[]> {
    const data = await this.cardsRequest<{ items: CardTemplate[] }>('/cards/templates', { method: 'GET' }, tenantId, 'Could not load card templates');
    return data.items || [];
  },

  async getCard(cardId: string, tenantId?: string): Promise<Card> {
    return this.cardsRequest<Card>(`/cards/${encodeURIComponent(cardId)}`, { method: 'GET' }, tenantId, 'Could not load the card');
  },

  async updateCard(cardId: string, update: UpdateCardRequest, tenantId?: string): Promise<Card> {
    return this.cardsRequest<Card>(
      `/cards/${encodeURIComponent(cardId)}`,
      { method: 'PATCH', body: JSON.stringify(update) },
      tenantId,
      'Could not save the card'
    );
  },

  async publishCard(cardId: string, tenantId?: string): Promise<Card> {
    return this.cardsRequest<Card>(`/cards/${encodeURIComponent(cardId)}/publish`, { method: 'POST' }, tenantId, 'Could not publish the card');
  },

  async approveCard(cardId: string, tenantId?: string): Promise<Card> {
    return this.cardsRequest<Card>(`/cards/${encodeURIComponent(cardId)}/approve`, { method: 'POST' }, tenantId, 'Could not approve the card');
  },

  /** Public visitor page for a card (apps/web-public). */
  publicCardUrl(cardSlug: string): string {
    return `${WEB_PUBLIC_URL}/c/${cardSlug}`;
  },

  /**
   * Downloads a protected file (QR asset, standee) with the in-memory access
   * token and saves it. A plain link or window.open cannot send the token,
   * and the cards service requires it (D-SERVICE-AUTH).
   */
  async downloadProtectedFile(url: string, filename: string, tenantId?: string): Promise<void> {
    const headers: Record<string, string> = {};
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
    const activeTenant = tenantId || inMemoryActiveTenantId;
    if (activeTenant) headers['X-Tenant-Id'] = activeTenant;

    const res = await fetch(url, { method: 'GET', headers, credentials: 'include' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Could not download the file. Try again.');
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  },

  getStandeeUrl(tenantId: string, branchId?: string, template: 'a4' | 'a5' = 'a4'): string {
    const params = new URLSearchParams({ template });
    const qs = params.toString();
    if (branchId) {
      return `${CARDS_API_URL}/orgs/${tenantId}/branches/${branchId}/qr/standee?${qs}`;
    }
    return `${CARDS_API_URL}/orgs/${tenantId}/qr/standee?${qs}`;
  },
};
