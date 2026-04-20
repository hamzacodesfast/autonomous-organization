-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "LocalState" AS ENUM ('CONCEPT_DRAFT', 'DESIGN_DRAFT', 'COMPLIANCE_REVIEW', 'COSTING_REVIEW', 'HUMAN_APPROVAL', 'SCHEDULED', 'LIVE', 'FULFILLMENT', 'ARCHIVED', 'RETIRED');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'ALLOCATED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'PAID', 'FULFILLMENT_PENDING', 'FULFILLED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('NOT_SUBMITTED', 'SUBMITTED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED', 'NEEDS_CHANGES');

-- CreateEnum
CREATE TYPE "ActionState" AS ENUM ('SUCCESS', 'FAILURE', 'ROLLBACK');

-- CreateTable
CREATE TABLE "Local" (
    "id" SERIAL NOT NULL,
    "localNumber" TEXT NOT NULL,
    "conceptSentence" TEXT NOT NULL,
    "state" "LocalState" NOT NULL,
    "approvedBlank" TEXT NOT NULL,
    "supplier" TEXT,
    "printProvider" TEXT,
    "garmentColorways" TEXT[],
    "editionCount" INTEGER NOT NULL,
    "retailPriceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "launchTimestamp" TIMESTAMP(3),
    "productCopy" TEXT,
    "socialCopy" TEXT,
    "sourceLicenseNotes" TEXT,
    "archiveUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Local_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalSku" (
    "id" SERIAL NOT NULL,
    "localId" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "editionCeiling" INTEGER NOT NULL,
    "allocatedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalSku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryReservation" (
    "id" TEXT NOT NULL,
    "localSkuId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "allocatedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stripeSessionId" TEXT,

    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "customerEmail" TEXT,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" TEXT NOT NULL,
    "localId" INTEGER NOT NULL,
    "localSkuId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCents" INTEGER NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "stripeCheckoutSession" TEXT,
    "stripePaymentIntent" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FulfillmentOrder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "FulfillmentStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "printifyOrderId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FulfillmentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "localId" INTEGER,
    "approver" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "scope" TEXT NOT NULL,
    "specVersion" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionLog" (
    "id" TEXT NOT NULL,
    "localId" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "agentName" TEXT NOT NULL,
    "actionClass" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "affectedObject" TEXT,
    "approvalId" TEXT,
    "publicUrl" TEXT,
    "state" "ActionState" NOT NULL,
    "summary" TEXT NOT NULL,

    CONSTRAINT "ActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "localId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "checksum" TEXT,
    "sourceNotes" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentDraft" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "localNumber" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "decision" TEXT,

    CONSTRAINT "AgentDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardSnapshot" (
    "id" TEXT NOT NULL,
    "currentLocal" TEXT NOT NULL,
    "localStatus" TEXT NOT NULL,
    "lastSanitizedAction" TEXT NOT NULL,
    "uptime" TEXT NOT NULL,
    "fulfilledThisMonth" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "payloadHash" TEXT NOT NULL,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Local_localNumber_key" ON "Local"("localNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LocalSku_sku_key" ON "LocalSku"("sku");

-- CreateIndex
CREATE INDEX "LocalSku_localId_idx" ON "LocalSku"("localId");

-- CreateIndex
CREATE INDEX "LocalSku_size_color_idx" ON "LocalSku"("size", "color");

-- CreateIndex
CREATE INDEX "InventoryReservation_localSkuId_status_idx" ON "InventoryReservation"("localSkuId", "status");

-- CreateIndex
CREATE INDEX "InventoryReservation_expiresAt_idx" ON "InventoryReservation"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_reservationId_key" ON "Order"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripeCheckoutSession_key" ON "Payment"("stripeCheckoutSession");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripePaymentIntent_key" ON "Payment"("stripePaymentIntent");

-- CreateIndex
CREATE UNIQUE INDEX "FulfillmentOrder_orderId_key" ON "FulfillmentOrder"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "FulfillmentOrder_printifyOrderId_key" ON "FulfillmentOrder"("printifyOrderId");

-- AddForeignKey
ALTER TABLE "LocalSku" ADD CONSTRAINT "LocalSku_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_localSkuId_fkey" FOREIGN KEY ("localSkuId") REFERENCES "LocalSku"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "InventoryReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_localSkuId_fkey" FOREIGN KEY ("localSkuId") REFERENCES "LocalSku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentOrder" ADD CONSTRAINT "FulfillmentOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionLog" ADD CONSTRAINT "ActionLog_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE CASCADE ON UPDATE CASCADE;

