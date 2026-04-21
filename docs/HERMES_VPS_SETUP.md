# Hermes VPS Setup

Platform: Hermes Agent on the Hetzner production VPS

This document connects the Autonomous Organization runtime to a real model-backed Hermes profile without granting it silent root authority.

## Runtime shape

- Hermes installs under the `ao_deploy` user on the VPS.
- Hermes profile name: `ao-brand`
- Workspace root: `/srv/autonomous-organization/app`
- Model connection: the checked-in profile example targets an OpenAI-compatible endpoint.
- Temporary provider changes, including Anthropic-backed live testing, may exist on the VPS as intentional profile overrides.
- Provider credentials stay only in the live Hermes profile env on the VPS.
- Hermes scheduled work runs through `hermes -p ao-brand cron tick` on a systemd timer.
- Hermes heartbeat sync updates the app runtime state through `docker exec ao-app node scripts/hermes-heartbeat.mjs`.

## Files in this repo

- profile config: `deploy/hermes/ao-brand.config.yaml.example`
- profile env template: `deploy/hermes/ao-brand.env.example`
- profile soul: `deploy/hermes/ao-brand.SOUL.md`
- install script: `scripts/install-hermes-vps.sh`
- timers:
  - `deploy/systemd/ao-hermes-heartbeat.service`
  - `deploy/systemd/ao-hermes-heartbeat.timer`
  - `deploy/systemd/ao-hermes-cron-tick.service`
  - `deploy/systemd/ao-hermes-cron-tick.timer`

## Install on the VPS

From the workstation:

```bash
ssh ao-production 'cd /srv/autonomous-organization/app && bash scripts/install-hermes-vps.sh'
```

The script:

1. installs Hermes with the official installer if missing
2. creates the `ao-brand` profile if missing
3. writes the profile `config.yaml` and `SOUL.md`
4. creates `~/.hermes/profiles/ao-brand/.env` if missing
5. installs and enables the heartbeat and cron-tick timers

The bootstrap intentionally skips Hermes' interactive setup wizard. On production, the repo-owned profile files are authoritative. Do not run `ao-brand setup` unless you are intentionally reconfiguring the profile and understand the drift you are introducing.

## Required provider credential after install

The install is not complete until this file contains real provider credentials:

```bash
/home/ao_deploy/.hermes/profiles/ao-brand/.env
```

The repo example currently uses an OpenAI-compatible shape:

```bash
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-...
```

If the live profile is temporarily pointed at Anthropic instead, set the provider-specific key material the live profile expects. Do not commit that override back into Git unless the repo-owned profile template is being intentionally changed.

## Discord approval surface

Hermes does not approve itself. Human approval travels through the production app's Discord interaction endpoint:

```text
https://autonomousorganization.io/api/discord/interactions
```

The production app env must contain the Discord control-plane variables used by that endpoint:

- `DISCORD_APPLICATION_ID`
- `DISCORD_PUBLIC_KEY`
- `DISCORD_BOT_TOKEN`
- `DISCORD_APPROVALS_CHANNEL_ID`
- `DISCORD_DROPS_PENDING_APPROVAL_CHANNEL_ID`
- `DISCORD_APPROVER_USER_IDS`

The bot posts pending requests to `#drops-pending-approval` and records decisions in `#approvals`. Humans should not need shell access to the VPS for routine approvals.

Smoke-test the approval path from the repo once the env is populated:

```bash
npm run discord:request-approval -- \
  --request-id=smoke-discord-approval-001 \
  --local-number=001 \
  --action-class="Class 3" \
  --platform=Hermes \
  --target-surface=approval_smoke_test \
  --scope="Smoke test the Discord approval path for Hermes." \
  --requested-by=operator-smoke-test
```

Expected result: a pending approval message appears in `#drops-pending-approval`, the buttons work, and the decision is written to `#approvals`.

## First validation

```bash
ssh ao-production
/home/ao_deploy/.local/bin/hermes -p ao-brand profile
/home/ao_deploy/.local/bin/hermes -p ao-brand status --all
systemctl status ao-hermes-heartbeat.timer
systemctl status ao-hermes-cron-tick.timer
docker exec ao-app node scripts/hermes-status.mjs
```

## First autonomous jobs to add

Do not add public publishing jobs first. Start with internal routines:

1. heartbeat verification
2. locked-state health summary
3. Stripe/Postgres/Printify reconciliation
4. postmortem draft preparation

Example style:

```bash
hermes -p ao-brand cron create "*/15 * * * *" \
  "Inspect the Organization's locked production state. Use terminal commands only. Do not change public state. Summarize any issues and stop if approval is required." \
  --name "AO locked-state health review"
```

## Safety note

Hermes is not permitted to bypass the app's own controls. The brand spec, gate status, approvals, and app runtime guards remain authoritative.
