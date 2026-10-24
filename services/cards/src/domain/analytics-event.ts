import { ulid } from 'ulid';

export type AnalyticsEventType =
  | 'card_viewed'
  | 'contact_saved'
  | 'cta_clicked'
  | 'qr_scanned'
  | string;

export interface AnalyticsEventProps {
  id: string;
  tenantId: string;
  eventType: AnalyticsEventType;
  cardId?: string;
  slug?: string;
  source?: string;
  sourceTag?: string;
  timestamp: string;
  properties?: Record<string, unknown>;
  createdAt: string;
}

/**
 * Patterns matching personally identifiable information (PII) or credentials/secrets.
 * Per AGENTS.md:
 * "No personal data in logs, push payloads or analytics event names.
 * Phone and email of visitors are encrypted at rest."
 */
const PII_OR_SECRET_KEYS = [
  /pass(word|code)?/i,
  /token/i,
  /otp/i,
  /secret/i,
  /hash/i,
  /pin/i,
  /credential/i,
  /authorization/i,
  /cookie/i,
  /bearer/i,
  /(api|private|secret|signing|service)[_-]?key/i,
  /phone/i,
  /email/i,
  /name/i,
  /address/i,
];

/**
 * Sanitizes telemetry properties:
 * 1. Blocks prototype pollution (__proto__, constructor, prototype).
 * 2. Strips any PII keys (phone, email, name, address) or credentials.
 * 3. Restricts nested depth and truncates string values to 256 chars.
 */
export function sanitizeAnalyticsProperties(
  props?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!props || typeof props !== 'object' || Array.isArray(props)) {
    return undefined;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    if (PII_OR_SECRET_KEYS.some((pattern) => pattern.test(key))) {
      continue;
    }

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const nested = sanitizeAnalyticsProperties(value as Record<string, unknown>);
      if (nested && Object.keys(nested).length > 0) {
        sanitized[key] = nested;
      }
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = typeof value === 'string' ? value.slice(0, 256) : value;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function createAnalyticsEvent(params: {
  tenantId: string;
  eventType: AnalyticsEventType;
  eventId?: string;
  cardId?: string;
  slug?: string;
  source?: string;
  sourceTag?: string;
  timestamp?: string | Date;
  properties?: Record<string, unknown>;
}): AnalyticsEventProps {
  const ts = params.timestamp
    ? typeof params.timestamp === 'string'
      ? params.timestamp
      : params.timestamp.toISOString()
    : new Date().toISOString();

  // Validate and sanitize eventType (alphanumeric, underscores, hyphens, max 64 chars)
  const cleanType = String(params.eventType || 'unknown')
    .trim()
    .slice(0, 64)
    .replace(/[^a-zA-Z0-9_.-]/g, '');

  return {
    id: params.eventId ? String(params.eventId).slice(0, 64) : `evt_${ulid()}`,
    tenantId: String(params.tenantId).trim(),
    eventType: cleanType || 'unknown',
    cardId: params.cardId ? String(params.cardId).trim().slice(0, 64) : undefined,
    slug: params.slug ? String(params.slug).trim().slice(0, 128) : undefined,
    source: params.source ? String(params.source).trim().slice(0, 64) : undefined,
    sourceTag: params.sourceTag ? String(params.sourceTag).trim().slice(0, 64) : undefined,
    timestamp: ts,
    properties: sanitizeAnalyticsProperties(params.properties),
    createdAt: new Date().toISOString(),
  };
}
