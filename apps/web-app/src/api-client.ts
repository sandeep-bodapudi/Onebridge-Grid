import type {
  ChatMessage,
  Conversation,
  ConversationPage,
  InternalNote,
  MessagePage,
  StartConversation,
  CompanyProfileSettings,
  SearchResults,
  Industry,
  FollowState,
  ActorPage,
  PublicCompanyProfile,
  AccessRequest,
  PlanUsage,
  MyProfile,
  ProfileUpdate,
  PublicMemberProfile,
  WorkHistoryEntry,
  InviteRequest,
  InviteSummary,
  InvitePreview,
  ClaimInviteRequest,
  ClaimInviteResponse,
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
  CardSummary,
  OverviewStats,
  LeadSummary,
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
const PROFILES_API_URL = process.env.NEXT_PUBLIC_PROFILES_API_URL || 'http://localhost:4004';
const SOCIAL_API_URL = process.env.NEXT_PUBLIC_SOCIAL_API_URL || 'http://localhost:4005';
const SEARCH_API_URL = process.env.NEXT_PUBLIC_SEARCH_API_URL || 'http://localhost:4006';
const MESSAGING_API_URL = process.env.NEXT_PUBLIC_MESSAGING_API_URL || 'http://localhost:4007';
const CARDS_PUBLIC_API_URL = process.env.NEXT_PUBLIC_CARDS_API_URL || 'http://localhost:4003';
const CARDS_API_URL = process.env.NEXT_PUBLIC_CARDS_API_URL || 'http://localhost:4003';
// Empty means the public site shares this app's origin (single-service deployment, D-SINGLE-SERVICE).
const WEB_PUBLIC_URL = process.env.NEXT_PUBLIC_WEB_PUBLIC_URL ?? 'http://localhost:3001';
const publicBase = (): string => WEB_PUBLIC_URL || (typeof window !== 'undefined' ? window.location.origin : '');

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

  /** F14: sign in with a one-time code sent by email (to claim an invite sent by email). */
  async requestEmailOtp(email: string): Promise<{ message: string; cooldownSeconds?: number }> {
    const res = await fetch(`${IDENTITY_API_URL}/auth/otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'onebridge-csrf-token' },
      body: JSON.stringify({ email }),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'Could not send the code');
    }
    return res.json();
  },

  async verifyEmailOtp(email: string, code: string, deviceLabel = 'Browser'): Promise<{ status: string; accessToken?: string; mfaTicket?: string }> {
    const res = await fetch(`${IDENTITY_API_URL}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'onebridge-csrf-token' },
      body: JSON.stringify({ email, code, deviceLabel }),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || 'That code is not right');
    }
    const data = await res.json();
    if (data.accessToken) inMemoryAccessToken = data.accessToken;
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
      const error = new Error(err.detail || err.title || 'Failed to create organization') as Error & { code?: string; status?: number };
      error.code = err.code;
      error.status = res.status;
      throw error;
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

  /** Organization service request with the in-memory token; throws the server's problem detail (and code) on failure. */
  async orgRequest<T>(path: string, init: RequestInit, tenantId?: string, fallbackError = 'Request failed'): Promise<T> {
    const headers: Record<string, string> = {};
    if (init.body) headers['Content-Type'] = 'application/json';
    if (tenantId) headers['X-Tenant-Id'] = tenantId;
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
    const res = await fetch(`${ORGANIZATION_API_URL}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) }, credentials: 'include' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error = new Error(err.detail || err.title || fallbackError) as Error & { code?: string; status?: number };
      error.code = err.code;
      error.status = res.status;
      throw error;
    }
    return res.json() as Promise<T>;
  },

  /** N01 profiles service request with the in-memory token (profiles are personal: no tenant header). */
  async profilesRequest<T>(path: string, init: RequestInit, fallbackError = 'Request failed'): Promise<T> {
    const headers: Record<string, string> = {};
    if (init.body) headers['Content-Type'] = 'application/json';
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
    const res = await fetch(`${PROFILES_API_URL}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) }, credentials: 'include' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error = new Error(err.detail || err.title || fallbackError) as Error & { code?: string; status?: number };
      error.code = err.code;
      error.status = res.status;
      throw error;
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  },

  /** N04 social service request. asCompany sends X-Act-As-Company (the caller must be its owner or an admin). */
  async socialRequest<T>(path: string, init: RequestInit, asCompany?: string, fallbackError = 'Request failed'): Promise<T> {
    const headers: Record<string, string> = {};
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
    if (asCompany) headers['X-Act-As-Company'] = asCompany;
    const res = await fetch(`${SOCIAL_API_URL}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) }, credentials: 'include' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error = new Error(err.detail || err.title || fallbackError) as Error & { code?: string; status?: number };
      error.code = err.code;
      error.status = res.status;
      throw error;
    }
    return res.json() as Promise<T>;
  },

  async getFollowState(targetType: 'member' | 'company', targetId: string, asCompany?: string): Promise<FollowState> {
    return this.socialRequest<FollowState>(`/follows/${targetType}/${encodeURIComponent(targetId)}`, { method: 'GET' }, asCompany, 'Could not load follow status');
  },

  async follow(targetType: 'member' | 'company', targetId: string, source = 'profile', asCompany?: string): Promise<FollowState> {
    return this.socialRequest<FollowState>(`/follows/${targetType}/${encodeURIComponent(targetId)}?source=${source}`, { method: 'PUT' }, asCompany, 'Could not follow');
  },

  async unfollow(targetType: 'member' | 'company', targetId: string, asCompany?: string): Promise<FollowState> {
    return this.socialRequest<FollowState>(`/follows/${targetType}/${encodeURIComponent(targetId)}`, { method: 'DELETE' }, asCompany, 'Could not unfollow');
  },

  async listCompanyFollowers(tenantId: string, cursor?: string): Promise<ActorPage> {
    const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return this.socialRequest<ActorPage>(`/companies/${encodeURIComponent(tenantId)}/followers${q}`, { method: 'GET', headers: { 'X-Tenant-Id': tenantId } }, undefined, 'Could not load followers');
  },

  async listFollowing(cursor?: string, asCompany?: string): Promise<ActorPage> {
    const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return this.socialRequest<ActorPage>(`/me/following${q}`, { method: 'GET' }, asCompany, 'Could not load who you follow');
  },

  /** N08 messaging request. asCompany sends X-Act-As-Company (the company inbox). */
  async messagingRequest<T>(path: string, init: RequestInit, asCompany?: string, fallbackError = 'Request failed'): Promise<T> {
    const headers: Record<string, string> = {};
    if (init.body) headers['Content-Type'] = 'application/json';
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
    if (asCompany) headers['X-Act-As-Company'] = asCompany;
    const res = await fetch(`${MESSAGING_API_URL}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) }, credentials: 'include' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error = new Error(err.detail || err.title || fallbackError) as Error & { code?: string; status?: number };
      error.code = err.code;
      error.status = res.status;
      throw error;
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  },

  async listConversations(options: { folder?: 'inbox' | 'requests' | 'done'; assigned?: 'me' | 'unassigned'; q?: string; cursor?: string }, asCompany?: string): Promise<ConversationPage> {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(options)) if (v) params.set(k, v);
    const q = params.toString() ? `?${params.toString()}` : '';
    return this.messagingRequest<ConversationPage>(`/conversations${q}`, { method: 'GET' }, asCompany, 'Could not load conversations');
  },

  async getConversation(id: string, asCompany?: string): Promise<Conversation> {
    return this.messagingRequest<Conversation>(`/conversations/${encodeURIComponent(id)}`, { method: 'GET' }, asCompany, 'Could not load the conversation');
  },

  async startConversation(body: StartConversation, asCompany?: string): Promise<Conversation> {
    return this.messagingRequest<Conversation>('/conversations', { method: 'POST', body: JSON.stringify(body) }, asCompany, 'Could not send the message');
  },

  async listMessages(id: string, cursor?: string, asCompany?: string): Promise<MessagePage> {
    const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return this.messagingRequest<MessagePage>(`/conversations/${encodeURIComponent(id)}/messages${q}`, { method: 'GET' }, asCompany, 'Could not load messages');
  },

  async sendMessage(id: string, body: { clientMessageId: string; text: string; replyToMessageId?: string }, asCompany?: string): Promise<ChatMessage> {
    return this.messagingRequest<ChatMessage>(`/conversations/${encodeURIComponent(id)}/messages`, { method: 'POST', body: JSON.stringify(body) }, asCompany, 'Could not send the message');
  },

  async editMessage(messageId: string, text: string, asCompany?: string): Promise<ChatMessage> {
    return this.messagingRequest<ChatMessage>(`/messages/${encodeURIComponent(messageId)}`, { method: 'PATCH', body: JSON.stringify({ text }) }, asCompany, 'Could not edit the message');
  },

  async unsendMessage(messageId: string, asCompany?: string): Promise<ChatMessage> {
    return this.messagingRequest<ChatMessage>(`/messages/${encodeURIComponent(messageId)}`, { method: 'DELETE' }, asCompany, 'Could not unsend the message');
  },

  async conversationAction(id: string, action: 'accept' | 'ignore', asCompany?: string): Promise<Conversation> {
    return this.messagingRequest<Conversation>(`/conversations/${encodeURIComponent(id)}/${action}`, { method: 'POST' }, asCompany, 'Could not update the request');
  },

  async markRead(id: string, upToMessageId: string, asCompany?: string): Promise<void> {
    await this.messagingRequest<void>(`/conversations/${encodeURIComponent(id)}/read`, { method: 'POST', body: JSON.stringify({ upToMessageId }) }, asCompany, 'Could not mark as read');
  },

  async setConversationStatus(id: string, status: 'open' | 'done', asCompany: string): Promise<Conversation> {
    return this.messagingRequest<Conversation>(`/conversations/${encodeURIComponent(id)}/status`, { method: 'POST', body: JSON.stringify({ status }) }, asCompany, 'Could not update the conversation');
  },

  async assignConversation(id: string, seatId: string, asCompany: string): Promise<Conversation> {
    return this.messagingRequest<Conversation>(`/conversations/${encodeURIComponent(id)}/assign`, { method: 'POST', body: JSON.stringify({ seatId }) }, asCompany, 'Could not assign the conversation');
  },

  async listNotes(id: string, asCompany: string): Promise<{ items: InternalNote[] }> {
    return this.messagingRequest<{ items: InternalNote[] }>(`/conversations/${encodeURIComponent(id)}/notes`, { method: 'GET' }, asCompany, 'Could not load notes');
  },

  async addNote(id: string, text: string, asCompany: string): Promise<InternalNote> {
    return this.messagingRequest<InternalNote>(`/conversations/${encodeURIComponent(id)}/notes`, { method: 'POST', body: JSON.stringify({ text }) }, asCompany, 'Could not save the note');
  },

  /** Opens the N08 realtime socket: a single-use ticket keeps the access token out of the URL. */
  async openRealtime(asCompany?: string): Promise<WebSocket> {
    const { ticket } = await this.messagingRequest<{ ticket: string }>('/realtime/ticket', { method: 'POST' }, asCompany, 'Could not connect');
    const base = new URL(MESSAGING_API_URL, window.location.href);
    base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
    base.pathname = `${base.pathname.replace(/\/+$/, '')}/realtime`;
    base.search = `?ticket=${encodeURIComponent(ticket)}`;
    return new WebSocket(base.toString());
  },

  /** N03: search as the signed-in member (members-only profiles included). */
  async search(params: { q?: string; type?: string; industry?: string; city?: string; verified?: boolean; cursor?: string }): Promise<SearchResults> {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== false) q.set(k, String(v));
    });
    const headers: Record<string, string> = {};
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
    const res = await fetch(`${SEARCH_API_URL}/search?${q.toString()}`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Search is not available right now.');
    }
    return res.json();
  },

  async industries(): Promise<Industry[]> {
    const res = await fetch(`${SEARCH_API_URL}/taxonomy/industries`);
    if (!res.ok) return [];
    return ((await res.json()) as { items: Industry[] }).items;
  },

  /** F26 public company page data (used by the signed-in company view). */
  async getPublicCompany(slug: string): Promise<PublicCompanyProfile | null> {
    const res = await fetch(`${CARDS_PUBLIC_API_URL}/public/o/${encodeURIComponent(slug)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Could not load the company page');
    return res.json();
  },

  /** N01: my profile; rejects with code profile_missing before the first save. */
  async getMyProfile(): Promise<MyProfile> {
    return this.profilesRequest<MyProfile>('/me/profile', { method: 'GET' }, 'Could not load your profile');
  },

  async saveMyProfile(update: ProfileUpdate): Promise<MyProfile> {
    return this.profilesRequest<MyProfile>('/me/profile', { method: 'PUT', body: JSON.stringify(update) }, 'Could not save your profile');
  },

  async addWorkHistory(entry: { companyName: string; title: string; startDate: string; endDate?: string }): Promise<WorkHistoryEntry> {
    return this.profilesRequest<WorkHistoryEntry>('/me/work-history', { method: 'POST', body: JSON.stringify(entry) }, 'Could not add the role');
  },

  async updateWorkHistory(id: string, patch: Partial<{ companyName: string; title: string; startDate: string; endDate: string; hidden: boolean }>): Promise<WorkHistoryEntry> {
    return this.profilesRequest<WorkHistoryEntry>(`/me/work-history/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }, 'Could not update the role');
  },

  async deleteWorkHistory(id: string): Promise<void> {
    await this.profilesRequest<void>(`/me/work-history/${encodeURIComponent(id)}`, { method: 'DELETE' }, 'Could not delete the role');
  },

  /** N01: a member's profile as the signed-in viewer may see it (null when not visible). */
  async getMemberProfile(handle: string): Promise<PublicMemberProfile | null> {
    try {
      return await this.profilesRequest<PublicMemberProfile>(`/members/${encodeURIComponent(handle)}`, { method: 'GET' }, 'Could not load the profile');
    } catch (err) {
      if ((err as { status?: number }).status === 404) return null;
      throw err;
    }
  },

  /** Public member profile page (apps/web-public). */
  publicMemberUrl(handle: string): string {
    return `${publicBase()}/in/${handle}`;
  },

  /** N02: ask the owner of an existing company (found by GSTIN) for access. Same answer whether or not it exists. */
  async requestCompanyAccess(req: { gstin: string; name: string; message?: string }): Promise<{ status: string; detail: string }> {
    return this.orgRequest(`/orgs/access-requests`, { method: 'POST', body: JSON.stringify(req) }, undefined, 'Could not send the request');
  },

  async listAccessRequests(tenantId: string): Promise<AccessRequest[]> {
    const data = await this.orgRequest<{ items: AccessRequest[] }>(`/orgs/${tenantId}/access-requests`, { method: 'GET' }, tenantId, 'Could not load access requests');
    return data.items || [];
  },

  async decideAccessRequest(tenantId: string, requestId: string, decision: 'approve' | 'decline', role: 'admin' | 'employee' = 'employee'): Promise<AccessRequest> {
    return this.orgRequest<AccessRequest>(
      `/orgs/${tenantId}/access-requests/${encodeURIComponent(requestId)}/decide`,
      { method: 'POST', body: JSON.stringify({ decision, role }) },
      tenantId,
      'Could not save the decision'
    );
  },

  async getPlanUsage(tenantId: string): Promise<PlanUsage> {
    return this.orgRequest<PlanUsage>(`/orgs/${tenantId}/limits`, { method: 'GET' }, tenantId, 'Could not load plan usage');
  },

  /** F14: invite a person into a seat (replaces any open invite). */
  async inviteToSeat(tenantId: string, seatId: string, req: InviteRequest): Promise<InviteSummary> {
    return this.orgRequest<InviteSummary>(`/orgs/${tenantId}/seats/${encodeURIComponent(seatId)}/invite`, { method: 'POST', body: JSON.stringify(req) }, tenantId, 'Could not send the invite');
  },

  async resendInvite(tenantId: string, seatId: string): Promise<InviteSummary> {
    return this.orgRequest<InviteSummary>(`/orgs/${tenantId}/seats/${encodeURIComponent(seatId)}/invite/resend`, { method: 'POST' }, tenantId, 'Could not resend the invite');
  },

  async revokeInvite(tenantId: string, seatId: string): Promise<InviteSummary> {
    return this.orgRequest<InviteSummary>(`/orgs/${tenantId}/seats/${encodeURIComponent(seatId)}/invite/revoke`, { method: 'POST' }, tenantId, 'Could not cancel the invite');
  },

  async listInvites(tenantId: string): Promise<InviteSummary[]> {
    const data = await this.orgRequest<{ items: InviteSummary[] }>(`/orgs/${tenantId}/invites`, { method: 'GET' }, tenantId, 'Could not load invites');
    return data.items || [];
  },

  /** F14: what an invite link is for (no sign-in needed). */
  async getInvite(token: string): Promise<InvitePreview> {
    return this.orgRequest<InvitePreview>(`/invites/${encodeURIComponent(token)}`, { method: 'GET' }, undefined, 'Could not open the invite');
  },

  async claimInvite(token: string, req: ClaimInviteRequest): Promise<ClaimInviteResponse> {
    return this.orgRequest<ClaimInviteResponse>(`/invites/${encodeURIComponent(token)}/claim`, { method: 'POST', body: JSON.stringify(req) }, undefined, 'Could not claim the invite');
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

  /** Card summaries (name, status, public URL) for every card in the company. */
  async listCardSummaries(tenantId?: string): Promise<CardSummary[]> {
    const data = await this.cardsRequest<{ items: CardSummary[] }>('/cards', { method: 'GET' }, tenantId, 'Could not load cards');
    return data.items || [];
  },

  async getOverviewStats(tenantId?: string): Promise<OverviewStats> {
    return this.cardsRequest<OverviewStats>('/stats/overview', { method: 'GET' }, tenantId, 'Could not load the overview');
  },

  /** Prototype read-only leads list (flag demo_leads_panel); owners and admins only. */
  async listLeads(tenantId?: string): Promise<LeadSummary[]> {
    const data = await this.cardsRequest<{ items: LeadSummary[] }>('/leads', { method: 'GET' }, tenantId, 'Could not load leads');
    return data.items || [];
  },

  /** F26: public company page settings (catalogue, portfolio, documents, people, routing, SEO). */
  async getCompanyProfile(tenantId?: string): Promise<CompanyProfileSettings> {
    return this.cardsRequest<CompanyProfileSettings>('/company-profile', { method: 'GET' }, tenantId, 'Could not load the company page');
  },

  async updateCompanyProfile(settings: CompanyProfileSettings, tenantId?: string): Promise<CompanyProfileSettings> {
    const { limits: _limits, ...body } = settings;
    return this.cardsRequest<CompanyProfileSettings>(
      '/company-profile',
      { method: 'PUT', body: JSON.stringify(body) },
      tenantId,
      'Could not save the company page'
    );
  },

  /** Public company page (apps/web-public). */
  publicCompanyUrl(companySlug: string): string {
    return `${publicBase()}/${companySlug}`;
  },

  /** True when the hosted prototype shows the read-only leads list. */
  leadsPanelEnabled(): boolean {
    return process.env.NEXT_PUBLIC_DEMO_LEADS_PANEL === 'true';
  },

  /** Public visitor page for a card (apps/web-public). */
  publicCardUrl(cardSlug: string): string {
    return `${publicBase()}/c/${cardSlug}`;
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

  /** Fetches a protected image (QR preview) with the access token and returns an object URL. */
  async fetchProtectedObjectUrl(url: string, tenantId?: string): Promise<string> {
    const headers: Record<string, string> = {};
    if (inMemoryAccessToken) headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
    const activeTenant = tenantId || inMemoryActiveTenantId;
    if (activeTenant) headers['X-Tenant-Id'] = activeTenant;
    const res = await fetch(url, { method: 'GET', headers, credentials: 'include' });
    if (!res.ok) throw new Error('Could not load the QR code');
    return URL.createObjectURL(await res.blob());
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
