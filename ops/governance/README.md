# Governance Manifests

These files are the machine-readable source for non-secret governance metadata that must exist in Postgres before launch mode can be reopened.

- `approvals.json`: approval records that Hermes and launch preflight expect to find in the `Approval` table
- `token-registry.json`: metadata-only credential registry entries that launch preflight expects to find in `TokenRegistryEntry`

Rules:

- Never put secret values in these files.
- Store credential names, not credential contents.
- Update the human-readable ledger in `ops/APPROVALS.md` in the same change whenever approval metadata changes.
- Use `notes` to explain inferred dates or partial historical reconstruction rather than inventing silent certainty.

Local usage:

```bash
npm run governance:check
npm run governance:apply
```

Production usage from `/srv/autonomous-organization/app` on Hetzner:

```bash
docker exec ao-app node scripts/governance-sync.mjs
docker exec ao-app node scripts/governance-sync.mjs --apply
```
