import { spawnSync } from "node:child_process";
import { localDatabaseUrl } from "./db-url.mjs";

const env = {
  ...process.env,
  DATABASE_URL: localDatabaseUrl,
};

const seedResult = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
  env,
  stdio: "inherit",
});

if ((seedResult.status ?? 1) !== 0) {
  process.exit(seedResult.status ?? 1);
}

const governanceResult = spawnSync("node", ["scripts/governance-sync.mjs", "--apply"], {
  env: {
    ...env,
  },
  stdio: "inherit",
});

process.exit(governanceResult.status ?? 1);
