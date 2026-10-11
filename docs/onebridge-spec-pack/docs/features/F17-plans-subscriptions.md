# F17: Plans, subscriptions and limits
Priority: Must     Build step: 5     Depends on: F16
Source: PRD v1.1 section 10, P1-BILL-01, -02, -04, -05

## User story
As an owner, I choose a plan, pay, and my limits apply automatically.

## Acceptance criteria
- Plans (prices exclude 18% GST): **Starter** 199 per seat per month (159 annual), 1 to 25 seats, 1 branch. **Business** 349 per seat per month (279 annual), 10 to 1,000 seats, unlimited branches. **Enterprise**: contact sales (from about 450, 100 seats minimum). No free plan and no trial.
- Monthly and annual billing. Razorpay: UPI (including AutoPay mandates), cards, netbanking. Enterprise by invoice.
- Seat add and remove with proration. Upgrade and downgrade. Downgrade never deletes data; over-limit seats become read-only.
- Payment step position is controlled by flag `payment_after_first_card`.
- Dunning at D+1, D+3, D+7 with a 7-day grace period.
- Webhooks: signature verified, idempotent, out-of-order safe.
- The fake `PlanLimits` is replaced by the real one, backed by subscription state. Limits table lives in config and is covered by tests per plan: seats, branches, templates, catalogue items (50 Starter, unlimited Business), analytics retention (90 days Starter, 1 year Business), audit retention, MFA rule (mandatory for Owner and Admin on Business and above).
- Event `plan_limits.changed` on every change; consumers apply within 60 seconds.
- Payments data in PostgreSQL with Prisma (ADR for the engine remains OPEN-PAYDB; default is PostgreSQL).

## States to design
Plan picker, checkout, payment failed, retrying, grace period, over-limit, downgrade warning.

## API and events
`GET /plans`, `POST /subscriptions`, `PATCH /subscriptions/{id}` (seats, plan), `POST /webhooks/razorpay`. Events: `plan_limits.changed`, `subscription.status_changed`.

## Tests required
Proration math, webhook replay and ordering, limit enforcement per plan, downgrade keeps data, dunning schedule with fake clock.

## Out of scope
Coupons and reseller codes (Should, later), add-ons beyond NFC.
