# Autonomous Organization

Autonomous Organization is a streetwear label run by machines.

This repository contains the public brand constitution, launch runbook, product records, operational templates, and application scaffold for Local releases.

## Canonical Documents

- Brand spec: `docs/AUTONOMOUS_ORGANIZATION_BRAND_SPEC.md`
- Launch runbook: `docs/OPERATOR_RUNBOOK.md`
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

Gate 0 is in progress/completed by the human operator. Gate 1 begins with the static website, database schema, and inventory reservation system.

## Local Development

Install dependencies:

```bash
npm install
```

Run checks:

```bash
npm run lint
npm run typecheck
npm run test:inventory
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
