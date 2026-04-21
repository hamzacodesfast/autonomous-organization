# Autonomous Organization

Autonomous Organization is a streetwear label run by machines.

This repository contains the public brand constitution, launch runbook, product records, operational templates, and application scaffold for Local releases.

## Canonical Documents

- Brand spec: `docs/AUTONOMOUS_ORGANIZATION_BRAND_SPEC.md`
- Launch runbook: `docs/OPERATOR_RUNBOOK.md`
- Production launch package: `docs/LOCAL_001_PRODUCTION_LAUNCH_PACKAGE.md`
- Hetzner VPS setup: `docs/HETZNER_VPS_SETUP.md`
- Local No. 001 record: `source/locals/001/LOCAL_RECORD.md`

## Private Documents

`OPERATOR_REGISTER` is private operator material and is intentionally ignored by Git.

Never commit:

- `.env`
- API keys
- passwords
- seed phrases
- recovery codes
- bank information
- raw customer data

## Current Gate

Gate 4 remains in prelaunch readiness. `AO-APPROVAL-0007` was exercised as a controlled production rehearsal, then closed cleanly. Official launch remains pending Hermes runtime implementation and a later operator approval.

## Local Development

Install dependencies:

```bash
npm install
```

Run checks:

```bash
npm run lint
npm run typecheck
npm run build
npm run test:inventory
npm run test:checkout
npm run test:printify
npm run launch:preflight
```

## Local Postgres

Docker is required for the local Postgres workflow.

Start Postgres, apply migrations, and seed Local No. 001:

```bash
npm run db:check
npm run db:up
npm run db:migrate
npm run seed
```

The public site uses static fallback data unless database reads are explicitly enabled:

```bash
ENABLE_DATABASE_READS=true npm run dev
```

Keep real secrets in `.env` or the human-controlled secret store. `.env.example` must contain placeholder values only.

## Stripe Test Checkout

Stripe Checkout is disabled until the local database is migrated, seeded, and explicit test-mode variables are set.

Required local environment values:

```bash
ENABLE_DATABASE_READS=true
STRIPE_CHECKOUT_ENABLED=true
STRIPE_TEST_MODE_ONLY=true
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_REQUIRE_TERMS_CONSENT=false
```

Forward Stripe test webhooks to the app:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Then start the app:

```bash
ENABLE_DATABASE_READS=true STRIPE_CHECKOUT_ENABLED=true npm run dev
```

Use Stripe-hosted Checkout from `/locals/001`. The browser success page does not allocate inventory; only signed Stripe webhooks can mark orders paid.

Set `STRIPE_REQUIRE_TERMS_CONSENT=true` only after the Stripe Dashboard public business details include the approved Terms of Service URL.

## Printify Fulfillment Guard

Paid Stripe webhook allocation creates a local fulfillment draft row in Postgres.

Printify API order creation is blocked unless this flag is explicitly enabled:

```bash
PRINTIFY_ENABLED=true
```

When enabled, the webhook creates a Printify draft order for the approved Local No. 001 product and variant mapping. It does not call Printify's `send_to_production` endpoint.

## Launch Preflight

Locked mode verifies that public checkout and Printify are closed:

```bash
npm run launch:preflight
```

Launch mode is only for an explicitly approved production rehearsal or public launch window:

```bash
npm run launch:preflight -- --mode=launch
```

## Hetzner Production Stack

The VPS deployment uses:

- `Dockerfile`
- `docker-compose.production.yml`
- `deploy/production.env.example`
- `deploy/Caddyfile.example`

Production compose commands run from `/srv/autonomous-organization/app`:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml build
docker compose --env-file .env.production -f docker-compose.production.yml up -d
```
