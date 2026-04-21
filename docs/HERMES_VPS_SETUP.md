# Hermes VPS Setup

Platform: Hermes Agent on the Hetzner production VPS

This document connects the Autonomous Organization runtime to a real model-backed Hermes profile without granting it silent root authority.

## Runtime shape

- Hermes installs under the `ao_deploy` user on the VPS.
- Hermes profile name: `ao-brand`
- Workspace root: `/srv/autonomous-organization/app`
- Model connection: OpenAI-compatible endpoint using:
  - `OPENAI_BASE_URL=https://api.openai.com/v1`
  - `OPENAI_API_KEY=...`
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

## Required secret after install

The install is not complete until this file contains a real key:

```bash
/home/ao_deploy/.hermes/profiles/ao-brand/.env
```

Minimum contents:

```bash
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-...
```

## First validation

```bash
ssh ao-production
source ~/.bashrc
hermes -p ao-brand profile
hermes -p ao-brand status --all
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
