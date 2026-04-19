import { PrismaClient, LocalState } from "@prisma/client";

const prisma = new PrismaClient();

const allocation = [
  { size: "S", quantity: 30 },
  { size: "M", quantity: 30 },
  { size: "L", quantity: 30 },
  { size: "XL", quantity: 10 },
] as const;

async function main() {
  const local = await prisma.local.upsert({
    where: { localNumber: "001" },
    update: {
      conceptSentence: "Local No. 001: founding artifact.",
      state: LocalState.CONCEPT_DRAFT,
      approvedBlank: "Gildan 5000 short-sleeve tee",
      garmentColorways: ["Black"],
      editionCount: 100,
      retailPriceCents: 5000,
      currency: "USD",
      productCopy: [
        "LOCAL NO. 001 TEE",
        "Issued by Local No. 001, N/A.",
        "",
        "Black Gildan 5000 short-sleeve tee.",
        "Primary Organization mark printed on the back.",
        "Sizes S-XL. 100 units total.",
        "",
        "Edition: 100 units. No restocks.",
      ].join("\n"),
      sourceLicenseNotes: "No external imagery used.",
    },
    create: {
      localNumber: "001",
      conceptSentence: "Local No. 001: founding artifact.",
      state: LocalState.CONCEPT_DRAFT,
      approvedBlank: "Gildan 5000 short-sleeve tee",
      garmentColorways: ["Black"],
      editionCount: 100,
      retailPriceCents: 5000,
      currency: "USD",
      productCopy: [
        "LOCAL NO. 001 TEE",
        "Issued by Local No. 001, N/A.",
        "",
        "Black Gildan 5000 short-sleeve tee.",
        "Primary Organization mark printed on the back.",
        "Sizes S-XL. 100 units total.",
        "",
        "Edition: 100 units. No restocks.",
      ].join("\n"),
      sourceLicenseNotes: "No external imagery used.",
    },
  });

  for (const row of allocation) {
    await prisma.localSku.upsert({
      where: { sku: `AO-001-BLACK-${row.size}` },
      update: {
        editionCeiling: row.quantity,
        color: "Black",
        size: row.size,
      },
      create: {
        localId: local.id,
        sku: `AO-001-BLACK-${row.size}`,
        size: row.size,
        color: "Black",
        editionCeiling: row.quantity,
      },
    });
  }

  await prisma.dashboardSnapshot.create({
    data: {
      id: "dashboard-prelaunch-001",
      currentLocal: "001",
      localStatus: "pending approval",
      lastSanitizedAction: "2026-04-19T23:30:00Z token freeze approval recorded",
      uptime: "pre-launch",
      fulfilledThisMonth: 0,
    },
  });
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
