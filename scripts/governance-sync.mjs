import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import {
  buildApprovalUpsertData,
  buildLocalNumberIndex,
  buildTokenRegistryUpsertData,
  comparableApprovalRecord,
  comparableTokenRegistryRecord,
  diffGovernanceRecords,
  loadGovernanceManifest,
} from "./lib/governance-manifest.mjs";

const prisma = new PrismaClient();

function loadEnvFile(path = ".env") {
  if (!fs.existsSync(path)) {
    return;
  }

  const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function summarizeDiff(diff) {
  return {
    approvalCreates: diff.approvalCreates.length,
    approvalUpdates: diff.approvalUpdates.length,
    approvalUnchanged: diff.approvalUnchanged.length,
    tokenCreates: diff.tokenCreates.length,
    tokenUpdates: diff.tokenUpdates.length,
    tokenUnchanged: diff.tokenUnchanged.length,
  };
}

function printSection(title, ids) {
  if (ids.length === 0) {
    return;
  }

  console.log(`${title}: ${ids.join(", ")}`);
}

function printUpdateSection(title, entries) {
  if (entries.length === 0) {
    return;
  }

  console.log(title);

  for (const entry of entries) {
    console.log(`- ${entry.expected.id}`);
  }
}

async function main() {
  loadEnvFile();

  const apply = hasFlag("apply");
  const manifest = loadGovernanceManifest();
  const locals = await prisma.local.findMany({
    select: {
      id: true,
      localNumber: true,
    },
  });
  const localsByNumber = buildLocalNumberIndex(locals);

  const manifestApprovals = manifest.approvals.map((approval) =>
    comparableApprovalRecord({
      id: approval.id,
      ...buildApprovalUpsertData(approval, localsByNumber),
      localNumber: approval.localNumber,
    }),
  );
  const manifestTokens = manifest.tokenRegistry.map((entry) =>
    comparableTokenRegistryRecord({
      id: entry.id,
      ...buildTokenRegistryUpsertData(entry),
    }),
  );

  const [dbApprovals, dbTokens] = await Promise.all([
    prisma.approval.findMany({
      include: {
        local: {
          select: {
            localNumber: true,
          },
        },
      },
    }),
    prisma.tokenRegistryEntry.findMany(),
  ]);

  const diff = diffGovernanceRecords({
    manifestApprovals,
    manifestTokens,
    dbApprovals: dbApprovals.map((approval) => ({
      id: approval.id,
      localNumber: approval.local?.localNumber ?? null,
      approver: approval.approver,
      decision: approval.decision,
      sourceChannel: approval.sourceChannel,
      scope: approval.scope,
      specVersion: approval.specVersion,
      approvedAt: approval.approvedAt,
      expiresAt: approval.expiresAt,
      linkedObjectIds: approval.linkedObjectIds,
      publicDestination: approval.publicDestination,
      notes: approval.notes,
    })),
    dbTokens,
  });

  const summary = summarizeDiff(diff);

  console.log(`Governance sync mode: ${apply ? "apply" : "check"}`);
  console.log(JSON.stringify(summary, null, 2));
  printSection(
    "Approvals to create",
    diff.approvalCreates.map((entry) => entry.id),
  );
  printUpdateSection("Approvals to update", diff.approvalUpdates);
  printSection(
    "Token registry entries to create",
    diff.tokenCreates.map((entry) => entry.id),
  );
  printUpdateSection("Token registry entries to update", diff.tokenUpdates);

  if (!apply) {
    if (diff.approvalCreates.length || diff.approvalUpdates.length || diff.tokenCreates.length || diff.tokenUpdates.length) {
      process.exit(1);
    }

    console.log("Governance metadata matches the manifests.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const approval of manifest.approvals) {
      const data = buildApprovalUpsertData(approval, localsByNumber);

      await tx.approval.upsert({
        where: { id: approval.id },
        update: data,
        create: {
          id: approval.id,
          ...data,
        },
      });
    }

    for (const entry of manifest.tokenRegistry) {
      const data = buildTokenRegistryUpsertData(entry);

      await tx.tokenRegistryEntry.upsert({
        where: { id: entry.id },
        update: data,
        create: {
          id: entry.id,
          ...data,
        },
      });
    }
  });

  console.log("Governance metadata applied successfully.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
