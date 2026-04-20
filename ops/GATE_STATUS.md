# Gate Status

Last updated: 2026-04-20

## Gate 0 — Legal And Account Shell

Status: complete

Human operator reported complete:

- Runbook § 1.1 — legal shell
- Runbook § 1.2 — production accounts
- Runbook § 1.3 — Discord control room
- Runbook § 1.4 — token work frozen until after commerce launch

Remaining Gate 0 confirmations:

- none

Completed after initial report:

- local Git identity configured
- first repository commit completed: `a1ecf55`
- GitHub `origin/main` synced: `b780e8f`
- Discord approval recorded: `AO-APPROVAL-0001`
- non-secret operator identifiers supplied to Codex

Operator launch inputs:

- legal entity name: Autonomous Organization
- public support email: autonomousorganization@protonmail.com
- desired first launch date: N/A
- target retail price for Local No. 001: $50 USD
- shipping countries for launch: International
- token work frozen until after commerce launch: yes

## Gate 1 — Static Site And Commerce Scaffold

Status: complete

Next build target:

- none

Completed:

- policy text human-approved: `AO-APPROVAL-0002`
- Printify draft product created and mapped for Local No. 001
- Printify enabled variant IDs recorded for black `S`, `M`, `L`, `XL`, and `2XL`
- Printify back mockup recorded for Local No. 001
- Discord webhooks that previously appeared in `.env.example` confirmed rotated by human operator
- failed Stripe test card checkout verified with no inventory allocation
- failed Checkout Session expiration cleanup verified against local Postgres
- declined-card webhook events observed with 200 responses
- hosted Stripe test card purchase completed through Checkout
- paid hosted Checkout webhook verified against local Postgres allocation path
- duplicate Stripe webhook replay verified through local endpoint
- Stripe CLI installed and authenticated on workstation
- Stripe CLI webhook forwarding verified against local endpoint
- Stripe test event burst verified with all webhook responses returning 200
- Checkout Session creation verified through app route
- Checkout Session expiration webhook verified against local Postgres cleanup path
- retry handling added for concurrent Stripe webhook transaction conflicts
- Stripe Node SDK added
- Stripe test-mode Checkout Session route added
- Stripe signed webhook route added
- webhook duplicate protection verified through `WebhookEvent`
- paid checkout webhook allocation verified against local Postgres
- product page test-checkout form added behind `STRIPE_CHECKOUT_ENABLED`
- local Postgres Docker Compose file added
- local database prerequisite check added
- initial Prisma migration generated
- local Postgres started through Docker Compose
- initial Prisma migration applied against local Postgres
- Local No. 001 seeded into local Postgres
- database-backed Local/dashboard reads verified with `ENABLE_DATABASE_READS=true`
- static website pages scaffolded
- Local No. 001 public page scaffolded
- public dashboard shell scaffolded
- policy/contact pages scaffolded
- database schema drafted
- Local No. 001 seed drafted
- database-backed Local/dashboard read layer added with static fallback
- inventory reservation module and tests added

Blocked locally:

- none

## Gate 2 — Production Files And Proof

Status: complete

Next build target:

- none

Completed:

- shipping profile and tax behavior human-confirmed: `AO-APPROVAL-0004`
- Local No. 001 physical sample / production proof human-approved: `AO-APPROVAL-0003`
- Local No. 001 production file generated and checksum recorded
- Printify draft product mockup generated and recorded
- Printify variant mapping recorded for fulfillment integration

Blocked locally:

- none

## Gate 3 — Live Checkout Rehearsal

Status: complete per operator report

Next build target:

- none

Completed:

- controlled Printify fulfillment draft submission built behind disabled `PRINTIFY_ENABLED` flag
- controlled Printify draft order submission verified from Stripe test checkout; no production send endpoint is wired
- live checkout payment completed per operator report; independent Stripe/Postgres/Printify verification intentionally skipped at operator request
- post-rehearsal local fuses returned to disabled state

Blocked locally:

- none

## Gate 4 — Production Launch Package

Status: launch window approved; production preflight pending

Next build target:

- run locked launch preflight
- run production launch preflight in deployed environment
- open public checkout only after production preflight passes

Completed:

- production launch package preparation approved: `AO-APPROVAL-0006`
- production launch package document drafted
- launch preflight script added
- locked launch preflight passed with local paid-order reconciliation warning
- public launch window approved: `AO-APPROVAL-0007`

Blocked locally:

- production launch preflight has not been run in the deployed environment
