# AUTONOMOUS ORGANIZATION — LAUNCH RUNBOOK v0.1

> Purpose: turn the brand constitution into a working commerce operation without losing the premise, the inventory promise, or the operator's control.

Current date: 2026-04-19  
Canonical brand spec: `AUTONOMOUS_ORGANIZATION_BRAND_SPEC_v0.2.md`  
Launch target: Local No. 001, black Gildan 5000 tee, back print only, 100 units total.

---

## 0. Operating Principle

Autonomy starts after the rails exist.

The first version is not a fully autonomous company. The first version is a strict machine with human approvals. The Organization becomes autonomous by passing gates:

- Gate 0: legal and financial shell exists.
- Gate 1: website, database, inventory, checkout, and fulfillment work in test mode.
- Gate 2: Local No. 001 has approved production files and proof.
- Gate 3: live checkout processes one real purchase without oversell.
- Gate 4: agents may draft routine work, but human approval remains required for publishing during the first 30 days.

Do not launch the token, livestream, or social automation before commerce works.

---

## 1. Human Operator Commands

These are the tasks only the human operator can do. Complete them in order.

### 1.1 Create the legal shell

1. Choose the operating jurisdiction.
2. Form the legal entity before applying for an EIN if operating in the United States.
3. Apply for an EIN directly through the IRS if eligible. Do not pay a third-party EIN site.
4. Open a business bank account.
5. Use the existing ProtonMail address as the operator inbox for now. If domain email is created later, add `operator@autonomousorganization.io` and `support@autonomousorganization.io` as the public addresses.
6. Keep credentials in a secure human-controlled credential store. A physical password book is acceptable if it is private and physically secure. A password manager vault named `Autonomous Organization` is optional convenience, not an app dependency. Agents do not receive or use human account passwords.
7. Create a private plaintext or Markdown-style document named `OPERATOR_REGISTER`. The current local file is extensionless on purpose. Do not make this a `.env` file. It should contain:
   - legal entity name
   - registered address
   - responsible human
   - EIN or tax ID
   - bank name, last four digits only
   - Stripe account ID
   - Printify shop ID
   - Discord server ID
   - Hetzner project name
   - GitHub repo URL

Do not put passwords, API secret keys, webhook URLs, seed phrases, recovery codes, full bank numbers, or raw customer data in `OPERATOR_REGISTER`.

Stop if any of these create uncertainty. Ask a lawyer or CPA before continuing.

### 1.2 Verify production accounts

These accounts already exist. Verify each one:

- GitHub organization or repository
- Namecheap domain access for `autonomousorganization.io`
- Hetzner Cloud project
- Stripe account
- Printify account
- Discord server
- X account
- Instagram account
- TikTok account
- Phantom wallet
- Pump.fun account, but do not launch a token yet

Rules:

- Every account uses the ProtonMail/operator email or domain business email where possible.
- Every account has MFA enabled.
- Recovery codes go into the secure human-controlled credential store, never into Git or chat.
- Agents do not receive root credentials.

### 1.3 Create Discord control room

Create a private Discord server with these channels:

- `#alerts`
- `#drops-pending-approval`
- `#approvals`
- `#ops-log`
- `#customer-escalations`
- `#deploys`
- `#postmortems`

Create incoming webhooks for:

- alerts
- deploys
- ops-log

For each webhook:

1. Open the target Discord channel.
2. Open channel settings with the gear icon or right-click the channel and choose `Edit Channel`.
3. Go to `Integrations`.
4. Choose `Create Webhook`, or `View Webhooks` then `New Webhook` if webhooks already exist.
5. Name the webhook after the channel:
   - `AO Alerts` for `#alerts`
   - `AO Deploys` for `#deploys`
   - `AO Ops Log` for `#ops-log`
6. Confirm the webhook posts to the correct channel.
7. Copy the webhook URL.

Store webhook URLs only in the secret store. Use these environment variable names later:

- `DISCORD_ALERTS_WEBHOOK_URL`
- `DISCORD_DEPLOYS_WEBHOOK_URL`
- `DISCORD_OPS_LOG_WEBHOOK_URL`

### 1.4 Freeze the token

Do not claim that any token grants ownership, revenue, profit, governance, dividends, product entitlement, or market upside.

Do not launch the token until:

- commerce is live and stable
- livestream fallback scene is tested
- a lawyer has reviewed public language
- the human has explicitly approved token scope

For launch, the Organization is a streetwear label. The token is outside the critical path.

---

## 2. Technical Architecture

Use a boring stack. Boring is the production aesthetic.

### 2.1 Application stack

- Next.js with TypeScript
- PostgreSQL
- Prisma or Drizzle for database schema and migrations
- Stripe Checkout Sessions for payment
- Printify API for fulfillment
- Discord incoming webhooks for alerts
- Hetzner VPS for production
- Caddy or Nginx for HTTPS reverse proxy
- systemd or Docker Compose for process supervision

### 2.2 Core services

The app must have these modules:

- `brand`: reads the brand spec and exposes guardrails to agents
- `locals`: Local records, lifecycle states, concepts, assets, approvals
- `inventory`: SKU ceilings, reservations, allocations, reconciliation
- `checkout`: Stripe Checkout Session creation and payment callbacks
- `fulfillment`: Printify order submission and status sync
- `approvals`: human approval records
- `action_log`: append-only operational log
- `dashboard`: sanitized public fields
- `alerts`: Discord notifications
- `agent_drafts`: draft concepts, copy, and graphics awaiting approval

### 2.3 Database tables

Minimum tables:

- `locals`
- `local_skus`
- `inventory_reservations`
- `orders`
- `order_items`
- `payments`
- `fulfillment_orders`
- `approvals`
- `action_logs`
- `assets`
- `agent_drafts`
- `dashboard_snapshots`
- `webhook_events`

Hard rules:

- Postgres is the edition-count authority.
- Stripe is payment authority.
- Printify is fulfillment authority.
- No public sale occurs unless Postgres can reserve inventory first.

---

## 3. Local Workspace Setup

Run these commands from `/home/sixer/Desktop/Autonomous Organization`.

```bash
git init
git branch -m main
mkdir -p app docs ops scripts assets/locals/001 source/locals/001
mv AUTONOMOUS_ORGANIZATION_BRAND_SPEC_v0.2.md docs/
cp docs/AUTONOMOUS_ORGANIZATION_BRAND_SPEC_v0.2.md docs/AUTONOMOUS_ORGANIZATION_BRAND_SPEC.md
cp mockups/GILDAN5000_FRONT.png assets/
cp mockups/GILDAN5000_BACK.png assets/
```

Create the first commit only after `.gitignore` exists and no secrets are present.

### 3.1 Required files

Create:

- `.gitignore`
- `.env.example`
- `README.md`
- `docs/AUTONOMOUS_ORGANIZATION_BRAND_SPEC.md`
- `docs/OPERATOR_RUNBOOK.md`
- `docs/APPROVAL_REGISTER_TEMPLATE.md`
- `docs/LOCAL_RECORD_TEMPLATE.md`
- `docs/COMPLIANCE_REVIEW_TEMPLATE.md`
- `docs/POSTMORTEM_TEMPLATE.md`

Do not create `.env` in Git. `.env` is local only.

---

## 4. Build Order

Build in this order. Do not skip ahead.

### 4.1 Phase A — Static website

Ship a static site before adding payment.

Required pages:

- `/`
- `/locals/001`
- `/archive`
- `/dashboard`
- `/shipping`
- `/returns`
- `/privacy`
- `/terms`
- `/contact`

The first site may have no checkout button. It should display:

- Local No. 001
- launch status: `scheduled` or `pending approval`
- edition count: 100
- size allocation
- public dashboard fields
- contact address

Acceptance:

- no broken links
- mobile and desktop readable
- no forbidden language
- no customer data
- no raw logs

### 4.2 Phase B — Database and admin seed

Add Postgres and schema migrations.

Docker is required for the local Postgres workflow.

Local commands:

```bash
npm run db:check
npm run db:up
npm run prisma:validate
npm run db:migrate
npm run seed
```

The public site must keep `ENABLE_DATABASE_READS=false` until migration and seed have completed. Enable database reads only after the seeded Local No. 001 record has been verified.

Seed Local No. 001:

- Local number: `001`
- concept: `Local No. 001: founding artifact.`
- blank: `Gildan 5000`
- color: `Black`
- placement: back only
- edition count: `100`
- allocation: `S=30`, `M=30`, `L=30`, `XL=10`
- state: `concept_draft`

Acceptance:

- migration runs from scratch
- seed runs from scratch
- Local No. 001 appears in admin/internal view
- public site reads sanitized data from database

### 4.3 Phase C — Inventory reservations

Implement reservation flow:

1. Customer selects size.
2. Server starts database transaction.
3. Server checks approved SKU ceiling minus allocated minus active reservations.
4. Server creates reservation with expiration.
5. Server returns reservation ID.
6. Expired reservations release automatically.

Acceptance:

- 50 concurrent attempts for `XL` cannot reserve more than 10.
- reservation expiration works.
- admin reconciliation shows available, reserved, allocated, and sold-out counts.

### 4.4 Phase D — Stripe Checkout test mode

Implement Checkout Sessions.

Flow:

1. Reservation exists.
2. Server creates Stripe Checkout Session in test mode.
3. Stripe metadata includes internal order/reservation IDs only.
4. Browser redirects to Stripe-hosted checkout.
5. Webhook verifies Stripe signature using raw request body.
6. `checkout.session.completed` marks payment as paid.
7. Paid reservation converts to allocation.
8. Failed or expired Checkout releases reservation according to commerce rules.

Acceptance:

- successful test card produces paid order
- failed card does not allocate inventory
- duplicate webhook event does not duplicate order
- browser success page alone cannot allocate inventory
- Stripe POST requests use idempotency keys

### 4.5 Phase E — Printify draft fulfillment

Connect Printify in draft/test discipline.

Tasks:

1. Retrieve Printify shop ID.
2. Identify Gildan 5000 blueprint/variant IDs for approved sizes and black color.
3. Create Local No. 001 product draft.
4. Upload approved print file.
5. Generate mockups.
6. Confirm shipping profile and print provider.
7. Place one human-approved sample/proof order.

Acceptance:

- Printify product is not public unless approved.
- supplier, print provider, variant IDs, and shipping profile are recorded.
- sample/proof is approved before live sale.

### 4.6 Phase F — Policies

Publish human-approved:

- shipping policy
- returns/refunds policy
- privacy policy
- terms of service
- contact page

Minimum operational promises:

- state shipping timeframe plainly
- define what happens when fulfillment is delayed
- define damaged/misprinted item procedure
- define refund window and limitations
- provide support email
- do not promise restocks

Acceptance:

- footer links all policies
- checkout page links policies
- policy text is human-approved

### 4.7 Phase G — Deployment

Provision Hetzner:

1. Create SSH key locally.
2. Add public key to Hetzner.
3. Create VPS.
4. Configure firewall: SSH, HTTP, HTTPS only.
5. Install Docker or Node runtime.
6. Configure app environment.
7. Configure Caddy/Nginx HTTPS.
8. Configure database backups.
9. Deploy staging.
10. Deploy production.

Acceptance:

- production domain resolves over HTTPS
- health endpoint works
- secrets are not logged
- service restarts automatically
- database backup restore is tested

### 4.8 Phase H — Live checkout rehearsal

Before public launch:

1. Run complete test-mode purchase.
2. Run failed payment.
3. Run duplicate webhook replay.
4. Run expired reservation.
5. Run sold-out SKU.
6. Run refund.
7. Run Printify submission in controlled mode.
8. Run Discord alert test.
9. Run dashboard sanitization test.
10. Run secret scan.

Acceptance:

- every test result is logged
- no oversell
- no leaked private data
- no unapproved public copy

---

## 5. Local No. 001 Production Package

Create `source/locals/001/LOCAL_RECORD.md`.

It must contain:

- concept sentence
- approved blank
- approved color
- approved print provider
- production file path
- production file checksum
- front mockup path
- back mockup path
- placement measurement
- size allocation
- price
- gross margin
- shipping profile
- product copy
- social copy
- approval ID

Create production art:

```text
AUTONOMOUS
ORGANIZATION
LOCAL NO. 001
```

Rules:

- Inter Semi Bold
- black tee
- back only
- no chest hit
- 100 units
- no external imagery
- no token reference
- no AI reference in public copy

---

## 6. Agent Operating Model

### 6.1 First 30 days

Agents may:

- draft Local concepts
- draft product copy
- draft social copy
- update internal reports
- prepare staging records
- summarize dashboard metrics
- propose customer replies

Agents may not:

- publish product pages without approval
- send social posts without approval
- send customer emails without approval
- refund above approved bands
- change credentials
- alter DNS, Stripe live settings, Printify supplier, wallet, token, or livestream format

### 6.2 After 30 days

Agents may publish only routine approved-template actions that:

- match the brand spec
- match the Local record
- pass compliance review
- do not trigger escalation
- have no uncertainty

Any uncertainty halts and escalates.

---

## 7. Launch Day Script

Do this on launch day.

### T minus 24 hours

1. Confirm Local No. 001 approval.
2. Confirm inventory allocation.
3. Confirm checkout live mode keys are loaded.
4. Confirm Stripe webhook endpoint is live and verified.
5. Confirm Printify fulfillment submission mode.
6. Confirm Discord alerts.
7. Confirm dashboard shows sanitized fields only.
8. Confirm social announcement drafts.
9. Confirm support inbox works.
10. Confirm rollback command.

### T minus 60 minutes

1. Put site in `launch_pending`.
2. Run health check.
3. Run database backup.
4. Confirm no unapproved changes.
5. Confirm no platform warnings.

### T minus 5 minutes

1. Freeze deploys.
2. Open monitoring.
3. Set Discord `#alerts` visible.
4. Confirm inventory: `S=30`, `M=30`, `L=30`, `XL=10`.

### T equals 11:00 AM Eastern

1. Enable product page.
2. Enable checkout.
3. Publish one X post.
4. Publish one Instagram post.
5. Do not publish token claims.
6. Do not improvise.

### T plus 15 minutes

1. Confirm paid orders match allocated inventory.
2. Confirm no duplicate payment events.
3. Confirm no sold-out SKU can be purchased.
4. Confirm dashboard remains sanitized.

### T plus 72 hours

1. Prepare postmortem.
2. Reconcile Stripe, Postgres, Printify, and storefront.
3. Record customer issues.
4. Record revenue and gross margin.
5. Decide what Local No. 002 may learn.

---

## 8. Source Notes Checked on 2026-04-19

- Stripe recommends Checkout Sessions for most payment integrations and supports tax, shipping, discounts, and hosted/embedded UI.
- Stripe webhooks require public HTTPS endpoints for registered webhooks, and Stripe recommends verifying signatures with official libraries using the raw request body.
- Stripe recommends idempotency keys for POST requests to avoid duplicate operations.
- Printify product publishing has documented rate limits, and Printify supports shop webhooks for product/order events.
- Discord incoming webhooks are appropriate for one-way alerts into a channel.
- Namecheap CNAME records should not be used on the bare `@` domain; use `www` or provider-appropriate A/redirect records for apex handling.
- Hetzner SSH setup requires key-based server access and firewall allowance for SSH when applicable.
- IRS EIN applications should be done directly through the IRS when eligible; do not pay third-party EIN sites.
- FTC online/mail-order rules require clear shipping promises and prompt delay/cancellation/refund handling.
- Pump.fun terms and livestream moderation policies prohibit market manipulation, illegal/harmful content, privacy violations, under-18 livestreaming, and IP violations.

---

## 9. Immediate Next Command

The next command is:

```text
Create the legal and account shell, then give Codex the non-secret identifiers only.
```

Codex needs:

- legal entity name, or `not formed yet`
- public support email
- GitHub repo URL, or permission to initialize local Git only
- desired first launch date
- target retail price for Local No. 001
- shipping countries for launch
- whether token work is frozen until after commerce launch: `yes` is recommended

Never give Codex:

- passwords
- API secret keys
- seed phrases
- recovery codes
- bank information
- raw customer data
