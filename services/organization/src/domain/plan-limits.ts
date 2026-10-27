/**
 * Plan limits (N02, plan section 5.1). Values are the founder-approved
 * samples (Q-NET-3) and stay configurable here until F17 replaces this
 * table with the billing service's PlanLimits. `null` means unlimited.
 */
export type Plan = 'free' | 'starter' | 'business' | 'enterprise';

export const PLANS: Plan[] = ['free', 'starter', 'business', 'enterprise'];

export type LimitKey =
  | 'seats'
  | 'branches'
  | 'posts_per_month'
  | 'catalogue_items'
  | 'inbox_users'
  | 'call_requests_per_month'
  | 'requirement_responses_per_month'
  | 'relationships';

export const PLAN_LIMITS: Record<Plan, Record<LimitKey, number | null>> = {
  free: {
    seats: 0,
    branches: 1,
    posts_per_month: 2,
    catalogue_items: 10,
    inbox_users: 1,
    call_requests_per_month: 5,
    requirement_responses_per_month: 3,
    relationships: 0,
  },
  starter: {
    seats: 25,
    branches: 1,
    posts_per_month: null,
    catalogue_items: 50,
    inbox_users: null,
    call_requests_per_month: null,
    requirement_responses_per_month: 20,
    relationships: 10,
  },
  business: {
    seats: 1000,
    branches: null,
    posts_per_month: null,
    catalogue_items: null,
    inbox_users: null,
    call_requests_per_month: null,
    requirement_responses_per_month: 100,
    relationships: null,
  },
  enterprise: {
    seats: null,
    branches: null,
    posts_per_month: null,
    catalogue_items: null,
    inbox_users: null,
    call_requests_per_month: null,
    requirement_responses_per_month: null,
    relationships: null,
  },
};

export function isPlan(value: unknown): value is Plan {
  return typeof value === 'string' && (PLANS as string[]).includes(value);
}

export function limitFor(plan: string | undefined, key: LimitKey): number | null {
  return PLAN_LIMITS[isPlan(plan) ? plan : 'starter'][key];
}

/** Which plan removes a limit, for "upgrade to" messages. */
export function nextPlanFor(plan: string | undefined): string {
  return plan === 'free' ? 'Starter' : 'Business';
}
