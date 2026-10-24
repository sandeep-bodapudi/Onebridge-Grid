/**
 * ADR-0003 point 4: "The Cards service keeps denormalised copies of
 * organization, branch and seat data needed to render cards and visitor
 * pages. It never reads another service's database."
 *
 * Each read model carries `aggregateVersion` so the sync consumer can
 * "ignore stale events... apply only if aggregateVersion is greater than
 * the stored one" (ADR-0003 point 3).
 */

export interface OrgReadModel {
  tenantId: string; // primary key = orgId
  businessId: string;
  name: string;
  slug: string;
  logo?: string;
  brandColours?: { band: string; accent?: string; text: string };
  verifiedBadge: boolean;
  cardApprovalRequired?: boolean; // Company setting (AC-8)
  /** Public company page (F26): profile fields mirrored from the organization. */
  plan?: string;
  planStatus?: 'active' | 'lapsed';
  industry?: string;
  city?: string;
  about?: string;
  website?: string;
  gstin?: string;
  socialLinks?: Record<string, string>;
  aggregateVersion: number;
  updatedAt: string;
}

export interface SeatReadModel {
  seatId: string; // primary key
  tenantId: string;
  title: string;
  branchId?: string;
  departmentId?: string;
  personId?: string;
  status: string;
  aggregateVersion: number;
  updatedAt: string;
}

export interface BranchReadModel {
  branchId: string; // primary key
  tenantId: string;
  name: string;
  address?: string;
  mapPin?: { lat: number; lng: number };
  status: string;
  aggregateVersion: number;
  updatedAt: string;
}

/**
 * True if `incomingVersion` should be applied over `storedVersion`.
 * A missing stored version (new record) always applies. Equal or lower
 * incoming versions are stale and are ignored (ADR-0003 point 3).
 */
export function isNewerVersion(storedVersion: number | undefined, incomingVersion: number | undefined): boolean {
  if (incomingVersion === undefined) return true; // no version info: apply (legacy/best-effort)
  if (storedVersion === undefined) return true;
  return incomingVersion > storedVersion;
}
