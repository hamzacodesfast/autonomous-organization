import { spawnSync } from "node:child_process";
import { localDatabaseUrl } from "./db-url.mjs";

function run(command, args) {
  return spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function fail(message) {
  console.error(`Database check failed: ${message}`);
  process.exit(1);
}

const dockerVersion = run("docker", ["--version"]);

if (dockerVersion.status !== 0) {
  fail("Docker is not installed or is not available on PATH.");
}

const composeVersion = run("docker", ["compose", "version"]);

if (composeVersion.status !== 0) {
  fail("Docker Compose is not available through `docker compose`.");
}

const dockerInfo = run("docker", ["info"]);

if (dockerInfo.status !== 0) {
  fail("Docker is installed, but the Docker daemon is not running or the current user cannot access it.");
}

console.log("Database check passed.");
console.log(`DATABASE_URL=${localDatabaseUrl}`);
