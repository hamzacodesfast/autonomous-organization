import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const runtimeControlId = "hermes-runtime-primary";

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

    process.env[key] = value;
  }
}

function argValue(name, fallback) {
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

function envFlag(name, fallback) {
  const value = process.env[name];

  if (value === undefined) {
    return fallback;
  }

  return value === "true";
}

function heartbeatIntervalSeconds() {
  const raw = process.env.HERMES_HEARTBEAT_INTERVAL_SECONDS?.trim();
  const seconds = raw ? Number.parseInt(raw, 10) : 300;

  if (!Number.isFinite(seconds) || seconds < 30 || seconds > 3600) {
    return 300;
  }

  return seconds;
}

loadEnvFile();

const queueState = argValue("queue", "idle");
const runtimeEnabled = argValue("runtime-enabled", envFlag("HERMES_RUNTIME_ENABLED", true) ? "true" : "false") === "true";
const lastError = argValue("last-error", null);

async function main() {
  const control = await prisma.hermesRuntimeControl.upsert({
    where: { id: runtimeControlId },
    update: {
      runtimeEnabled,
      queueState,
      lastError,
      heartbeatIntervalSeconds: heartbeatIntervalSeconds(),
      lastHeartbeatAt: new Date(),
    },
    create: {
      id: runtimeControlId,
      runtimeEnabled,
      queueState,
      lastError,
      heartbeatIntervalSeconds: heartbeatIntervalSeconds(),
      lastHeartbeatAt: new Date(),
    },
  });

  console.log(JSON.stringify({
    id: control.id,
    killSwitchActive: control.killSwitchActive,
    lastHeartbeatAt: control.lastHeartbeatAt,
    queueState: control.queueState,
    runtimeEnabled: control.runtimeEnabled,
  }, null, 2));
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
