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

Status: launch mode closed; post-launch reconciliation pending

Next build target:

- reconcile Stripe, Postgres, and Printify counts
- record fulfillment exceptions and postmortem notes

Completed:

- production launch package preparation approved: `AO-APPROVAL-0006`
- production launch package document drafted
- launch preflight script added
- locked launch preflight passed with local paid-order reconciliation warning
- public launch window approved: `AO-APPROVAL-0007`
- Hetzner VPS `ao-production-001` provisioned
- SSH shortcut `ao-production` verified with deploy user
- `ao_deploy` sudo user created
- server SSH hardening applied
- server firewall enabled for SSH, HTTP, and HTTPS
- Docker, Docker Compose, and Caddy installed on Hetzner
- deploy user verified for Docker access
- app repo cloned to Hetzner at `/srv/autonomous-organization/app`
- production env file created on Hetzner with checkout, Stripe live mode, and Printify fuses locked
- production Docker image built on Hetzner with OpenSSL available for Prisma
- production Postgres container started and healthy
- initial Prisma migration applied against production Postgres
- Local No. 001 seeded in production Postgres with `100` total units and `20` each for `S`, `M`, `L`, `XL`, and `XXL`
- app container started and healthy on `127.0.0.1:3000`
- Caddy configured in HTTP IP-smoke mode to reverse proxy `127.0.0.1:3000`
- VPS-local health check passed at `http://127.0.0.1/api/health`
- public Hetzner firewall opened for HTTP/HTTPS by human operator
- public health check passed at `http://62.238.9.164/api/health`
- public Local No. 001 page verified in locked mode with checkout disabled
- `autonomousorganization.io` and `www.autonomousorganization.io` now resolve to `62.238.9.164` on authoritative and major public resolvers
- Caddy switched from HTTP IP-smoke mode to production HTTPS domain mode
- `https://autonomousorganization.io` verified with valid TLS
- `https://www.autonomousorganization.io` verified redirecting to apex
- production app URLs updated to `https://autonomousorganization.io`
- deployed locked preflight passed on Hetzner with live Stripe key kind and closed checkout/Printify fuses
- disabled checkout redirect verified on production domain without localhost leakage
- production Stripe webhook signing secret synced to Hetzner
- production webhook route reached over public HTTPS
- live webhook processing correctly blocked while `STRIPE_TEST_MODE_ONLY=true`
- production launch fuses opened on Hetzner:
  - `STRIPE_CHECKOUT_ENABLED=true`
  - `STRIPE_TEST_MODE_ONLY=false`
  - `PRINTIFY_ENABLED=true`
- Local No. 001 switched to `LIVE` in production Postgres
- launch-mode preflight passed on Hetzner
- launch-mode preflight warnings recorded:
  - `STRIPE_REQUIRE_TERMS_CONSENT` is still not `true`
  - `STRIPE_AUTOMATIC_TAX_ENABLED` is still not `true`
- public Local No. 001 page verified with live `Checkout` label
- production webhook accepted a signed probe event in live mode and returned `ignored`
- production launch fuses re-locked on Hetzner:
  - `STRIPE_CHECKOUT_ENABLED=false`
  - `STRIPE_TEST_MODE_ONLY=true`
  - `PRINTIFY_ENABLED=false`
- locked preflight passed on Hetzner after launch-mode closure
- public Local No. 001 page re-verified with `Checkout Disabled`
- checkout session route re-verified redirecting to `checkout_disabled`
- public dashboard updated to:
  - `localStatus=live`
  - `uptime=post-launch`
  - `lastSanitizedAction=Local No. 001 launch window closed; checkout disabled`

Blocked locally:

- none
