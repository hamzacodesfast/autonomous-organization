import fs from "node:fs";
import { prisma } from "../lib/prisma";
import { createDiscordApprovalRequest } from "../lib/discord-approvals";

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

function argValue(name: string, fallback = "") {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));

  if (inline) {
    return inline.slice(prefix.length);
  }

  const index = process.argv.indexOf(`--${name}`);

  if (index >= 0) {
    return process.argv[index + 1] ?? fallback;
  }

  return fallback;
}

function requiredArg(name: string) {
  const value = argValue(name);

  if (!value) {
    throw new Error(`Missing required argument --${name}.`);
  }

  return value;
}

async function resolveLocalId(localNumber: string) {
  if (!localNumber) {
    return null;
  }

  const local = await prisma.local.findUnique({
    where: { localNumber },
    select: { id: true, localNumber: true },
  });

  if (!local) {
    throw new Error(`Local ${localNumber} was not found.`);
  }

  return local.id;
}

async function main() {
  loadEnvFile();

  const localNumber = argValue("local-number");
  const localId = await resolveLocalId(localNumber);

  const result = await createDiscordApprovalRequest({
    requestId: requiredArg("request-id"),
    localId: localId ?? undefined,
    actionClass: requiredArg("action-class"),
    platform: requiredArg("platform"),
    targetSurface: requiredArg("target-surface"),
    scope: requiredArg("scope"),
    publicDestination: argValue("public-destination") || undefined,
    affectedObject: argValue("affected-object") || undefined,
    requestedBy: argValue("requested-by", "discord-smoke-test"),
    proposedApprovalId: argValue("proposed-approval-id") || undefined,
    notes: argValue("notes") || undefined,
  });

  console.log(
    JSON.stringify(
      {
        status: result.status,
        approvalId: "approvalId" in result ? result.approvalId : null,
        approvalRequestId: result.approvalRequest.id,
        discordChannelId: result.approvalRequest.discordChannelId,
        discordMessageId: result.approvalRequest.discordMessageId,
        requestId: result.approvalRequest.requestId,
      },
      null,
      2,
    ),
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
