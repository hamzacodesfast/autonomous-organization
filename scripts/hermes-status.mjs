import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

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

    process.env[key] = value;
  }
}

loadEnvFile();

async function main() {
  const [control, jobs] = await Promise.all([
    prisma.hermesRuntimeControl.findUnique({
      where: { id: "hermes-runtime-primary" },
    }),
    prisma.hermesJobRun.findMany({
      orderBy: [{ requestedAt: "desc" }],
      take: 5,
      select: {
        id: true,
        jobName: true,
        status: true,
        requestedAt: true,
        finishedAt: true,
        summary: true,
      },
    }),
  ]);

  console.log(JSON.stringify({ control, jobs }, null, 2));
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
