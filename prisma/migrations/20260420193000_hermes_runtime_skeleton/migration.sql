-- CreateEnum
CREATE TYPE "ActionLogPhase" AS ENUM ('BEFORE', 'AFTER');

-- CreateEnum
CREATE TYPE "HermesJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILURE', 'BLOCKED', 'ROLLBACK', 'CANCELLED');

-- AlterTable
ALTER TABLE "ActionLog"
ADD COLUMN "jobRunId" TEXT,
ADD COLUMN "phase" "ActionLogPhase" NOT NULL DEFAULT 'AFTER';

-- CreateTable
CREATE TABLE "HermesRuntimeControl" (
    "id" TEXT NOT NULL,
    "runtimeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "killSwitchActive" BOOLEAN NOT NULL DEFAULT false,
    "queueState" TEXT NOT NULL DEFAULT 'idle',
    "lastHeartbeatAt" TIMESTAMP(3),
    "heartbeatIntervalSeconds" INTEGER NOT NULL DEFAULT 300,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HermesRuntimeControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HermesJobRun" (
    "id" TEXT NOT NULL,
    "localId" INTEGER,
    "jobName" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "actionClass" TEXT NOT NULL,
    "targetSurface" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "approvalId" TEXT,
    "affectedObject" TEXT,
    "publicUrl" TEXT,
    "status" "HermesJobStatus" NOT NULL DEFAULT 'QUEUED',
    "retryBudget" INTEGER NOT NULL DEFAULT 0,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "summary" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "HermesJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenRegistryEntry" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "ownerAccount" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "scopes" TEXT[],
    "createdDate" TIMESTAMP(3) NOT NULL,
    "expirationDate" TIMESTAMP(3),
    "nextRotationDate" TIMESTAMP(3),
    "storageLocation" TEXT NOT NULL,
    "lastSuccessfulUse" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenRegistryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionLog_jobRunId_idx" ON "ActionLog"("jobRunId");

-- CreateIndex
CREATE INDEX "ActionLog_requestId_phase_idx" ON "ActionLog"("requestId", "phase");

-- CreateIndex
CREATE INDEX "HermesJobRun_status_requestedAt_idx" ON "HermesJobRun"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "HermesJobRun_jobName_requestedAt_idx" ON "HermesJobRun"("jobName", "requestedAt");

-- CreateIndex
CREATE INDEX "HermesJobRun_requestId_idx" ON "HermesJobRun"("requestId");

-- CreateIndex
CREATE INDEX "TokenRegistryEntry_platform_environment_idx" ON "TokenRegistryEntry"("platform", "environment");

-- AddForeignKey
ALTER TABLE "ActionLog" ADD CONSTRAINT "ActionLog_jobRunId_fkey" FOREIGN KEY ("jobRunId") REFERENCES "HermesJobRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HermesJobRun" ADD CONSTRAINT "HermesJobRun_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE SET NULL ON UPDATE CASCADE;
