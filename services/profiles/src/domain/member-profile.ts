/**
 * N01: member accounts and personal profiles (D-NETWORK).
 * A person can join without a company. Contact details are never part of a
 * profile (D-CONTACT): phone and email live only in identity.
 */

export type ProfileVisibility = 'everyone' | 'members';

export interface ConsentRecord {
  type: 'member_notice';
  version: string;
  acceptedAt: string;
}

export interface MemberProfileProps {
  personId: string;
  handle: string;
  previousHandles: string[];
  name: string;
  headline?: string;
  photoUrl?: string;
  coverUrl?: string;
  city?: string;
  about?: string;
  skills: string[];
  languages: string[];
  visibility: ProfileVisibility;
  /** Search-engine indexing; off by default for individuals (N01). */
  indexable: boolean;
  ageConfirmedAt: string;
  consents: ConsentRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkHistoryProps {
  id: string;
  personId: string;
  source: 'seat' | 'self';
  tenantId?: string;
  seatId?: string;
  companyName: string;
  title: string;
  startDate: string;
  endDate?: string;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileUpdateInput {
  name?: unknown;
  handle?: unknown;
  headline?: unknown;
  photoUrl?: unknown;
  coverUrl?: unknown;
  city?: unknown;
  about?: unknown;
  skills?: unknown;
  languages?: unknown;
  ageConfirmed?: unknown;
  noticeVersion?: unknown;
  visibility?: unknown;
  indexable?: unknown;
}

/** The member privacy notice accepted at sign-up (N01, N10). Bump on any change to the text. */
export const MEMBER_NOTICE_VERSION = 'member-notice-2026-10';

export const HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]{2,39}$/;
/** Paths on web-public and words that would confuse people as handles. */
const RESERVED_HANDLES = new Set(['admin', 'api', 'app', 'directory', 'search', 'login', 'signup', 'settings', 'help', 'support', 'onebridge', 'grid', 'privacy', 'terms', 'me', 'new', 'edit']);

export class ProfileValidationError extends Error {
  constructor(message: string, public readonly code: string = 'invalid') {
    super(message);
    this.name = 'ProfileValidationError';
  }
}

function text(value: unknown, max: number, label: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new ProfileValidationError(`${label} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new ProfileValidationError(`${label} can be at most ${max} characters.`);
  return trimmed || undefined;
}

function httpsUrl(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new ProfileValidationError(`${label} must be a link.`);
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') throw new Error('not https');
    return url.toString();
  } catch {
    throw new ProfileValidationError(`${label} must be an https link.`);
  }
}

function list(value: unknown, maxItems: number, maxLength: number, label: string): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new ProfileValidationError(`${label} must be a list.`);
  const items = value.map((v) => (typeof v === 'string' ? v.trim() : '')).filter(Boolean);
  if (items.length > maxItems) throw new ProfileValidationError(`You can add up to ${maxItems} ${label.toLowerCase()}.`);
  for (const item of items) {
    if (item.length > maxLength) throw new ProfileValidationError(`Each of your ${label.toLowerCase()} can be at most ${maxLength} characters.`);
  }
  // Case-insensitive de-duplication, keeping the first spelling.
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.toLowerCase()) ? false : (seen.add(i.toLowerCase()), true)));
}

export function normaliseHandle(value: unknown): string {
  if (typeof value !== 'string') throw new ProfileValidationError('Choose a profile address.', 'invalid_handle');
  const handle = value.trim().toLowerCase();
  if (!HANDLE_PATTERN.test(handle)) {
    throw new ProfileValidationError('Use 3 to 40 lowercase letters, numbers or hyphens, starting with a letter or number.', 'invalid_handle');
  }
  if (RESERVED_HANDLES.has(handle)) throw new ProfileValidationError('That address is reserved. Choose another.', 'handle_taken');
  return handle;
}

/** A starting handle from the name, e.g. "Meera Iyer" -> "meera-iyer". */
export function handleFromName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 32)
    .replace(/^-|-$/g, '');
  return base.length >= 3 ? base : `member${base ? `-${base}` : ''}`;
}

/** Validated changes from a PUT /me/profile body (only the fields that were sent). */
export function validateProfileUpdate(input: ProfileUpdateInput): Partial<MemberProfileProps> {
  const out: Partial<MemberProfileProps> = {};
  if (input.name !== undefined) {
    const name = text(input.name, 80, 'Name');
    if (!name) throw new ProfileValidationError('Enter your name.');
    out.name = name;
  }
  if (input.handle !== undefined) out.handle = normaliseHandle(input.handle);
  if (input.headline !== undefined) out.headline = text(input.headline, 120, 'Headline');
  if (input.photoUrl !== undefined) out.photoUrl = httpsUrl(input.photoUrl, 'Photo');
  if (input.coverUrl !== undefined) out.coverUrl = httpsUrl(input.coverUrl, 'Cover image');
  if (input.city !== undefined) out.city = text(input.city, 60, 'City');
  if (input.about !== undefined) out.about = text(input.about, 2000, 'About');
  if (input.skills !== undefined) out.skills = list(input.skills, 30, 40, 'Skills') ?? [];
  if (input.languages !== undefined) out.languages = list(input.languages, 10, 30, 'Languages') ?? [];
  if (input.visibility !== undefined) {
    if (input.visibility !== 'everyone' && input.visibility !== 'members') throw new ProfileValidationError('Choose who can see your profile.');
    out.visibility = input.visibility;
  }
  if (input.indexable !== undefined) out.indexable = input.indexable === true;
  return out;
}

export interface WorkHistoryInput {
  companyName?: unknown;
  title?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  hidden?: unknown;
}

function isoDate(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new ProfileValidationError(`${label} must be a date (YYYY-MM-DD).`);
  }
  return value;
}

/** A self-reported role. Partial validation for updates when `partial` is true. */
export function validateWorkHistory(input: WorkHistoryInput, partial = false): Partial<WorkHistoryProps> {
  const out: Partial<WorkHistoryProps> = {};
  if (!partial || input.companyName !== undefined) {
    const companyName = text(input.companyName, 120, 'Company');
    if (!companyName) throw new ProfileValidationError('Enter the company.');
    out.companyName = companyName;
  }
  if (!partial || input.title !== undefined) {
    const title = text(input.title, 120, 'Role');
    if (!title) throw new ProfileValidationError('Enter your role.');
    out.title = title;
  }
  if (!partial || input.startDate !== undefined) {
    const start = isoDate(input.startDate, 'Start date');
    if (!start) throw new ProfileValidationError('Enter when you started.');
    out.startDate = start;
  }
  if (input.endDate !== undefined) out.endDate = isoDate(input.endDate, 'End date');
  if (out.startDate && out.endDate && out.endDate < out.startDate) {
    throw new ProfileValidationError('The end date is before the start date.');
  }
  if (input.hidden !== undefined) out.hidden = input.hidden === true;
  return out;
}

export type CompletenessItem = 'photo' | 'headline' | 'city' | 'about' | 'skill';

/** N01: shown only to the member themselves. */
export function completeness(profile: Pick<MemberProfileProps, 'photoUrl' | 'headline' | 'city' | 'about' | 'skills'>): {
  done: number;
  missing: CompletenessItem[];
} {
  const checks: Array<[CompletenessItem, boolean]> = [
    ['photo', Boolean(profile.photoUrl)],
    ['headline', Boolean(profile.headline)],
    ['city', Boolean(profile.city)],
    ['about', Boolean(profile.about)],
    ['skill', profile.skills.length > 0],
  ];
  return { done: checks.filter(([, ok]) => ok).length, missing: checks.filter(([, ok]) => !ok).map(([k]) => k) };
}

/** Newest first: current roles (no end date) before past ones, then by start date. */
export function sortWorkHistory<T extends Pick<WorkHistoryProps, 'startDate' | 'endDate'>>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    if (!a.endDate !== !b.endDate) return a.endDate ? 1 : -1;
    return b.startDate.localeCompare(a.startDate);
  });
}
