-- Stage 3.3: Billing skeleton
-- Adds BillingCustomer, Subscription, PlanEntitlement, UsageMeter, InvoiceEvent
-- Extends AuditAction enum with billing, project, document, workflow, export actions

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID', 'PAUSED');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'ANNUAL');

-- AlterEnum: extend AuditAction with new values
ALTER TYPE "AuditAction" ADD VALUE 'BILLING_SUBSCRIPTION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'BILLING_SUBSCRIPTION_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'BILLING_SUBSCRIPTION_CANCELED';
ALTER TYPE "AuditAction" ADD VALUE 'BILLING_PAYMENT_SUCCEEDED';
ALTER TYPE "AuditAction" ADD VALUE 'BILLING_PAYMENT_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'PROJECT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'PROJECT_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'DOCUMENT_UPLOADED';
ALTER TYPE "AuditAction" ADD VALUE 'DOCUMENT_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'WORKFLOW_STARTED';
ALTER TYPE "AuditAction" ADD VALUE 'WORKFLOW_CANCELED';
ALTER TYPE "AuditAction" ADD VALUE 'EXPORT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'OUTPUT_APPROVED';

-- CreateTable: BillingCustomer
CREATE TABLE "BillingCustomer" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "billingEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Subscription
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "billingCustomerId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "stripePriceId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "interval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PlanEntitlement
CREATE TABLE "PlanEntitlement" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "maxSeats" INTEGER NOT NULL DEFAULT 1,
    "maxProjects" INTEGER NOT NULL DEFAULT 3,
    "maxUploadsMonth" INTEGER NOT NULL DEFAULT 20,
    "maxRunsMonth" INTEGER NOT NULL DEFAULT 5,
    "maxExportsMonth" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UsageMeter
CREATE TABLE "UsageMeter" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "uploadsCount" INTEGER NOT NULL DEFAULT 0,
    "runsCount" INTEGER NOT NULL DEFAULT 0,
    "exportsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageMeter_pkey" PRIMARY KEY ("id")
);

-- CreateTable: InvoiceEvent
CREATE TABLE "InvoiceEvent" (
    "id" TEXT NOT NULL,
    "firmId" TEXT,
    "stripeEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingCustomer_firmId_key" ON "BillingCustomer"("firmId");
CREATE UNIQUE INDEX "BillingCustomer_stripeCustomerId_key" ON "BillingCustomer"("stripeCustomerId");
CREATE INDEX "BillingCustomer_stripeCustomerId_idx" ON "BillingCustomer"("stripeCustomerId");

CREATE UNIQUE INDEX "Subscription_billingCustomerId_key" ON "Subscription"("billingCustomerId");
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");
CREATE INDEX "Subscription_stripeSubscriptionId_idx" ON "Subscription"("stripeSubscriptionId");
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

CREATE UNIQUE INDEX "PlanEntitlement_firmId_key" ON "PlanEntitlement"("firmId");

CREATE UNIQUE INDEX "UsageMeter_firmId_key" ON "UsageMeter"("firmId");

CREATE UNIQUE INDEX "InvoiceEvent_stripeEventId_key" ON "InvoiceEvent"("stripeEventId");
CREATE INDEX "InvoiceEvent_firmId_processedAt_idx" ON "InvoiceEvent"("firmId", "processedAt");
CREATE INDEX "InvoiceEvent_stripeEventId_idx" ON "InvoiceEvent"("stripeEventId");

-- AddForeignKey
ALTER TABLE "BillingCustomer" ADD CONSTRAINT "BillingCustomer_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_billingCustomerId_fkey" FOREIGN KEY ("billingCustomerId") REFERENCES "BillingCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanEntitlement" ADD CONSTRAINT "PlanEntitlement_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageMeter" ADD CONSTRAINT "UsageMeter_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceEvent" ADD CONSTRAINT "InvoiceEvent_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
