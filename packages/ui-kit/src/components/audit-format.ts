/**
 * Turns audit codes (e.g. "seat.created") into plain sentences for the
 * dashboard, so admins never have to read event codes or IDs.
 */

export interface AuditActionOption {
  value: string;
  label: string;
}

const ACTION_VERBS: Record<string, string> = {
  'org.created': 'created the company',
  'org.updated': 'updated the company profile',
  'org.brand_updated': 'updated the brand kit',
  'org.locks_updated': 'changed which card fields are locked',
  'branch.created': 'added the branch',
  'branch.updated': 'updated the branch',
  'branch.archived': 'archived the branch',
  'department.created': 'added the department',
  'department.updated': 'updated the department',
  'department.archived': 'archived the department',
  'department.defaults_seeded': 'added the default departments',
  seed_defaults: 'added the default departments',
  'team.created': 'added the team',
  'team.updated': 'updated the team',
  'team.archived': 'archived the team',
  'seat.created': 'created the seat',
  'seat.updated': 'updated the seat',
  'seat.assigned': 'assigned a person to the seat',
  'seat.archived': 'offboarded the seat',
  'tree.person_moved': 'moved a person in the org chart',
  'card.published': 'published the card',
  'card.updated': 'updated the card',
};

export const AUDIT_ACTION_OPTIONS: AuditActionOption[] = [
  { value: 'seat.created', label: 'Seat created' },
  { value: 'seat.updated', label: 'Seat updated' },
  { value: 'seat.assigned', label: 'Person assigned' },
  { value: 'seat.archived', label: 'Seat offboarded' },
  { value: 'branch.created', label: 'Branch added' },
  { value: 'branch.updated', label: 'Branch updated' },
  { value: 'branch.archived', label: 'Branch archived' },
  { value: 'department.created', label: 'Department added' },
  { value: 'team.created', label: 'Team added' },
  { value: 'org.brand_updated', label: 'Brand kit updated' },
  { value: 'org.locks_updated', label: 'Field locks changed' },
];

/** "seat.created" → "created the seat"; unknown codes become readable words. */
export function describeAuditAction(action: string): string {
  if (ACTION_VERBS[action]) return ACTION_VERBS[action];
  const [entity, verb] = action.split('.');
  if (!verb) return action.replace(/_/g, ' ');
  return `${verb.replace(/_/g, ' ')} the ${entity.replace(/_/g, ' ')}`;
}

/** Best human name for the thing an audit entry changed, taken from its recorded state. */
export function auditSubjectName(entry: {
  after?: Record<string, unknown> | null;
  before?: Record<string, unknown> | null;
}): string | undefined {
  const state = entry.after || entry.before || {};
  for (const key of ['name', 'title', 'label']) {
    const value = state[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

/** "Priya Kulkarni created the seat Head of Sales". */
export function describeAuditEntry(
  entry: { action: string; after?: Record<string, unknown> | null; before?: Record<string, unknown> | null },
  actorName: string
): string {
  const subject = auditSubjectName(entry);
  return `${actorName} ${describeAuditAction(entry.action)}${subject ? ` ${subject}` : ''}`;
}

const relativeFormatter =
  typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl
    ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
    : null;

/** "2 hours ago", "yesterday", or a date for anything older than a week. */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const seconds = Math.round((then.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (!relativeFormatter || abs >= 7 * 86400) {
    return then.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  if (abs < 60) return 'just now';
  if (abs < 3600) return relativeFormatter.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return relativeFormatter.format(Math.round(seconds / 3600), 'hour');
  return relativeFormatter.format(Math.round(seconds / 86400), 'day');
}
