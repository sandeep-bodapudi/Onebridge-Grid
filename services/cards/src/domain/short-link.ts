import crypto from 'node:crypto';

export type ShortLinkTargetType = 'card' | 'company' | 'branch' | 'external';
export type ShortLinkStatus = 'active' | 'disabled' | 'unactivated' | 'pending_approval';

export interface ShortLinkProps {
  id: string;
  tenantId: string;
  code: string;
  shortUrl: string;
  targetType: ShortLinkTargetType;
  targetId: string;
  destinationUrl: string;
  source: string;
  label?: string;
  status: ShortLinkStatus;
  statusReason?: string;
  isExternal: boolean;
  externalApprovedBy?: string | null;
  externalApprovedAt?: string | null;
  aggregateVersion: number;
  createdAt: string;
  updatedAt: string;
}

const BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Generates an 8-character cryptographically random Base62 shortlink code.
 * Yields 62^8 ≈ 2.18 x 10^14 combinations.
 */
export function generateShortLinkCode(): string {
  const bytes = crypto.randomBytes(8);
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += BASE62_ALPHABET[bytes[i] % BASE62_ALPHABET.length];
  }
  return result;
}

export function validateShortLinkCode(code: string): boolean {
  if (typeof code !== 'string') return false;
  return /^[0-9a-zA-Z]{8}$/.test(code);
}

/**
 * True for OneBridge's own pages. `trustedHosts` adds the deployment's
 * configured public hosts (WEB_PUBLIC_URL, SHORT_LINK_BASE_URL), so a
 * staging or demo host is not mistaken for an external destination.
 */
export function isOneBridgeDestination(url: string, trustedHosts: string[] = []): boolean {
  if (typeof url !== 'string' || !url.trim()) return false;
  const trimmed = url.trim();

  // Relative path within OneBridge app
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'obg.in' ||
      host.endsWith('.obg.in') ||
      host === 'onebridge.in' ||
      host.endsWith('.onebridge.in') ||
      trustedHosts.some((h) => h.toLowerCase() === host)
    );
  } catch {
    return false;
  }
}

const PRIVATE_IP_REGEX = /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.|0\.0\.0\.0|::1)/;

export function validateDestinationUrl(
  url: string,
  options: { allowExternal?: boolean; callerRole?: string; trustedHosts?: string[] } = {}
): { isValid: boolean; reason?: string } {
  if (typeof url !== 'string' || !url.trim()) {
    return { isValid: false, reason: 'Destination URL is required' };
  }

  const trimmed = url.trim();

  // Disallow javascript:, data:, file:, etc.
  if (/^(javascript|data|file|vbscript):/i.test(trimmed)) {
    return { isValid: false, reason: 'Destination URL contains unsafe or prohibited scheme' };
  }

  const isInternal = isOneBridgeDestination(trimmed, options.trustedHosts);

  if (!isInternal) {
    // AC-7: External destinations require Company Admin approval
    const role = options.callerRole;
    const isCompanyAdmin = role === 'owner' || role === 'admin' || role === 'super_admin';

    if (!isCompanyAdmin && !options.allowExternal) {
      return {
        isValid: false,
        reason: 'External destinations need Company Admin approval and a URL safety check. Only OneBridge pages by default.',
      };
    }

    // SSRF & URL safety check on external URLs
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { isValid: false, reason: 'Destination URL must use HTTP or HTTPS protocol' };
      }

      const hostname = parsed.hostname.toLowerCase();

      if (hostname === 'localhost' && !isInternal) {
        return { isValid: false, reason: 'Destination URL refers to unsafe or prohibited address (localhost)' };
      }

      if (PRIVATE_IP_REGEX.test(hostname)) {
        return { isValid: false, reason: 'Destination URL refers to unsafe or prohibited private IP address' };
      }
    } catch {
      return { isValid: false, reason: 'Destination URL is invalid' };
    }
  }

  return { isValid: true };
}

export const DEFAULT_SHORT_LINK_BASE_URL = 'https://obg.in';

/** Hostnames of the given URLs, ignoring any that fail to parse. */
export function hostsOf(...urls: Array<string | undefined>): string[] {
  const hosts: string[] = [];
  for (const u of urls) {
    if (!u) continue;
    try {
      hosts.push(new URL(u).hostname.toLowerCase());
    } catch {
      // ignore malformed configuration values
    }
  }
  return hosts;
}

export function createShortLink(params: {
  id: string;
  tenantId: string;
  targetType: ShortLinkTargetType;
  targetId: string;
  destinationUrl: string;
  code?: string;
  source?: string;
  label?: string;
  status?: ShortLinkStatus;
  callerRole?: string;
  approvedBy?: string;
  /** Defaults to https://obg.in. Set from SHORT_LINK_BASE_URL. */
  shortLinkBaseUrl?: string;
  /** Extra hosts treated as OneBridge pages (see isOneBridgeDestination). */
  trustedHosts?: string[];
}): ShortLinkProps {
  const code = params.code || generateShortLinkCode();
  const source = params.source || 'default';
  const now = new Date().toISOString();
  const isExternal = !isOneBridgeDestination(params.destinationUrl, params.trustedHosts);

  const initialStatus: ShortLinkStatus = params.status || (isExternal && !params.approvedBy ? 'pending_approval' : 'active');

  return {
    id: params.id,
    tenantId: params.tenantId,
    code,
    shortUrl: `${(params.shortLinkBaseUrl || DEFAULT_SHORT_LINK_BASE_URL).replace(/\/+$/, '')}/${code}`,
    targetType: params.targetType,
    targetId: params.targetId,
    destinationUrl: params.destinationUrl,
    source,
    label: params.label,
    status: initialStatus,
    isExternal,
    externalApprovedBy: isExternal ? params.approvedBy || null : null,
    externalApprovedAt: isExternal && params.approvedBy ? now : null,
    aggregateVersion: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function repointShortLink(
  current: ShortLinkProps,
  newDestinationUrl: string,
  repointedBy: string,
  trustedHosts: string[] = []
): ShortLinkProps {
  const isExternal = !isOneBridgeDestination(newDestinationUrl, trustedHosts);
  const now = new Date().toISOString();

  return {
    ...current,
    // Code is strictly immutable (AC-1)
    code: current.code,
    destinationUrl: newDestinationUrl,
    isExternal,
    externalApprovedBy: isExternal ? repointedBy : null,
    externalApprovedAt: isExternal ? now : null,
    aggregateVersion: current.aggregateVersion + 1,
    updatedAt: now,
  };
}

export function updateShortLinkStatus(
  current: ShortLinkProps,
  newStatus: ShortLinkStatus,
  reason?: string
): ShortLinkProps {
  const now = new Date().toISOString();
  return {
    ...current,
    status: newStatus,
    statusReason: reason,
    aggregateVersion: current.aggregateVersion + 1,
    updatedAt: now,
  };
}
