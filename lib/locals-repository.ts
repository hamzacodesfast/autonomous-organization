import { ReservationStatus, type LocalState } from "@prisma/client";
import { dashboardSnapshot, local001, type PublicDashboardSnapshot, type PublicLocal } from "@/lib/local-001";
import { prisma } from "@/lib/prisma";

const stateLabels: Record<LocalState, string> = {
  CONCEPT_DRAFT: "pending approval",
  DESIGN_DRAFT: "pending approval",
  COMPLIANCE_REVIEW: "pending approval",
  COSTING_REVIEW: "pending approval",
  HUMAN_APPROVAL: "pending approval",
  SCHEDULED: "scheduled",
  LIVE: "live",
  FULFILLMENT: "fulfillment",
  ARCHIVED: "archived",
  RETIRED: "retired",
};

function databaseReadsEnabled() {
  return process.env.ENABLE_DATABASE_READS === "true" && Boolean(process.env.DATABASE_URL);
}

function formatPrice(cents: number, currency: string) {
  const normalizedCurrency = currency.toUpperCase();
  const hasFraction = cents % 100 !== 0;

  return `${new Intl.NumberFormat("en-US", {
    currency: normalizedCurrency,
    maximumFractionDigits: hasFraction ? 2 : 0,
    minimumFractionDigits: hasFraction ? 2 : 0,
    style: "currency",
  }).format(cents / 100)} ${normalizedCurrency}`;
}

export async function getCurrentLocal(): Promise<PublicLocal> {
  if (!databaseReadsEnabled()) {
    return local001;
  }

  try {
    const now = new Date();
    const record = await prisma.local.findUnique({
      where: { localNumber: "001" },
      include: {
        skus: {
          orderBy: { id: "asc" },
          include: {
            reservations: {
              where: {
                status: ReservationStatus.ACTIVE,
                expiresAt: { gt: now },
              },
            },
          },
        },
      },
    });

    if (!record) {
      return local001;
    }

    const allocation = record.skus.map((sku) => ({
      size: sku.size,
      quantity: sku.editionCeiling,
    }));

    const remainingCount = record.skus.reduce((total, sku) => {
      const activeReserved = sku.reservations.reduce((sum, reservation) => sum + reservation.quantity, 0);
      return total + Math.max(0, sku.editionCeiling - sku.allocatedCount - activeReserved);
    }, 0);

    return {
      ...local001,
      number: record.localNumber,
      concept: record.conceptSentence,
      issueDate: record.launchTimestamp?.toISOString() ?? "N/A",
      status: stateLabels[record.state],
      price: formatPrice(record.retailPriceCents, record.currency),
      editionCount: record.editionCount,
      remainingCount,
      allocation,
    };
  } catch (error) {
    console.error("Falling back to static Local No. 001 record", error);
    return local001;
  }
}

export async function getPublicDashboardSnapshot(): Promise<PublicDashboardSnapshot> {
  if (!databaseReadsEnabled()) {
    return dashboardSnapshot;
  }

  try {
    const record = await prisma.dashboardSnapshot.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!record) {
      return dashboardSnapshot;
    }

    return {
      currentLocal: record.currentLocal,
      localStatus: record.localStatus,
      lastAgentAction: record.lastSanitizedAction,
      uptime: record.uptime,
      fulfilledThisMonth: record.fulfilledThisMonth,
    };
  } catch (error) {
    console.error("Falling back to static dashboard snapshot", error);
    return dashboardSnapshot;
  }
}
