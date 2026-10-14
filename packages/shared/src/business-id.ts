import crypto from 'node:crypto';

// Crockford Base32 alphabet: 32 characters (0-9, A-Z excluding I, L, O, U)
export const CROCKFORD_BASE32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'app',
  'auth',
  'billing',
  'cards',
  'dashboard',
  'internal',
  'login',
  'media',
  'notifications',
  'null',
  'ops',
  'orgs',
  'public',
  'root',
  'static',
  'status',
  'undefined',
  'webhook',
]);

/**
 * Generates a cryptographically secure Base32 string of the given length.
 * Per ADR-0001: Uses cryptographically secure random source.
 */
export function generateBase32Id(length = 6): string {
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    const index = bytes[i] % CROCKFORD_BASE32_ALPHABET.length;
    result += CROCKFORD_BASE32_ALPHABET[index];
  }
  return result;
}

/**
 * Mint Business ID format: OB-<6 char base32>, e.g. OB-7KQ2MX.
 * Per F03 & ADR-0001: Unique across platform, immutable, never reused.
 */
export function generateBase32BusinessId(): string {
  return `OB-${generateBase32Id(6)}`;
}

/**
 * Validates Business ID format: OB-<6 char base32>
 */
export function validateBusinessId(id: string): boolean {
  if (typeof id !== 'string') return false;
  const regex = /^OB-[0-9A-HJKMNP-TV-Z]{6}$/;
  return regex.test(id);
}

/**
 * Validates company slug format:
 * - 3 to 63 lowercase alphanumeric characters and hyphens
 * - Cannot start or end with hyphen
 * - Cannot contain consecutive hyphens
 * - Cannot be a reserved keyword
 */
export function validateSlug(slug: string): { isValid: boolean; reason?: string } {
  if (typeof slug !== 'string' || slug.trim() === '') {
    return { isValid: false, reason: 'Slug must be a non-empty string' };
  }
  const normalized = slug.trim().toLowerCase();
  if (normalized.length < 3 || normalized.length > 63) {
    return { isValid: false, reason: 'Slug must be between 3 and 63 characters long' };
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    return { isValid: false, reason: 'Slug must contain only lowercase letters, numbers, and single hyphens' };
  }
  if (RESERVED_SLUGS.has(normalized)) {
    return { isValid: false, reason: `Slug "${normalized}" is reserved and cannot be used` };
  }
  return { isValid: true };
}

/**
 * Sanitizes a company name into a URL-safe slug.
 */
export function slugifyCompanyName(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'org';
}

/**
 * Mint Student ID format: OB-S<6 char base32>, e.g. OB-S7KQ2MX.
 * Per F03 AC-5, ADR-0001 & PRD Section 8.2: Minted by Identity with its own registry.
 */
export function generateBase32StudentId(): string {
  return `OB-S${generateBase32Id(6)}`;
}

/**
 * Validates Student ID format: OB-S<6 char base32>
 */
export function validateStudentId(id: string): boolean {
  if (typeof id !== 'string') return false;
  const regex = /^OB-S[0-9A-HJKMNP-TV-Z]{6}$/;
  return regex.test(id);
}

export type DerivedEntityType = 'branch' | 'department' | 'seat';

/**
 * Derives a Branch ID from a Business ID: <BusinessID>-B<nn> (two-digit zero padded).
 * Per F03 AC-4 & PRD Section 8.2.
 */
export function formatBranchId(businessId: string, seq: number): string {
  return `${businessId}-B${String(seq).padStart(2, '0')}`;
}

/**
 * Derives a Department ID from a Business ID: <BusinessID>-D<nn> (two-digit zero padded).
 * Per F03 AC-4 & PRD Section 8.2.
 */
export function formatDepartmentId(businessId: string, seq: number): string {
  return `${businessId}-D${String(seq).padStart(2, '0')}`;
}

/**
 * Derives a Seat (Employee Identity) ID from a Business ID: <BusinessID>-E<nnnn> (four-digit zero padded).
 * Per F03 AC-4 & PRD Section 8.2.
 */
export function formatSeatId(businessId: string, seq: number): string {
  return `${businessId}-E${String(seq).padStart(4, '0')}`;
}

const DERIVED_ID_REGEX = /^(OB-[0-9A-HJKMNP-TV-Z]{6})-(B\d{2,}|D\d{2,}|E\d{4,})$/;

/**
 * Validates a Derived ID format and optional entity type.
 */
export function validateDerivedId(id: string, expectedType?: DerivedEntityType): boolean {
  if (typeof id !== 'string') return false;
  const match = DERIVED_ID_REGEX.exec(id);
  if (!match) return false;

  if (expectedType) {
    const code = match[2][0];
    if (expectedType === 'branch' && code !== 'B') return false;
    if (expectedType === 'department' && code !== 'D') return false;
    if (expectedType === 'seat' && code !== 'E') return false;
  }

  return true;
}

/**
 * Parses a Derived ID into its constituent components.
 */
export function parseDerivedId(
  id: string
): { businessId: string; type: DerivedEntityType; seq: number } | null {
  if (typeof id !== 'string') return null;
  const match = DERIVED_ID_REGEX.exec(id);
  if (!match) return null;

  const businessId = match[1];
  const suffix = match[2];
  const code = suffix[0];
  const seq = parseInt(suffix.slice(1), 10);

  let type: DerivedEntityType;
  if (code === 'B') type = 'branch';
  else if (code === 'D') type = 'department';
  else if (code === 'E') type = 'seat';
  else return null;

  return { businessId, type, seq };
}
