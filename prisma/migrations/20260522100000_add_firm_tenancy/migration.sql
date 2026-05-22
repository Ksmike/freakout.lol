-- CreateEnum
CREATE TYPE "FirmRole" AS ENUM ('OWNER', 'ADMIN', 'PARTNER', 'ANALYST', 'REVIEWER', 'VIEWER');

-- CreateEnum
CREATE TYPE "FirmMembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "Firm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "billingStatus" TEXT NOT NULL DEFAULT 'trialing',
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "region" TEXT,
    "dataRetentionDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Firm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmMembership" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "FirmRole" NOT NULL DEFAULT 'OWNER',
    "status" "FirmMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "invitedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmMembership_pkey" PRIMARY KEY ("id")
);

-- Add nullable first so existing projects can be backfilled.
ALTER TABLE "Project" ADD COLUMN "firmId" TEXT;

-- Backfill one default firm per user.
INSERT INTO "Firm" ("id", "name", "slug", "createdAt", "updatedAt")
SELECT
    'firm_' || "id",
    COALESCE(NULLIF("name", ''), split_part("email", '@', 1), 'Default Firm'),
    'default-' || regexp_replace(lower("id"), '[^a-z0-9-]', '-', 'g'),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User";

INSERT INTO "FirmMembership" ("id", "firmId", "userId", "role", "status", "acceptedAt", "createdAt", "updatedAt")
SELECT
    'fmem_' || "id",
    'firm_' || "id",
    "id",
    'OWNER',
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User";

UPDATE "Project"
SET "firmId" = 'firm_' || "userId"
WHERE "firmId" IS NULL;

ALTER TABLE "Project" ALTER COLUMN "firmId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Firm_slug_key" ON "Firm"("slug");

-- CreateIndex
CREATE INDEX "Firm_billingStatus_idx" ON "Firm"("billingStatus");

-- CreateIndex
CREATE INDEX "Firm_plan_idx" ON "Firm"("plan");

-- CreateIndex
CREATE UNIQUE INDEX "FirmMembership_firmId_userId_key" ON "FirmMembership"("firmId", "userId");

-- CreateIndex
CREATE INDEX "FirmMembership_userId_status_idx" ON "FirmMembership"("userId", "status");

-- CreateIndex
CREATE INDEX "FirmMembership_firmId_role_idx" ON "FirmMembership"("firmId", "role");

-- CreateIndex
CREATE INDEX "Project_firmId_createdAt_idx" ON "Project"("firmId", "createdAt");

-- CreateIndex
CREATE INDEX "Project_firmId_status_idx" ON "Project"("firmId", "status");

-- AddForeignKey
ALTER TABLE "FirmMembership" ADD CONSTRAINT "FirmMembership_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmMembership" ADD CONSTRAINT "FirmMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
