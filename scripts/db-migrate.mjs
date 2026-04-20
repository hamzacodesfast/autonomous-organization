import { spawnSync } from "node:child_process";
import { localDatabaseUrl } from "./db-url.mjs";

const result = spawnSync("npx", ["prisma", "migrate", "dev", "--name", "init"], {
  env: {
    ...process.env,
    DATABASE_URL: localDatabaseUrl,
  },
  stdio: "inherit",
});

process.exit(result.status ?? 1);
