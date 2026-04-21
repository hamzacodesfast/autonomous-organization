import { ActionState, ApprovalDecision, LocalState, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const allocation = [
  { size: "S", quantity: 20 },
  { size: "M", quantity: 20 },
  { size: "L", quantity: 20 },
  { size: "XL", quantity: 20 },
  { size: "XXL", quantity: 20 },
];

const productCopy = [
  "LOCAL NO. 001 TEE",
  "Issued by Local No. 001, N/A.",
  "",
  "Black Gildan 5000 short-sleeve tee.",
  "Primary Organization mark printed on the back.",
  "Sizes S-XXL. 100 units total.",
  "",
  "Edition: 100 units. No restocks.",
].join("\n");

async function main() {
  const local = await prisma.local.upsert({
    where: { localNumber: "001" },
    update: {
      conceptSentence: "Local No. 001: founding artifact.",
      state: LocalState.HUMAN_APPROVAL,
      approvedBlank: "Gildan 5000 short-sleeve tee",
      supplier: "Printify",
      printProvider: "Printify Choice",
      garmentColorways: ["Black"],
      editionCount: 100,
      retailPriceCents: 5000,
      currency: "USD",
      productCopy,
      sourceLicenseNotes: "No external imagery used.",
    },
    create: {
      localNumber: "001",
      conceptSentence: "Local No. 001: founding artifact.",
      state: LocalState.HUMAN_APPROVAL,
      approvedBlank: "Gildan 5000 short-sleeve tee",
      supplier: "Printify",
      printProvider: "Printify Choice",
      garmentColorways: ["Black"],
      editionCount: 100,
      retailPriceCents: 5000,
      currency: "USD",
      productCopy,
      sourceLicenseNotes: "No external imagery used.",
    },
  });

  for (const row of allocation) {
    await prisma.localSku.upsert({
      where: { sku: `AO-001-BLACK-${row.size}` },
      update: {
        localId: local.id,
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

  await prisma.approval.upsert({
    where: { id: "AO-APPROVAL-0001" },
    update: {
      localId: local.id,
      approver: "hamzacodesfast",
      decision: ApprovalDecision.APPROVED,
      scope: "Token work frozen until after commerce launch.",
      specVersion: "v0.3",
      approvedAt: new Date("2026-04-19T23:30:00.000Z"),
      notes:
        "No token ownership, profit, governance, dividend, revenue-share, entitlement, price, or market language may be published.",
    },
    create: {
      id: "AO-APPROVAL-0001",
      localId: local.id,
      approver: "hamzacodesfast",
      decision: ApprovalDecision.APPROVED,
      scope: "Token work frozen until after commerce launch.",
      specVersion: "v0.3",
      approvedAt: new Date("2026-04-19T23:30:00.000Z"),
      notes:
        "No token ownership, profit, governance, dividend, revenue-share, entitlement, price, or market language may be published.",
    },
  });

  await prisma.actionLog.upsert({
    where: { id: "action-token-freeze-001" },
    update: {
      localId: local.id,
      timestamp: new Date("2026-04-19T23:30:00.000Z"),
      agentName: "human-operator",
      actionClass: "Class 3",
      requestId: "AO-APPROVAL-0001",
      platform: "Discord",
      affectedObject: "token-public-language",
      approvalId: "AO-APPROVAL-0001",
      state: ActionState.SUCCESS,
      summary: "Token work frozen until after commerce launch.",
    },
    create: {
      id: "action-token-freeze-001",
      localId: local.id,
      timestamp: new Date("2026-04-19T23:30:00.000Z"),
      agentName: "human-operator",
      actionClass: "Class 3",
      requestId: "AO-APPROVAL-0001",
      platform: "Discord",
      affectedObject: "token-public-language",
      approvalId: "AO-APPROVAL-0001",
      state: ActionState.SUCCESS,
      summary: "Token work frozen until after commerce launch.",
    },
  });

  await prisma.dashboardSnapshot.upsert({
    where: { id: "dashboard-prelaunch-001" },
    update: {
      currentLocal: "001",
      localStatus: "pending approval",
      lastSanitizedAction: "2026-04-19T23:30:00Z token freeze approval recorded",
      uptime: "pre-launch",
      fulfilledThisMonth: 0,
    },
    create: {
      id: "dashboard-prelaunch-001",
      currentLocal: "001",
      localStatus: "pending approval",
      lastSanitizedAction: "2026-04-19T23:30:00Z token freeze approval recorded",
      uptime: "pre-launch",
      fulfilledThisMonth: 0,
    },
  });

  await prisma.hermesRuntimeControl.upsert({
    where: { id: "hermes-runtime-primary" },
    update: {
      runtimeEnabled: true,
      killSwitchActive: false,
      queueState: "idle",
      heartbeatIntervalSeconds: 300,
      lastError: null,
    },
    create: {
      id: "hermes-runtime-primary",
      runtimeEnabled: true,
      killSwitchActive: false,
      queueState: "idle",
      heartbeatIntervalSeconds: 300,
      lastError: null,
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
