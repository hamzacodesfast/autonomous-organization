-- CreateEnum
CREATE TYPE "TokenRegistryStatus" AS ENUM ('ACTIVE', 'DORMANT', 'ROTATED', 'REVOKED');

-- AlterTable
ALTER TABLE "Approval"
ADD COLUMN "linkedObjectIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "publicDestination" TEXT,
ADD COLUMN "sourceChannel" TEXT;

-- AlterTable
ALTER TABLE "TokenRegistryEntry"
ADD COLUMN "credentialNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "notes" TEXT,
ADD COLUMN "status" "TokenRegistryStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "TokenRegistryEntry"
ALTER COLUMN "credentialNames" DROP DEFAULT;
