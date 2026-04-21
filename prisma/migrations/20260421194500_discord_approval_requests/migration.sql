-- CreateEnum
CREATE TYPE "ApprovalRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "localId" INTEGER,
    "jobRunId" TEXT,
    "requestId" TEXT NOT NULL,
    "actionClass" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "targetSurface" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "specVersion" TEXT NOT NULL,
    "publicDestination" TEXT,
    "affectedObject" TEXT,
    "requestedBy" TEXT NOT NULL,
    "proposedApprovalId" TEXT,
    "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "resolutionReason" TEXT,
    "discordChannelId" TEXT,
    "discordMessageId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByDiscordUserId" TEXT,
    "resolvedByDiscordUsername" TEXT,
    "approvalId" TEXT,
    "notes" TEXT,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRequest_requestId_key" ON "ApprovalRequest"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRequest_discordMessageId_key" ON "ApprovalRequest"("discordMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRequest_approvalId_key" ON "ApprovalRequest"("approvalId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_status_requestedAt_idx" ON "ApprovalRequest"("status", "requestedAt");

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_jobRunId_fkey" FOREIGN KEY ("jobRunId") REFERENCES "HermesJobRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
