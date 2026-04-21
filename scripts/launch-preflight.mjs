import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const expectedSizes = ["S", "M", "L", "XL", "XXL"];
const expectedVariantEnv = [
  "PRINTIFY_VARIANT_ID_S",
  "PRINTIFY_VARIANT_ID_M",
  "PRINTIFY_VARIANT_ID_L",
  "PRINTIFY_VARIANT_ID_XL",
  "PRINTIFY_VARIANT_ID_XXL",
];

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

function env(name) {
  return process.env[name]?.trim() ?? "";
}

function envFlag(name, fallback) {
  const value = env(name);

  if (!value) {
    return fallback;
  }

  return value === "true";
}

function isPlaceholder(value) {
  return !value || value.startsWith("PLACEHOLDER_");
}

function keyKind(value) {
  if (value.startsWith("sk_live_")) {
    return "live";
  }

  if (value.startsWith("sk_test_")) {
    return "test";
  }

  if (value.startsWith("rk_")) {
    return "restricted";
  }

  return value ? "unknown" : "unset";
}

const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function requireValue(name) {
  if (isPlaceholder(env(name))) {
    fail(`${name} must be set and must not be a placeholder.`);
  }
}

function requireFlag(name, value) {
  if (env(name) !== value) {
    fail(`${name} must be ${value}.`);
  }
}

function validateReservationWindow() {
  const raw = env("STRIPE_CHECKOUT_RESERVATION_MINUTES");
  const minutes = Number.parseInt(raw, 10);

  if (!Number.isFinite(minutes) || minutes < 31 || minutes > 1440) {
    fail("STRIPE_CHECKOUT_RESERVATION_MINUTES must be between 31 and 1440.");
  }
}

function validateShippingCountries() {
  const countries = env("STRIPE_ALLOWED_SHIPPING_COUNTRIES")
    .split(",")
    .map((country) => country.trim().toUpperCase())
    .filter(Boolean);

  if (countries.length === 0) {
    fail("STRIPE_ALLOWED_SHIPPING_COUNTRIES must list at least one ISO-2 country code.");
    return;
  }

  const invalid = countries.filter((country) => !/^[A-Z]{2}$/.test(country));

  if (invalid.length > 0) {
    fail(`STRIPE_ALLOWED_SHIPPING_COUNTRIES contains invalid entries: ${invalid.join(", ")}.`);
  }
}

function validatePublicUrl(name, mode) {
  const value = env(name);

  if (mode !== "launch") {
    return;
  }

  if (!value.startsWith("https://")) {
    fail(`${name} must be an HTTPS production URL in launch mode.`);
  }

  if (value.includes("localhost") || value.includes("127.0.0.1")) {
    fail(`${name} must not point at localhost in launch mode.`);
  }
}

function validateShared(mode) {
  requireValue("DATABASE_URL");
  requireValue("STRIPE_WEBHOOK_SECRET");
  requireValue("PUBLIC_SUPPORT_EMAIL");
  validateReservationWindow();
  validateShippingCountries();
  validatePublicUrl("APP_URL", mode);
  validatePublicUrl("PUBLIC_SITE_URL", mode);
  validateHermes();

  if (env("TOKEN_WORK_FROZEN") !== "true") {
    fail("TOKEN_WORK_FROZEN must remain true until commerce launch is complete.");
  }
}

function validateHermes() {
  const interval = Number.parseInt(env("HERMES_HEARTBEAT_INTERVAL_SECONDS") || "300", 10);

  if (!envFlag("HERMES_RUNTIME_ENABLED", true)) {
    fail("HERMES_RUNTIME_ENABLED must be true.");
  }

  if (!Number.isFinite(interval) || interval < 30 || interval > 3600) {
    fail("HERMES_HEARTBEAT_INTERVAL_SECONDS must be between 30 and 3600.");
  }
}

function validateLockedMode() {
  requireFlag("STRIPE_CHECKOUT_ENABLED", "false");
  requireFlag("PRINTIFY_ENABLED", "false");

  if (keyKind(env("STRIPE_SECRET_KEY")) === "live" && env("STRIPE_TEST_MODE_ONLY") !== "true") {
    fail("STRIPE_TEST_MODE_ONLY must be true when live keys are present outside a launch window.");
  }
}

function validateLaunchMode() {
  requireFlag("ENABLE_DATABASE_READS", "true");
  requireFlag("STRIPE_CHECKOUT_ENABLED", "true");
  requireFlag("STRIPE_TEST_MODE_ONLY", "false");
  requireFlag("PRINTIFY_ENABLED", "true");

  if (keyKind(env("STRIPE_SECRET_KEY")) !== "live") {
    fail("STRIPE_SECRET_KEY must be a live key in launch mode.");
  }

  if (!env("STRIPE_PUBLISHABLE_KEY").startsWith("pk_live_")) {
    fail("STRIPE_PUBLISHABLE_KEY must be a live publishable key in launch mode.");
  }

  if (!env("STRIPE_WEBHOOK_SECRET").startsWith("whsec_")) {
    fail("STRIPE_WEBHOOK_SECRET must be a Stripe webhook signing secret.");
  }

  requireValue("PRINTIFY_API_TOKEN");
  requireValue("PRINTIFY_SHOP_ID");
  requireValue("PRINTIFY_PRODUCT_ID");

  for (const name of expectedVariantEnv) {
    const value = env(name);

    if (!/^\d+$/.test(value)) {
      fail(`${name} must be a Printify numeric variant ID.`);
    }
  }

  if (env("STRIPE_REQUIRE_TERMS_CONSENT") !== "true") {
    warn("STRIPE_REQUIRE_TERMS_CONSENT is not true. Confirm Stripe Dashboard has approved Terms URL before public launch.");
  }

  if (env("STRIPE_AUTOMATIC_TAX_ENABLED") !== "true") {
    warn("STRIPE_AUTOMATIC_TAX_ENABLED is not true. AO-APPROVAL-0004 keeps tax responsibility with the operator.");
  }

  if (env("PRINTIFY_SEND_SHIPPING_NOTIFICATION") === "true") {
    warn("PRINTIFY_SEND_SHIPPING_NOTIFICATION is true. Confirm customer messaging is intentionally delegated to Printify.");
  }
}

async function validateDatabase(mode) {
  if (process.argv.includes("--skip-db")) {
    warn("Database checks skipped by --skip-db.");
    return;
  }

  const prisma = new PrismaClient();

  try {
    const [local, runtimeControl, tokenRegistryEntries] = await Promise.all([
      prisma.local.findUnique({
      where: { localNumber: "001" },
      include: {
        skus: {
          include: {
            reservations: {
              where: {
                status: "ACTIVE",
                expiresAt: { gt: new Date() },
              },
            },
          },
        },
      },
      }),
      prisma.hermesRuntimeControl.findUnique({
        where: { id: "hermes-runtime-primary" },
      }),
      prisma.tokenRegistryEntry.count(),
    ]);

    if (!local) {
      fail("Local No. 001 is missing from the database.");
      return;
    }

    if (!runtimeControl) {
      if (mode === "launch") {
        fail("Hermes runtime control record is missing.");
      } else {
        warn("Hermes runtime control record is missing.");
      }
    } else {
      if (!runtimeControl.runtimeEnabled) {
        fail("Hermes runtime control record has runtimeEnabled=false.");
      }

      if (mode === "launch" && runtimeControl.killSwitchActive) {
        fail("Hermes kill switch must be inactive in launch mode.");
      }

      if (!runtimeControl.lastHeartbeatAt) {
        if (mode === "launch") {
          fail("Hermes heartbeat has never been recorded.");
        } else {
          warn("Hermes heartbeat has never been recorded.");
        }
      } else {
        const ageMs = Date.now() - runtimeControl.lastHeartbeatAt.getTime();
        const thresholdMs = runtimeControl.heartbeatIntervalSeconds * 2000;

        if (ageMs > thresholdMs) {
          if (mode === "launch") {
            fail("Hermes heartbeat is stale.");
          } else {
            warn("Hermes heartbeat is stale.");
          }
        }
      }
    }

    if (tokenRegistryEntries === 0) {
      warn("Token registry metadata is empty.");
    }

    if (local.editionCount !== 100) {
      fail(`Local No. 001 editionCount must be 100, found ${local.editionCount}.`);
    }

    if (local.retailPriceCents !== 5000 || local.currency !== "USD") {
      fail("Local No. 001 must be priced at $50 USD.");
    }

    if (mode === "launch" && local.state !== "LIVE") {
      fail(`Local No. 001 state must be LIVE in launch mode, found ${local.state}.`);
    }

    const skusBySize = new Map(local.skus.map((sku) => [sku.size, sku]));

    for (const size of expectedSizes) {
      const sku = skusBySize.get(size);

      if (!sku) {
        fail(`Local No. 001 is missing SKU size ${size}.`);
        continue;
      }

      if (sku.editionCeiling !== 20) {
        fail(`${sku.sku} edition ceiling must be 20, found ${sku.editionCeiling}.`);
      }

      if (sku.allocatedCount > sku.editionCeiling) {
        fail(`${sku.sku} allocated count exceeds its edition ceiling.`);
      }
    }

    const unexpectedSizes = local.skus.map((sku) => sku.size).filter((size) => !expectedSizes.includes(size));

    if (unexpectedSizes.length > 0) {
      fail(`Local No. 001 has unexpected SKU sizes: ${unexpectedSizes.join(", ")}.`);
    }

    const activeReservations = local.skus.reduce(
      (total, sku) => total + sku.reservations.reduce((sum, reservation) => sum + reservation.quantity, 0),
      0,
    );

    if (mode === "launch" && activeReservations > 0) {
      fail(`Launch mode requires zero active pre-launch reservations, found ${activeReservations}.`);
    }

    const paidOrders = await prisma.order.count({ where: { status: "PAID" } });

    if (paidOrders > 0) {
      warn(`Database already contains ${paidOrders} paid order(s). Confirm inventory reconciliation before public launch.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

function printResults(mode) {
  console.log(`Launch preflight mode: ${mode}`);
  console.log(`Stripe secret key kind: ${keyKind(env("STRIPE_SECRET_KEY"))}`);
  console.log(`Hermes enabled: ${envFlag("HERMES_RUNTIME_ENABLED", true) ? "true" : "false"}`);
  console.log(`Checkout enabled: ${env("STRIPE_CHECKOUT_ENABLED") || "unset"}`);
  console.log(`Printify enabled: ${env("PRINTIFY_ENABLED") || "unset"}`);

  for (const message of warnings) {
    console.log(`WARN: ${message}`);
  }

  for (const message of failures) {
    console.error(`FAIL: ${message}`);
  }

  if (failures.length > 0) {
    console.error(`Launch preflight failed with ${failures.length} blocker(s).`);
    process.exit(1);
  }

  console.log("Launch preflight passed.");
}

loadEnvFile();

const mode = argValue("mode", "locked");

if (!["locked", "launch"].includes(mode)) {
  console.error("Usage: node scripts/launch-preflight.mjs --mode=locked|launch [--skip-db]");
  process.exit(1);
}

validateShared(mode);

if (mode === "launch") {
  validateLaunchMode();
} else {
  validateLockedMode();
}

await validateDatabase(mode);
printResults(mode);
