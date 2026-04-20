# Local No. 001 Production Launch Package

Date: 2026-04-20
Prepared for: Autonomous Organization
Local: `001`

## Authority

This package records the approved public launch window and the remaining production controls.

Current approvals on record:

- `AO-APPROVAL-0001` — token work frozen until after commerce launch
- `AO-APPROVAL-0002` — public policy and contact text approved
- `AO-APPROVAL-0003` — Local No. 001 physical sample / production proof approved
- `AO-APPROVAL-0004` — shipping included and tax behavior accepted by operator
- `AO-APPROVAL-0006` — prepare production launch package
- `AO-APPROVAL-0007` — final public launch window approved

## Current Position

Local No. 001 has a production asset, Printify product mapping, policy pages, Stripe Checkout flow, signed webhook allocation, duplicate webhook protection, and controlled Printify draft submission.

The live checkout rehearsal was reported complete by the operator. Independent Stripe/Postgres/Printify verification was intentionally skipped at operator request and recorded that way in `ops/GATE_STATUS.md`.

Default safe state:

```bash
STRIPE_CHECKOUT_ENABLED=false
STRIPE_TEST_MODE_ONLY=true
PRINTIFY_ENABLED=false
TOKEN_WORK_FROZEN=true
```

## Production Blockers

Public launch remains blocked until all are true:

- production deployment target is selected and reachable over HTTPS
- Hetzner SSH access works through the `ao_deploy` user
- live Stripe webhook endpoint is configured for the production URL
- production `STRIPE_WEBHOOK_SECRET` matches the production endpoint
- production env passes `npm run launch:preflight -- --mode=launch`
- Local No. 001 database state is `LIVE`
- public dashboard status is updated to live or launch-window language
- operator confirms tax/accounting handling remains accepted for launch
- operator confirms support inbox is actively monitored

## Local Locked Preflight

Run this whenever the system should be safe and closed:

```bash
npm run launch:preflight
```

Expected locked state:

```bash
STRIPE_CHECKOUT_ENABLED=false
STRIPE_TEST_MODE_ONLY=true
PRINTIFY_ENABLED=false
```

This mode verifies the fuses are closed and catches accidental live-key exposure outside a launch window.

## Launch Window Environment

Only during the approved launch window:

```bash
ENABLE_DATABASE_READS=true
STRIPE_CHECKOUT_ENABLED=true
STRIPE_TEST_MODE_ONLY=false
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CHECKOUT_RESERVATION_MINUTES=31
STRIPE_ALLOWED_SHIPPING_COUNTRIES=US,CA,GB,AU,DE,FR,NL,SE,JP
STRIPE_REQUIRE_TERMS_CONSENT=true
PRINTIFY_ENABLED=true
PRINTIFY_API_TOKEN=...
PRINTIFY_SHOP_ID=...
PRINTIFY_PRODUCT_ID=69e5bbbbc109d487ac09e911
PRINTIFY_VARIANT_ID_S=12126
PRINTIFY_VARIANT_ID_M=12125
PRINTIFY_VARIANT_ID_L=12124
PRINTIFY_VARIANT_ID_XL=12127
PRINTIFY_VARIANT_ID_XXL=12128
PRINTIFY_SHIPPING_METHOD=1
PRINTIFY_SEND_SHIPPING_NOTIFICATION=false
TOKEN_WORK_FROZEN=true
```

Before setting `STRIPE_REQUIRE_TERMS_CONSENT=true`, the Stripe Dashboard public business details must include the approved Terms URL.

## Production Database Switch

After `AO-APPROVAL-0007`, set Local No. 001 live in the production database:

```sql
UPDATE "Local"
SET "state" = 'LIVE',
    "launchTimestamp" = NOW()
WHERE "localNumber" = '001';

UPDATE "DashboardSnapshot"
SET "localStatus" = 'live',
    "uptime" = 'launch window',
    "lastSanitizedAction" = 'Local No. 001 launch window opened'
WHERE "id" = 'dashboard-prelaunch-001';
```

Do not run this against the local test database and mistake that for production.

## Launch Preflight

Run immediately before opening checkout:

```bash
npm run lint
npm run typecheck
npm run test:inventory
npm run test:checkout
npm run test:printify
npm run launch:preflight -- --mode=launch
```

The launch preflight blocks on:

- checkout disabled when launch mode expects it open
- Printify disabled when launch mode expects it open
- live key safety still on
- non-live Stripe keys
- missing webhook signing secret
- placeholder Printify values
- bad reservation window
- bad shipping country list
- Local No. 001 not `LIVE`
- SKU ceilings not exactly `20` each for `S`, `M`, `L`, `XL`, `XXL`
- active pre-launch reservations

Warnings must be read aloud by the operator before continuing.

## Public Launch Steps

1. Complete `docs/HETZNER_VPS_SETUP.md`.
2. Confirm `.env` or production secret store is in launch-window state.
3. Apply migrations to production.
4. Apply the production database switch.
5. Run launch preflight in production environment.
6. Deploy the current `main`.
7. Open `/locals/001`.
8. Confirm button text says `Checkout`, not `Test Checkout`.
9. Place exactly one operator smoke purchase only if the launch window requires it.
10. Monitor Stripe webhooks for `checkout.session.completed`.
11. Monitor Postgres for paid allocation and no oversell.
12. Monitor Printify for draft order creation.
13. Keep `send_to_production` manual unless a later approval wires automatic production submission.
14. Publish public/social launch copy only after checkout and fulfillment records look correct.

## Rollback

If anything is wrong:

```bash
STRIPE_CHECKOUT_ENABLED=false
PRINTIFY_ENABLED=false
```

Then restart or redeploy the app.

Follow-up checks:

- confirm `/locals/001` shows checkout disabled
- check active reservations and expire/cancel if needed
- check Stripe Dashboard for incomplete or paid sessions
- check Printify for unplanned draft orders
- post a short incident note in `#ops-log`

Never delete paid orders to make numbers look clean. Reconcile them.

## Post Launch

Within 72 hours:

- reconcile Stripe, Postgres, and Printify counts
- record orders paid, orders submitted, and fulfillment exceptions
- prepare postmortem from `docs/POSTMORTEM_TEMPLATE.md`
- keep token work frozen until commerce launch is explicitly closed by a later approval

## Recorded Final Launch Approval

```text
AO-APPROVAL-0007

Approved: public launch window for Local No. 001.

Scope:
- open public checkout for Local No. 001
- use live Stripe keys and production webhook secret
- enable Printify draft order submission
- keep Printify send-to-production manual
- keep token work frozen
- publish approved launch copy after checkout sanity check

Approved by: hamzacodesfast
Date: 2026-04-20
```

## References

- Stripe Go-live checklist: https://docs.stripe.com/get-started/checklist/go-live
- Stripe webhook configuration and best practices: https://docs.stripe.com/webhooks/configure
- Stripe Checkout Sessions API: https://docs.stripe.com/api/checkout/sessions
- Printify order API: https://developers.printify.com/API-Doc-RREdits.html
- Hetzner VPS setup: `docs/HETZNER_VPS_SETUP.md`
