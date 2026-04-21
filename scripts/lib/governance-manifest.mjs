import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const approvalsManifestPath = path.join(repoRoot, "ops/governance/approvals.json");
export const tokenRegistryManifestPath = path.join(repoRoot, "ops/governance/token-registry.json");

const isoDateString = z.string().datetime({ offset: true });

const approvalManifestSchema = z.object({
  version: z.literal(1),
  approvals: z.array(
    z.object({
      id: z.string().regex(/^AO-APPROVAL-\d{4}$/),
      localNumber: z.string().regex(/^\d{3}$/).nullable(),
      approver: z.string().min(1),
      decision: z.enum(["APPROVED", "REJECTED", "NEEDS_CHANGES"]),
      sourceChannel: z.string().min(1).nullable(),
      scope: z.string().min(1),
      specVersion: z.string().regex(/^v\d+\.\d+$/),
      approvedAt: isoDateString,
      expiresAt: isoDateString.nullable(),
      linkedObjectIds: z.array(z.string().min(1)),
      publicDestination: z.string().min(1).nullable(),
      notes: z.string().min(1).nullable(),
    }),
  ),
});

const tokenRegistryManifestSchema = z.object({
  version: z.literal(1),
  entries: z.array(
    z.object({
      id: z.string().min(1),
      platform: z.string().min(1),
      environment: z.string().min(1),
      ownerAccount: z.string().min(1),
      credentialNames: z.array(z.string().min(1)).min(1),
      purpose: z.string().min(1),
      scopes: z.array(z.string().min(1)).min(1),
      status: z.enum(["ACTIVE", "DORMANT", "ROTATED", "REVOKED"]),
      createdDate: isoDateString,
      expirationDate: isoDateString.nullable(),
      nextRotationDate: isoDateString.nullable(),
      storageLocation: z.string().min(1),
      lastSuccessfulUse: isoDateString.nullable(),
      notes: z.string().min(1).nullable(),
    }),
  ),
});

const secretLikeValuePattern =
  /(sk_(live|test|proj)|pk_(live|test)|rk_(live|test)|whsec_|discord\.com\/api\/webhooks\/|ghp_|github_pat_|xox[baprs]-|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN|Bearer\s+[A-Za-z0-9._-]+)/i;

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function scanForSecretLikeValues(value, trail = []) {
  if (typeof value === "string") {
    if (secretLikeValuePattern.test(value)) {
      const location = trail.length > 0 ? trail.join(".") : "<root>";
      throw new Error(`Secret-like value detected in governance manifest at ${location}.`);
    }

    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForSecretLikeValues(entry, [...trail, String(index)]));
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      scanForSecretLikeValues(child, [...trail, key]);
    }
  }
}

function sortStrings(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

export function loadGovernanceManifest() {
  const approvalsRaw = readJsonFile(approvalsManifestPath);
  const tokenRegistryRaw = readJsonFile(tokenRegistryManifestPath);

  scanForSecretLikeValues(approvalsRaw);
  scanForSecretLikeValues(tokenRegistryRaw);

  const approvalsFile = approvalManifestSchema.parse(approvalsRaw);
  const tokenRegistryFile = tokenRegistryManifestSchema.parse(tokenRegistryRaw);

  return {
    approvals: approvalsFile.approvals,
    tokenRegistry: tokenRegistryFile.entries,
  };
}

export function buildLocalNumberIndex(locals) {
  return new Map(locals.map((local) => [local.localNumber, local]));
}

export function buildApprovalUpsertData(approval, localsByNumber) {
  const local = approval.localNumber ? localsByNumber.get(approval.localNumber) : null;

  if (approval.localNumber && !local) {
    throw new Error(`Approval ${approval.id} references missing local ${approval.localNumber}.`);
  }

  return {
    localId: local?.id ?? null,
    approver: approval.approver,
    decision: approval.decision,
    sourceChannel: approval.sourceChannel,
    scope: approval.scope,
    specVersion: approval.specVersion,
    approvedAt: new Date(approval.approvedAt),
    expiresAt: approval.expiresAt ? new Date(approval.expiresAt) : null,
    linkedObjectIds: approval.linkedObjectIds,
    publicDestination: approval.publicDestination,
    notes: approval.notes,
  };
}

export function buildTokenRegistryUpsertData(entry) {
  return {
    platform: entry.platform,
    environment: entry.environment,
    ownerAccount: entry.ownerAccount,
    credentialNames: entry.credentialNames,
    purpose: entry.purpose,
    scopes: entry.scopes,
    status: entry.status,
    createdDate: new Date(entry.createdDate),
    expirationDate: entry.expirationDate ? new Date(entry.expirationDate) : null,
    nextRotationDate: entry.nextRotationDate ? new Date(entry.nextRotationDate) : null,
    storageLocation: entry.storageLocation,
    lastSuccessfulUse: entry.lastSuccessfulUse ? new Date(entry.lastSuccessfulUse) : null,
    notes: entry.notes,
  };
}

export function comparableApprovalRecord(input) {
  return {
    id: input.id,
    localNumber: input.localNumber ?? null,
    approver: input.approver,
    decision: input.decision,
    sourceChannel: input.sourceChannel ?? null,
    scope: input.scope,
    specVersion: input.specVersion,
    approvedAt: input.approvedAt instanceof Date ? input.approvedAt.toISOString() : input.approvedAt,
    expiresAt: input.expiresAt instanceof Date ? input.expiresAt.toISOString() : (input.expiresAt ?? null),
    linkedObjectIds: sortStrings(input.linkedObjectIds ?? []),
    publicDestination: input.publicDestination ?? null,
    notes: input.notes ?? null,
  };
}

export function comparableTokenRegistryRecord(input) {
  return {
    id: input.id,
    platform: input.platform,
    environment: input.environment,
    ownerAccount: input.ownerAccount,
    credentialNames: sortStrings(input.credentialNames ?? []),
    purpose: input.purpose,
    scopes: sortStrings(input.scopes ?? []),
    status: input.status,
    createdDate: input.createdDate instanceof Date ? input.createdDate.toISOString() : input.createdDate,
    expirationDate: input.expirationDate instanceof Date ? input.expirationDate.toISOString() : (input.expirationDate ?? null),
    nextRotationDate:
      input.nextRotationDate instanceof Date ? input.nextRotationDate.toISOString() : (input.nextRotationDate ?? null),
    storageLocation: input.storageLocation,
    lastSuccessfulUse:
      input.lastSuccessfulUse instanceof Date ? input.lastSuccessfulUse.toISOString() : (input.lastSuccessfulUse ?? null),
    notes: input.notes ?? null,
  };
}

export function diffGovernanceRecords({ manifestApprovals, manifestTokens, dbApprovals, dbTokens }) {
  const approvalCreates = [];
  const approvalUpdates = [];
  const approvalUnchanged = [];
  const tokenCreates = [];
  const tokenUpdates = [];
  const tokenUnchanged = [];

  const dbApprovalsById = new Map(dbApprovals.map((record) => [record.id, comparableApprovalRecord(record)]));
  const dbTokensById = new Map(dbTokens.map((record) => [record.id, comparableTokenRegistryRecord(record)]));

  for (const approval of manifestApprovals) {
    const comparableManifest = comparableApprovalRecord(approval);
    const existing = dbApprovalsById.get(approval.id);

    if (!existing) {
      approvalCreates.push(comparableManifest);
      continue;
    }

    if (JSON.stringify(existing) === JSON.stringify(comparableManifest)) {
      approvalUnchanged.push(comparableManifest);
      continue;
    }

    approvalUpdates.push({ expected: comparableManifest, actual: existing });
  }

  for (const entry of manifestTokens) {
    const comparableManifest = comparableTokenRegistryRecord(entry);
    const existing = dbTokensById.get(entry.id);

    if (!existing) {
      tokenCreates.push(comparableManifest);
      continue;
    }

    if (JSON.stringify(existing) === JSON.stringify(comparableManifest)) {
      tokenUnchanged.push(comparableManifest);
      continue;
    }

    tokenUpdates.push({ expected: comparableManifest, actual: existing });
  }

  return {
    approvalCreates,
    approvalUpdates,
    approvalUnchanged,
    tokenCreates,
    tokenUpdates,
    tokenUnchanged,
  };
}
